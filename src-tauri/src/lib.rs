use std::collections::HashMap;
use std::path::PathBuf;

use gifmeta::{LoopMode, ModOptions, PreviewMode};
use tauri::ipc::Response;

/// Reads all metadata incl. per-frame info (rect, disposal, keyframe flag).
#[tauri::command]
async fn get_info(path: String) -> Result<gifmeta::gifmeta_structs::GifMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || gifmeta::get_metadata(&PathBuf::from(path), true))
        .await
        .map_err(|e| e.to_string())?
}

/// Renders one frame as PNG and returns the raw bytes (arrives as an `ArrayBuffer` in JS —
/// much faster than a JSON array of numbers).
///
/// `raw = true` → only the pixels stored in this frame; otherwise the frame as it looks when
/// the GIF plays.
#[tauri::command]
async fn get_frame(path: String, frame: usize, raw: Option<bool>) -> Result<Response, String> {
    let mode = if raw.unwrap_or(false) {
        PreviewMode::Raw
    } else {
        PreviewMode::Composited
    };
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        gifmeta::get_frame_image_with_mode(path, frame, mode)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(Response::new(bytes))
}

/// Writes the modified GIF and returns the path that was written.
///
/// * `loop_infinite = true` → loop forever (wins over `loop_count`)
/// * `loop_count = n` (n ≥ 1) → plays n times
/// * both `None`/false → keep the original loop setting
#[tauri::command]
async fn save_modified_gif(
    input_path: String,
    output_path: Option<String>,
    loop_infinite: Option<bool>,
    loop_count: Option<u16>,
    delay_all: Option<u16>,
    delays: Option<HashMap<usize, u16>>,
) -> Result<String, String> {
    let loop_mode = match (loop_infinite.unwrap_or(false), loop_count) {
        (true, _) => Some(LoopMode::Infinite),
        (false, Some(0)) => return Err("Loop count must be at least 1".into()),
        (false, Some(n)) => Some(LoopMode::Times(n)),
        (false, None) => None,
    };
    let opts = ModOptions {
        output: output_path.map(PathBuf::from),
        loop_mode,
        delay_all,
        delays,
    };
    let input = PathBuf::from(input_path);
    let out = tauri::async_runtime::spawn_blocking(move || gifmeta::modify_gif(&input, opts))
        .await
        .map_err(|e| e.to_string())??;
    Ok(out.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_info,
            get_frame,
            save_modified_gif
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
