# gifmeta-gui (Tauri desktop app)

Cross-platform desktop GUI for the `gifmeta` crate: open a GIF, browse frames, edit per-frame and
global delay + loop count, save. Version 0.2.0. Tauri 2 + React 18 + Vite 6 + Tailwind 3 + DaisyUI 5.
Plain JavaScript/JSX (no TypeScript), no frontend tests.

## Commands
```bash
npm install
npm run tauri dev     # Vite on :1420 (strictPort) + Rust backend
npm run tauri build
npm run build         # frontend only → dist/
cd src-tauri && cargo build && cargo fmt -- --check   # what CI runs (Ubuntu 22.04 + webkit/gtk deps)
```

## Layout
```
src-tauri/src/lib.rs     Tauri commands (async, work in spawn_blocking):
                           get_info(path) → GifMetadata (show_frames = true)
                           get_frame(path, frame, raw?) → tauri::ipc::Response (raw PNG bytes → ArrayBuffer in JS)
                           save_modified_gif(inputPath, outputPath, loopInfinite?, loopCount?, delayAll?, delays?) → written path
src-tauri/Cargo.toml     gifmeta = "0.5.0" from crates.io
src-tauri/capabilities/  default.json + main.json (identical; dialog open/save + opener)
src/GifMetaApp.jsx       all app state: file, original metadata, editable frames, loop, playback, keyboard,
                         drag & drop, save, toasts, tabs (controlled tabs, not radio inputs)
src/lib/gif.js           pure helpers: durations, loop label, dirty check, buildSaveArgs()
src/lib/frameImages.js   cache of rendered frames as object URLs ("index:mode"), preloadAll()
src/components/FrameList.jsx    🔑/Δ + delay per frame, ● when edited, auto-scroll to selection
src/components/FrameViewer.jsx  ◀ ▶ Play, Pretty/Raw toggle, delay input, frame badges, checkerboard
src/components/SettingsTab.jsx  delay for all frames, ∞ loop toggle + plays count (min 1), theme
src/components/SaveTab.jsx      output path + "Choose…" (save dialog) + save
src/components/Toast.jsx        DaisyUI toasts (instead of alert())
src/components/AboutTab.jsx     about + app version
docs/GUI_PLAN.md         roadmap / status
```

## Data flow
- Open (button, or drop a .gif on the window) → `get_info` → `original` (never mutated) + `frames`
  (editable copy) + `loop = { infinite, count }` (count ≥ 1). Output path suggested via
  `@tauri-apps/api/path` (`dirname`/`basename`/`join` — works on Windows).
- Frame images: `cache.load(index, "pretty" | "raw")` → `get_frame` → `ArrayBuffer` → Blob → object URL.
  The cache is cleared (URLs revoked) when a new file is opened; stale loads are dropped.
- Play: preloads all pretty frames (progress bar), then steps with `setTimeout(playbackDelayMs(delay))`
  using the *edited* delays. Delays < 2 cs play as 10 cs (like browsers). Stops after `loop.count`
  plays (ends on the last frame) unless infinite.
- Save: `buildSaveArgs()` only sends what changed: `loopInfinite`/`loopCount` if the loop changed,
  `delayAll` if all delays are equal, otherwise the full `delays` map `{ index: cs }`.
  Tauri maps camelCase JS args → snake_case Rust params.
- "Unsaved" = has changes vs. the file AND differs from the last saved state.

## Gotchas
- `loop_count` from the crate is user-facing: 0 = infinite (also `loop_infinite: true`), 1 = once, n = n times.
  The GUI never sends 0 — it sends `loopInfinite: true` instead.
- Rendering frame n in the crate replays frames 0…n → preloading for playback is O(n²). See GUI_PLAN §7.
- Don't put image data into `frames`/metadata state (JSON tab renders it) — use the image cache.
- Keyboard shortcuts are ignored while focus is in an input.
- The capability files must allow every dialog used (`dialog:allow-open`, `dialog:allow-save`; `confirm` via `dialog:default`).
- Testing without a desktop: run `npx vite --port 1420` and drive it with Playwright, mocking
  `window.__TAURI_INTERNALS__.invoke` (commands + `plugin:path|*`, `plugin:dialog|*`, `plugin:event|*`).

## Roadmap
**GUI plan: `docs/GUI_PLAN.md`** (upgrade to gifmeta 0.5.0, frame badges, pretty/raw, play button,
faster frame transfer, thumbnails, save dialog, cleanup). Update its status markers as items land.

## Frame editing roadmap
Full plan: `../gifmeta/docs/FRAME_EDITING_PLAN.md`. GUI steps, in order:
1. Phase 2 — show 🔑/Δ badge per frame, `Optimized: x/y keyframes` in status bar, rect + disposal in
   FrameViewer. Uses new crate fields `is_keyframe`, `left/top/width/height`, `disposal`,
   `keyframe_count`, `is_delta_optimized` (crate > 0.4.1; until published use a local path dep, don't commit it).
2. Phase 4 — per-frame checkbox "Convert to full image" → `keyframes: [indices]`.
3. Phase 5 — per-frame checkbox "Delete frame" → `deleteFrames: [indices]`; dim/strike deleted frames
   and exclude them from duration/frame count in the status bar.
Always send **original** frame indices — the crate applies delays, re-keys and deletes by original index.
