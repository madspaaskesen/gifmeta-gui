// Cache of rendered frame images as object URLs, keyed by "index:mode".
import { invoke } from "@tauri-apps/api/core";

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

  /** Preloads all frames in order, calling onProgress(loaded, total). */
  async function preloadAll(count, mode = "pretty", onProgress) {
    for (let i = 0; i < count; i++) {
      await load(i, mode);
      onProgress?.(i + 1, count);
    }
  }

  return { clear, peek, load, preloadAll };
}
