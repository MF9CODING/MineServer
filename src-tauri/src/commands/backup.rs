use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use serde::{Deserialize, Serialize};
use zip::write::FileOptions;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub id: String,
    pub server_name: String,
    pub server_path: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub backup_type: String, // "manual", "auto", "pre-update"
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub task_type: String, // "restart", "backup", "command"
    pub server_id: String,
    pub server_name: String,
    pub cron_expression: String,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub command: Option<String>,
}

fn get_backups_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("Mineserver").join("Backups")
}

fn get_tasks_file() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("Mineserver").join("scheduled_tasks.json")
}

fn get_backups_index_file() -> PathBuf {
    get_backups_dir().join("backups_index.json")
}

#[tauri::command]
pub async fn create_backup(
    server_path: String,
    server_name: String,
    backup_type: String,
) -> Result<BackupInfo, String> {
    let server_dir = Path::new(&server_path);
    if !server_dir.exists() {
        return Err("Server path does not exist".to_string());
    }

    let backups_dir = get_backups_dir();
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    // Generate backup filename
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let safe_name = server_name.replace(" ", "_").replace("/", "_").replace("\\", "_");
    let backup_filename = format!("{}_{}.zip", safe_name, timestamp);
    let backup_path = backups_dir.join(&backup_filename);

    // Create zip file
    let file = fs::File::create(&backup_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add all files from server directory
    for entry in WalkDir::new(server_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative_path = path.strip_prefix(server_dir).unwrap();

        if path.is_file() {
            let relative_str = relative_path.to_string_lossy().replace("\\", "/");
            zip.start_file(&relative_str, options.clone())
                .map_err(|e| format!("Failed to add file to zip: {}", e))?;

            let mut file = fs::File::open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            zip.write_all(&buffer)
                .map_err(|e| format!("Failed to write to zip: {}", e))?;
        } else if path.is_dir() && relative_path.to_string_lossy() != "" {
            let relative_str = format!("{}/", relative_path.to_string_lossy().replace("\\", "/"));
            zip.add_directory(&relative_str, options.clone())
                .map_err(|e| format!("Failed to add directory to zip: {}", e))?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finish zip: {}", e))?;

    // Get file size
    let metadata = fs::metadata(&backup_path)
        .map_err(|e| format!("Failed to get backup size: {}", e))?;

    let backup_info = BackupInfo {
        id: uuid::Uuid::new_v4().to_string(),
        server_name,
        server_path,
        created_at: chrono::Local::now().to_rfc3339(),
        size_bytes: metadata.len(),
        backup_type,
        file_path: backup_path.to_string_lossy().to_string(),
    };

    // Update index
    let mut backups = list_backups_internal()?;
    backups.insert(0, backup_info.clone());
    save_backups_index(&backups)?;

    Ok(backup_info)
}

#[tauri::command]
pub async fn list_backups() -> Result<Vec<BackupInfo>, String> {
    list_backups_internal()
}

fn list_backups_internal() -> Result<Vec<BackupInfo>, String> {
    let index_file = get_backups_index_file();
    if !index_file.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&index_file)
        .map_err(|e| format!("Failed to read backups index: {}", e))?;
    let backups: Vec<BackupInfo> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse backups index: {}", e))?;

    // Filter out backups that no longer exist
    let valid_backups: Vec<BackupInfo> = backups
        .into_iter()
        .filter(|b| Path::new(&b.file_path).exists())
        .collect();

    Ok(valid_backups)
}

fn save_backups_index(backups: &Vec<BackupInfo>) -> Result<(), String> {
    let index_file = get_backups_index_file();
    fs::create_dir_all(index_file.parent().unwrap())
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    let content = serde_json::to_string_pretty(backups)
        .map_err(|e| format!("Failed to serialize backups: {}", e))?;
    fs::write(&index_file, content)
        .map_err(|e| format!("Failed to write backups index: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_backup(backup_id: String) -> Result<(), String> {
    let mut backups = list_backups_internal()?;
    
    if let Some(pos) = backups.iter().position(|b| b.id == backup_id) {
        let backup = &backups[pos];
        if Path::new(&backup.file_path).exists() {
            fs::remove_file(&backup.file_path)
                .map_err(|e| format!("Failed to delete backup file: {}", e))?;
        }
        backups.remove(pos);
        save_backups_index(&backups)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn restore_backup(backup_id: String, target_path: String) -> Result<(), String> {
    let backups = list_backups_internal()?;
    let backup = backups.iter().find(|b| b.id == backup_id)
        .ok_or("Backup not found")?;

    let backup_file = fs::File::open(&backup.file_path)
        .map_err(|e| format!("Failed to open backup: {}", e))?;
    let mut archive = zip::ZipArchive::new(backup_file)
        .map_err(|e| format!("Failed to read backup archive: {}", e))?;

    archive.extract(&target_path)
        .map_err(|e| format!("Failed to extract backup: {}", e))?;

    Ok(())
}

// Scheduled Tasks

#[tauri::command]
pub async fn save_scheduled_tasks(tasks: Vec<ScheduledTask>) -> Result<(), String> {
    let tasks_file = get_tasks_file();
    fs::create_dir_all(tasks_file.parent().unwrap())
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    let content = serde_json::to_string_pretty(&tasks)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))?;
    fs::write(&tasks_file, content)
        .map_err(|e| format!("Failed to write tasks: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_scheduled_tasks() -> Result<Vec<ScheduledTask>, String> {
    let tasks_file = get_tasks_file();
    if !tasks_file.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&tasks_file)
        .map_err(|e| format!("Failed to read tasks: {}", e))?;
    let tasks: Vec<ScheduledTask> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse tasks: {}", e))?;
    Ok(tasks)
}
