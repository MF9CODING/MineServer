use tauri::{State, WebviewWindow, Emitter};
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::collections::{HashMap, HashSet};
use std::io::{BufReader, BufRead, Write};
use std::thread;
use std::time::Duration;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub path: String,
    pub jar_file: String,
    pub ram: u32,
    pub java_path: Option<String>,
    pub startup_flags: Option<String>,
    pub auto_restart: bool,
}

pub struct ServerProcessState {
    pub processes: Arc<Mutex<HashMap<String, Child>>>,
    pub explicit_stops: Arc<Mutex<HashSet<String>>>,
    pub configs: Arc<Mutex<HashMap<String, ServerConfig>>>,
}

impl ServerProcessState {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
            explicit_stops: Arc::new(Mutex::new(HashSet::new())),
            configs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// Internal helper to spawn process
fn spawn_process_internal(
    window: WebviewWindow,
    config: &ServerConfig
) -> Result<Child, String> {
    let server_path = std::path::Path::new(&config.path);
    if !server_path.exists() {
        return Err("Server directory not found".to_string());
    }

    // Auto-Accept EULA
    let eula_path = server_path.join("eula.txt");
    // Check if it exists or if it explicitly says false
    // We just force write eula=true to be robust
    if let Ok(content) = std::fs::read_to_string(&eula_path) {
        if !content.contains("eula=true") {
             let _ = std::fs::write(&eula_path, "eula=true");
        }
    } else {
         let _ = std::fs::write(&eula_path, "eula=true");
    }

    let mut cmd;
    
    // NeoForge/Forge Support: Check for run.bat/run.sh scripts first
    let run_script_win = server_path.join("run.bat");
    let run_script_unix = server_path.join("run.sh");
    
    let has_run_script = if cfg!(target_os = "windows") {
        run_script_win.exists()
    } else {
        run_script_unix.exists()
    };
    
    if has_run_script {
        // NeoForge/Forge server - use the bundled run script
        let _ = window.emit("debug-log", format!("[NeoForge/Forge] Detected run script, using it to start server"));
        
        #[cfg(target_os = "windows")]
        {
            cmd = Command::new("cmd");
            cmd.arg("/C").arg("run.bat");
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            cmd = Command::new("bash");
            cmd.arg("run.sh");
        }
        
        cmd.current_dir(server_path);
        
        // Set JVM memory args via environment variable (NeoForge respects this)
        cmd.env("JVM_ARGS", format!("-Xmx{}M -Xms{}M", config.ram, config.ram));
        
        // Also set JAVA_TOOL_OPTIONS as fallback
        let mut java_opts = format!("-Xmx{}M -Xms{}M", config.ram, config.ram);
        if let Some(flags) = &config.startup_flags {
            java_opts.push_str(" ");
            java_opts.push_str(flags);
        }
        // Note: We set env but some scripts override. User can edit user_jvm_args.txt for persistent settings.
        
    } else if config.jar_file.ends_with(".jar") || config.jar_file.ends_with(".phar") {
        // Standard server (Vanilla, Paper, Spigot, Fabric, PocketMine)
        let bin = if config.jar_file.ends_with(".phar") { "php" } else { "java" };
        let java_bin = config.java_path.clone().unwrap_or_else(|| bin.to_string());
        
        let mut final_bin = java_bin.clone();

        // Desktop Logic for PHP
        let local_php = server_path.join("bin/php");
        if config.jar_file.ends_with(".phar") && local_php.exists() {
             final_bin = local_php.to_string_lossy().to_string();
        }

        let _ = window.emit("debug-log", format!("Launching: {} CWD: {:?}", final_bin, server_path));
        
        cmd = Command::new(&final_bin);
        cmd.current_dir(server_path); 

        // Add RAM args first only for Java
        if !config.jar_file.ends_with(".phar") {
            cmd.arg(format!("-Xmx{}M", config.ram));
            cmd.arg(format!("-Xms{}M", config.ram));
        }
        
        // Add Custom Flags
        if let Some(flags) = &config.startup_flags {
            for flag in flags.split_whitespace() {
                 cmd.arg(flag);
            }
        }
        
        if config.jar_file.ends_with(".phar") {
             cmd.arg(&config.jar_file);
        } else {
             cmd.arg("-jar").arg(&config.jar_file).arg("nogui");
        }
    } else {
        // Binary execution (Bedrock, custom executables)
        cmd = Command::new(server_path.join(&config.jar_file));
        cmd.current_dir(server_path);
    }

    cmd.stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .stdin(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start server: {}", e))?;
    
    // Wire up logs
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    let window_clone = window.clone();
    let id_clone = config.id.clone();
    let log_path = server_path.join("server_console.log");
    
    // Stdout Thread
    let lp = log_path.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone.emit(&format!("server-log:{}", id_clone), &l);
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&lp) {
                    let _ = writeln!(file, "{}", l);
                }
            }
        }
    });

    // Stderr Thread
    let window_clone_err = window.clone();
    let id_clone_err = config.id.clone();
    let lp_err = log_path.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                 let _ = window_clone_err.emit(&format!("server-log:{}", id_clone_err), &l);
                 if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&lp_err) {
                    let _ = writeln!(file, "{}", l);
                }
            }
        }
    });

    Ok(child)
}

