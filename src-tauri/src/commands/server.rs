use std::path::Path;
use std::fs;
use serde::Serialize;
use zip::write::FileOptions;
use std::io::{Read, Write};
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    size: u64,
    is_dir: bool,
}

#[tauri::command]
pub fn delete_server(path: String) -> Result<(), String> {
    let server_path = Path::new(&path);
    
    // Safety check: ensure we are deleting something that looks like a server in our expected location
    // This is a basic check; you might want to make it more robust
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed: Path does not appear to be in a Servers directory".to_string());
    }

    if server_path.exists() {
        std::fs::remove_dir_all(server_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_server_files(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err("Directory not found".to_string());
    }

    let read_dir = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            entries.push(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                size: metadata.len(),
                is_dir: metadata.is_dir(),
            });
        }
    }

    // Sort: directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_server_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    
    // Basic text file check could go here, for now assuming text
    std::fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_server_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    // Simple safety check again
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed: Path does not appear to be in a Servers directory".to_string());
    }

    std::fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    std::fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    std::fs::remove_file(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_directory(path: String) -> Result<(), String> {
    if !path.contains("Servers") && !path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err("Directory not found".to_string());
    }
    std::fs::remove_dir_all(dir_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    if !old_path.contains("Servers") && !old_path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    if !new_path.contains("Servers") && !new_path.contains("servers") {
        return Err("Safety check failed".to_string());
    }
    let old = Path::new(&old_path);
    if !old.exists() {
        return Err("Original file/folder not found".to_string());
    }
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duplicate_file(path: String, new_path: String) -> Result<(), String> {
    if (!path.contains("Servers") && !path.contains("servers")) || 
       (!new_path.contains("Servers") && !new_path.contains("servers")) {
        return Err("Safety check failed".to_string());
    }
    
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("Source file not found".to_string());
    }

    if path_obj.is_dir() {
         return Err("Duplicating directories is not supported yet".to_string());
    } else {
        // Safe duplication logic
        let mut final_new_path = std::path::PathBuf::from(&new_path);
        let mut counter = 1;

        // Extract stem and extension for incrementing
        let file_stem = final_new_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let extension = final_new_path.extension().map(|e| e.to_string_lossy().to_string());
        // Fix: Clone parent to PathBuf to avoid borrowing final_new_path which changes
        let parent = final_new_path.parent().unwrap_or(Path::new("")).to_path_buf();

        // Loop until we find a free name
        while final_new_path.exists() {
            let new_name = if let Some(ref ext) = extension {
                format!("{} (copy {}).{}", file_stem, counter, ext)
            } else {
                format!("{} (copy {})", file_stem, counter)
            };
            final_new_path = parent.join(new_name);
            counter += 1;
        }

        std::fs::copy(path, final_new_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn copy_file_path(path: String) -> Result<String, String> {
    // Just return the path back, user wants to copy to clipboard in frontend
    // but we can return absolute path here if needed
    let abs_path = std::fs::canonicalize(&path).map_err(|e| e.to_string())?;
    Ok(abs_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn archive_files(server_path: String, files: Vec<String>, archive_name: String) -> Result<(), String> {
    let root = Path::new(&server_path);
    if !root.exists() {
        return Err("Server path not found".to_string());
    }

    let archive_path = root.join(&archive_name);
    let file = fs::File::create(&archive_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for file_name in files {
        let full_path = root.join(&file_name);
        if !full_path.exists() { continue; }

        if full_path.is_file() {
             zip.start_file(&file_name, options.clone()).map_err(|e| e.to_string())?;
             let mut f = fs::File::open(&full_path).map_err(|e| e.to_string())?;
             let mut buffer = Vec::new();
             f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
             zip.write_all(&buffer).map_err(|e| e.to_string())?;
        } else if full_path.is_dir() {
            for entry in WalkDir::new(&full_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                let relative = path.strip_prefix(root).unwrap();
                let relative_str = relative.to_string_lossy().replace("\\", "/");

                if path.is_file() {
                    zip.start_file(&relative_str, options.clone()).map_err(|e| e.to_string())?;
                    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
                    let mut buffer = Vec::new();
                    f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                    zip.write_all(&buffer).map_err(|e| e.to_string())?;
                } else if path.is_dir() {
                     zip.add_directory(&relative_str, options.clone()).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn extract_file(server_path: String, file_name: String) -> Result<(), String> {
    let root = Path::new(&server_path);
    let archive_path = root.join(&file_name);
    
    let file = fs::File::open(&archive_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    archive.extract(root).map_err(|e| e.to_string())?;
    Ok(())
}
