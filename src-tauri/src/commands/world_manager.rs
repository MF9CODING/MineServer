use std::path::{Path, PathBuf};
use std::fs::{self, File};
use std::io::{Read, Write, Cursor};
use std::collections::HashMap;
use serde::Serialize;


#[derive(Serialize)]
pub struct Dimension {
    name: String,   // Display Name (Overworld, Nether, End)
    id: String,     // internal id (overworld, nether, end)
    size_bytes: u64,
}

#[derive(Serialize)]
pub struct WorldGroup {
    level_name: String,
    dimensions: Vec<Dimension>,
    total_size: u64,
    exists: bool,
    path_debug: String,
}

fn get_level_name(server_path: &Path) -> String {
    let props_path = server_path.join("server.properties");
    if props_path.exists() {
         if let Ok(content) = fs::read_to_string(&props_path) {
             for line in content.lines() {
                 let text = line.trim();
                 if text.starts_with("level-name=") {
                     return text.replace("level-name=", "").trim().to_string();
                 }
             }
         }
    }
    "world".to_string()
}

fn get_dir_size(path: &Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        size += get_dir_size(&entry.path());
                    } else {
                        size += meta.len();
                    }
                }
            }
        }
    }
    size
}

fn parse_properties(path: &Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            if line.trim().starts_with('#') || line.trim().is_empty() { continue; }
            if let Some((k, v)) = line.split_once('=') {
                 map.insert(k.trim().to_string(), v.trim().to_string());
            }
        }
    }
    map
}

fn resolve_world_path(server_path: &Path, level_name: &str) -> PathBuf {
    // 1. Check strict Bedrock path (worlds/level_name)
    let bedrock_world = server_path.join("worlds").join(level_name);
    if bedrock_world.exists() && bedrock_world.is_dir() {
        return bedrock_world;
    }

    // 2. Check strict Java path (root/level_name)
    let java_world = server_path.join(level_name);
    if java_world.exists() && java_world.is_dir() {
        return java_world;
    }

    // 3. Fallback for new world creation (If neither exists yet)
    let bedrock_worlds_folder = server_path.join("worlds");
    if bedrock_worlds_folder.exists() && bedrock_worlds_folder.is_dir() {
        // If 'worlds' folder exists, we likely want to create the new world there (Bedrock)
        return bedrock_worlds_folder.join(level_name);
    }

    // Default to root (Java)
    java_world
}

