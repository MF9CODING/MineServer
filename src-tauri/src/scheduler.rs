use tauri::{AppHandle, Emitter, Manager};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use chrono::{Local, Timelike};
use crate::commands::backup::{load_scheduled_tasks_sync, ScheduledTask, save_scheduled_tasks, create_backup};
use crate::commands::runner::{ServerProcessState, stop_server_direct, start_server_direct, send_server_command_direct};

pub struct SchedulerState {
    pub running: Arc<Mutex<bool>>,
}

impl SchedulerState {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }
}

pub fn init_scheduler(app: AppHandle) {
    let state = app.state::<SchedulerState>();
    let running = state.running.clone();
    
    // Ensure only one thread runs
    {
        let mut r = running.lock().unwrap();
        if *r { return; }
        *r = true;
    }

    std::thread::spawn(move || {
        println!("[Scheduler] Thread started.");
        loop {
            // Tick every 60 seconds
            std::thread::sleep(Duration::from_secs(60));
            
            let now = Local::now();
            
            match load_scheduled_tasks_sync() {
                Ok(mut tasks) => {
                    for task in tasks.iter_mut() {
                        if !task.enabled { continue; }
                        
                        if is_time_to_run(&task.cron_expression, now) {
                            // Check recent run
                            let last_run_time = task.last_run.as_ref().and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok());
                            let recent_run = if let Some(last) = last_run_time {
                                let diff: chrono::TimeDelta = now.signed_duration_since(last.with_timezone(&Local));
                                diff.num_seconds() < 90 // Buffer
                            } else {
                                false
                            };
                            
                            if !recent_run {
                                println!("[Scheduler] Executing Task: {}", task.name);
                                
                                // Execute Task Async
                                let _task_id = task.id.clone();
                                let server_id = task.server_id.clone();
                                let server_name = task.server_name.clone();
                                let server_path = task.server_path.clone();
                                let task_type = task.task_type.clone();
                                let command_payload = task.command.clone();
                                let app_handle = app.clone();
                                
                                // Get state BEFORE thread spawn and clone Arc fields
                                let state_proc = app.state::<ServerProcessState>();
                                let processes_arc = state_proc.processes.clone();
                                let explicit_stops_arc = state_proc.explicit_stops.clone();
                                let configs_arc = state_proc.configs.clone();
                                
                                // Update Last Run
                                task.last_run = Some(now.to_rfc3339());
                                
                                std::thread::spawn(move || {
                                    match task_type.as_str() {
                                        "backup" => {
                                            let _ = app_handle.emit("server-log", format!("[Scheduler] Starting Backup for {}", server_name));
                                            tauri::async_runtime::spawn(async move {
                                                match create_backup(server_path, server_name.clone(), "auto".into()).await {
                                                    Ok(_) => { let _ = app_handle.emit("server-log", format!("[Scheduler] Backup Success: {}", server_name)); },
                                                    Err(e) => { let _ = app_handle.emit("server-log", format!("[Scheduler] Backup Failed: {}", e)); }
                                                }
                                            });
                                        },
                                        "restart" => {
                                            let _ = app_handle.emit("server-log", format!("[Scheduler] Restarting {}", server_name));
                                            
                                            // Use cloned Arcs directly instead of state_proc
                                            // Stop
                                            {
                                                let mut stops = explicit_stops_arc.lock().unwrap();
                                                stops.insert(server_id.clone());
                                            }
                                            {
                                                let mut procs = processes_arc.lock().unwrap();
                                                if let Some(mut child) = procs.remove(&server_id) {
                                                    if let Some(mut stdin) = child.stdin.take() {
                                                        let _ = std::io::Write::write_all(&mut stdin, b"stop\n");
                                                    }
                                                    let _ = child.kill();
                                                }
                                            }
                                            
                                            std::thread::sleep(Duration::from_secs(5));
                                            
                                            // Start
                                            if let Ok(configs) = configs_arc.lock() {
                                                if let Some(cfg) = configs.get(&server_id) {
                                                    if let Some(window) = app_handle.get_webview_window("main") {
                                                         // Build a temporary state struct for start_server_direct
                                                         let temp_state = ServerProcessState {
                                                             processes: processes_arc.clone(),
                                                             explicit_stops: explicit_stops_arc.clone(),
                                                             configs: configs_arc.clone(),
                                                         };
                                                         let _ = start_server_direct(
                                                             window,
                                                             &temp_state,
                                                             cfg.id.clone(),
                                                             cfg.path.clone(),
                                                             cfg.jar_file.clone(),
                                                             cfg.ram,
                                                             cfg.java_path.clone(),
                                                             cfg.startup_flags.clone(),
                                                             Some(cfg.auto_restart)
                                                         );
                                                    }
                                                }
                                            }
                                        },
                                        "command" => {
                                             if let Some(cmd) = command_payload {
                                                 let mut procs = processes_arc.lock().unwrap();
                                                 if let Some(child) = procs.get_mut(&server_id) {
                                                     if let Some(stdin) = child.stdin.as_mut() {
                                                         let _ = std::io::Write::write_all(stdin, format!("{}\n", cmd).as_bytes());
                                                     }
                                                 }
                                             }
                                        },
                                        _ => {}
                                    }
                                });
                            }
                        }
                    }
                    // Save timestamps
                    // Ideally we should do this.
                    let _ = save_scheduled_tasks(tasks);
                }
                Err(e) => eprintln!("[Scheduler] Failed to load tasks: {}", e),
            }
        }
    });
}

fn is_time_to_run(cron: &str, now: chrono::DateTime<Local>) -> bool {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    if parts.len() != 5 { return false; }
    
    let (min, hour, dom, month, dow) = (parts[0], parts[1], parts[2], parts[3], parts[4]);
    
    fn matches(pattern: &str, value: u32) -> bool {
        if pattern == "*" { return true; }
        if let Ok(v) = pattern.parse::<u32>() { return v == value; }
        false
    }
    
    matches(min, now.minute()) && matches(hour, now.hour())
}