pub fn start_server_direct(
    window: WebviewWindow,
    state: &ServerProcessState,
    id: String,
    path: String,
    jar_file: String,
    ram: u32,
    java_path: Option<String>,
    startup_flags: Option<String>,
    auto_restart: Option<bool>,
) -> Result<String, String> {
    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;

    if processes.contains_key(&id) {
        return Err("Server is already running".to_string());
    }

    // Reset explicit stop flag
    if let Ok(mut express_stops) = state.explicit_stops.lock() {
        express_stops.remove(&id);
    }

    let config = ServerConfig {
        id: id.clone(),
        path,
        jar_file,
        ram,
        java_path,
        startup_flags,
        auto_restart: auto_restart.unwrap_or(false),
    };

    // Store config for restarts
    if let Ok(mut configs) = state.configs.lock() {
        configs.insert(id.clone(), config.clone());
    }

    // Spawn Process
    let child = spawn_process_internal(window.clone(), &config)?;
    
    // Store process
    processes.insert(id.clone(), child);
    
    // Spawn Monitor Thread
    let processes_arc = state.processes.clone();
    let explicit_stops_arc = state.explicit_stops.clone();
    let configs_arc = state.configs.clone();
    let window_monitor = window.clone();
    let monitor_id = id.clone();

    thread::spawn(move || {
        monitor_server_loop(monitor_id, window_monitor, processes_arc, explicit_stops_arc, configs_arc);
    });

    Ok("Server started".into())
}

#[tauri::command]
pub fn start_server(
    window: WebviewWindow,
    state: State<'_, ServerProcessState>,
    id: String,
    path: String,
    jar_file: String,
    ram: u32,
    java_path: Option<String>,
    startup_flags: Option<String>,
    auto_restart: Option<bool>,
) -> Result<String, String> {
    start_server_direct(window, state.inner(), id, path, jar_file, ram, java_path, startup_flags, auto_restart)
}

// Logic to monitor and restart
fn monitor_server_loop(
    id: String,
    window: WebviewWindow,
    processes: Arc<Mutex<HashMap<String, Child>>>,
    explicit_stops: Arc<Mutex<HashSet<String>>>,
    configs: Arc<Mutex<HashMap<String, ServerConfig>>>
) {
    loop {
        // Polling loop
        thread::sleep(Duration::from_secs(2));

        let mut is_running = false;
        
        // Check Status
        {
            if let Ok(mut procs) = processes.lock() {
                if let Some(child) = procs.get_mut(&id) {
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            is_running = false; // Exited
                        },
                        Ok(None) => {
                            is_running = true; // Still running
                        },
                        Err(_) => {
                            is_running = false;
                        }
                    }
                } else {
                    // Removed from map -> likely stopped or crashed and cleaned up already
                    return; 
                }
            }
        }

        if is_running {
            continue;
        }

        // Process has exited.
        // Remove from map first
        {
            if let Ok(mut procs) = processes.lock() {
                procs.remove(&id);
            }
        }

        let _ = window.emit("server-stopped", &id);

        // Check if explicit stop
        let was_explicit_stop = {
            if let Ok(stops) = explicit_stops.lock() {
                stops.contains(&id)
            } else {
                false
            }
        };

        if was_explicit_stop {
            let _ = window.emit(&format!("server-log:{}", id), format!("Server {} stopped (User Initiated).", id));
            break; // Exit monitor
        }

        // Check Auto Restart
        let config = {
            let confs = configs.lock().unwrap();
            confs.get(&id).cloned()
        };

        if let Some(cfg) = config {
            if cfg.auto_restart {
                let _ = window.emit(&format!("server-log:{}", id), format!("Server {} crashed/stopped. Auto-restarting in 3s...", id));
                // Wait
                thread::sleep(Duration::from_secs(3));
                
                // Restart
                match spawn_process_internal(window.clone(), &cfg) {
                    Ok(new_child) => {
                        let _ = window.emit("server-started", &id); // Notify UI
                        if let Ok(mut procs) = processes.lock() {
                            procs.insert(id.clone(), new_child);
                        }
                        // Loop continues to monitor new process
                    },
                    Err(e) => {
                        let _ = window.emit(&format!("server-log:{}", id), format!("Failed to auto-restart: {}", e));
                        break;
                    }
                }
            } else {
                // No auto restart
                 break;
            }
        } else {
            break;
        }
    }
}