#[tauri::command]
pub fn get_world_info(server_path: String) -> Result<WorldGroup, String> {
    let path = Path::new(&server_path);
    if !path.exists() {
        return Err("Server path not found".to_string());
    }

    let level_name = get_level_name(path);
    let mut dimensions = Vec::new();
    let mut total_size = 0;
    let mut exists = false;

    // 1. Resolve Main World Path
    let ow_path = resolve_world_path(path, &level_name);
    
    if ow_path.exists() {
        let size = get_dir_size(&ow_path);
        dimensions.push(Dimension {
            name: "Overworld".to_string(), // In Bedrock, this is the whole world (level.db)
            id: "overworld".to_string(),
            size_bytes: size,
        });
        total_size += size;
        exists = true;
        
        // Check for Java/Vanilla Dimensions inside Overworld (DIM-1, DIM1)
        // Bedrock doesn't use these, so this check is harmless for Bedrock but good for Java
        let nether_path = ow_path.join("DIM-1");
        if nether_path.exists() {
             dimensions.push(Dimension {
                 name: "Nether (Vanilla)".to_string(),
                 id: "nether_vanilla".to_string(),
                 size_bytes: get_dir_size(&nether_path), 
             });
        }
         let end_path = ow_path.join("DIM1");
        if end_path.exists() {
             dimensions.push(Dimension {
                 name: "The End (Vanilla)".to_string(),
                 id: "end_vanilla".to_string(),
                 size_bytes: get_dir_size(&end_path), 
             });
        }
    }

    // 2. Check Paper Dimensions (always at root: level-name_nether)
    // Paper logic assumes root. Bedrock servers won't match this.
    
    // We only check these if we didn't find "worlds" folder? 
    // Or just check anyway. Paper wouldn't have "worlds" folder usually.
    // If it's Bedrock, strict "level-name_nether" won't exist.
    
    let nether_folder = path.join(format!("{}_nether", level_name));
    if nether_folder.exists() {
        let size = get_dir_size(&nether_folder);
        dimensions.push(Dimension {
            name: "Nether".to_string(),
            id: "nether".to_string(),
            size_bytes: size,
        });
        total_size += size;
    }

    let end_folder = path.join(format!("{}_the_end", level_name));
    if end_folder.exists() {
        let size = get_dir_size(&end_folder);
        dimensions.push(Dimension {
            name: "The End".to_string(),
            id: "end".to_string(),
            size_bytes: size,
        });
        total_size += size;
    }

    Ok(WorldGroup {
        level_name,
        dimensions,
        total_size,
        exists,
        path_debug: ow_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn delete_world(server_path: String) -> Result<(), String> {
    let path = Path::new(&server_path);
    let level_name = get_level_name(path);
    
    // Delete Overworld (Resolved)
    let ow_path = resolve_world_path(path, &level_name);
    if ow_path.exists() {
        fs::remove_dir_all(ow_path).map_err(|e| e.to_string())?;
    }
    
    // Delete Paper Dimensions (Always root)
    let nether_path = path.join(format!("{}_nether", level_name));
    if nether_path.exists() {
        fs::remove_dir_all(nether_path).map_err(|e| e.to_string())?;
    }
    
    let end_path = path.join(format!("{}_the_end", level_name));
    if end_path.exists() {
        fs::remove_dir_all(end_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn delete_dimension_folder(server_path: String, dimension: String) -> Result<(), String> {
    let path = Path::new(&server_path);
    let level_name = get_level_name(path);

    let target_path = match dimension.as_str() {
        "overworld" => resolve_world_path(path, &level_name),
        "nether" => path.join(format!("{}_nether", level_name)),
        "end" => path.join(format!("{}_the_end", level_name)),
        _ => return Err(format!("Unknown dimension: {}", dimension)),
    };

    if target_path.exists() {
        fs::remove_dir_all(target_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn regenerate_world(
    server_path: String, 
    seed: String, 
    level_type: String, 
    generate_structures: bool, 
    hardcore: bool,
    difficulty: String,
    spawn_animals: bool,
    spawn_monsters: bool,
    allow_nether: bool,
) -> Result<(), String> {
    let path = Path::new(&server_path);
    let props_path = path.join("server.properties");
    
    // 1. Delete existing (all dimensions)
    delete_world(server_path.clone())?;
    
    // 2. Update properties
    let content = fs::read_to_string(&props_path).unwrap_or_default();
    let mut new_lines = Vec::new();
    
    // Track keys to update
    let mut updates = HashMap::new();
    updates.insert("level-seed", seed);
    updates.insert("level-type", level_type);
    updates.insert("generate-structures", generate_structures.to_string());
    updates.insert("hardcore", hardcore.to_string());
    updates.insert("difficulty", difficulty);
    updates.insert("spawn-animals", spawn_animals.to_string());
    updates.insert("spawn-monsters", spawn_monsters.to_string());
    updates.insert("allow-nether", allow_nether.to_string());
    
    let mut seen_keys = Vec::new();

    for line in content.lines() {
        if line.trim().starts_with('#') || line.trim().is_empty() {
            new_lines.push(line.to_string());
            continue;
        }
        
        if let Some((k, _)) = line.split_once('=') {
            let key = k.trim();
            if let Some(val) = updates.get(key) {
                new_lines.push(format!("{}={}", key, val));
                seen_keys.push(key.to_string());
                continue;
            }
        }
        new_lines.push(line.to_string());
    }
    
    // Add missing keys
    for (k, v) in updates {
        if !seen_keys.contains(&k.to_string()) {
            new_lines.push(format!("{}={}", k, v));
        }
    }
    
    fs::write(&props_path, new_lines.join("\n")).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    percentage: u8,
    details: String,
}

#[tauri::command]
pub fn upload_world<R: tauri::Runtime>(window: tauri::Window<R>, server_path: String, zip_path: String) -> Result<(), String> {
    use std::io::{Read, Write};
    use tauri::Emitter;

    let path = Path::new(&server_path);
    let level_name = get_level_name(path);
    let world_path = resolve_world_path(path, &level_name);

    // emit start
    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 0,
        details: "Preparing...".to_string(),
    });
    
    // Delete existing
    if world_path.exists() {
         let _ = window.emit("world_upload_progress", ProgressPayload {
            percentage: 0,
            details: "Removing old world...".to_string(),
        });
        fs::remove_dir_all(&world_path).map_err(|e| e.to_string())?;
    }
    
    // Open Zip
    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    // Calculate total uncompressed size
    let mut total_size: u64 = 0;
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
             total_size += file.size();
        }
    }
    
    let mut extracted_bytes: u64 = 0;
    let mut last_emit_time = std::time::Instant::now();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        
        // Sanitize path
        let outpath = match file.enclosed_name() {
            Some(path) => world_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            
            // buffer copy with progress
            let mut buffer = [0u8; 8192];
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                outfile.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
                
                extracted_bytes += n as u64;
                
                // Emit event every 100ms max to avoid spamming frontend
                if last_emit_time.elapsed().as_millis() > 100 {
                    let percentage = if total_size > 0 {
                        ((extracted_bytes as f64 / total_size as f64) * 100.0) as u8
                    } else { 0 };
                    
                    let _ = window.emit("world_upload_progress", ProgressPayload {
                        percentage,
                        details: format!("Extracting: {}", file.name()),
                    });
                    last_emit_time = std::time::Instant::now();
                }
            }
        }
        
        // Get Unix permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)).unwrap();
            }
        }
    }
    
    // finish
    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 100,
        details: "Done!".to_string(),
    });
    
    Ok(())
}

