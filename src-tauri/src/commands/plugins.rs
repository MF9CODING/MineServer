use std::path::Path;
use std::fs;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub name: String,
    pub filename: String,
    pub enabled: bool,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
pub struct ModrinthSearchResponse {
    pub hits: Vec<ModrinthHit>,
    pub total_hits: u64,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModrinthHit {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ModrinthVersion {
    pub id: String,
    pub files: Vec<ModrinthFile>,
}

#[derive(Debug, Deserialize)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
}

#[tauri::command]
pub async fn list_plugins(server_path: String) -> Result<Vec<InstalledPlugin>, String> {
    let plugins_dir = Path::new(&server_path).join("plugins");
    
    if !plugins_dir.exists() {
        return Ok(vec![]);
    }

    let mut plugins = Vec::new();
    
    let entries = fs::read_dir(&plugins_dir)
        .map_err(|e| format!("Failed to read plugins directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
                
            let size = path.metadata().map(|m| m.len()).unwrap_or(0);

            if filename.ends_with(".jar") {
                let name = filename.trim_end_matches(".jar").to_string();
                plugins.push(InstalledPlugin { name, filename, enabled: true, size });
            } else if filename.ends_with(".jar.disabled") {
                let name = filename.trim_end_matches(".jar.disabled").to_string();
                plugins.push(InstalledPlugin { name, filename, enabled: false, size });
            }
        }
    }

    Ok(plugins)
}

#[tauri::command]
pub async fn search_modrinth_plugins(query: String, offset: Option<u64>) -> Result<PaginatedResult<ModrinthHit>, String> {
    let client = Client::new();
    let off = offset.unwrap_or(0);
    
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets=[[\"project_type:plugin\"]]&limit=20&offset={}",
        urlencoding::encode(&query),
        off
    );

    let resp = client.get(&url)
        .header("User-Agent", "Mineserver/1.0.0 (contact@mineserver.app)")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let search_result: ModrinthSearchResponse = resp.json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(PaginatedResult {
        items: search_result.hits,
        total: search_result.total_hits,
    })
}

#[tauri::command]
pub async fn install_modrinth_plugin(project_id: String, server_path: String) -> Result<String, String> {
    let client = Client::new();
    
    // Get latest version
    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders=[\"paper\",\"spigot\",\"bukkit\"]",
        project_id
    );

    let resp = client.get(&versions_url)
        .header("User-Agent", "Mineserver/1.0.0 (contact@mineserver.app)")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let versions: Vec<ModrinthVersion> = resp.json()
        .await
        .map_err(|e| format!("Failed to parse versions: {}", e))?;

    let version = versions.first()
        .ok_or("No compatible version found")?;

    let file = version.files.iter()
        .find(|f| f.primary)
        .or_else(|| version.files.first())
        .ok_or("No file found for this version")?;

    // Download the jar
    let jar_bytes = client.get(&file.url)
        .header("User-Agent", "Mineserver/1.0.0 (contact@mineserver.app)")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    // Ensure plugins directory exists
    let plugins_dir = Path::new(&server_path).join("plugins");
    fs::create_dir_all(&plugins_dir)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;

    // Write the jar file
    let jar_path = plugins_dir.join(&file.filename);
    fs::write(&jar_path, &jar_bytes)
        .map_err(|e| format!("Failed to write plugin: {}", e))?;

    Ok(file.filename.clone())
}

#[tauri::command]
pub async fn toggle_plugin(server_path: String, filename: String) -> Result<String, String> {
    let plugins_dir = Path::new(&server_path).join("plugins");
    let old_path = plugins_dir.join(&filename);
    
    if !old_path.exists() {
        return Err("File not found".to_string());
    }

    let new_filename = if filename.ends_with(".disabled") {
        filename.trim_end_matches(".disabled").to_string()
    } else {
        format!("{}.disabled", filename)
    };

    let new_path = plugins_dir.join(&new_filename);
    
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to toggle plugin: {}", e))?;

    Ok(new_filename)
}

#[tauri::command]
pub async fn delete_plugin(server_path: String, filename: String) -> Result<(), String> {
    let plugin_path = Path::new(&server_path).join("plugins").join(&filename);
    
    if !plugin_path.exists() {
        return Err("Plugin not found".to_string());
    }

    fs::remove_file(&plugin_path)
        .map_err(|e| format!("Failed to delete plugin: {}", e))?;

    Ok(())
}

// --- Mod Support (for Forge/Fabric) ---

#[tauri::command]
pub async fn search_modrinth_mods(query: String, loader: String, offset: Option<u64>) -> Result<PaginatedResult<ModrinthHit>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0 (contact@mineserver.app)")
        .build()
        .map_err(|e| e.to_string())?;
    
    let off = offset.unwrap_or(0);
    // For mods, we filter by project_type:mod and the loader (forge or fabric)
    let facets = format!("[[\"project_type:mod\"],[\"categories:{}\"]]", loader);
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets={}&limit=20&offset={}",
        urlencoding::encode(&query),
        urlencoding::encode(&facets),
        off
    );
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let search_result: ModrinthSearchResponse = resp.json().await.map_err(|e| e.to_string())?;
    