pub fn stop_server_direct(
    state: &ServerProcessState,
    id: String
) -> Result<String, String> {
    // 1. Mark as explicit stop
    {
        let mut express = state.explicit_stops.lock().map_err(|e| e.to_string())?;
        express.insert(id.clone());
    }

    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = processes.remove(&id) {
        // Try graceful stop
        if let Some(mut stdin) = child.stdin.take() {
             // For Java servers, "stop" is standard. For Bedrock, also "stop".
            let _ = writeln!(stdin, "stop");
        }

        // Wait up to 10 seconds
        let start = std::time::Instant::now();
        loop {
            match child.try_wait() {
                Ok(Some(_)) => return Ok("Server stopped gracefully".into()),
                Ok(None) => {
                    if start.elapsed().as_secs() > 10 {
                        let _ = child.kill();
                        return Ok("Server stopped (Forced)".into());
                    }
                    thread::sleep(Duration::from_millis(500));
                },
                Err(_) => {
                     let _ = child.kill();
                     return Ok("Server stopped".into());
                }
            }
        }
    } else {
        Err("Server not running".into())
    }
}

#[tauri::command]
pub fn stop_server(
    state: State<'_, ServerProcessState>,
    id: String
) -> Result<String, String> {
    stop_server_direct(state.inner(), id)
}

pub fn send_server_command_direct(
    state: &ServerProcessState,
    id: String,
    command: String
) -> Result<(), String> {
    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;

    if let Some(child) = processes.get_mut(&id) {
        if let Some(stdin) = child.stdin.as_mut() {
            writeln!(stdin, "{}", command).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("Server not running or stdin unavailable".into())
}

#[tauri::command]
pub fn send_server_command(
    state: State<'_, ServerProcessState>,
    id: String,
    command: String
) -> Result<(), String> {
    send_server_command_direct(state.inner(), id, command)
}

#[tauri::command]
pub fn is_server_running(
    state: State<'_, ServerProcessState>,
    id: String
) -> bool {
    if let Ok(processes) = state.processes.lock() {
        processes.contains_key(&id)
    } else {
        false
    }
}

#[derive(serde::Serialize)]
pub struct ResourceUsage {
    cpu: f32,
    ram: u64,
}

#[tauri::command]
pub fn get_server_resource_usage(
    proc_state: State<'_, ServerProcessState>,
    sys_state: State<'_, super::system::SystemState>,
    id: String
) -> Result<ResourceUsage, String> {
    let processes = proc_state.processes.lock().map_err(|e| e.to_string())?;
    
    if let Some(child) = processes.get(&id) {
        let pid = child.id(); 
        
        let mut sys = sys_state.sys.lock().map_err(|e| e.to_string())?;
        use sysinfo::Pid;
        sys.refresh_processes();
        let sys_pid = Pid::from_u32(pid);
        
        let mut total_cpu: f32 = 0.0;
        let mut total_ram: u64 = 0;
        
        if let Some(proc) = sys.process(sys_pid) {
            total_cpu += proc.cpu_usage();
            total_ram += proc.memory();
        }
        
        for (_proc_pid, proc) in sys.processes() {
            if let Some(parent_pid) = proc.parent() {
                if parent_pid == sys_pid {
                    total_cpu += proc.cpu_usage();
                    total_ram += proc.memory();
                }
            }
        }
        
        return Ok(ResourceUsage {
            cpu: total_cpu,
            ram: total_ram,
        });
    }
    
    Ok(ResourceUsage { cpu: 0.0, ram: 0 })
}

#[tauri::command]
pub fn get_running_servers(
    state: State<'_, ServerProcessState>
) -> Vec<String> {
    if let Ok(processes) = state.processes.lock() {
        processes.keys().cloned().collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn clear_log_file(path: String) -> Result<(), String> {
    let log_path = std::path::Path::new(&path).join("server_console.log");
    std::fs::File::create(&log_path)
        .map_err(|e| format!("Failed to clear log file: {}", e))?;
    Ok(())
}
