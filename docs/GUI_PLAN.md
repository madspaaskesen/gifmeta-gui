# 🦀 gifmeta-gui roadmap

Living plan for the desktop app. Status: ⬜ todo · 🟨 in progress · ✅ done
Crate-side plan (frames, delete, re-key): `../gifmeta/docs/FRAME_EDITING_PLAN.md`

**gifmeta-gui 0.2.0** (2026-10-22, unreleased): sections 1 + 2, section 3 items 1, 2, 4, 5 and parts of 4/5 ✅.
Tested in a browser with Playwright + mocked Tauri IPC on the 40-frame forge GIF (no console errors);
`cargo check` of `src-tauri` against gifmeta 0.5.0 is clean.

---

## 1. Upgrade to gifmeta 0.5.0 ✅
gifmeta 0.5.0 is published (2026-10-22). In `src-tauri/Cargo.toml`: `gifmeta = "0.5.0"`.

What changes for the GUI:
- `get_info` JSON gains `loop_infinite`, `keyframe_count`, `is_delta_optimized`, and per frame
  `left`, `top`, `width`, `height`, `disposal` ("any" | "keep" | "background" | "previous"),
  `uses_transparent_pixels`, `is_keyframe`. All additive.
- ⚠️ `loop_count` is now **1** (not 0) for GIFs without a loop block (plays once). 0 still = infinite.
- Previews from `get_frame_image` are now correct for optimized GIFs (no more "ghost" frames) — free fix.
- `gifmeta::mod_gif` is deprecated (still works, compiler warning). Switch `save_modified_gif` to:
  ```rust
  gifmeta::modify_gif(&input, gifmeta::ModOptions {
      output, loop_mode, delay_all, delays, ..Default::default()
  })
  ```
  with `loop_mode: Option<gifmeta::LoopMode>` built from `loopInfinite` / `loopCount`.
- New: `gifmeta::get_frame_image_with_mode(path, frame, PreviewMode::{Composited, Raw})`.

## 2. Frame-type & loop UI ✅
- Frame list: 🔑 / Δ badge per frame (`is_keyframe`).
- Status bar: `Optimized: 1/40 keyframes` when `is_delta_optimized`.
- FrameViewer: rect (`left,top width×height`), disposal, keyframe yes/no.
- FrameViewer toggle **Pretty / Raw**: `get_frame` gets a `raw: bool` param → `get_frame_image_with_mode`.
  Raw view on a CSS checkerboard background so transparency is visible. Cache images per mode
  (`imageData` / `rawImageData`).
- Settings: **"Infinite loop" checkbox** that disables the loop-count field (min 1). Send
  `loopInfinite: bool` + `loopCount` to `save_modified_gif`.

## 3. Biggest wins (impact / effort)
1. ✅ **Play button with edited delays** — in-app playback using the frames + current (edited) delays,
   so changes are visible before saving. Preload frames, `setTimeout` per frame delay (0 cs → treat
   as 10 cs like browsers do, show a hint). Play / pause / loop according to loop setting.
2. ✅ **Faster frame transfer** — `get_frame` currently returns `Vec<u8>` → serialised as a JSON array
   of numbers (an 800×516 PNG becomes several MB of text). Return `tauri::ipc::Response::new(bytes)`
   (raw binary, arrives as `ArrayBuffer`) or a base64 string. Then `URL.createObjectURL(new Blob([...]))`
   instead of FileReader → data URL.
3. ⬜ **Thumbnails in the frame list** (list now shows 🔑/Δ + delay; thumbnails still todo) — lazy-load with `IntersectionObserver`, small size (render the
   PNG scaled via CSS or add a crate/Tauri helper that downsizes). Combined with 🔑/Δ badges.
4. ✅ **Save dialog + feedback** — `save()` from `@tauri-apps/plugin-dialog` instead of the output text
   field (keep the suggested `_modified.gif` name as default). Toast/status message instead of `alert()`.
   "● modified" indicator when there are unsaved changes; confirm before opening another file.
5. ✅ **Windows paths** — `split("/")` breaks on `C:\…` (filename in status bar + output suggestion).
   Use `@tauri-apps/api/path` (`basename`, `dirname`, `join`) instead.

## 4. Nice next
- ✅ Keyboard: ↑/↓ (and ←/→) change frame, Space = play/pause.
- ✅ Drag & drop a GIF onto the window (Tauri drag-drop event).
- ⬜ Multi-select frames (shift/cmd click) → set delay for all selected.
- ⬜ Timeline view: one bar per frame, width = delay — timing at a glance; click to select.
- ✅ "Reset changes" button. ⬜ file size before/after save.
- 🟨 Theme choice is remembered (localStorage). ⬜ follow OS by default.
- ✅ Bigger default window (1200×800, min 800×560).
- ⬜ Later (crate phases 4–5): per-frame checkboxes **"Convert to full image"** and **"Delete frame"**
  (deleted frames dimmed / struck through, excluded from duration + frame count). Always send
  **original** frame indices.

## 5. Cleanup
- ✅ Remove dead `applyToAllChange` in `SettingsTab.jsx`.
- ✅ `class=` → `className=`.
- ✅ Removed unused `greet` command. ⬜ `capabilities/default.json` and `main.json` are identical — delete `main.json` and drop it from `tauri.conf.json`.
- ✅ Status bar shows the real sum; viewer shows "plays as 100 ms" for delays < 2 cs and playback mimics browsers.
- ✅ Version 0.2.0 in package.json, Cargo.toml, tauri.conf.json; About shows app version.
- ✅ README feature list updated.

## 6. Logo 🦀
- ⬜ Turn Mads' own crab (README `crab_idle_loop` GIF) into a proper **SVG logo** — vectorize
  (vtracer/potrace) or redraw clean with few colours so it reads at 16 px and large.
- ⬜ Generate all app icons from it: `npx tauri icon logo.png` (replaces default Tauri icons in
  `src-tauri/icons/`). Use it in README, About tab and the header.

## 7. Known limitations / next ideas
- ✅ Playback preload is now a single pass (0.2.1): Tauri command `get_all_frames` streams every frame
  through a `Channel` using gifmeta 0.5.1's `FrameRenderer` (forge GIF ~15× faster, 150-frame GIF ~56×).
  Falls back to per-frame `get_frame` if the command is unavailable.
- ⬜ Frame images are cached as object URLs per `index:mode` (`src/lib/frameImages.js`) — memory grows
  with very large GIFs; could cap or use thumbnails.

## 8. Later
- ⬜ macOS signing + notarization (needs Apple Developer account) → no more `xattr` quarantine step.
- ⬜ Tauri updater for automatic updates.
- ⬜ Minimal frontend tests (vitest) for helpers: filename shortening, most-common delay, delay maps.
