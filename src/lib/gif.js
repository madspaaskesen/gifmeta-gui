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

/** True when any delay or the loop setting differs from the original file. */
export function isDirty(original, frames, loop) {
  if (!original || !frames) return false;
  if (loop.infinite !== original.loop_infinite) return true;
  if (!loop.infinite && loop.count !== original.loop_count) return true;
  return frames.some((f, i) => f.delay_cs !== original.frames[i]?.delay_cs);
}

/** Builds the arguments for the `save_modified_gif` Tauri command. */
export function buildSaveArgs({ inputPath, outputPath, original, frames, loop }) {
  const loopChanged =
    loop.infinite !== original.loop_infinite ||
    (!loop.infinite && loop.count !== original.loop_count);
  const delaysChanged = frames.some((f, i) => f.delay_cs !== original.frames[i]?.delay_cs);
  const first = frames[0]?.delay_cs;
  const allSame = frames.every((f) => f.delay_cs === first);

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
  };
}
