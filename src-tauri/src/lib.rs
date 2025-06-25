use gifmeta;
use std::collections::HashMap;
use std::path::PathBuf;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_info(path: String) -> Result<gifmeta::gifmeta_structs::GifMetadata, String> {
    use std::path::PathBuf;
    let path_buf = PathBuf::from(path);
    gifmeta::get_metadata(&path_buf, true).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_frame(path: String, frame: usize) -> Result<Vec<u8>, String> {
    println!("📦 get_frame called with path: {}, frame: {}", path, frame);

    match gifmeta::get_frame_image(path, frame) {
        Ok(data) => {
            println!("✅ Frame image extracted, bytes: {}", data.len());
            Ok(data)
        }
        Err(e) => {
            eprintln!("❌ Failed to get frame image: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn save_modified_gif(
    input_path: String,
    output_path: Option<String>,
    loop_count: Option<u16>,
    delay_all: Option<u16>,
    delays: Option<HashMap<usize, u16>>,
) -> Result<(), String> {
    let input = PathBuf::from(input_path);
    let output = output_path.map(PathBuf::from);

    gifmeta::mod_gif(&input, output, loop_count, delay_all, delays)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_info,
            get_frame,
            save_modified_gif
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
