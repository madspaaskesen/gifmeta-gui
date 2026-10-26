import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { basename, dirname, join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";

import FrameList from "./components/FrameList";
import FrameViewer from "./components/FrameViewer";
import SettingsTab from "./components/SettingsTab";
import SaveTab from "./components/SaveTab";
import AboutTab from "./components/AboutTab";
import Toast from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import { createFrameImageCache, imageSize } from "./lib/frameImages";
import {
  DEFAULT_EDITS,
  IMAGE_EXTENSIONS,
  buildCreateArgs,
  buildPlanArgs,
  buildSaveArgs,
  duplicateItem,
  formatDuration,
  frameItems,
  imageItem,
  isDirty,
  isImagePath,
  loopLabel,
  mostCommonDelay,
  moveItem,
  playbackDelayMs,
  playbackSequence,
  saveCommand,
  shortenFilename,
} from "./lib/gif";
import "./GifMetaApp.css";

const NEW_GIF_DELAY = 10; // cs per frame for a new GIF from images (100 ms)

/** Metadata stand-in for a new GIF that only exists as a list of images. */
function syntheticOriginal(width, height) {
  return {
    synthetic: true,
    width,
    height,
    frame_count: 0,
    frames: [],
    loop_infinite: true,
    loop_count: 0,
    is_delta_optimized: false,
    keyframe_count: 0,
  };
}

function GifMetaApp() {
  // File + metadata
  const [inputPath, setInputPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [original, setOriginal] = useState(null); // metadata as read from the file (or synthetic)
  const [frames, setFrames] = useState([]); // editable items (see lib/gif.js)
  const [loop, setLoop] = useState({ infinite: true, count: 1 });
  const [edits, setEdits] = useState(DEFAULT_EDITS); // unoptimize + delete mode
  const [outputPath, setOutputPath] = useState("");
  const [savedKey, setSavedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Viewer — `selectedIndex` is a POSITION in `frames`
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState("pretty");
  const [playing, setPlaying] = useState(false);
  const [preload, setPreload] = useState(null);
  const [tab, setTab] = useState("viewer");
  const [toasts, setToasts] = useState([]);
  const [confirmRequest, setConfirmRequest] = useState(null); // in-app confirm dialog

  const cacheRef = useRef(createFrameImageCache());
  const baselineRef = useRef([]); // items of a new GIF as first loaded (for ↺ Reset)
  const [, rerender] = useReducer((x) => x + 1, 0);

  // Latest values for the playback loop and event handlers (avoids stale closures).
  const framesRef = useRef(frames);
  const loopRef = useRef(loop);
  const editsRef = useRef(edits);
  const originalRef = useRef(original);
  const selectedIndexRef = useRef(selectedIndex);
  framesRef.current = frames;
  loopRef.current = loop;
  editsRef.current = edits;
  originalRef.current = original;
  selectedIndexRef.current = selectedIndex;
  const playRef = useRef({ token: 0, timer: null });

  const isNew = !!original?.synthetic;
  const metadata = useMemo(() => (original ? { ...original, frames } : null), [original, frames]);
  const frame = frames[selectedIndex];
  const hasChanges = isDirty(original, frames, loop, edits);
  const stateKey = JSON.stringify([
    frames.map((f) => [f.key, f.delay_cs, !!f.deleted, !!f.rekey]),
    loop,
    edits,
  ]);
  const keptCount = frames.filter((f) => !f.deleted).length;
  const deletedCount = frames.length - keptCount;
  const insertedCount = isNew ? 0 : frames.filter((f) => f.kind === "image").length;
  const copyCount = frames.filter((f) => f.copy).length;
  const unsaved = hasChanges && stateKey !== savedKey;
  // ↺ Reset: back to the file as opened — or, for a new GIF, to the images as first picked.
  const canReset = isNew
    ? stateKey !== JSON.stringify([baselineRef.current.map((f) => [f.key, f.delay_cs, false, false]), { infinite: true, count: 1 }, DEFAULT_EDITS])
    : hasChanges;
  const imageUrl = original ? cacheRef.current.peekItem(frame, mode) : undefined;

  // ---------- toasts ----------
  const notify = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 8000 : 4000);
  }, []);

  // ---------- frame images ----------
  useEffect(() => {
    if (!original || imageUrl || !frame) return;
    cacheRef.current
      .loadItem(frame, mode)
      .then(rerender)
      .catch((e) => {
        if (String(e?.message ?? e) !== "stale") notify(`Could not load frame: ${e}`, "error");
      });
  }, [original, frame, mode, imageUrl, notify]);

  // ---------- playback ----------
  const stopPlayback = useCallback(() => {
    playRef.current.token++;
    clearTimeout(playRef.current.timer);
    setPlaying(false);
    setPreload(null);
  }, []);

  const startPlayback = useCallback(async () => {
    const items = framesRef.current;
    if (!items.length) return;
    const token = ++playRef.current.token;
    setMode("pretty");
    setPlaying(true);

    const cache = cacheRef.current;
    if (!items.every((f) => cache.peekItem(f, "pretty"))) {
      const orig = originalRef.current;
      const gifFrames = orig?.synthetic ? 0 : orig?.frame_count ?? 0;
      const images = [...new Set(items.filter((f) => f.kind === "image").map((f) => f.path))];
      const total = gifFrames + images.length;
      setPreload({ loaded: 0, total });
      try {
        if (gifFrames && items.some((f) => f.kind === "frame")) {
          await cache.preloadAll(gifFrames, "pretty", (loaded) => {
            if (playRef.current.token === token) setPreload({ loaded, total });
          });
        }
        let loaded = gifFrames;
        for (const p of images) {
          await cache.loadFile(p);
          if (playRef.current.token === token) setPreload({ loaded: ++loaded, total });
        }
      } catch (e) {
        if (playRef.current.token === token) {
          stopPlayback();
          notify(`Could not load frames: ${e}`, "error");
        }
        return;
      }
      if (playRef.current.token !== token) return;
      setPreload(null);
    }

    // Play the result: deleted frames skipped, their delay merged (like gifmeta does).
    const seq = playbackSequence(framesRef.current, editsRef.current.deleteMode);
    if (!seq.length) return stopPlayback();
    let i = 0;
    let plays = 0;
    const step = () => {
      if (playRef.current.token !== token) return;
      setSelectedIndex(seq[i].pos);
      const delay = playbackDelayMs(seq[i].delayCs);
      playRef.current.timer = setTimeout(() => {
        i++;
        if (i >= seq.length) {
          i = 0;
          plays++;
          const l = loopRef.current;
          if (!l.infinite && plays >= l.count) {
            stopPlayback(); // GIF ends on its last frame
            return;
          }
        }
        step();
      }, delay);
    };
    step();
  }, [notify, stopPlayback]);

  const togglePlay = useCallback(() => (playing ? stopPlayback() : startPlayback()), [
    playing,
    startPlayback,
    stopPlayback,
  ]);

  const go = useCallback(
    (delta) => {
      if (!frames.length || playing) return;
      setSelectedIndex((i) => (i + delta + frames.length) % frames.length);
    },
    [frames.length, playing],
  );

  // ---------- edit: delays / delete / re-key ----------
  const setFrameDelay = (pos, delay) =>
    setFrames((fs) => fs.map((f, i) => (i === pos ? { ...f, delay_cs: delay } : f)));

  // Re-key applies to the original frame, so copies of it follow.
  const toggleRekey = (pos) => {
    const target = frames[pos];
    if (!target || target.kind !== "frame") return;
    const value = !target.rekey;
    setFrames((fs) => fs.map((f) => (f.kind === "frame" && f.index === target.index ? { ...f, rekey: value } : f)));
  };

  const removeAt = (pos) => {
    const lastAfter = framesRef.current.length - 2;
    setFrames((fs) => fs.filter((_, i) => i !== pos));
    setSelectedIndex(Math.max(0, Math.min(pos, lastAfter)));
  };

  const toggleDelete = (pos) => {
    const f = frames[pos];
    if (!f) return;
    if (!f.deleted && keptCount <= 1) {
      notify("At least one frame must remain", "error");
      return;
    }
    if (f.kind === "image" || f.copy) removeAt(pos);
    else setFrames((fs) => fs.map((x, i) => (i === pos ? { ...x, deleted: !x.deleted } : x)));
  };

  // ---------- edit: duplicate / move / insert ----------
  const duplicateAt = (pos) => {
    const f = frames[pos];
    if (!f) return;
    setFrames((fs) => [...fs.slice(0, pos + 1), duplicateItem(fs[pos]), ...fs.slice(pos + 1)]);
    setSelectedIndex(pos + 1);
  };

  const moveTo = (from, to) => {
    if (to < 0 || to >= frames.length || from === to) return;
    setFrames((fs) => moveItem(fs, from, to));
    setSelectedIndex(to);
  };

  /** Loads image files as frame items; drops (and reports) images of the wrong size. */
  const loadImageItems = useCallback(
    async (paths, size, delay) => {
      const items = [];
      const wrong = [];
      for (const path of paths) {
        try {
          const url = await cacheRef.current.loadFile(path);
          const { width, height } = await imageSize(url);
          const name = await basename(path);
          if (size && (width !== size.width || height !== size.height)) {
            wrong.push(`${name} (${width}×${height})`);
            continue;
          }
          size = size ?? { width, height };
          items.push(imageItem({ path, name, width, height, delay }));
        } catch (e) {
          notify(`Could not read ${path}: ${e}`, "error");
        }
      }
      if (wrong.length) {
        notify(`Images must be ${size.width}×${size.height} (same as the GIF). Skipped: ${wrong.join(", ")}`, "error");
      }
      return { items, size };
    },
    [notify],
  );

  const insertImages = useCallback(
    async (paths, afterPos) => {
      const orig = originalRef.current;
      if (!orig || !paths?.length) return;
      const after = afterPos ?? selectedIndexRef.current;
      const delay = framesRef.current[after]?.delay_cs ?? NEW_GIF_DELAY;
      const { items } = await loadImageItems(paths, { width: orig.width, height: orig.height }, delay);
      if (!items.length) return;
      setFrames((fs) => [...fs.slice(0, after + 1), ...items, ...fs.slice(after + 1)]);
      setSelectedIndex(after + 1);
      notify(`➕ ${items.length} image${items.length > 1 ? "s" : ""} inserted`, "success");
    },
    [loadImageItems, notify],
  );

  const pickImages = () =>
    open({ multiple: true, filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }] }).then((p) =>
      p ? (Array.isArray(p) ? p : [p]) : null,
    );

  const handleInsertImages = async () => {
    if (!original || playing) return;
    const paths = await pickImages();
    if (paths) insertImages(paths);
  };

  // ---------- open / new ----------
  /** Shows the in-app confirm dialog; resolves true / false. */
  const askConfirm = useCallback(
    (request) => new Promise((resolve) => setConfirmRequest({ ...request, resolve })),
    [],
  );
  const answerConfirm = useCallback((ok) => {
    setConfirmRequest((r) => {
      r?.resolve(ok);
      return null;
    });
  }, []);

  const confirmDiscard = useCallback(async () => {
    if (!unsaved) return true;
    return askConfirm({
      title: "Unsaved changes",
      message: "You have changes that are not saved. Discard them?",
      okLabel: "Discard",
    });
  }, [unsaved, askConfirm]);

  const openGif = useCallback(
    async (path, { force = false } = {}) => {
      if (!path) return;
      if (!force && !(await confirmDiscard())) return;
      stopPlayback();
      setLoading(true);
      try {
        const meta = await invoke("get_info", { path });
        cacheRef.current.clear(path);
        const name = await basename(path);
        const dir = await dirname(path);
        setInputPath(path);
        setFileName(name);
        setOriginal(meta);
        setFrames(frameItems(meta.frames));
        setLoop({ infinite: meta.loop_infinite, count: meta.loop_infinite ? 1 : meta.loop_count || 1 });
        setEdits(DEFAULT_EDITS);
        setSelectedIndex(0);
        setMode("pretty");
        setTab("viewer");
        setSavedKey(null);
        setOutputPath(await join(dir, name.replace(/\.gif$/i, "") + "_modified.gif"));
      } catch (e) {
        console.error(e);
        notify(`Could not read GIF: ${e}`, "error");
      } finally {
        setLoading(false);
      }
    },
    [confirmDiscard, stopPlayback, notify],
  );

  const newFromImages = useCallback(
    async (paths) => {
      if (!paths?.length) return;
      if (!(await confirmDiscard())) return;
      stopPlayback();
      cacheRef.current.clear(null);
      const { items, size } = await loadImageItems(paths, null, NEW_GIF_DELAY);
      if (!items.length) return;
      const dir = await dirname(paths[0]);
      setInputPath("");
      setFileName("New GIF");
      setOriginal(syntheticOriginal(size.width, size.height));
      baselineRef.current = items;
      setFrames(items);
      setLoop({ infinite: true, count: 1 });
      setEdits(DEFAULT_EDITS);
      setSelectedIndex(0);
      setMode("pretty");
      setTab("viewer");
      setSavedKey(null);
      setOutputPath(await join(dir, items[0].name.replace(/\.[^.]+$/, "") + "_animated.gif"));
      if (items.length < 2) notify("Add at least one more image to make an animation", "info");
    },
    [confirmDiscard, stopPlayback, loadImageItems, notify],
  );

  const handleOpen = async () => {
    const path = await open({ filters: [{ name: "GIFs", extensions: ["gif"] }] });
    if (typeof path === "string") openGif(path);
  };

  const handleNewFromImages = async () => {
    const paths = await pickImages();
    if (paths) newFromImages(paths);
  };

  // Drag & drop files onto the window: a GIF opens it; images are inserted (or start a new GIF).
  const dropRef = useRef(null);
  dropRef.current = (paths) => {
    const gif = paths.find((p) => /\.gif$/i.test(p));
    const images = paths.filter(isImagePath);
    if (gif) openGif(gif);
    else if (images.length && original && !playing) insertImages(images);
    else if (images.length && !playing) newFromImages(images);
  };
  useEffect(() => {
    // The listener is registered asynchronously: if the effect is cleaned up first (React
    // StrictMode, fast unmount), remove it as soon as it exists — otherwise drops fire twice.
    let unlisten;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") dropRef.current(event.payload.paths ?? []);
      })
      .then((fn) => (cancelled ? fn() : (unlisten = fn)))
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // ---------- keyboard ----------
  // ↑/← previous, ↓/→ next, Alt+↑/↓ move frame, Space play/pause, ⌫ delete, D duplicate,
  // I insert image (not while typing).
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
    if (confirmRequest) return;
    const pos = selectedIndexRef.current;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (original && !playing) moveTo(pos, pos + (e.key === "ArrowUp" ? -1 : 1));
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === " " && original) {
      e.preventDefault();
      togglePlay();
    } else if ((e.key === "Delete" || e.key === "Backspace") && original && !playing) {
      e.preventDefault();
      toggleDelete(pos);
    } else if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && original && !playing) {
      e.preventDefault();
      duplicateAt(pos);
    } else if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && original && !playing) {
      e.preventDefault();
      handleInsertImages();
    }
  };
  useEffect(() => {
    const onKey = (e) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- settings ----------
  const applyDelayToAll = (delay) => {
    setFrames((fs) => fs.map((f) => ({ ...f, delay_cs: delay })));
    notify(`Delay set to ${delay} cs on all ${frames.length} frames`, "success");
  };

  const resetChanges = () => {
    if (!original) return;
    stopPlayback();
    const items = isNew ? baselineRef.current : frameItems(original.frames);
    setFrames(items);
    setSelectedIndex((i) => Math.max(0, Math.min(i, items.length - 1)));
    setEdits(DEFAULT_EDITS);
    setLoop({
      infinite: original.loop_infinite,
      count: original.loop_infinite ? 1 : original.loop_count || 1,
    });
  };

  /** Closes the GIF / new GIF and returns to the empty start screen. */
  const closeAll = async () => {
    if (!original || !(await confirmDiscard())) return;
    stopPlayback();
    cacheRef.current.clear(null);
    baselineRef.current = [];
    setInputPath("");
    setFileName("");
    setOriginal(null);
    setFrames([]);
    setLoop({ infinite: true, count: 1 });
    setEdits(DEFAULT_EDITS);
    setSelectedIndex(0);
    setMode("pretty");
    setTab("viewer");
    setSavedKey(null);
    setOutputPath("");
  };

  // ---------- save ----------
  const choosePath = async () => {
    const path = await save({
      defaultPath: outputPath || undefined,
      filters: [{ name: "GIF", extensions: ["gif"] }],
    });
    if (path) setOutputPath(path);
    return path;
  };

  const saveGif = async () => {
    if (!original) return;
    if (isNew && keptCount < 2) {
      notify("A GIF needs at least 2 frames — add more images first.", "error");
      return;
    }
    let target = outputPath;
    if (!target) target = await choosePath();
    if (!target) return;
    if (target === inputPath) {
      notify("Choose a different file than the original.", "error");
      return;
    }
    stopPlayback();
    setSaving(true);
    try {
      const command = saveCommand(original, frames);
      const params = { inputPath, outputPath: target, original, frames, loop, edits };
      const args =
        command === "create_gif_from_images"
          ? buildCreateArgs(params)
          : command === "save_gif_plan"
            ? buildPlanArgs(params)
            : buildSaveArgs(params);
      const report = await invoke(command, args);
      setSavedKey(stateKey);
      const details = [];
      if (report.deleted?.length) details.push(`${report.deleted.length} deleted`);
      if (!isNew && report.inserted) details.push(`${report.inserted} inserted`);
      if (report.duplicated) details.push(`${report.duplicated} duplicated`);
      if (report.reordered) details.push("re-ordered");
      if (report.rekeyed?.length) details.push(`${report.rekeyed.length} written as full images`);
      notify(
        isNew
          ? `✅ Created ${report.frames_out} frames → ${report.output}`
          : `✅ Saved → ${report.output}` +
              (details.length ? ` · ${report.frames_in} → ${report.frames_out} frames · ${details.join(" · ")}` : ""),
        "success",
      );
      for (const w of report.warnings ?? []) notify(`⚠️ ${w}`, "info");
      // A new GIF continues as a normal GIF, so it can be edited further.
      if (isNew) await openGif(report.output, { force: true });
    } catch (e) {
      console.error(e);
      notify(`❌ Failed to save: ${e}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------
  const durationCs = playbackSequence(frames, edits.deleteMode).reduce((sum, f) => sum + f.delayCs, 0);
  const tabs = [
    ["viewer", "🖼️ Viewer"],
    ["settings", "⚙️ Settings"],
    ["json", "🧠 JSON"],
    ["save", "💾 Save"],
    ["about", "🧩 About"],
  ];
  const frameSummary = [
    `${keptCount} frame${keptCount === 1 ? "" : "s"}`,
    deletedCount && `${deletedCount} deleted`,
    insertedCount && `${insertedCount} inserted`,
    copyCount && `${copyCount} copied`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col h-screen text-base-content bg-base-300">
      <header className="sticky top-0 z-10 bg-base-100 shadow p-2 flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold">GIFmeta GUI 🦀</h1>
        <div className="flex gap-2">
          {canReset && (
            <button
              onClick={resetChanges}
              className="btn btn-ghost btn-sm"
              title={isNew ? "Back to the images as you picked them" : "Undo all edits — back to the file as opened"}
            >
              ↺ Reset
            </button>
          )}
          {original && (
            <button onClick={closeAll} className="btn btn-ghost btn-sm" title="Close and start over">
              ✕ Close
            </button>
          )}
          <button
            onClick={() => (tab === "save" ? saveGif() : setTab("save"))}
            className={`btn btn-sm ${tab === "save" ? "btn-success" : ""}`}
            disabled={!hasChanges || saving}
            title={tab === "save" ? "Save now" : "Go to the Save tab (output file + save)"}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : "💾"} {isNew ? "Create GIF" : "Save"}
            {unsaved ? " ●" : ""}
          </button>
          <button onClick={handleNewFromImages} className="btn btn-sm" title="Make a new GIF from PNG/JPEG/WebP images">
            🎬 New from images
          </button>
          <button onClick={handleOpen} className="btn btn-primary btn-sm">
            {loading ? <span className="loading loading-spinner loading-xs" /> : "📁"} Open GIF
          </button>
        </div>
      </header>

      <main className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-base-200 overflow-y-auto p-2">
          <h2 className="text-sm font-semibold mb-2 flex justify-between items-center gap-1">
            <span>Frames</span>
            <span className="flex items-center gap-1">
              {original?.is_delta_optimized && (
                <span className="badge badge-warning badge-sm" title="Delta-optimized GIF">
                  Δ optimized
                </span>
              )}
              {original && (
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={handleInsertImages}
                  disabled={playing}
                  title="Insert images after the selected frame (I) — or drop image files onto the window"
                >
                  ➕
                </button>
              )}
            </span>
          </h2>
          <FrameList
            frames={frames}
            original={original}
            selectedIndex={selectedIndex}
            onSelect={(i) => !playing && setSelectedIndex(i)}
            onMove={moveTo}
            disabled={playing}
            unoptimize={edits.unoptimize}
          />
        </aside>

        <section className="flex-1 overflow-y-auto p-4">
          <div role="tablist" className="tabs tabs-lift">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                className={`tab ${tab === id ? "tab-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-base-100 border border-base-300 border-t-0 rounded-b-box p-6">
            {tab === "viewer" && (
              <FrameViewer
                metadata={metadata}
                frame={frame}
                position={selectedIndex}
                count={frames.length}
                imageUrl={imageUrl}
                mode={mode}
                setMode={setMode}
                onDelayChange={(d) => setFrameDelay(selectedIndex, d)}
                onPrev={() => go(-1)}
                onNext={() => go(1)}
                playing={playing}
                onTogglePlay={togglePlay}
                preload={preload}
                onToggleDelete={() => toggleDelete(selectedIndex)}
                onToggleRekey={() => toggleRekey(selectedIndex)}
                onDuplicate={() => duplicateAt(selectedIndex)}
                onMoveUp={() => moveTo(selectedIndex, selectedIndex - 1)}
                onMoveDown={() => moveTo(selectedIndex, selectedIndex + 1)}
                onInsertImages={handleInsertImages}
                canDelete={keptCount > 1 || !!frame?.deleted}
                unoptimize={edits.unoptimize}
              />
            )}
            {tab === "settings" && (
              <SettingsTab
                metadata={metadata}
                isNew={isNew}
                defaultDelay={mostCommonDelay(frames)}
                onApplyDelayToAll={applyDelayToAll}
                loop={loop}
                setLoop={setLoop}
                edits={edits}
                setEdits={setEdits}
              />
            )}
            {tab === "json" &&
              (metadata ? (
                <pre className="bg-accent p-4 rounded-box text-accent-content text-xs overflow-auto">
                  {JSON.stringify(metadata, (k, v) => (v === null ? undefined : v), 2)}
                </pre>
              ) : (
                <p className="opacity-60 mt-3">Open a GIF to view metadata…</p>
              ))}
            {tab === "save" && (
              <SaveTab
                metadata={metadata}
                isNew={isNew}
                frameCount={keptCount}
                outputPath={outputPath}
                setOutputPath={setOutputPath}
                onChoosePath={choosePath}
                onSave={saveGif}
                dirty={hasChanges}
                saving={saving}
              />
            )}
            {tab === "about" && <AboutTab />}
          </div>
        </section>
      </main>

      <footer className="bg-base-200 border-t border-base-300 p-2 flex justify-between gap-4 text-sm">
        {original ? (
          <span className="truncate">
            {isNew ? "🎬" : "📁"} {shortenFilename(fileName)} · {original.width}×{original.height} · {frameSummary} ·{" "}
            {formatDuration(durationCs)} · Loop: {loopLabel(loop.infinite, loop.count)}
            {original.is_delta_optimized && ` · Δ optimized: ${original.keyframe_count}/${original.frame_count} keyframes`}
          </span>
        ) : (
          <span className="opacity-70">Open a GIF, make a new one from images, or drop files onto the window…</span>
        )}
        <span className="shrink-0">{unsaved ? "● Unsaved changes" : original ? "✔" : ""}</span>
      </footer>

      <ConfirmDialog request={confirmRequest} onAnswer={answerConfirm} />
      <Toast toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

export default GifMetaApp;
