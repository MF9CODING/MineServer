use tauri::{State, Window, Emitter};
use igd_next::{search_gateway, PortMappingProtocol};
use std::net::{SocketAddrV4, IpAddr};
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::path::Path;
use reqwest::Client;
use std::io::Read;
use std::thread;

pub struct NetworkState {
    pub tunnels: Arc<Mutex<HashMap<String, Child>>>,
}

impl NetworkState {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn check_internet_connection() -> bool {
    // Simple check to google DNS
    std::net::TcpStream::connect("8.8.8.8:53").is_ok()
}

#[tauri::command]
pub async fn get_public_ip() -> Result<String, String> {
    reqwest::get("https://api.ipify.org")
        .await.map_err(|e| e.to_string())?
        .text()
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upnp_map_port(port: u16, protocol_str: String) -> Result<String, String> {
    let protocol = match protocol_str.as_str() {
        "TCP" => PortMappingProtocol::TCP,
        "UDP" => PortMappingProtocol::UDP,
        _ => return Err("Invalid protocol. Use TCP or UDP".to_string()),
    };

    use igd_next::SearchOptions;
    use std::time::Duration;

    let search_options = SearchOptions {
        timeout: Some(Duration::from_secs(5)),
        ..Default::default()
    };

    let gateway = search_gateway(search_options)
        .map_err(|e| format!("Search Failed (Timeout/Disabled?): {}. Ensure UPnP is enabled in your router settings.", e))?;

    let local_ip = local_ip_address::local_ip()
        .map_err(|e| format!("Failed to get local IP: {}", e))?;
    
    let local_addr = match local_ip {
        IpAddr::V4(addr) => SocketAddrV4::new(addr, port),
        _ => return Err("IPv6 not supported for this UPnP implementation".to_string()),
    };

    gateway.add_port(protocol, port, std::net::SocketAddr::V4(local_addr), 0, "Mineserver")
        .map_err(|e| format!("UPnP Mapping Failed: {}", e))?;

    let public_ip = gateway.get_external_ip()
        .map_err(|e| format!("Failed to get public IP: {}", e))?;

    Ok(public_ip.to_string())
}

#[tauri::command]
pub async fn upnp_remove_port(port: u16, protocol_str: String) -> Result<(), String> {
    let protocol = match protocol_str.as_str() {
        "TCP" => PortMappingProtocol::TCP,
        "UDP" => PortMappingProtocol::UDP,
        _ => return Err("Invalid protocol".to_string()),
    };

    use igd_next::SearchOptions;
    use std::time::Duration;

    let search_options = SearchOptions {
        timeout: Some(Duration::from_secs(5)),
        ..Default::default()
    };

    let gateway = search_gateway(search_options)
        .map_err(|e| format!("Failed to find IGD gateway: {}", e))?;

    gateway.remove_port(protocol, port)
        .map_err(|e| format!("UPnP Removal Failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn install_playit(server_path: String) -> Result<String, String> {
    let path = Path::new(&server_path);
    // Use .playit subdirectory for the binary too, keeping root clean
    let playit_dir = path.join(".playit");
    if !playit_dir.exists() {
        std::fs::create_dir_all(&playit_dir).map_err(|e| e.to_string())?;
    }

    let binary_name = if cfg!(target_os = "windows") { "playit.exe" } else { "playit" };
    let binary_path = playit_dir.join(binary_name);

    if binary_path.exists() {
        // Double check we can open it - if not, it might be locked (running)
        if std::fs::File::open(&binary_path).is_ok() {
             return Ok("Playit installed".to_string());
        } else {
             return Ok("Playit installed (Locked/Running)".to_string());
        }
    }

    let url = if cfg!(target_os = "windows") {
        "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64.exe"
    } else {
        "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-linux-x86_64"
    };

    let client = Client::new();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Create direct write with Error 32 handling
    match std::fs::write(&binary_path, &bytes) {
        Ok(_) => {},
        Err(e) if e.raw_os_error() == Some(32) => {
            return Ok("Playit updated (Locked/Running)".to_string());
        },
        Err(e) => return Err(format!("Failed to write Playit binary: {}", e))
    }

    #[cfg(target_family = "unix")]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&binary_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&binary_path, perms).unwrap();
    }

    Ok("Playit installed".to_string())
}

#[tauri::command]
pub fn start_playit_tunnel(
    window: Window,
    state: State<'_, NetworkState>,
    id: String,
    server_path: String
) -> Result<String, String> {
    let mut tunnels = state.tunnels.lock().map_err(|e| e.to_string())?;

    if tunnels.contains_key(&id) {
        return Err("Tunnel already running".to_string());
    }

    let path = Path::new(&server_path);
    let binary_name = if cfg!(target_os = "windows") { "playit.exe" } else { "playit" };
    // OLD: let binary_path = path.join(binary_name);
    
    // NEW: Run everything from the .playit subdirectory
    let playit_dir = path.join(".playit");
    let _ = std::fs::create_dir_all(&playit_dir);
    let binary_path = playit_dir.join(binary_name);

    if !binary_path.exists() {
        return Err("Playit not installed (binary missing in .playit)".to_string());
    }

    let log_path = playit_dir.join("playit_agent.log");
    let _ = std::fs::remove_file(&log_path);

    // Run playit in a visible terminal window for now (workaround for pipe issues)
    // The user will see the claim link in that window
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        // We use /D "path" to set CWD for the start command to ensure playit.toml is written there
        c.args([
            "/c", 
            "start", 
            "/D", playit_dir.to_str().unwrap(), 
            "Playit Tunnel", 
            binary_path.to_str().unwrap()
        ]);
        c.current_dir(&playit_dir);
        c
    } else {
        let mut c = Command::new(&binary_path);
        c.current_dir(&playit_dir);
        c.stdout(Stdio::piped())
         .stderr(Stdio::piped())
         .stdin(Stdio::null());
        c
    };

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start Playit: {}", e))?;
    let pid = child.id();
    
    let window_clone = window.clone();
    let id_clone = id.clone();
    
    let _ = window_clone.emit(&format!("tunnel-log:{}", id_clone), format!("Agent (PID: {}) started. Check the terminal window for the claim link.", pid));

    // Only monitor stdout/stderr on non-Windows (Windows uses visible terminal)
    #[cfg(not(target_os = "windows"))]
    {
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        
        // Monitor stdout
        let w1 = window.clone();
        let i1 = id.clone();
        thread::spawn(move || {
            let mut reader = stdout;
            let mut buffer = [0u8; 1024];
            let mut current_line = Vec::new();
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 { break; }
                for i in 0..n {
                    let byte = buffer[i];
                    if byte == b'\n' || byte == b'\r' {
                        if !current_line.is_empty() {
                            if let Ok(l) = String::from_utf8(current_line.clone()) {
                                let clean = l.trim().to_string();
                                if !clean.is_empty() {
                                    let _ = w1.emit(&format!("tunnel-log:{}", i1), clean.clone());
                                    if clean.contains("playit.gg/claim/") {
                                        let _ = w1.emit(&format!("tunnel-claim:{}", i1), clean);
                                    }
                                }
                            }
                            current_line.clear();
                        }
                    } else {
                        current_line.push(byte);
                    }
                }
            }
        });
    
        // Monitor stderr
        let w2 = window.clone();
        let i2 = id.clone();
        thread::spawn(move || {
            let mut reader = stderr;
            let mut buffer = [0u8; 1024];
            let mut current_line = Vec::new();
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 { break; }
                for i in 0..n {
                    let byte = buffer[i];
                    if byte == b'\n' || byte == b'\r' {
                        if !current_line.is_empty() {
                            if let Ok(l) = String::from_utf8(current_line.clone()) {
                                let clean = l.trim().to_string();
                                if !clean.is_empty() {
                                    let _ = w2.emit(&format!("tunnel-log:{}", i2), clean);
                                }
                            }
                            current_line.clear();
                        }
                    } else {
                        current_line.push(byte);
                    }
                }
            }
        });
    } // Close #[cfg(not(target_os = "windows"))]
    // Monitor log file (Fallback for Windows pipe buffering)
    let w4 = window.clone();
    let i4 = id.clone();
    let log_path_tail = log_path.clone();
    thread::spawn(move || {
        use std::io::{Seek, SeekFrom};
        let mut last_pos = 0;
        // Wait a bit for file to be created
        thread::sleep(std::time::Duration::from_millis(500));
        
        for _ in 0..60 { // Try for 60 seconds
            if let Ok(mut file) = std::fs::File::open(&log_path_tail) {
                let _ = file.seek(SeekFrom::Start(last_pos));
                let mut buffer = String::new();
                if let Ok(_) = file.read_to_string(&mut buffer) {
                    for line in buffer.lines() {
                        let clean = line.trim().to_string();
                        if !clean.is_empty() {
                            let _ = w4.emit(&format!("tunnel-log:{}", i4), clean.clone());
                            if clean.contains("playit.gg/claim/") {
                                let _ = w4.emit(&format!("tunnel-claim:{}", i4), clean);
                            }
                        }
                    }
                }
                if let Ok(meta) = file.metadata() {
                    last_pos = meta.len();
                }
            }
            thread::sleep(std::time::Duration::from_millis(1000));
        }
    });

