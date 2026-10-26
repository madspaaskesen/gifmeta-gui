# gifmeta-gui (Tauri desktop app)

Cross-platform desktop GUI for the `gifmeta` crate: open a GIF, browse frames, edit per-frame and
global delay + loop count, delete / insert / duplicate / re-order frames, create a GIF from images, save. Version 0.4.0. Tauri 2 + React 18 + Vite 6 + Tailwind 3 + DaisyUI 5.
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
                           get_all_frames(path, raw?, onFrame: Channel) → streams every frame (raw PNG) in order, returns count
                           save_modified_gif(inputPath, outputPath, loopInfinite?, loopCount?, delayAll?, delays?,
                             deleteFrames?, keyframes?, unoptimize?, deleteMode?) → SaveReport (frames only changed in place)
                           save_gif_plan(inputPath, outputPath, plan: [{frame}|{image}, delay], loopInfinite?, loopCount?,
                             keyframes?, unoptimize?) → SaveReport (insert / duplicate / re-order; 2 gifmeta passes, see plan.rs)
                           create_gif_from_images(images, delays, outputPath, loopInfinite?, loopCount?) → SaveReport
                           read_image(path) → raw bytes of a PNG/JPEG/WebP/GIF the user picked (preview)
src-tauri/src/plan.rs    save_plan (pass 1: delete/duplicate/insert/re-key, pass 2: order + delays) + tests
src-tauri/Cargo.toml     gifmeta = "0.7.0" from crates.io
src-tauri/capabilities/  default.json + main.json (identical; dialog open/save + opener)
src/GifMetaApp.jsx       all app state: file, original metadata, editable frames, loop, playback, keyboard,
                         drag & drop, save, toasts, tabs (controlled tabs, not radio inputs)
src/lib/gif.js           pure helpers: frame items (frameItems/imageItem/duplicateItem/moveItem), dirty + structure check,
                         playbackSequence() (skip deleted, merge delays → [{pos, delayCs}]), saveCommand() + buildSaveArgs /
                         buildPlanArgs / buildCreateArgs
src/lib/frameImages.js   cache of images as object URLs ("index:mode" for GIF frames, "file:<path>" for images),
                         preloadAll() via get_all_frames stream, loadItem/peekItem, imageSize()
src/components/FrameList.jsx    🔑/Δ/🖼️ + delay per item, copy/new badges, drag ⠿ to re-order (pointer events), auto-scroll
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

## Frame items (0.4.0)
- `frames` is a list of **items**, `selectedIndex` is a **position** in it (not a frame index).
  `{ kind: "frame", key, index, copy, deleted, rekey, … }` = frame of the GIF (`index` = ORIGINAL index),
  `{ kind: "image", key, path, name, width, height, delay_cs }` = inserted image. Keys are unique (React list keys).
- Copies and images are **removed** on delete; original frames get `deleted: true` (undoable). Re-key applies to
  every item of the same original index.
- Save routing (`saveCommand`): new GIF from images (`original.synthetic`) → `create_gif_from_images`;
  structure changed (insert / copy / move) → `save_gif_plan` with final delays (deleted delays already merged);
  otherwise the old `save_modified_gif`. After creating, the new file is opened as a normal GIF.
- Inserted images must match the GIF size (checked in the UI via the decoded image, and again in the crate).
- Drag & drop of files: a `.gif` opens it, images are inserted (or start a new GIF when nothing is open).
  The drag-drop listener is removed even if the effect is cleaned up before it was registered (StrictMode).
- ↺ Reset = back to the file as opened (new GIF: `baselineRef`, the images as picked); ✕ Close = `closeAll()`, empty state.
- "Unsaved changes" confirmation is an in-app modal (`components/ConfirmDialog.jsx`, `askConfirm()`), not the native
  dialog — the native `confirm()` didn't work for Mads on macOS (Close never closed an unsaved new GIF).
- Header 💾 Save / Create GIF: first click opens the **Save tab** (output path + spinner visible), a click while the
  Save tab is active saves. Opening a file, a new GIF or closing goes back to the Viewer tab.
- Re-ordering uses pointer events, not HTML5 drag & drop (Tauri's file drop disables HTML5 DnD on Windows).

## Gotchas
- Frame edit flags live on the editable frames: `f.deleted`, `f.rekey`; global: `edits = { unoptimize, deleteMode }`.
  Playback + status duration use `playbackSequence` so they match what gifmeta will write.
- `loop_count` from the crate is user-facing: 0 = infinite (also `loop_infinite: true`), 1 = once, n = n times.
  The GUI never sends 0 — it sends `loopInfinite: true` instead.
- `get_frame` for frame n replays frames 0…n — fine for one frame, never loop it over all frames; use
  `get_all_frames` (single pass, streamed through a Tauri `Channel`). Channel messages may arrive just after
  the command resolves — `preloadAll` waits until all `count` frames are received.
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

## Release + signing
1. Bump version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (+ lock files).
2. Publish a GitHub release → `release.yml` builds unsigned `.dmg` (x64 + aarch64), `.msi`, `.AppImage`.
3. When the workflow is done: Mac `scripts/release-mac.sh` (signs with the Developer ID via
   `APPLE_SIGNING_IDENTITY`, notarizes + staples the dmg with `notarytool --keychain-profile gifmeta-notary`,
   same names → `gh release upload --clobber`); Windows `scripts/sign-windows.ps1 -Tag vX.Y.Z` (signs the .msi).
   Uploading before CI is done gets overwritten by CI — both scripts check the workflow status first.