/// Upload a specific dimension (overworld, nether, end).
/// For Nether/End, extracts to `{level-name}_nether` or `{level-name}_the_end`.
#[tauri::command]
pub fn upload_dimension<R: tauri::Runtime>(
    window: tauri::Window<R>,
    server_path: String,
    zip_path: String,
    dimension: String, // "overworld" | "nether" | "end"
) -> Result<(), String> {
    use std::io::{Read, Write};
    use tauri::Emitter;

    let path = Path::new(&server_path);
    let level_name = get_level_name(path);

    // Determine target path based on dimension
    let target_path = match dimension.as_str() {
        "overworld" => resolve_world_path(path, &level_name),
        "nether" => path.join(format!("{}_nether", level_name)),
        "end" => path.join(format!("{}_the_end", level_name)),
        _ => return Err(format!("Unknown dimension: {}", dimension)),
    };

    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 0,
        details: format!("Preparing {} upload...", dimension),
    });

    // Delete existing dimension folder
    if target_path.exists() {
        let _ = window.emit("world_upload_progress", ProgressPayload {
            percentage: 5,
            details: format!("Removing old {}...", dimension),
        });
        fs::remove_dir_all(&target_path).map_err(|e| e.to_string())?;
    }

    // Create target directory
    fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;

    // Open Zip
    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Detect if all files are inside a single root folder (common for world zips)
    // e.g., "my_world/level.dat" - we want to strip "my_world/" prefix
    let mut root_prefix: Option<String> = None;
    let mut all_have_common_root = true;

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name();
            if let Some(first_slash) = name.find('/') {
                let prefix = &name[..first_slash + 1];
                if let Some(ref existing) = root_prefix {
                    if existing != prefix {
                        all_have_common_root = false;
                        break;
                    }
                } else {
                    root_prefix = Some(prefix.to_string());
                }
            } else {
                // File at root level (no folder) - don't strip
                all_have_common_root = false;
                break;
            }
        }
    }

    let strip_prefix = if all_have_common_root { root_prefix } else { None };

    // Calculate total size
    let mut total_size: u64 = 0;
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            total_size += file.size();
        }
    }

    let mut extracted_bytes: u64 = 0;
    let mut last_emit_time = std::time::Instant::now();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        let file_name = file.name().to_string();
        
        // Strip the common root prefix if detected
        let relative_path = if let Some(ref prefix) = strip_prefix {
            if file_name.starts_with(prefix) {
                file_name.strip_prefix(prefix).unwrap_or(&file_name)
            } else {
                &file_name
            }
        } else {
            &file_name
        };

        // Skip empty paths (the root folder itself)
        if relative_path.is_empty() {
            continue;
        }

        let outpath = target_path.join(relative_path);

        if file_name.ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;

            let mut buffer = [0u8; 8192];
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                outfile.write_all(&buffer[..n]).map_err(|e| e.to_string())?;

                extracted_bytes += n as u64;

                if last_emit_time.elapsed().as_millis() > 100 {
                    let percentage = if total_size > 0 {
                        ((extracted_bytes as f64 / total_size as f64) * 100.0) as u8
                    } else { 0 };

                    let _ = window.emit("world_upload_progress", ProgressPayload {
                        percentage,
                        details: format!("Extracting: {}", relative_path),
                    });
                    last_emit_time = std::time::Instant::now();
                }
            }
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)).ok();
            }
        }
    }

    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 100,
        details: "Done!".to_string(),
    });

    Ok(())
}

