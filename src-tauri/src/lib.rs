use std::collections::HashMap;
use std::path::PathBuf;

use gifmeta::{DeleteMode, FrameRenderer, LoopMode, ModOptions, PreviewMode};
use tauri::ipc::{Channel, InvokeResponseBody, Response};

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

/// Renders **all** frames in one pass (gifmeta `FrameRenderer`) and streams each one as raw
/// PNG bytes through `on_frame`, in order, as soon as it is ready. Returns the frame count.
///
/// Much faster than calling `get_frame` per frame (which replays the GIF from the start).
#[tauri::command]
async fn get_all_frames(
    path: String,
    raw: Option<bool>,
    on_frame: Channel,
) -> Result<usize, String> {
    let mode = if raw.unwrap_or(false) {
        PreviewMode::Raw
    } else {
        PreviewMode::Composited
    };
    tauri::async_runtime::spawn_blocking(move || {
        let mut count = 0;
        for frame in FrameRenderer::open(&path, mode)? {
            let frame = frame?;
            let png = gifmeta::utils::extract_frame_as_png::encode_png(&frame.image)?;
            on_frame
                .send(InvokeResponseBody::Raw(png))
                .map_err(|e| format!("Could not send frame {}: {e}", frame.index))?;
            count += 1;
        }
        Ok(count)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// What `save_modified_gif` did (sent back to the UI).
#[derive(serde::Serialize)]
struct SaveReport {
    output: String,
    frames_in: usize,
    frames_out: usize,
    deleted: Vec<usize>,
    rekeyed: Vec<usize>,
    quantized: Vec<usize>,
    warnings: Vec<String>,
}

/// Writes the modified GIF and returns a report.
///
/// * `loop_infinite = true` → loop forever (wins over `loop_count`)
/// * `loop_count = n` (n ≥ 1) → plays n times
/// * both `None`/false → keep the original loop setting
/// * `delete_frames` / `keyframes`: ORIGINAL frame indices; `unoptimize`: every frame → full image
/// * `delete_mode`: `"merge"` (default, delay goes to the previous frame) or `"drop"`
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn save_modified_gif(
    input_path: String,
    output_path: Option<String>,
    loop_infinite: Option<bool>,
    loop_count: Option<u16>,
    delay_all: Option<u16>,
    delays: Option<HashMap<usize, u16>>,
    delete_frames: Option<Vec<usize>>,
    keyframes: Option<Vec<usize>>,
    unoptimize: Option<bool>,
    delete_mode: Option<String>,
) -> Result<SaveReport, String> {
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
        delete_frames,
        keyframes,
        unoptimize: unoptimize.unwrap_or(false),
        delete_mode: match delete_mode.as_deref() {
            Some("drop") => DeleteMode::DropDelay,
            _ => DeleteMode::MergeDelay,
        },
        ..Default::default()
    };
    let input = PathBuf::from(input_path);
    let r =
        tauri::async_runtime::spawn_blocking(move || gifmeta::modify_gif_with_report(&input, opts))
            .await
            .map_err(|e| e.to_string())??;
    Ok(SaveReport {
        output: r.output.display().to_string(),
        frames_in: r.frames_in,
        frames_out: r.frames_out,
        warnings: r.warnings(),
        deleted: r.deleted,
        rekeyed: r.rekeyed,
        quantized: r.quantized,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_info,
            get_frame,
            get_all_frames,
            save_modified_gif
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
