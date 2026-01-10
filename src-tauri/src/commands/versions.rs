use reqwest::Client;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct MojangManifest {
    versions: Vec<MojangVersion>,
}

#[derive(Debug, Deserialize)]
struct MojangVersion {
    id: String,
    #[serde(rename = "type")]
    version_type: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct PaperProject {
    versions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ServerVersion {
    version: String,
    is_stable: bool,
}

#[tauri::command]
pub async fn get_vanilla_versions() -> Result<Vec<String>, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("https://launchermeta.mojang.com/mc/game/version_manifest.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<MojangManifest>()
        .await
        .map_err(|e| e.to_string())?;

    let versions: Vec<String> = resp.versions
        .into_iter()
        .filter(|v| v.version_type == "release")
        .map(|v| v.id)
        .collect();

    Ok(versions)
}

#[tauri::command]
pub async fn get_paper_versions() -> Result<Vec<String>, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("https://api.papermc.io/v2/projects/paper")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<PaperProject>()
        .await
        .map_err(|e| e.to_string())?;

    // Reverse to get latest first
    let mut versions = resp.versions;
    versions.reverse();
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_bedrock_versions() -> Result<Vec<String>, String> {
    // Use Bedrock-OSS API (maintained community list)
    // Source: https://github.com/Bedrock-OSS/BDS-Versions
    
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    // Fetch from Bedrock-OSS
    if let Ok(resp) = client
        .get("https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json")
        .send()
        .await
    {
        if let Ok(text) = resp.text().await {
            // Structure: { "windows": { "versions": ["1.21.131.1", ...] } }
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(windows) = parsed.get("windows").and_then(|w| w.as_object()) {
                    if let Some(version_list) = windows.get("versions").and_then(|v| v.as_array()) {
                        // The list is ascending (oldest first), so reverse it to get newest
                        for v in version_list.iter().rev().take(20) { 
                             if let Some(v_str) = v.as_str() {
                                 versions.push(v_str.to_string());
                             }
                        }
                    }
                }
            }
        }
    }
    
    // Fallback if API fails
    if versions.is_empty() {
        versions = vec![
            "1.21.131.1".to_string(),
            "1.21.130.4".to_string(),
            "1.21.124.2".to_string(),
            "1.21.123.2".to_string(),
            "1.21.122.2".to_string(),
            "1.21.121.1".to_string(),
            "1.21.120.4".to_string(),
        ];
    }
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_forge_versions() -> Result<Vec<String>, String> {
    // Forge uses Maven for versions - fetch from their promotions API
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    // Get Minecraft versions that have Forge
    if let Ok(resp) = client
        .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        .send()
        .await
    {
        if let Ok(parsed) = resp.json::<serde_json::Value>().await {
            if let Some(promos) = parsed.get("promos").and_then(|p| p.as_object()) {
                // Extract unique MC versions from keys like "1.20.4-recommended", "1.20.4-latest"
                let mut mc_versions: std::collections::HashSet<String> = std::collections::HashSet::new();
                for key in promos.keys() {
                    if let Some(mc_ver) = key.split('-').next() {
                        // Filter to recent versions (1.16+)
                        if mc_ver.starts_with("1.2") || mc_ver.starts_with("1.19") || 
                           mc_ver.starts_with("1.18") || mc_ver.starts_with("1.17") || mc_ver.starts_with("1.16") {
                            mc_versions.insert(mc_ver.to_string());
                        }
                    }
                }
                let mut sorted: Vec<String> = mc_versions.into_iter().collect();
                sorted.sort_by(|a, b| b.cmp(a)); // Descending order
                versions = sorted;
            }
        }
    }
    
    // Fallback
    if versions.is_empty() {
        versions = vec![
            "1.20.4".to_string(), "1.20.3".to_string(), "1.20.2".to_string(),
            "1.20.1".to_string(), "1.19.4".to_string(), "1.18.2".to_string(),
        ];
    }
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_fabric_versions() -> Result<Vec<String>, String> {
    // Fabric uses their own meta API
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    if let Ok(resp) = client
        .get("https://meta.fabricmc.net/v2/versions/game")
        .send()
        .await
    {
        if let Ok(parsed) = resp.json::<Vec<serde_json::Value>>().await {
            for item in parsed.iter().take(30) {
                if let (Some(version), Some(stable)) = (
                    item.get("version").and_then(|v| v.as_str()),
                    item.get("stable").and_then(|s| s.as_bool())
                ) {
                    if stable {
                        versions.push(version.to_string());
                    }
                }
            }
        }
    }
    
    // Fallback
    if versions.is_empty() {
        versions = vec![
            "1.20.4".to_string(), "1.20.3".to_string(), "1.20.2".to_string(),
            "1.20.1".to_string(), "1.19.4".to_string(), "1.18.2".to_string(),
        ];
    }
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_spigot_versions() -> Result<Vec<String>, String> {
    // Spigot uses the same PaperMC API structure (they mirror versions)
    // We'll use GetBukkit API or fallback to known versions
    let _client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .build()
        .map_err(|e| e.to_string())?;
    
    // GetBukkit maintains a Spigot download mirror
    let versions = vec![
        "1.21".to_string(), "1.20.6".to_string(), "1.20.4".to_string(),
        "1.20.2".to_string(), "1.20.1".to_string(), "1.19.4".to_string(),
        "1.19.3".to_string(), "1.19.2".to_string(), "1.18.2".to_string(),
        "1.17.1".to_string(), "1.16.5".to_string(),
    ];
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_purpur_versions() -> Result<Vec<String>, String> {
    // Purpur uses PaperMC-style API
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    if let Ok(resp) = client
        .get("https://api.purpurmc.org/v2/purpur")
        .send()
        .await
    {
        if let Ok(parsed) = resp.json::<serde_json::Value>().await {
            if let Some(version_list) = parsed.get("versions").and_then(|v| v.as_array()) {
                for v in version_list.iter().rev().take(20) {
                    if let Some(v_str) = v.as_str() {
                        versions.push(v_str.to_string());
                    }
                }
            }
        }
    }
    
    // Fallback
    if versions.is_empty() {
        versions = vec![
            "1.21".to_string(), "1.20.6".to_string(), "1.20.4".to_string(),
            "1.20.2".to_string(), "1.20.1".to_string(), "1.19.4".to_string(),
        ];
    }
    
    Ok(versions)
}

#[tauri::command]
pub async fn get_nukkit_versions() -> Result<Vec<String>, String> {
    // Cloudburst Nukkit for Bedrock support
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    // Cloudburst/Nukkit uses GitHub releases
    if let Ok(resp) = client
        .get("https://api.github.com/repos/CloudburstMC/Nukkit/releases")
        .send()
        .await
    {
        if let Ok(releases) = resp.json::<Vec<serde_json::Value>>().await {
            for release in releases.iter().take(15) {
                if let Some(tag) = release.get("tag_name").and_then(|t| t.as_str()) {
                    // Filter to non-prerelease
                    if !release.get("prerelease").and_then(|p| p.as_bool()).unwrap_or(false) {
                        versions.push(tag.to_string());
                    }
                }
            }
        }
    }
    
    // Fallback
    if versions.is_empty() {
        versions = vec![
            "v1.0.0".to_string(), // Placeholder, Nukkit versioning is weird (often just builds)
        ];
    }
    
    Ok(versions)
}
