mod commands;
mod models;

use commands::register_commands;
use models::*;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    secwin_path: Mutex<Option<PathBuf>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            secwin_path: Mutex::new(None),
        })
        .invoke_handler(register_commands())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}