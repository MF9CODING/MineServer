use std::path::Path;
use std::fs::File;
use std::io::Write;
use reqwest::Client;
use tauri::{Window, Emitter};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt; // For chmod later

#[derive(Debug, Deserialize)]
struct MojangManifest {
    versions: Vec<MojangVersion>,
}

#[derive(Debug, Deserialize)]
struct MojangVersion {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct VersionDetails {
    downloads: VersionDownloads,
}

#[derive(Debug, Deserialize)]
struct VersionDownloads {
    server: DownloadEntry,
}

#[derive(Debug, Deserialize)]
struct DownloadEntry {
    url: String,
}

#[derive(Debug, Deserialize)]
struct PaperBuilds {
    builds: Vec<PaperBuild>,
}

#[derive(Debug, Deserialize)]
struct PaperBuild {
    build: u32,
    downloads: PaperDownloads,
}

#[derive(Debug, Deserialize)]
struct PaperDownloads {
    application: PaperApplication,
}

#[derive(Debug, Deserialize)]
struct PaperApplication {
    name: String,
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    percentage: u64,
    current: u64,
    total: u64,
}

#[tauri::command]
pub async fn download_server(
    window: Window,
    app_handle: tauri::AppHandle,
    server_type: String,
    version: String,
    server_path: String,
    preserve_config: Option<bool>,
) -> Result<String, String> {
    let preserve = preserve_config.unwrap_or(false);
    
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    // ... (rest is same until post-processing)
    let url = resolve_url(&client, &server_type, &version).await?;
    
    // Ensure directory exists
    let path = Path::new(&server_path);
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }

    let file_name = if server_type == "bedrock" { 
        "bedrock-server.zip" 
    } else if server_type == "nukkit" {
        "nukkit.jar"
    } else { 
        "server.jar" 
    };
    let file_path = path.join(file_name);
    
    // Download
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let total_size = res.content_length().unwrap_or(0);
    
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
             let _ = window.emit("download-progress", DownloadProgress {
                percentage: (downloaded * 100) / total_size,
                current: downloaded,
                total: total_size,
            });
        }
    }

    // Runtime Download (PocketMine Only for now)
    if server_type == "pocketmine" {
        // No-op for PC (PHP is usually system installed or bundled differently)
        // If we want to support Windows/Linux bundled PHP later, we can add it here.
    }

    // Post-Processing
    if server_type == "bedrock" {
        // Backup configs if preserve is true
        let configs = ["server.properties", "whitelist.json", "permissions.json"];
        if preserve {
            for config in configs.iter() {
                let config_path = path.join(config);
                if config_path.exists() {
                    let _ = std::fs::rename(&config_path, path.join(format!("{}.bak", config)));
                }
            }
        }

        // Unzip
        let file = File::open(&file_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(&path).map_err(|e| e.to_string())?;
        
        // Restore configs
        if preserve {
            for config in configs.iter() {
                let backup_path = path.join(format!("{}.bak", config));
                let target_path = path.join(config);
                
                if backup_path.exists() {
                    // Remove the default file extracted from zip
                    if target_path.exists() {
                        let _ = std::fs::remove_file(&target_path);
                    }
                    // Restore backup
                    let _ = std::fs::rename(&backup_path, target_path);
                }
            }
        }

        // Remove zip
        std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    } else {
        // EULA
        let eula_path = path.join("eula.txt");
        let mut eula_file = File::create(eula_path).map_err(|e| e.to_string())?;
        eula_file.write_all(b"eula=true").map_err(|e| e.to_string())?;
    }

    Ok("Download complete".into())
}

