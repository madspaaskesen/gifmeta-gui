mod plan;

use std::collections::HashMap;
use std::path::PathBuf;

use gifmeta::{DeleteMode, FrameRenderer, LoopMode, ModOptions, PreviewMode};
use plan::{PlanItem, PlanSettings, SaveReport};
use tauri::ipc::{Channel, InvokeResponseBody, Response};

/// `loop_infinite = true` → forever (wins), `loop_count = n ≥ 1` → n plays, neither → keep.
fn loop_mode(
    loop_infinite: Option<bool>,
    loop_count: Option<u16>,
) -> Result<Option<LoopMode>, String> {
    match (loop_infinite.unwrap_or(false), loop_count) {
        (true, _) => Ok(Some(LoopMode::Infinite)),
        (false, Some(0)) => Err("Loop count must be at least 1".into()),
        (false, Some(n)) => Ok(Some(LoopMode::Times(n))),
        (false, None) => Ok(None),
    }
}

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
    let loop_mode = loop_mode(loop_infinite, loop_count)?;
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
    Ok(r.into())
}

/// Saves an edited frame list: frames of the input GIF and/or inserted images, in any order,
/// with one delay each (`plan = [{ frame: 3, delay: 10 }, { image: "/x.png", delay: 50 }, …]`).
/// Frames not in the plan are deleted; frames listed twice are duplicated.
/// `keyframes` are ORIGINAL indices.
#[tauri::command]
async fn save_gif_plan(
    input_path: String,
    output_path: String,
    plan: Vec<PlanItem>,
    loop_infinite: Option<bool>,
    loop_count: Option<u16>,
    keyframes: Option<Vec<usize>>,
    unoptimize: Option<bool>,
) -> Result<SaveReport, String> {
    let settings = PlanSettings {
        loop_mode: loop_mode(loop_infinite, loop_count)?,
        keyframes: keyframes.unwrap_or_default(),
        unoptimize: unoptimize.unwrap_or(false),
    };
    tauri::async_runtime::spawn_blocking(move || {
        plan::save_plan(
            &PathBuf::from(input_path),
            &PathBuf::from(output_path),
            &plan,
            &settings,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Creates a new GIF from image files (PNG/JPEG/WebP, same size), one delay per image.
#[tauri::command]
async fn create_gif_from_images(
    images: Vec<String>,
    delays: Vec<u16>,
    output_path: String,
    loop_infinite: Option<bool>,
    loop_count: Option<u16>,
) -> Result<SaveReport, String> {
    if images.len() != delays.len() {
        return Err("Need one delay per image".into());
    }
    let loop_mode = loop_mode(loop_infinite, loop_count)?;
    tauri::async_runtime::spawn_blocking(move || {
        plan::create_from_images(&images, &delays, &PathBuf::from(output_path), loop_mode)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reads an image file (PNG/JPEG/WebP/GIF) the user picked, as raw bytes for a preview.
#[tauri::command]
async fn read_image(path: String) -> Result<Response, String> {
    let ok = PathBuf::from(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            matches!(
                e.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "gif"
            )
        })
        .unwrap_or(false);
    if !ok {
        return Err("Only PNG, JPEG, WebP or GIF images can be added".into());
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&path))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Could not read image: {e}"))?;
    Ok(Response::new(bytes))
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
            save_modified_gif,
            save_gif_plan,
            create_gif_from_images,
            read_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