#[tauri::command]
pub fn archive_world<R: tauri::Runtime>(
    window: tauri::Window<R>,
    server_path: String,
    save_path: String,
) -> Result<(), String> {
    use std::io::Write;
    use tauri::Emitter;
    use walkdir::WalkDir;

    let path = Path::new(&server_path);
    let level_name = get_level_name(path);
    
    // We want to archive the main world folder
    // For Bedrock: "worlds/{level_name}"
    // For Java: "{level_name}" (plus nether/end folders if they exist separately)
    
    let world_path = resolve_world_path(path, &level_name);
    
    if !world_path.exists() {
        return Err("World folder not found".to_string());
    }

    let file = File::create(&save_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut files_to_add = Vec::new();
    
    // 1. Add Main World
    for entry in WalkDir::new(&world_path).into_iter().filter_map(|e| e.ok()) {
        files_to_add.push((entry.path().to_path_buf(), world_path.parent().unwrap().to_path_buf()));
    }

    // 2. Add Java Dimensions (Nether/End) if they exist at root (Paper/Spigot style)
    let nether_path = path.join(format!("{}_nether", level_name));
    if nether_path.exists() {
         for entry in WalkDir::new(&nether_path).into_iter().filter_map(|e| e.ok()) {
            files_to_add.push((entry.path().to_path_buf(), path.to_path_buf()));
        }
    }
    
    let end_path = path.join(format!("{}_the_end", level_name));
    if end_path.exists() {
         for entry in WalkDir::new(&end_path).into_iter().filter_map(|e| e.ok()) {
            files_to_add.push((entry.path().to_path_buf(), path.to_path_buf()));
        }
    }

    let total_files = files_to_add.len();
    let mut processed = 0;
    let mut last_emit = std::time::Instant::now();

    for (full_path, base_path) in files_to_add {
        let path = full_path.strip_prefix(&base_path).unwrap();
        let path_str = path.to_string_lossy().replace("\\", "/"); // Zip requires forward slashes

        if full_path.is_dir() {
            let _ = zip.add_directory(&path_str, options);
        } else {
            zip.start_file(&path_str, options).map_err(|e| e.to_string())?;
            let mut f = File::open(&full_path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e: std::io::Error| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        }
        
        processed += 1;
        if last_emit.elapsed().as_millis() > 100 {
             let percentage = ((processed as f64 / total_files as f64) * 100.0) as u8;
             let _ = window.emit("world_archive_progress", ProgressPayload {
                percentage,
                details: format!("Archiving: {}", path_str),
            });
            last_emit = std::time::Instant::now();
        }
    }

    let _ = zip.finish().map_err(|e| e.to_string())?;

    let _ = window.emit("world_archive_progress", ProgressPayload {
        percentage: 100,
        details: "Archive created successfully!".to_string(),
    });

    Ok(())
}

#[tauri::command]
pub fn import_world<R: tauri::Runtime>(
    window: tauri::Window<R>,
    server_path: String,
    zip_path: String,
    new_level_name: String,
) -> Result<(), String> {
    use std::io::{Read, Write};
    use tauri::Emitter;

    let path = Path::new(&server_path);
    
    // Safety check: Don't allow empty name or path traversal
    if new_level_name.trim().is_empty() || new_level_name.contains("..") || new_level_name.contains("/") || new_level_name.contains("\\") {
        return Err("Invalid world name".to_string());
    }

    // Determine target path. For Bedrock -> "worlds/new_name". For Java -> "new_name".
    // We try to detect server type or just defaults.
    // To be safe and support both cleanly:
    // If "worlds" folder exists, put it there (Bedrock).
    // Else put it in root (Java).
    
    let worlds_folder = path.join("worlds");
    let target_world_path = if worlds_folder.exists() && worlds_folder.is_dir() {
        worlds_folder.join(&new_level_name)
    } else {
        path.join(&new_level_name)
    };

    if target_world_path.exists() {
        return Err(format!("A world named '{}' already exists.", new_level_name));
    }

    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 0,
        details: format!("Importing into '{}'...", new_level_name),
    });

    // Create target directory
    fs::create_dir_all(&target_world_path).map_err(|e| e.to_string())?;

    // Open Zip
    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Consolidated extraction logic (similar to upload_dimension but targeting a specific new folder)
    let mut root_prefix: Option<String> = None;
    let mut all_have_common_root = true;

    // Check for common root folder in zip
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name();
            if let Some(first_slash) = name.find('/') {
                let prefix = &name[..first_slash + 1];
                if let Some(ref existing) = root_prefix {
                    if existing != prefix {
                        all_have_common_root = false;
                        break;
                    }
                } else {
                    root_prefix = Some(prefix.to_string());
                }
            } else {
                all_have_common_root = false;
                break;
            }
        }
    }
    
    let strip_prefix = if all_have_common_root { root_prefix } else { None };

    // Calculate total size
    let mut total_size: u64 = 0;
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            total_size += file.size();
        }
    }

    let mut extracted_bytes: u64 = 0;
    let mut last_emit_time = std::time::Instant::now();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let file_name = file.name().to_string();

        // Strip prefix
        let relative_path = if let Some(ref prefix) = strip_prefix {
            if file_name.starts_with(prefix) {
                file_name.strip_prefix(prefix).unwrap_or(&file_name)
            } else {
                &file_name
            }
        } else {
            &file_name
        };

        if relative_path.is_empty() { continue; }

        let outpath = target_world_path.join(relative_path);

        if file_name.ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                     fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            let mut buffer = [0u8; 8192];
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                outfile.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
                extracted_bytes += n as u64;

                if last_emit_time.elapsed().as_millis() > 100 {
                    let percentage = if total_size > 0 {
                        ((extracted_bytes as f64 / total_size as f64) * 100.0) as u8
                    } else { 0 };
                    let _ = window.emit("world_upload_progress", ProgressPayload {
                        percentage,
                        details: format!("Extracting: {}", relative_path),
                    });
                    last_emit_time = std::time::Instant::now();
                }
            }
        }
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
             if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)).ok();
            }
        }
    }

    let _ = window.emit("world_upload_progress", ProgressPayload {
        percentage: 100,
        details: "Import complete!".to_string(),
    });

    Ok(())
}
