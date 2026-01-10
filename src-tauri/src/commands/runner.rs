use tauri::{State, Window, Emitter};
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::{BufReader, BufRead, Write};
use std::thread;

pub struct ServerProcessState {
    pub processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl ServerProcessState {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub fn start_server(
    window: Window,
    app_handle: tauri::AppHandle,
    state: State<'_, ServerProcessState>,
    id: String,
    path: String,
    jar_file: String,
    ram: u32,
    java_path: Option<String>,
    startup_flags: Option<String>,
) -> Result<String, String> {
    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;

    if processes.contains_key(&id) {
        return Err("Server is already running".to_string());
    }

    let server_path = std::path::Path::new(&path);
    // Verify Server Path
    if !server_path.exists() {
        let _ = window.emit("debug-log", format!("CRITICAL: Server path does not exist: {:?}", server_path));
        return Err("Server directory not found".to_string());
    } else {
        let _ = window.emit("debug-log", format!("Server path exists: {:?}", server_path));
    }

    // Construct args
    let mut cmd;
    
    if jar_file.ends_with(".jar") || jar_file.ends_with(".phar") {
        let bin = if jar_file.ends_with(".phar") { "php" } else { "java" };
        let java_bin = java_path.unwrap_or_else(|| bin.to_string());
        
        let mut final_bin = java_bin.clone();

        // ---------------------------------------------------------
        // LOGIC SPLIT: ANDROID vs DESKTOP
        // ---------------------------------------------------------
        
        // Desktop Logic
        let local_php = server_path.join("bin/php");
        // Check for bundled PHP (e.g. if user manually put it there or we support it later)
        if jar_file.ends_with(".phar") && local_php.exists() {
             final_bin = local_php.to_string_lossy().to_string();
        }

        // ---------------------------------------------------------

        // Ensure Android binary AND libraries are executable (Recursive Fix)

        
        let _ = window.emit("debug-log", format!("Launching: {} CWD: {:?}", final_bin, server_path));
        
        cmd = Command::new(&final_bin);
        // Set env vars for libraries if needed

        
        // Important: PocketMine MUST run in the server directory
        cmd.current_dir(server_path); 

        // Add RAM args first only for Java
        if !jar_file.ends_with(".phar") {
            cmd.arg(format!("-Xmx{}M", ram));
            cmd.arg(format!("-Xms{}M", ram));
        }
        
        // Add Custom Flags
        if let Some(flags) = startup_flags {
            for flag in flags.split_whitespace() {
                 cmd.arg(flag);
            }
        }
        
        if jar_file.ends_with(".phar") {
             cmd.arg(&jar_file);
        } else {
             cmd.arg("-jar").arg(&jar_file).arg("nogui");
        }
    } else {
        // Binary execution (exe or linux binary)


        cmd = Command::new(server_path.join(&jar_file));
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
    
    // Spawn threads to read stdout/stderr and emit events
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    let window_clone = window.clone();
    let id_clone = id.clone();
    let log_path = server_path.join("server_console.log");
    let log_path_err = log_path.clone();

    // Clone log path for threads. We use simple append.
    // Ideally we would use a Mutex<File> but independent opens in append mode usually work on OS level for logs (interleaved).
    
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone.emit(&format!("server-log:{}", id_clone), &l);
                // Persistence
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                    let _ = writeln!(file, "{}", l);
                }
            }
        }
    });

    let window_clone_err = window.clone();
    let id_clone_err = id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                 let _ = window_clone_err.emit(&format!("server-log:{}", id_clone_err), &l);
                 // Persistence
                 if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path_err) {
                    let _ = writeln!(file, "{}", l);
                }
            }
        }
    });

    processes.insert(id, child);
    Ok("Server started".into())
}

#[tauri::command]
pub fn stop_server(
    state: State<'_, ServerProcessState>,
    id: String
) -> Result<String, String> {
    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = processes.remove(&id) {
        // Try graceful stop first
        if let Some(mut stdin) = child.stdin.take() {
            let _ = writeln!(stdin, "stop");
        }
        
        // Give it time, or kill
        // detailed implementation can poll exit status, for now assuming it stops or we kill it
        // Simpler for MVP: just kill if valid
        let _ = child.kill(); 
        
        Ok("Server stopped".into())
    } else {
        Err("Server not running".into())
    }
}

#[tauri::command]
pub fn send_server_command(
    state: State<'_, ServerProcessState>,
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
        let pid = child.id(); // u32
        
        // Lock system
        let mut sys = sys_state.sys.lock().map_err(|e| e.to_string())?;
        
        // Refresh ALL processes to get accurate child process info
        use sysinfo::Pid;
        sys.refresh_processes();
        
        let sys_pid = Pid::from_u32(pid);
        
        // Sum up resources from the main process AND all its children
        let mut total_cpu: f32 = 0.0;
        let mut total_ram: u64 = 0;
        
        // Get the main process
        if let Some(proc) = sys.process(sys_pid) {
            total_cpu += proc.cpu_usage();
            total_ram += proc.memory();
        }
        
        // Also sum all child processes (Java may spawn multiple threads/processes)
        for (proc_pid, proc) in sys.processes() {
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
    
    // If not found or not running
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
    
    // Create new empty file or truncate existing
    std::fs::File::create(&log_path)
        .map_err(|e| format!("Failed to clear log file: {}", e))?;
        
    Ok(())
}