    Ok(PaginatedResult {
        items: search_result.hits,
        total: search_result.total_hits,
    })
}

#[tauri::command]
pub async fn install_modrinth_mod(
    project_id: String, 
    server_path: String,
    loader: String,
    game_version: String,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Fetch versions for this loader and game version
    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders=[\"{}\"]&game_versions=[\"{}\"]",
        project_id, loader, game_version
    );
    
    let version_resp = client.get(&versions_url).send().await.map_err(|e| e.to_string())?;
    let versions: Vec<ModrinthVersion> = version_resp.json().await.map_err(|e| e.to_string())?;
    
    let version = versions.first().ok_or("No compatible version found for this loader/game version")?;
    
    // Find primary jar file
    let file = version.files.iter().find(|f| f.primary)
        .or_else(|| version.files.first())
        .ok_or("No downloadable file found")?;
    
    // Download to mods folder
    let mods_dir = Path::new(&server_path).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    
    let jar_path = mods_dir.join(&file.filename);
    let jar_resp = client.get(&file.url).send().await.map_err(|e| e.to_string())?;
    let jar_bytes = jar_resp.bytes().await.map_err(|e| e.to_string())?;
    
    fs::write(&jar_path, &jar_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

// --- Hangar Support (PaperMC) ---

#[derive(Debug, Deserialize, Serialize)]
pub struct HangarPlugin {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct HangarSearchResponse {
    result: Vec<HangarProject>,
}

#[derive(Debug, Deserialize)]
struct HangarProject {
    namespace: HangarNamespace,
    name: String,
    description: String,
    stats: HangarStats,
    #[serde(rename = "avatarUrl")]
    avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HangarNamespace {
    owner: String,
    slug: String,
}

#[derive(Debug, Deserialize)]
struct HangarStats {
    downloads: u64,
}

#[tauri::command]
pub async fn search_hangar_plugins(query: String) -> Result<Vec<HangarPlugin>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    let url = format!(
        "https://hangar.papermc.io/api/v1/projects?q={}&limit=20",
        urlencoding::encode(&query)
    );
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let search: HangarSearchResponse = resp.json().await.map_err(|e| e.to_string())?;
    
    let plugins: Vec<HangarPlugin> = search.result.into_iter().map(|p| HangarPlugin {
        id: p.namespace.slug.clone(),
        slug: format!("{}/{}", p.namespace.owner, p.namespace.slug),
        title: p.name,
        description: p.description,
        downloads: p.stats.downloads,
        icon_url: p.avatar_url,
        source: "hangar".to_string(),
    }).collect();
    
    Ok(plugins)
}

#[tauri::command]
pub async fn install_hangar_plugin(slug: String, server_path: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Get latest version
    let versions_url = format!("https://hangar.papermc.io/api/v1/projects/{}/versions?limit=1", slug);
    let versions_resp = client.get(&versions_url).send().await.map_err(|e| e.to_string())?;
    let versions: serde_json::Value = versions_resp.json().await.map_err(|e| e.to_string())?;
    
    let version_name = versions["result"][0]["name"].as_str().ok_or("No version found")?;
    
    // Download PAPER platform jar
    let download_url = format!(
        "https://hangar.papermc.io/api/v1/projects/{}/versions/{}/PAPER/download",
        slug, version_name
    );
    
    let jar_resp = client.get(&download_url).send().await.map_err(|e| e.to_string())?;
    let jar_bytes = jar_resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Save to plugins folder
    let plugins_dir = Path::new(&server_path).join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    
    let filename = slug.split('/').last().unwrap_or("plugin");
    let jar_path = plugins_dir.join(format!("{}.jar", filename));
    fs::write(&jar_path, &jar_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

// --- Spigot Support ---
// Note: SpigotMC API is limited, using spiget.org mirror

#[derive(Debug, Deserialize, Serialize)]
pub struct SpigotPlugin {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: String,
}

#[tauri::command]
pub async fn search_spigot_plugins(query: String, page: Option<u32>) -> Result<Vec<SpigotPlugin>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    let page_num = page.unwrap_or(1);
    
    // Spiget.org API - use different endpoint for empty query
    let url = if query.is_empty() || query == "minecraft" {
        // Get popular resources sorted by downloads
        format!(
            "https://api.spiget.org/v2/resources?size=20&page={}&sort=-downloads",
            page_num
        )
    } else {
        format!(
            "https://api.spiget.org/v2/search/resources/{}?size=20&page={}",
            urlencoding::encode(&query),
            page_num
        )
    };
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let resources: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
    
    let plugins: Vec<SpigotPlugin> = resources.into_iter().filter_map(|r| {
        Some(SpigotPlugin {
            id: r["id"].as_u64()?.to_string(),
            slug: r["id"].as_u64()?.to_string(),
            title: r["name"].as_str()?.to_string(),
            description: r["tag"].as_str().unwrap_or("").to_string(),
            downloads: r["downloads"].as_u64().unwrap_or(0),
            icon_url: r["icon"]["url"].as_str().map(|s| format!("https://www.spigotmc.org/{}", s)),
            source: "spigot".to_string(),
        })
    }).collect();
    
    Ok(plugins)
}

#[tauri::command]
pub async fn install_spigot_plugin(resource_id: String, server_path: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Get resource info
    let info_url = format!("https://api.spiget.org/v2/resources/{}", resource_id);
    let info_resp = client.get(&info_url).send().await.map_err(|e| e.to_string())?;
    let info: serde_json::Value = info_resp.json().await.map_err(|e| e.to_string())?;
    let name = info["name"].as_str().unwrap_or("plugin");
    
    // Download
    let download_url = format!("https://api.spiget.org/v2/resources/{}/download", resource_id);
    let jar_resp = client.get(&download_url).send().await.map_err(|e| e.to_string())?;
    let jar_bytes = jar_resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Save
    let plugins_dir = Path::new(&server_path).join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    
    let jar_path = plugins_dir.join(format!("{}.jar", name.replace(" ", "-")));
    fs::write(&jar_path, &jar_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

// --- Poggit Support (PocketMine) ---

#[derive(Debug, Deserialize, Serialize)]
pub struct PoggitPlugin {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: String,
}

#[tauri::command]
pub async fn search_poggit_plugins(query: String) -> Result<Vec<PoggitPlugin>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Poggit API
    let url = if query.is_empty() {
        "https://poggit.pmmp.io/releases.json?top".to_string()
    } else {
        format!("https://poggit.pmmp.io/releases.json?name={}", urlencoding::encode(&query))
    };
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let releases: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    
    let plugins: Vec<PoggitPlugin> = releases.into_iter().take(20).filter_map(|r| {
        Some(PoggitPlugin {
            id: r["project_id"].as_u64()?.to_string(),
            slug: r["name"].as_str()?.to_string(),
            title: r["name"].as_str()?.to_string(),
            description: r["tagline"].as_str().unwrap_or("").to_string(),
            downloads: r["downloads"].as_u64().unwrap_or(0),
            icon_url: r["icon_url"].as_str().map(|s| s.to_string()),
            source: "poggit".to_string(),
        })
    }).collect();
    
    Ok(plugins)
}

#[tauri::command]
pub async fn install_poggit_plugin(plugin_name: String, server_path: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Get plugin info
    let url = format!("https://poggit.pmmp.io/releases.json?name={}", urlencoding::encode(&plugin_name));
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let releases: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    
    let release = releases.first().ok_or("Plugin not found")?;
    let artifact_url = release["artifact_url"].as_str().ok_or("No download URL")?;
    let name = release["name"].as_str().unwrap_or("plugin");
    
    // Download phar
    let phar_resp = client.get(artifact_url).send().await.map_err(|e| e.to_string())?;
    let phar_bytes = phar_resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Save to plugins folder
    let plugins_dir = Path::new(&server_path).join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    
    let phar_path = plugins_dir.join(format!("{}.phar", name));
    fs::write(&phar_path, &phar_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

// --- CurseForge Support ---
// Note: CurseForge requires API key, using fallback

#[tauri::command]
pub async fn search_curseforge_plugins(query: String, page: Option<u32>) -> Result<Vec<SpigotPlugin>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    // CurseForge API requires key, using public search
    let _page = page.unwrap_or(1);
    let url = format!(
        "https://api.curseforge.com/v1/mods/search?gameId=432&classId=5&searchFilter={}&pageSize=20",
        urlencoding::encode(&query)
    );
    
    // Try CurseForge, but likely will fail without API key
    // Return empty for now - would need $2.99/month API access
    let _ = client.get(&url).send().await;
    
    // Fallback: return notice
    Ok(vec![SpigotPlugin {
        id: "0".to_string(),
        slug: "curseforge-info".to_string(),
        title: "CurseForge requires API key".to_string(),
        description: "CurseForge API requires a paid API key. Use Modrinth or Hangar instead.".to_string(),
        downloads: 0,
        icon_url: None,
        source: "curseforge".to_string(),
    }])
}

// --- Polymart Support ---

#[tauri::command]
pub async fn search_polymart_plugins(query: String, page: Option<u32>) -> Result<Vec<SpigotPlugin>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    let page_num = page.unwrap_or(1);
    
    // Polymart uses POST requests
    let url = "https://api.polymart.org/v1/search";
    
    let resp = client.post(url)
        .form(&[
            ("query", query.as_str()),
            ("limit", "20"),
            ("start", &((page_num - 1) * 20).to_string()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = resp.json().await.unwrap_or(serde_json::json!({"response": {"result": []}}));
    
    // Try different response structures
    let resources = data["response"]["result"].as_array()
        .or_else(|| data["response"]["resources"].as_array())
        .map(|arr| arr.to_vec())
        .unwrap_or_default();
    
    let plugins: Vec<SpigotPlugin> = resources.into_iter().filter_map(|r| {
        Some(SpigotPlugin {
            id: r["id"].as_u64().or_else(|| r["id"].as_str().and_then(|s| s.parse().ok()))?.to_string(),
            slug: r["id"].as_u64().or_else(|| r["id"].as_str().and_then(|s| s.parse().ok()))?.to_string(),
            title: r["title"].as_str().or_else(|| r["name"].as_str())?.to_string(),
            description: r["subtitle"].as_str().or_else(|| r["tagLine"].as_str()).unwrap_or("").to_string(),
            downloads: r["downloads"].as_u64().unwrap_or(0),
            icon_url: r["thumbnailURL"].as_str().or_else(|| r["thumbnail"].as_str()).map(|s| s.to_string()),
            source: "polymart".to_string(),
        })
    }).collect();
    
    // If no results from Polymart API, return a notice
    if plugins.is_empty() {
        Ok(vec![SpigotPlugin {
            id: "0".to_string(),
            slug: "polymart-notice".to_string(),
            title: "No plugins found".to_string(),
            description: "Try searching on Modrinth or SpigotMC for more results.".to_string(),
            downloads: 0,
            icon_url: None,
            source: "polymart".to_string(),
        }])
    } else {
        Ok(plugins)
    }
}

#[tauri::command]
pub async fn install_polymart_plugin(resource_id: String, server_path: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
        
    let download_url = format!("https://polymart.org/resource/{}/download", resource_id);
    let resp = client.get(&download_url).send().await.map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    
    // Try to infer filename from header
    let filename = resp.headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .and_then(|cd| cd.to_str().ok())
        .and_then(|cd| {
            if let Some(idx) = cd.find("filename=") {
                Some(cd[idx+9..].trim_matches('"').to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| format!("polymart-{}.jar", resource_id));

    let jar_bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Check if HTML (login wall)
    if jar_bytes.starts_with(b"<!DOCTYPE html") || jar_bytes.starts_with(b"<html") {
         return Err("Failed to download: Plugin requires login or is paid.".to_string());
    }

    let plugins_dir = Path::new(&server_path).join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    
    let jar_path = plugins_dir.join(&filename);
    fs::write(&jar_path, &jar_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

// --- Plugin Version Fetching ---

#[derive(Debug, Serialize)]
pub struct VersionInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "gameVersions")]
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "datePublished")]
    pub date_published: String,
    #[serde(rename = "versionType")]
    pub version_type: String, 
}

#[tauri::command]
pub async fn get_plugin_versions(source: String, project_id: String, slug: String) -> Result<Vec<VersionInfo>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mineserver/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    match source.as_str() {
        "polymart" => {
            Ok(vec![VersionInfo {
                id: project_id.clone(),
                name: "Latest".to_string(),
                game_versions: vec!["Latest".to_string()],
                loaders: vec!["spigot".to_string(), "paper".to_string()],
                download_url: format!("https://polymart.org/resource/{}/download", project_id),
                date_published: "".to_string(),
                version_type: "Release".to_string(),
            }])
        },
        "modrinth" => {
            let url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);
            let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let versions: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
            
            let result: Vec<VersionInfo> = versions.into_iter().take(10).filter_map(|v| {
                Some(VersionInfo {
                    id: v["id"].as_str()?.to_string(),
                    name: v["version_number"].as_str()?.to_string(),
                    game_versions: v["game_versions"].as_array()?.iter().filter_map(|g| g.as_str().map(|s| s.to_string())).collect(),
                    loaders: v["loaders"].as_array()?.iter().filter_map(|l| l.as_str().map(|s| s.to_string())).collect(),
                    download_url: v["files"][0]["url"].as_str().unwrap_or("").to_string(),
                    date_published: v["date_published"].as_str().unwrap_or("").to_string(),
                    version_type: v["version_type"].as_str().unwrap_or("release").to_string(),
                })
            }).collect();
            
            Ok(result)
        },
        "hangar" => {
            let url = format!("https://hangar.papermc.io/api/v1/projects/{}/versions?limit=10", slug);
            let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            
            let versions = data["result"].as_array().map(|a| a.to_vec()).unwrap_or_default();
            let result: Vec<VersionInfo> = versions.into_iter().filter_map(|v| {
                let name = v["name"].as_str()?.to_string();
                let game_versions: Vec<String> = v["platformDependencies"]["PAPER"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|g| g.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default();
                
                Some(VersionInfo {
                    id: name.clone(),
                    name,
                    game_versions,
                    loaders: vec!["paper".to_string(), "spigot".to_string()],
                    download_url: "".to_string(),
                    date_published: v["createdAt"].as_str().unwrap_or("").to_string(),
                    version_type: v["channel"]["name"].as_str().unwrap_or("Release").to_string(),
                })
            }).collect();
            
            Ok(result)
        },
        "spigot" => {
            // Spiget versions
            let url = format!("https://api.spiget.org/v2/resources/{}/versions?size=10", project_id);
            let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let versions: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
            
            let result: Vec<VersionInfo> = versions.into_iter().filter_map(|v| {
                Some(VersionInfo {
                    id: v["id"].as_u64()?.to_string(),
                    name: v["name"].as_str().unwrap_or("Unknown").to_string(),
                    game_versions: vec!["1.8-1.21".to_string()],
                    loaders: vec!["spigot".to_string(), "paper".to_string(), "bukkit".to_string()],
                    download_url: format!("https://api.spiget.org/v2/resources/{}/download", project_id),
                    date_published: "".to_string(), // Spiget versions endpoint lacks easy date
                    version_type: "Release".to_string(),
                })
            }).collect();
            
            // If no versions, return a default
            if result.is_empty() {
                Ok(vec![VersionInfo {
                    id: "latest".to_string(),
                    name: "Latest".to_string(),
                    game_versions: vec!["1.8-1.21".to_string()],
                    loaders: vec!["spigot".to_string(), "paper".to_string()],
                    download_url: format!("https://api.spiget.org/v2/resources/{}/download", project_id),
                    date_published: "".to_string(),
                    version_type: "Release".to_string(),
                }])
            } else {
                Ok(result)
            }
        },
        _ => {
            // Default fallback
            Ok(vec![VersionInfo {
                id: "latest".to_string(),
                name: "Latest".to_string(),
                game_versions: vec!["1.20".to_string(), "1.21".to_string()],
                loaders: vec!["paper".to_string(), "spigot".to_string()],
                download_url: "".to_string(),
                date_published: "".to_string(),
                version_type: "Release".to_string(),
            }])
        }
    }
}
