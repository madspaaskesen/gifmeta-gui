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

// ---------------------------------------------------------------------------------------------
// The editable frame list holds "items":
//   { kind: "frame", key, index, copy, deleted, rekey, delay_cs, …frame metadata }
//     – a frame of the opened GIF (`index` = ORIGINAL index). `copy: true` = a duplicate.
//   { kind: "image", key, path, name, width, height, delay_cs }
//     – an image file inserted as a new frame (or every frame of a "new GIF from images").
// Copies and images are removed when deleted; original frames get `deleted: true` (undoable).
// ---------------------------------------------------------------------------------------------

let keyCounter = 0;
/** Unique key for new items (duplicates, images). */
export function newKey(prefix = "k") {
  keyCounter += 1;
  return `${prefix}${keyCounter}`;
}

/** Editable items for the frames of a freshly opened GIF. */
export function frameItems(metaFrames) {
  return (metaFrames ?? []).map((f) => ({
    ...f,
    kind: "frame",
    key: `f${f.index}`,
    copy: false,
    deleted: false,
    rekey: false,
  }));
}

/** An image file as a frame item. */
export function imageItem({ path, name, width, height, delay }) {
  return { kind: "image", key: newKey("img"), path, name, width, height, delay_cs: delay };
}

/** A copy of an item, placed by the caller right after it. */
export function duplicateItem(item) {
  return item.kind === "frame"
    ? { ...item, key: newKey(`f${item.index}c`), copy: true, deleted: false }
    : { ...item, key: newKey("img") };
}

/** Moves the item at `from` to position `to` (positions in the new list). */
export function moveItem(items, from, to) {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = items.slice();
  const [it] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it);
  return next;
}

/** True when frames were inserted, duplicated or moved (needs the "plan" save). */
export function isStructureChanged(original, items) {
  if (!original) return false;
  if (original.synthetic) return true;
  if (items.length !== original.frames.length) return true;
  return items.some((f, i) => f.kind !== "frame" || f.copy || f.index !== i);
}

/** Delay of an item in the opened file (undefined for images). */
export function originalDelay(original, item) {
  return item.kind === "frame" ? original?.frames?.[item.index]?.delay_cs : undefined;
}

/** True when anything differs from the opened file (always true for a new GIF with frames). */
export function isDirty(original, frames, loop, edits = DEFAULT_EDITS) {
  if (!original || !frames) return false;
  if (original.synthetic) return frames.length > 0;
  if (loop.infinite !== original.loop_infinite) return true;
  if (!loop.infinite && loop.count !== original.loop_count) return true;
  if (edits.unoptimize) return true;
  if (isStructureChanged(original, frames)) return true;
  return frames.some(
    (f) => f.delay_cs !== originalDelay(original, f) || f.deleted || f.rekey,
  );
}

/**
 * The frames as they will play after saving: deleted frames are skipped and (in "merge" mode)
 * their delay is added to the previous kept frame — or the next one when deleting at the start.
 * Mirrors gifmeta's `DeleteMode`. Returns [{ pos, delayCs }] — `pos` is the position in `frames`.
 */
export function playbackSequence(frames, deleteMode = "merge") {
  const seq = [];
  let carry = 0;
  (frames ?? []).forEach((f, pos) => {
    if (f.deleted) {
      if (deleteMode === "merge") {
        if (seq.length) seq[seq.length - 1].delayCs += f.delay_cs;
        else carry += f.delay_cs;
      }
      return;
    }
    seq.push({ pos, delayCs: f.delay_cs + carry });
    carry = 0;
  });
  return seq;
}

function loopArgs(original, loop) {
  const loopChanged =
    original.synthetic ||
    loop.infinite !== original.loop_infinite ||
    (!loop.infinite && loop.count !== original.loop_count);
  return {
    loopInfinite: loopChanged ? loop.infinite : null,
    loopCount: loopChanged && !loop.infinite ? loop.count : null,
  };
}

/** Arguments for `save_modified_gif` (frames only changed in place: delays, delete, re-key). */
export function buildSaveArgs({ inputPath, outputPath, original, frames, loop, edits = DEFAULT_EDITS }) {
  const delaysChanged = frames.some((f) => f.delay_cs !== originalDelay(original, f));
  const first = frames[0]?.delay_cs;
  const allSame = frames.every((f) => f.delay_cs === first);
  const deleteFrames = frames.filter((f) => f.deleted).map((f) => f.index);
  const keyframes = frames.filter((f) => f.rekey && !f.deleted).map((f) => f.index);

  return {
    inputPath,
    outputPath,
    ...loopArgs(original, loop),
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

/**
 * Arguments for `save_gif_plan`: the result frame by frame, in order, with final delays
 * (deleted delays already merged). Frames not in the plan are deleted by the backend.
 */
export function buildPlanArgs({ inputPath, outputPath, original, frames, loop, edits = DEFAULT_EDITS }) {
  const plan = playbackSequence(frames, edits.deleteMode).map(({ pos, delayCs }) => {
    const f = frames[pos];
    return f.kind === "frame" ? { frame: f.index, delay: delayCs } : { image: f.path, delay: delayCs };
  });
  const keyframes = [
    ...new Set(frames.filter((f) => f.kind === "frame" && f.rekey && !f.deleted).map((f) => f.index)),
  ];
  return {
    inputPath,
    outputPath,
    plan,
    ...loopArgs(original, loop),
    keyframes: keyframes.length ? keyframes : null,
    unoptimize: edits.unoptimize || null,
  };
}

/** Arguments for `create_gif_from_images` (a new GIF made only of image items). */
export function buildCreateArgs({ outputPath, frames, loop }) {
  const kept = frames.filter((f) => !f.deleted);
  return {
    images: kept.map((f) => f.path),
    delays: kept.map((f) => f.delay_cs),
    outputPath,
    loopInfinite: loop.infinite,
    loopCount: loop.infinite ? null : loop.count,
  };
}

/** Which save command fits the current edits. */
export function saveCommand(original, frames) {
  if (original?.synthetic) return "create_gif_from_images";
  return isStructureChanged(original, frames) ? "save_gif_plan" : "save_modified_gif";
}

/** Image files that can be inserted as frames. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const isImagePath = (p) => new RegExp(`\\.(${IMAGE_EXTENSIONS.join("|")})$`, "i").test(p);
