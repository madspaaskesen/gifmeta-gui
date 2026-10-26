// src/components/FrameViewer.jsx
import { playbackDelayMs } from "../lib/gif";

const DISPOSAL_HELP = {
  any: "Unspecified — next frame is drawn on top",
  keep: "Keep — next frame is drawn on top",
  background: "Background — area is cleared before the next frame",
  previous: "Previous — canvas is restored to before this frame",
};

export default function FrameViewer({
  metadata,
  frame,
  position,
  count,
  imageUrl,
  mode,
  setMode,
  onDelayChange,
  onPrev,
  onNext,
  playing,
  onTogglePlay,
  preload,
  onToggleDelete,
  onToggleRekey,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onInsertImages,
  canDelete = true,
  unoptimize = false,
}) {
  if (!metadata || !frame) {
    return (
      <div className="text-center opacity-60 italic p-4">
        {metadata ? "Select a frame…" : "Open a GIF, make a new one from images, or drop files onto the window…"}
      </div>
    );
  }

  const isImage = frame.kind === "image";
  const removable = isImage || frame.copy; // copies and images are removed, not flagged
  const fullCanvas =
    frame.left === 0 &&
    frame.top === 0 &&
    frame.width === metadata.width &&
    frame.height === metadata.height;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <div className="join">
          <button className="btn btn-sm join-item" onClick={onPrev} disabled={playing} title="Previous frame (↑)">
            ◀
          </button>
          <button
            className={`btn btn-sm join-item ${playing ? "btn-warning" : "btn-primary"}`}
            onClick={onTogglePlay}
            title="Play with the current edits (Space)"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button className="btn btn-sm join-item" onClick={onNext} disabled={playing} title="Next frame (↓)">
            ▶
          </button>
        </div>

        <div className="join" title="Pretty: as the GIF looks when playing. Raw: only the pixels stored in this frame.">
          <button
            className={`btn btn-sm join-item ${mode === "pretty" ? "btn-active" : ""}`}
            onClick={() => setMode("pretty")}
          >
            ✨ Pretty
          </button>
          <button
            className={`btn btn-sm join-item ${mode === "raw" ? "btn-active" : ""}`}
            onClick={() => setMode("raw")}
            disabled={playing || isImage}
          >
            🧩 Raw
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span>Delay</span>
          <input
            type="number"
            className="input input-bordered input-sm w-20"
            value={frame.delay_cs}
            min={0}
            disabled={playing}
            onChange={(e) => onDelayChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <span className="opacity-70">cs</span>
        </label>
      </div>

      {/* Arrange */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <div className="join">
          <button className="btn btn-sm join-item" onClick={onMoveUp} disabled={playing || position === 0} title="Move up (Alt+↑)">
            ⬆
          </button>
          <button
            className="btn btn-sm join-item"
            onClick={onMoveDown}
            disabled={playing || position >= count - 1}
            title="Move down (Alt+↓)"
          >
            ⬇
          </button>
        </div>
        <button className="btn btn-sm" onClick={onDuplicate} disabled={playing} title="Copy this frame, the copy goes right after it (D)">
          📑 Duplicate
        </button>
        <button className="btn btn-sm" onClick={onInsertImages} disabled={playing} title="Insert image files after this frame (I)">
          ➕ Insert image…
        </button>
      </div>

      {/* Frame edits */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        {removable ? (
          <button
            className="btn btn-sm btn-error btn-outline"
            onClick={onToggleDelete}
            disabled={playing || !canDelete}
            title={canDelete ? "Remove this frame (⌫)" : "At least one frame must remain"}
          >
            🗑️ Remove {isImage ? "image" : "copy"}
          </button>
        ) : (
          <label
            className={`label cursor-pointer gap-2 ${!canDelete && !frame.deleted ? "opacity-50" : ""}`}
            title={canDelete || frame.deleted ? "Delete this frame when saving (⌫)" : "At least one frame must remain"}
          >
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-error"
              checked={!!frame.deleted}
              disabled={playing || (!canDelete && !frame.deleted)}
              onChange={onToggleDelete}
            />
            <span>🗑️ Delete frame</span>
          </label>
        )}
        {!isImage && (
          <label
            className={`label cursor-pointer gap-2 ${frame.is_keyframe || frame.deleted || unoptimize ? "opacity-50" : ""}`}
            title={
              unoptimize
                ? "Unoptimize is on — every frame becomes a full image"
                : frame.is_keyframe
                  ? "Already a full image"
                  : "Write this frame as a full image when saving"
            }
          >
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-success"
              checked={!!frame.rekey || (unoptimize && !frame.deleted)}
              disabled={playing || frame.is_keyframe || frame.deleted || unoptimize}
              onChange={onToggleRekey}
            />
            <span>🔑 Convert to full image</span>
          </label>
        )}
      </div>

      {preload && (
        <div className="w-64 text-xs text-center">
          Loading frames {preload.loaded}/{preload.total}…
          <progress className="progress progress-primary w-full" value={preload.loaded} max={preload.total} />
        </div>
      )}

      {/* Frame info */}
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        <span className="badge badge-outline" title="Position in the result">
          #{position + 1} / {count}
        </span>
        {isImage ? (
          <>
            <span className="badge badge-secondary" title={frame.path}>
              🖼️ {frame.name}
            </span>
            <span className="badge badge-outline">
              {frame.width}×{frame.height}
            </span>
          </>
        ) : (
          <>
            <span className="badge badge-outline">
              {frame.copy ? "📑 Copy of frame" : "Frame"} {frame.index} / {metadata.frame_count - 1}
            </span>
            {frame.deleted && <span className="badge badge-error">🗑️ Will be deleted</span>}
            {!frame.deleted && !frame.is_keyframe && (frame.rekey || unoptimize) && (
              <span className="badge badge-success badge-outline">→ 🔑 full image on save</span>
            )}
            <span
              className={`badge ${frame.is_keyframe ? "badge-success" : "badge-warning"}`}
              title={
                frame.is_keyframe
                  ? "A full image on its own — safe to edit"
                  : "Only stores changes on top of earlier frames — gifmeta re-writes it as a full image if needed"
              }
            >
              {frame.is_keyframe ? "🔑 Keyframe" : "Δ Delta frame"}
            </span>
            <span className="badge badge-outline" title={fullCanvas ? "Covers the whole canvas" : "Sub-rectangle of the canvas"}>
              {frame.left},{frame.top} · {frame.width}×{frame.height}
            </span>
            <span className="badge badge-outline" title={DISPOSAL_HELP[frame.disposal]}>
              dispose: {frame.disposal}
            </span>
          </>
        )}
        {frame.delay_cs < 2 && (
          <span className="badge badge-ghost" title="Browsers show delays below 2 cs as 10 cs">
            plays as {playbackDelayMs(frame.delay_cs)} ms
          </span>
        )}
      </div>

      {/* Image */}
      <div className="checkerboard rounded shadow max-w-full overflow-auto">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={isImage ? frame.name : `Frame ${frame.index} (${mode})`}
            className="block max-w-full h-auto"
            style={{ imageRendering: "pixelated" }}
            width={metadata.width}
            height={metadata.height}
          />
        ) : (
          <div
            className="flex items-center justify-center opacity-60 text-sm"
            style={{ width: Math.min(metadata.width, 640), height: Math.min(metadata.height, 400) }}
          >
            Rendering…
          </div>
        )}
      </div>

      {mode === "raw" && !isImage && !frame.is_keyframe && (
        <p className="text-xs opacity-70 max-w-md text-center">
          Raw view: only the pixels this delta frame stores. The checkerboard shows through where it
          reuses pixels from earlier frames.
        </p>
      )}
      {isImage && (
        <p className="text-xs opacity-70 max-w-md text-center">
          Saved as a full frame. Fully transparent pixels stay transparent; semi-transparent pixels are drawn opaque.
        </p>
      )}
    </div>
  );
}
