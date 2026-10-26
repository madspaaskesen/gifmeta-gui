// Cache of rendered frame images as object URLs, keyed by "index:mode" (frames of the opened
// GIF) or "file:<path>" (image files inserted as frames).
import { Channel, invoke } from "@tauri-apps/api/core";

export function createFrameImageCache() {
  let path = null;
  const urls = new Map(); // key → object URL
  const pending = new Map(); // key → Promise<string>

  function clear(newPath = null) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    pending.clear();
    path = newPath;
  }

  const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

  /** Loads (or returns cached) object URL for an image file on disk. */
  function loadFile(filePath) {
    const key = `file:${filePath}`;
    if (urls.has(key)) return Promise.resolve(urls.get(key));
    if (pending.has(key)) return pending.get(key);
    const ext = filePath.split(".").pop().toLowerCase();
    const p = invoke("read_image", { path: filePath })
      .then((buffer) => {
        const url = URL.createObjectURL(new Blob([buffer], { type: MIME[ext] ?? "image/png" }));
        urls.set(key, url);
        return url;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  }

  /** Cached URL for a frame item (frame of the GIF or image file), or undefined. */
  function peekItem(item, mode = "pretty") {
    if (!item) return undefined;
    return item.kind === "image" ? urls.get(`file:${item.path}`) : peek(item.index, mode);
  }

  /** Loads the image for a frame item. Images look the same in pretty and raw mode. */
  function loadItem(item, mode = "pretty") {
    return item.kind === "image" ? loadFile(item.path) : load(item.index, mode);
  }

  /** Returns a cached URL synchronously, or undefined. */
  function peek(index, mode = "pretty") {
    return urls.get(`${index}:${mode}`);
  }

  /** Loads (or returns cached) object URL for a frame. `mode`: "pretty" | "raw". */
  function load(index, mode = "pretty") {
    const key = `${index}:${mode}`;
    if (urls.has(key)) return Promise.resolve(urls.get(key));
    if (pending.has(key)) return pending.get(key);
    const forPath = path;
    const p = invoke("get_frame", { path, frame: index, raw: mode === "raw" })
      .then((buffer) => {
        // A new file was opened while loading → drop the stale result.
        if (forPath !== path) throw new Error("stale");
        const url = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
        urls.set(key, url);
        return url;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  }

  /** Turns a channel/command payload (ArrayBuffer, typed array or number[]) into an object URL. */
  function toUrl(payload) {
    const bytes = payload instanceof ArrayBuffer ? payload : new Uint8Array(payload);
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  }

  /**
   * Preloads all frames, calling onProgress(loaded, total).
   * Uses the streaming `get_all_frames` command (one pass over the GIF, frames arrive as
   * they are rendered); falls back to loading frame by frame if that isn't available.
   */
  async function preloadAll(count, mode = "pretty", onProgress) {
    if (Array.from({ length: count }, (_, i) => urls.has(`${i}:${mode}`)).every(Boolean)) {
      onProgress?.(count, count);
      return;
    }
    const forPath = path;
    let received = 0;
    let resolveAll;
    const allReceived = new Promise((resolve) => (resolveAll = resolve));

    const channel = new Channel();
    channel.onmessage = (payload) => {
      if (forPath !== path) return; // a new file was opened meanwhile
      const key = `${received}:${mode}`;
      if (urls.has(key)) {
        // keep the cached one
      } else {
        urls.set(key, toUrl(payload));
      }
      received++;
      onProgress?.(received, count);
      if (received >= count) resolveAll();
    };

    try {
      const total = await invoke("get_all_frames", { path, raw: mode === "raw", onFrame: channel });
      // Channel messages can arrive just after the command resolves.
      if (received < total) {
        count = total;
        await allReceived;
      }
    } catch (e) {
      if (forPath !== path) throw new Error("stale");
      console.warn("get_all_frames failed, loading frame by frame:", e);
      for (let i = 0; i < count; i++) {
        await load(i, mode);
        onProgress?.(i + 1, count);
      }
    }
    if (forPath !== path) throw new Error("stale");
  }

  return { clear, peek, load, preloadAll, loadFile, peekItem, loadItem };
}

/** Natural size of an image URL → { width, height }. */
export function imageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}