async fn resolve_url(client: &Client, server_type: &str, version: &str) -> Result<String, String> {
    match server_type {
        "vanilla" => {
            let manifest: MojangManifest = client.get("https://launchermeta.mojang.com/mc/game/version_manifest.json")
                .send().await.map_err(|e| e.to_string())?
                .json().await.map_err(|e| e.to_string())?;
                
            let v = manifest.versions.iter().find(|v| v.id == version)
                .ok_or("Version not found")?;
                
            let details: VersionDetails = client.get(&v.url)
                .send().await.map_err(|e| e.to_string())?
                .json().await.map_err(|e| e.to_string())?;
                
            Ok(details.downloads.server.url)
        },
        "paper" => {
            let builds: PaperBuilds = client.get(&format!("https://api.papermc.io/v2/projects/paper/versions/{version}/builds"))
                .send().await.map_err(|e| e.to_string())?
                .json().await.map_err(|e| e.to_string())?;
                
            let latest = builds.builds.last().ok_or("No builds found")?;
            let download = &latest.downloads.application.name;
            
            Ok(format!("https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{}/downloads/{}", latest.build, download))
        },
        "bedrock" => {
            // BLOCK OFFICIAL BEDROCK ON ANDROID (x86_64 only)


            // Bedrock-OSS / Standard URL pattern
            // https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.131.1.zip
            
            // If version is "latest", fetch it or specific version
            let version_to_download = if version == "latest" || version.is_empty() {
                // We could fetch latest from API, but for now fallback to known stable or let frontend handle "latest"
                // Ideally frontend passes specific version. 
                "1.21.131.1" 
            } else {
                version
            };

            // Construct URL based on OS
            #[cfg(target_os = "windows")]
            let platform_path = "bin-win";
            
            #[cfg(target_os = "linux")]
            let platform_path = "bin-linux";

            #[cfg(target_os = "macos")]
            let platform_path = "bin-linux"; // MacOS can sometimes run linux binaries via compat, or just fail.

            Ok(format!("https://www.minecraft.net/bedrockdedicatedserver/{}/bedrock-server-{}.zip", platform_path, version_to_download))
        },
        "forge" => {
            // Forge downloads installer which needs to be run
            // For now use serverpacklocator or direct forge installer URL
            // Format: https://maven.minecraftforge.net/net/minecraftforge/forge/{mc_version}-{forge_version}/forge-{mc_version}-{forge_version}-installer.jar
            
            // Fetch the recommended/latest forge version for this MC version
            let promos_resp = client.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
                .send().await.map_err(|e| e.to_string())?;
            let promos: serde_json::Value = promos_resp.json().await.map_err(|e| e.to_string())?;
            
            // Look for recommended, then latest
            let forge_version = promos.get("promos")
                .and_then(|p| p.get(&format!("{}-recommended", version)).or_else(|| p.get(&format!("{}-latest", version))))
                .and_then(|v| v.as_str())
                .ok_or("Forge version not found")?;
            
            // Return installer URL (user needs to run it manually or we can automate later)
            Ok(format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-installer.jar",
                version, forge_version, version, forge_version
            ))
        },
        "neoforge" => {
            // NeoForge installer download
            // Format: https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar
            // Version is like "21.4.100" (not MC version)
            Ok(format!(
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
                version, version
            ))
        },
        "fabric" => {
            // Fabric server launcher - fetch latest loader and installer versions
            let loader_resp = client.get("https://meta.fabricmc.net/v2/versions/loader")
                .send().await.map_err(|e| e.to_string())?;
            let loaders: Vec<serde_json::Value> = loader_resp.json().await.map_err(|e| e.to_string())?;
            let loader_version = loaders.first()
                .and_then(|l| l.get("version").and_then(|v| v.as_str()))
                .ok_or("Fabric loader not found")?;
            
            let installer_resp = client.get("https://meta.fabricmc.net/v2/versions/installer")
                .send().await.map_err(|e| e.to_string())?;
            let installers: Vec<serde_json::Value> = installer_resp.json().await.map_err(|e| e.to_string())?;
            let installer_version = installers.first()
                .and_then(|i| i.get("version").and_then(|v| v.as_str()))
                .ok_or("Fabric installer not found")?;
            
            // Fabric server jar URL
            Ok(format!(
                "https://meta.fabricmc.net/v2/versions/loader/{}/{}/{}/server/jar",
                version, loader_version, installer_version
            ))
        },
        "spigot" => {
            // Spigot requires BuildTools, but we can use GetBukkit mirrors
            // Or direct download from GetBukkit
            Ok(format!("https://download.getbukkit.org/spigot/spigot-{}.jar", version))
        },
        "purpur" => {
            // Purpur API - similar to Paper
            let builds_resp = client.get(&format!("https://api.purpurmc.org/v2/purpur/{}", version))
                .send().await.map_err(|e| e.to_string())?;
            let builds: serde_json::Value = builds_resp.json().await.map_err(|e| e.to_string())?;
            
            let latest_build = builds.get("builds")
                .and_then(|b| b.get("latest"))
                .and_then(|l| l.as_str())
                .ok_or("Purpur build not found")?;
            
            Ok(format!("https://api.purpurmc.org/v2/purpur/{}/{}/download", version, latest_build))
        },
        "pocketmine" => {
            // PocketMine-MP - download from GitHub releases
            // Version is like "5.11.2" (tag name)
            Ok(format!(
                "https://github.com/pmmp/PocketMine-MP/releases/download/{}/PocketMine-MP.phar",
                version
            ))
        },
        "nukkit" => {
            // Cloudburst Nukkit - Java-based Bedrock Server
            // Use CI for latest stable build
            Ok("https://ci.cloudburstmc.org/job/Nukkit/lastSuccessfulBuild/artifact/target/nukkit-1.0-SNAPSHOT.jar".to_string())
        },
        _ => Err("Unsupported server type".to_string())
    }
}
