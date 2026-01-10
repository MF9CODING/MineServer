pub mod models;
pub mod commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .manage(commands::runner::ServerProcessState::new())
    .manage(commands::system::SystemState::new())
    .manage(commands::network_manager::NetworkState::new())
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::server::delete_server,
            commands::server::get_server_files,
            commands::server::read_server_file,
            commands::server::write_server_file,
            commands::server::create_directory,
            commands::server::delete_file,
            commands::server::delete_directory,

            commands::server::rename_file,
            commands::server::duplicate_file,

            commands::server::copy_file_path,
            commands::server::archive_files,
            commands::server::extract_file,
            commands::server::write_binary_file,
            commands::system::get_system_info,
            commands::system::get_local_ip,


            commands::versions::get_nukkit_versions,
            commands::versions::get_vanilla_versions,
            commands::versions::get_paper_versions,
            commands::versions::get_bedrock_versions,
            commands::versions::get_forge_versions,
            commands::versions::get_fabric_versions,
            commands::versions::get_spigot_versions,
            commands::versions::get_purpur_versions,
            commands::downloader::download_server,
            commands::runner::start_server,
            commands::runner::stop_server,
            commands::runner::send_server_command,
            commands::runner::get_server_resource_usage,
            commands::runner::is_server_running,
            commands::runner::get_server_resource_usage,
            commands::runner::is_server_running,
            commands::runner::get_running_servers,
            commands::runner::clear_log_file,
            commands::world_manager::get_world_info,
            commands::world_manager::delete_world,
            commands::world_manager::delete_dimension_folder,
            commands::world_manager::regenerate_world,
            commands::world_manager::upload_world,
            commands::world_manager::upload_dimension,
            commands::network_manager::upnp_map_port,
            commands::network_manager::upnp_remove_port,
            commands::network_manager::install_playit,
            commands::network_manager::start_playit_tunnel,
            commands::network_manager::stop_playit_tunnel,
            commands::network_manager::reset_playit_tunnel,
            commands::network_manager::check_internet_connection,
            commands::network_manager::get_public_ip,
            commands::server_config::get_java_versions,
            commands::server_config::read_server_properties,
            commands::server_config::update_server_properties,
            commands::plugins::list_plugins,
            commands::plugins::search_modrinth_plugins,
            commands::plugins::install_modrinth_plugin,
            commands::plugins::delete_plugin,
            commands::plugins::search_modrinth_mods,
            commands::plugins::install_modrinth_mod,
            commands::plugins::search_hangar_plugins,
            commands::plugins::install_hangar_plugin,
            commands::plugins::search_spigot_plugins,
            commands::plugins::install_spigot_plugin,
            commands::plugins::search_poggit_plugins,
            commands::plugins::install_poggit_plugin,
            commands::plugins::search_curseforge_plugins,
            commands::plugins::search_polymart_plugins,
            commands::plugins::get_plugin_versions,
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::delete_backup,
            commands::backup::restore_backup,
            commands::backup::save_scheduled_tasks,
            commands::backup::load_scheduled_tasks
        ]).run(tauri::generate_context!())
        .expect("error while running tauri application");
}