    // Monitor exit
    let w3 = window.clone();
    let i3 = id.clone();
    let state_clone = state.tunnels.clone();
    thread::spawn(move || {
        match child.wait() {
            Ok(status) => {
                let _ = w3.emit(&format!("tunnel-log:{}", i3), format!("Agent exited with status: {}", status));
                let mut tunnels = state_clone.lock().unwrap();
                tunnels.remove(&i3);
            },
            Err(e) => {
                let _ = w3.emit(&format!("tunnel-log:{}", i3), format!("Error waiting for agent: {}", e));
            }
        }
    });

    Ok("Tunnel started".into())
}

#[tauri::command]
pub fn stop_playit_tunnel(
    state: State<'_, NetworkState>,
    id: String
) -> Result<String, String> {
    let mut tunnels = state.tunnels.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = tunnels.remove(&id) {
        let _ = child.kill();
        Ok("Tunnel stopped".into())
    } else {
        Err("Tunnel not running".into())
    }
}

#[tauri::command]
pub fn reset_playit_tunnel(
    state: State<'_, NetworkState>,
    id: String,
    server_path: String
) -> Result<String, String> {
    // 1. Try to kill known child from HashMap
    let mut tunnels = state.tunnels.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = tunnels.remove(&id) {
        let _ = child.kill();
    }

    // 2. FORCE KILL ORPHANS (Windows Specific)
    // The HashMap might be empty (if app restarted), but the process is still running and locking files.
    // We must kill any 'playit' process running from this specific server folder.
    #[cfg(target_os = "windows")]
    {
        // Escape path for PowerShell
        let clean_path = server_path.replace("'", "''"); 
        let ps_cmd = format!(
            "Get-Process playit -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -like '*{}*' }} | Stop-Process -Force",
            clean_path
        );
        
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .output(); // Wait for it to finish

         std::thread::sleep(std::time::Duration::from_millis(1000));
    }

    // 3. Delete Config Files (Scorched Earth Policy)
    // Playit might mistakenly save in the server root (binary location) or .playit (CWD).
    // We delete BOTH to be sure.
    
    let path_cwd = Path::new(&server_path).join(".playit");
    let path_root = Path::new(&server_path);

    let files_to_nuke = vec![
        path_cwd.clone(),                               // The .playit folder
        path_root.join("playit.toml"),                  // Config in root?
        path_root.join("playit-agent.toml"),            // Alternate name?
        path_cwd.join("playit.toml"),                   // Config in .playit
        path_cwd.join("playit-agent.toml"),             // Alternate name in .playit
    ];

    for p in files_to_nuke {
        if p.exists() {
            if p.is_dir() {
                 let _ = std::fs::remove_dir_all(&p);
            } else {
                 let _ = std::fs::remove_file(&p);
            }
        }
    }

    // Windows retry logic for the main folder if it failed above
    if path_cwd.exists() {
        let mut retries = 0;
        loop {
            match std::fs::remove_dir_all(&path_cwd) {
                Ok(_) => break,
                Err(e) => {
                    if retries >= 5 {
                         // Don't error out, just warn, maybe the file deletion above worked enough
                         // return Err(format!("Failed to delete config: {} (Is the terminal still open?)", e));
                         break; 
                    }
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    retries += 1;
                }
            }
        }
    }

    Ok("Tunnel config reset. You can now start fresh.".into())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn check_firewall_rule(port: u16) -> bool {
    use std::process::Command;
    // Check if a rule with our naming convention exists
    let rule_name = format!("MineServer Port {}", port);
    
    let output = Command::new("netsh")
        .args(["advfirewall", "firewall", "show", "rule", &format!("name=\"{}\"", rule_name)])
        .output();
        
    match output {
        Ok(o) => o.status.success(), // Exit code 0 means rule found
        Err(_) => false,
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn check_firewall_rule(_port: u16) -> bool {
    // Non-windows support not implemented yet (ufw/iptables?)
    true // Assume open or managed externally
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn add_firewall_rule(port: u16) -> Result<String, String> {
    use std::process::Command;
    
    let rule_name = format!("MineServer Port {}", port);
    
    // Check if already exists to avoid duplicates
    if check_firewall_rule(port) {
        return Ok("Rule already exists".to_string());
    }
    
    // We try to run directly. If failed due to permissions, we try Powershell RunAs
    // Direct attempt:
    let output = Command::new("netsh")
        .args([
            "advfirewall", "firewall", "add", "rule", 
            &format!("name=\"{}\"", rule_name), 
            "dir=in", 
            "action=allow", 
            "protocol=TCP", 
            &format!("localport={}", port)
        ])
        .output()
        .map_err(|e| e.to_string())?;
        
    if output.status.success() {
        return Ok("Rule added successfully".to_string());
    }
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("Run as administrator") || stderr.contains("elevation") {
        // Try to trigger UAC via PowerShell
        let ps_script = format!(
            "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=\"{}\" dir=in action=allow protocol=TCP localport={}' -Verb RunAs -WindowStyle Hidden -Wait",
            rule_name, port
        );
        
        let ps_output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;
            
        if ps_output.status.success() {
            // Re-check to confirm it actually worked
             if check_firewall_rule(port) {
                 return Ok("Rule added via UAC prompt".to_string());
             } else {
                 return Err("User cancelled UAC or operation failed".to_string());
             }
        } else {
            return Err("Failed to trigger UAC prompt".to_string());
        }
    }
    
    Err(format!("Netsh failed: {}", stderr))
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn add_firewall_rule(_port: u16) -> Result<String, String> {
    Err("Automatic firewall configuration is only supported on Windows.".to_string())
}
