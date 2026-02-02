
use walkdir::WalkDir;

#[derive(serde::Serialize)]
pub struct JavaInstall {
    path: String,
    version: String,
    arch: String,
}

#[tauri::command]
pub fn get_java_versions() -> Vec<JavaInstall> {
    let mut installs = Vec::new();

    #[cfg(target_os = "windows")]
    let search_paths = vec![
        "C:\\Program Files\\Java",
        "C:\\Program Files (x86)\\Java",
        "C:\\Users", // Start of user dir might be too deep, maybe just skip for now or look in specific locations like .sdkman?
    ];

    #[cfg(not(target_os = "windows"))]
     let search_paths = vec![
        "/usr/lib/jvm",
        "/usr/java",
    ];

    for path in search_paths {
        if !std::path::Path::new(path).exists() { continue; }
        
        for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
             let fname = entry.file_name().to_string_lossy();
             if fname == "java.exe" || fname == "java" {
                 // Verify it
                 if let Ok(output) = std::process::Command::new(entry.path()).arg("-version").output() {
                     let stderr = String::from_utf8_lossy(&output.stderr);
                     // Parse version roughly
                     let version = stderr.lines().next().unwrap_or("Unknown").to_string();
                     
                     installs.push(JavaInstall {
                         path: entry.path().to_string_lossy().to_string(),
                         version: version.replace("\"", ""), // Cleanup
                         arch: "64-bit".to_string(), // Simplified assumption or parse further
                     });
                 }
             }
        }
    }
    
    // Add PATH java if simple check works
    if let Ok(output) = std::process::Command::new("java").arg("-version").output() {
         let stderr = String::from_utf8_lossy(&output.stderr);
         installs.push(JavaInstall {
             path: "java".to_string(),
             version: stderr.lines().next().unwrap_or("System Default").replace("\"", ""),
             arch: "System Default".to_string(),
         });
    }

    // Deduplicate logic could go here
    installs
}

// --- Server Properties Support ---

use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn read_server_properties(server_path: String) -> Result<HashMap<String, String>, String> {
    let props_path = Path::new(&server_path).join("server.properties");
    
    if !props_path.exists() {
        return Ok(HashMap::new());
    }
    
    let content = fs::read_to_string(&props_path)
        .map_err(|e| format!("Failed to read server.properties: {}", e))?;
    
    let mut properties = HashMap::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        if let Some((key, value)) = line.split_once('=') {
            properties.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    
    Ok(properties)
}

#[tauri::command]
pub fn update_server_properties(server_path: String, properties: HashMap<String, String>) -> Result<(), String> {
    let props_path = Path::new(&server_path).join("server.properties");
    
    // Read existing content
    let existing_content = if props_path.exists() {
        fs::read_to_string(&props_path).unwrap_or_default()
    } else {
        String::new()
    };
    
    let mut lines: Vec<String> = Vec::new();
    let mut updated_keys: Vec<String> = Vec::new();
    
    // Update existing lines
    for line in existing_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            lines.push(line.to_string());
            continue;
        }
        
        if let Some((key, _)) = trimmed.split_once('=') {
            let key = key.trim();
            if let Some(new_value) = properties.get(key) {
                lines.push(format!("{}={}", key, new_value));
                updated_keys.push(key.to_string());
            } else {
                lines.push(line.to_string());
            }
        } else {
            lines.push(line.to_string());
        }
    }
    
    // Add new properties that weren't in the file
    for (key, value) in &properties {
        if !updated_keys.contains(key) {
            lines.push(format!("{}={}", key, value));
        }
    }
    
    let new_content = lines.join("\n");
    fs::write(&props_path, new_content)
        .map_err(|e| format!("Failed to write server.properties: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn install_grimac(server_path: String) -> Result<String, String> {
    let path = Path::new(&server_path).join("plugins");
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    
    let jar_path = path.join("GrimAC.jar");
    if jar_path.exists() {
        return Ok("GrimAC already installed.".to_string());
    }

    // Direct download from GitHub Releases
    let url = "https://github.com/GrimAnticheat/Grim/releases/download/2.3.61/GrimAC.jar";

    let client = reqwest::Client::new();
    let resp = client.get(url)
        .header("User-Agent", "Mineserver/1.0")
        .send()
        .await
        .map_err(|e| format!("Network Error: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }
    
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    
    fs::write(&jar_path, &bytes).map_err(|e| format!("File Write Error: {}", e))?;
    
    Ok("GrimAC installed successfully! Restart your server.".to_string())
}
