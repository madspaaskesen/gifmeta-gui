// Small pure helpers for GIF metadata in the GUI.

/** "very-long-name-of-a-file.gif" → "very-long-name-of-a-f….gif" */
export function shortenFilename(name, maxLength = 25) {
  const extIndex = name.lastIndexOf(".");
  const ext = extIndex !== -1 ? name.slice(extIndex) : "";
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;
  return base.length > maxLength ? base.slice(0, maxLength) + "…" + ext : name;
}

/** Delay value used by most frames (used as default for "apply to all"). */
export function mostCommonDelay(frames) {
  if (!frames?.length) return 0;
  const counts = {};
  for (const f of frames) counts[f.delay_cs] = (counts[f.delay_cs] || 0) + 1;
  const [mostCommon] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return parseInt(mostCommon[0], 10);
}

/** Sum of all frame delays in centiseconds, as stored in the file. */
export function totalDurationCs(frames) {
  return (frames ?? []).reduce((sum, f) => sum + (f.delay_cs || 0), 0);
}

/**
 * How long a frame is actually shown when the GIF plays, in milliseconds.
 * Browsers show delays below 2 cs (0 / 1) as 10 cs — we mimic that for playback.
 */
export function playbackDelayMs(delayCs) {
  return (delayCs < 2 ? 10 : delayCs) * 10;
}

/** "1.2 s" / "850 ms" */
export function formatDuration(cs) {
  return cs >= 100 ? `${(cs / 100).toFixed(cs % 100 === 0 ? 0 : 2)} s` : `${cs * 10} ms`;
}

/** User-facing loop label. */
export function loopLabel(infinite, count) {
  if (infinite) return "∞";
  return count === 1 ? "1× (once)" : `${count}×`;
}

/** Default frame-edit settings (not per frame). */
export const DEFAULT_EDITS = { unoptimize: false, deleteMode: "merge" };

/** True when any delay, the loop setting or a frame edit differs from the original file. */
export function isDirty(original, frames, loop, edits = DEFAULT_EDITS) {
  if (!original || !frames) return false;
  if (loop.infinite !== original.loop_infinite) return true;
  if (!loop.infinite && loop.count !== original.loop_count) return true;
  if (edits.unoptimize) return true;
  return frames.some(
    (f, i) => f.delay_cs !== original.frames[i]?.delay_cs || f.deleted || f.rekey,
  );
}

/**
 * The frames as they will play after saving: deleted frames are skipped and (in "merge" mode)
 * their delay is added to the previous kept frame — or the next one when deleting at the start.
 * Mirrors gifmeta's `DeleteMode`. Returns [{ index, delayCs }] with ORIGINAL indices.
 */
export function playbackSequence(frames, deleteMode = "merge") {
  const seq = [];
  let carry = 0;
  for (const f of frames ?? []) {
    if (f.deleted) {
      if (deleteMode === "merge") {
        if (seq.length) seq[seq.length - 1].delayCs += f.delay_cs;
        else carry += f.delay_cs;
      }
      continue;
    }
    seq.push({ index: f.index, delayCs: f.delay_cs + carry });
    carry = 0;
  }
  return seq;
}

/** Builds the arguments for the `save_modified_gif` Tauri command. */
export function buildSaveArgs({ inputPath, outputPath, original, frames, loop, edits = DEFAULT_EDITS }) {
  const loopChanged =
    loop.infinite !== original.loop_infinite ||
    (!loop.infinite && loop.count !== original.loop_count);
  const delaysChanged = frames.some((f, i) => f.delay_cs !== original.frames[i]?.delay_cs);
  const first = frames[0]?.delay_cs;
  const allSame = frames.every((f) => f.delay_cs === first);
  const deleteFrames = frames.filter((f) => f.deleted).map((f) => f.index);
  const keyframes = frames.filter((f) => f.rekey && !f.deleted).map((f) => f.index);

  return {
    inputPath,
    outputPath,
    loopInfinite: loopChanged ? loop.infinite : null,
    loopCount: loopChanged && !loop.infinite ? loop.count : null,
    delayAll: delaysChanged && allSame ? first : null,
    delays:
      delaysChanged && !allSame
        ? Object.fromEntries(frames.map((f) => [f.index, f.delay_cs]))
        : null,
    deleteFrames: deleteFrames.length ? deleteFrames : null,
    keyframes: keyframes.length ? keyframes : null,
    unoptimize: edits.unoptimize || null,
    deleteMode: deleteFrames.length ? edits.deleteMode : null,
  };
}
