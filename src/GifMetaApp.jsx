import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { basename, dirname, join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";

import FrameList from "./components/FrameList";
import FrameViewer from "./components/FrameViewer";
import SettingsTab from "./components/SettingsTab";
import SaveTab from "./components/SaveTab";
import AboutTab from "./components/AboutTab";
import Toast from "./components/Toast";
import { createFrameImageCache } from "./lib/frameImages";
import {
  DEFAULT_EDITS,
  buildSaveArgs,
  formatDuration,
  isDirty,
  loopLabel,
  mostCommonDelay,
  playbackDelayMs,
  playbackSequence,
  shortenFilename,
} from "./lib/gif";
import "./GifMetaApp.css";

function GifMetaApp() {
  // File + metadata
  const [inputPath, setInputPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [original, setOriginal] = useState(null); // metadata as read from the file
  const [frames, setFrames] = useState([]); // editable copy of original.frames
  const [loop, setLoop] = useState({ infinite: true, count: 1 });
  const [edits, setEdits] = useState(DEFAULT_EDITS); // unoptimize + delete mode
  const [outputPath, setOutputPath] = useState("");
  const [savedKey, setSavedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Viewer
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState("pretty");
  const [playing, setPlaying] = useState(false);
  const [preload, setPreload] = useState(null);
  const [tab, setTab] = useState("viewer");
  const [toasts, setToasts] = useState([]);

  const cacheRef = useRef(createFrameImageCache());
  const [, rerender] = useReducer((x) => x + 1, 0);

  // Latest values for the playback loop (avoids stale closures).
  const framesRef = useRef(frames);
  const loopRef = useRef(loop);
  const editsRef = useRef(edits);
  framesRef.current = frames;
  loopRef.current = loop;
  editsRef.current = edits;
  const playRef = useRef({ token: 0, timer: null });

  const metadata = useMemo(() => (original ? { ...original, frames } : null), [original, frames]);
  const frame = frames[selectedIndex];
  const hasChanges = isDirty(original, frames, loop, edits);
  const stateKey = JSON.stringify([
    frames.map((f) => [f.delay_cs, !!f.deleted, !!f.rekey]),
    loop,
    edits,
  ]);
  const keptCount = frames.filter((f) => !f.deleted).length;
  const deletedCount = frames.length - keptCount;
  const unsaved = hasChanges && stateKey !== savedKey;
  const imageUrl = original ? cacheRef.current.peek(selectedIndex, mode) : undefined;

  // ---------- toasts ----------
  const notify = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 8000 : 4000);
  }, []);

  // ---------- frame images ----------
  useEffect(() => {
    if (!original || imageUrl || !frames[selectedIndex]) return;
    cacheRef.current
      .load(selectedIndex, mode)
      .then(rerender)
      .catch((e) => {
        if (String(e?.message ?? e) !== "stale") notify(`Could not render frame: ${e}`, "error");
      });
  }, [original, selectedIndex, mode, imageUrl, frames, notify]);

  // ---------- playback ----------
  const stopPlayback = useCallback(() => {
    playRef.current.token++;
    clearTimeout(playRef.current.timer);
    setPlaying(false);
    setPreload(null);
  }, []);

  const startPlayback = useCallback(async () => {
    const count = framesRef.current.length;
    if (!count) return;
    const token = ++playRef.current.token;
    setMode("pretty");
    setPlaying(true);

    const cache = cacheRef.current;
    if (!framesRef.current.every((f) => cache.peek(f.index, "pretty"))) {
      setPreload({ loaded: 0, total: count });
      try {
        await cache.preloadAll(count, "pretty", (loaded, total) => {
          if (playRef.current.token === token) setPreload({ loaded, total });
        });
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
    let i = 0;
    let plays = 0;
    const step = () => {
      if (playRef.current.token !== token) return;
      setSelectedIndex(seq[i].index);
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

  // Keyboard: ↑/← previous, ↓/→ next, Space play/pause (not while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
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
        toggleDeleteRef.current(selectedIndexRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, togglePlay, original, playing]);

  // ---------- open ----------
  const loadFile = useCallback(
    async (path) => {
      if (!path) return;
      if (unsaved) {
        const ok = await confirm("You have unsaved changes. Open another file anyway?", {
          title: "Unsaved changes",
          kind: "warning",
        });
        if (!ok) return;
      }
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
        setFrames(meta.frames.map((f) => ({ ...f, deleted: false, rekey: false })));
        setLoop({ infinite: meta.loop_infinite, count: meta.loop_infinite ? 1 : meta.loop_count || 1 });
        setEdits(DEFAULT_EDITS);
        setSelectedIndex(0);
        setMode("pretty");
        setSavedKey(null);
        setOutputPath(await join(dir, name.replace(/\.gif$/i, "") + "_modified.gif"));
      } catch (e) {
        console.error(e);
        notify(`Could not read GIF: ${e}`, "error");
      } finally {
        setLoading(false);
      }
    },
    [unsaved, stopPlayback, notify],
  );

  const handleSelect = async () => {
    const path = await open({ filters: [{ name: "GIFs", extensions: ["gif"] }] });
    if (typeof path === "string") loadFile(path);
  };

  // Drag & drop a GIF onto the window.
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  useEffect(() => {
    let unlisten;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const gif = event.payload.paths.find((p) => /\.gif$/i.test(p));
        if (gif) loadFileRef.current(gif);
      })
      .then((fn) => (unlisten = fn))
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  // ---------- edit ----------
  const setFrameDelay = (index, delay) =>
    setFrames((fs) => fs.map((f) => (f.index === index ? { ...f, delay_cs: delay } : f)));

  const toggleFrameFlag = (index, flag) =>
    setFrames((fs) => fs.map((f) => (f.index === index ? { ...f, [flag]: !f[flag] } : f)));

  const toggleDelete = (index) => {
    const f = frames[index];
    if (!f) return;
    if (!f.deleted && keptCount <= 1) {
      notify("At least one frame must remain", "error");
      return;
    }
    toggleFrameFlag(index, "deleted");
  };
  const toggleDeleteRef = useRef(toggleDelete);
  toggleDeleteRef.current = toggleDelete;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const applyDelayToAll = (delay) => {
    setFrames((fs) => fs.map((f) => ({ ...f, delay_cs: delay })));
    notify(`Delay set to ${delay} cs on all ${frames.length} frames`, "success");
  };

  const resetChanges = () => {
    if (!original) return;
    setFrames(original.frames.map((f) => ({ ...f, deleted: false, rekey: false })));
    setEdits(DEFAULT_EDITS);
    setLoop({
      infinite: original.loop_infinite,
      count: original.loop_infinite ? 1 : original.loop_count || 1,
    });
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
    let target = outputPath;
    if (!target) target = await choosePath();
    if (!target) return;
    if (target === inputPath) {
      notify("Choose a different file than the original.", "error");
      return;
    }
    setSaving(true);
    try {
      const report = await invoke(
        "save_modified_gif",
        buildSaveArgs({ inputPath, outputPath: target, original, frames, loop, edits }),
      );
      setSavedKey(stateKey);
      const details = [];
      if (report.deleted?.length) details.push(`${report.deleted.length} deleted`);
      if (report.rekeyed?.length) details.push(`${report.rekeyed.length} written as full images`);
      notify(
        `✅ Saved → ${report.output}` +
          (details.length ? ` · ${report.frames_in} → ${report.frames_out} frames · ${details.join(" · ")}` : ""),
        "success",
      );
      for (const w of report.warnings ?? []) notify(`⚠️ ${w}`, "info");
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

  return (
    <div className="flex flex-col h-screen text-base-content bg-base-300">
      <header className="sticky top-0 z-10 bg-base-100 shadow p-2 flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold">GIFmeta GUI 🦀</h1>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={resetChanges} className="btn btn-ghost btn-sm" title="Undo all edits">
              ↺ Reset
            </button>
          )}
          <button onClick={saveGif} className="btn btn-sm" disabled={!hasChanges || saving}>
            💾 Save{unsaved ? " ●" : ""}
          </button>
          <button onClick={handleSelect} className="btn btn-primary btn-sm">
            {loading ? <span className="loading loading-spinner loading-xs" /> : "📁"} Open GIF
          </button>
        </div>
      </header>

      <main className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-base-200 overflow-y-auto p-2">
          <h2 className="text-sm font-semibold mb-2 flex justify-between">
            <span>Frames</span>
            {original?.is_delta_optimized && (
              <span className="badge badge-warning badge-sm" title="Delta-optimized GIF">
                Δ optimized
              </span>
            )}
          </h2>
          <FrameList
            frames={frames}
            original={original}
            selectedIndex={selectedIndex}
            onSelect={(i) => !playing && setSelectedIndex(i)}
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
                onToggleRekey={() => toggleFrameFlag(selectedIndex, "rekey")}
                canDelete={keptCount > 1}
                unoptimize={edits.unoptimize}
              />
            )}
            {tab === "settings" && (
              <SettingsTab
                metadata={metadata}
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
            📁 {shortenFilename(fileName)} · {original.width}×{original.height} ·{" "}
            {deletedCount ? `${keptCount}/${frames.length} frames (${deletedCount} deleted)` : `${frames.length} frames`} ·{" "}
            {formatDuration(durationCs)} · Loop: {loopLabel(loop.infinite, loop.count)}
            {original.is_delta_optimized && ` · Δ optimized: ${original.keyframe_count}/${original.frame_count} keyframes`}
          </span>
        ) : (
          <span className="opacity-70">Open a GIF or drop one onto the window…</span>
        )}
        <span className="shrink-0">{unsaved ? "● Unsaved changes" : original ? "✔" : ""}</span>
      </footer>

      <Toast toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

export default GifMetaApp;
