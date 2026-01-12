use tauri::State;
use sysinfo::{System, CpuRefreshKind, MemoryRefreshKind, Disks};
use std::sync::Mutex;
use local_ip_address::local_ip;

pub struct SystemState {
    pub sys: Mutex<System>,
}

impl SystemState {
    pub fn new() -> Self {
        Self {
            sys: Mutex::new(System::new_all()),
        }
    }
}

#[tauri::command]
pub fn get_system_info(state: State<SystemState>) -> SystemInfo {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    sys.refresh_memory_specifics(MemoryRefreshKind::everything());
    
    // Refresh disks
    let disks = Disks::new_with_refreshed_list();
    let mut total_disk = 0;
    let mut free_disk = 0;
    
    for disk in &disks {
        total_disk += disk.total_space();
        free_disk += disk.available_space();
    }

    SystemInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_swap: sys.total_swap(),
        used_swap: sys.used_swap(),
        cpu_usage: sys.global_cpu_info().cpu_usage(),
        cpu_threads: sys.cpus().len() as u32,
        cpu_cores: sys.physical_core_count().unwrap_or(sys.cpus().len()) as u32,
        os_name: System::name().unwrap_or("Unknown".to_string()),
        os_version: System::os_version().unwrap_or("Unknown".to_string()),
        host_name: System::host_name().unwrap_or("Unknown".to_string()),
        disk_total_gb: total_disk / 1024 / 1024 / 1024,
        disk_free_gb: free_disk / 1024 / 1024 / 1024,
    }
}

#[tauri::command]
pub fn get_local_ip() -> String {
    local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "127.0.0.1".to_string())
}

// Nukkit function moved to versions.rs



#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    total_memory: u64,
    used_memory: u64,
    total_swap: u64,
    used_swap: u64,
    cpu_usage: f32,
    cpu_threads: u32,
    cpu_cores: u32,
    os_name: String,
    os_version: String,
    host_name: String,
    disk_total_gb: u64,
    disk_free_gb: u64,
}

#[tauri::command]
pub fn factory_reset(paths: Vec<String>) -> Result<(), String> {
    for path_str in paths {
        let path = std::path::Path::new(&path_str);
        if path.exists() {
             std::fs::remove_dir_all(path).map_err(|e| format!("Failed to delete {}: {}", path_str, e))?;
        }
    }
    Ok(())
}
