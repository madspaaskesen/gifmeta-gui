import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import FrameViewer from "./components/FrameViewer";
import SettingsTab from "./components/SettingsTab";
import SaveTab from "./components/SaveTab";
import AboutTab from "./components/AboutTab";
import "./GifMetaApp.css";

function GifMetaApp() {
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus]   = useState("Ready");
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [defaultDelay, setDefaultDelay] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  useEffect(() => {
    if (!metadata?.frames || !inputPath) {
      setStatus("Status: Ready");
      return;
    }

    const file = inputPath.split("/").pop() || "";
    const shortName = shortenFilename(file);

    // Total duration: sum of frame delays OR fallback to defaultDelay
    const totalDuration = metadata.frames.reduce((sum, frame) => {
      return sum + (frame.delay_cs ?? defaultDelay ?? 0);
    }, 0);

    const statusMsg = `📁 ${shortName} · Duration: ${totalDuration}cs · Loops: ${loopCount} · Frames: ${metadata.frames.length} · ✔`;
    setStatus(statusMsg);
  }, [metadata?.frames, inputPath, loopCount, defaultDelay]);

  function shortenFilename(name, maxLength = 25) {
    const extIndex = name.lastIndexOf(".");
    const ext = extIndex !== -1 ? name.slice(extIndex) : "";
    const base = extIndex !== -1 ? name.slice(0, extIndex) : name;

    return base.length > maxLength
      ? base.slice(0, maxLength) + "…" + ext
      : name;
  }

  function getMostCommonDelay(frames) {
    const counts = {};
    for (const frame of frames) {
      counts[frame.delay_cs] = (counts[frame.delay_cs] || 0) + 1;
    }
    const [mostCommon] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return parseInt(mostCommon[0]);
  }

  const handleSelect = async () => {
    const path = await open({
      filters: [{ name: "GIFs", extensions: ["gif"] }],
    });
    if (!path) return;

    setInputPath(path);
    setStatus("Loading…");

    // Auto-suggest output path (same folder, different file name)
    const inputFile = path.split('/').pop(); // e.g., image.gif
    const dir = path.replace(`/${inputFile}`, '');
    const baseName = inputFile.replace(/\.gif$/i, '');

    setOutputPath(`${dir}/${baseName}_modified.gif`);

    try {
      const meta = await invoke("get_info", { path });
      setDefaultDelay(getMostCommonDelay(meta.frames));
      setLoopCount(meta.loop_count ?? 0)
      setMetadata(meta);
      setStatus("Loaded metadata ✔");
    } catch (err) {
      console.error(err);
      setStatus("Error reading GIF");
    }
  };

  async function saveGif() {
    const allSame = metadata.frames.every(f => f.delay_cs === defaultDelay);
    const changedLoop = loopCount !== metadata.loop_count;

    try {
      await invoke('save_modified_gif', {
        inputPath: inputPath,
        outputPath: outputPath,
        loopCount: changedLoop ? loopCount : null,
        delayAll: allSame ? defaultDelay : null,
        delays: allSame ? null : Object.fromEntries(
          metadata.frames.map(f => [f.index, f.delay_cs])
        ),
      });
      alert("✅ GIF saved!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save");
    }
  }

  return (
    <div className="flex flex-col h-screen text-base-content bg-base-300">

      <header className="sticky top-0 z-10 bg-base-100 shadow p-2 flex justify-between items-center">
        <h1 className="text-xl font-bold">GIFmeta GUI 🦀</h1>
        <button onClick={handleSelect} className="btn btn-primary btn-sm">
          📁 Select File
        </button>
      </header>

      <main className="flex h-[calc(100vh-100px)]">
        {/* Left column – thumbnails */}
        <div className="w-1/4 border-r overflow-y-auto p-2">
          <h2 className="text-sm font-semibold mb-2">Frames</h2>
          <ul className="space-y-2">
            {metadata?.frames?.map((f) => (
              <li
                key={f.index}
                onClick={() => setSelectedFrame(f)}
                className={`cursor-pointer rounded p-2 text-center text-xs ${
                  selectedFrame?.index === f.index
                    ? "bg-primary text-primary-content"
                    : "bg-base-300"
                }`}
              >
                🖼️ Frame {f.index}
              </li>
            ))}
            {!metadata && (
              <p className="text-xs opacity-60">No frames yet…</p>
            )}
          </ul>
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="tabs tabs-lift">
            <input type="radio" name="my_tabs" className="tab" aria-label="🖼️ Viewer" defaultChecked />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <FrameViewer frame={selectedFrame} setFrame={setSelectedFrame} metadata={metadata} setMetadata={setMetadata} />
            </div>

            <input type="radio" name="my_tabs" className="tab" aria-label="⚙️ Settings" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <SettingsTab metadata={metadata} setMetadata={setMetadata} loopCount={loopCount} setLoopCount={setLoopCount} defaultDelay={defaultDelay} setDefaultDelay={setDefaultDelay} />
            </div>

            <input type="radio" name="my_tabs" className="tab" aria-label="🧠 JSON" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              {metadata ? (
                <pre className="bg-base-300 p-4 rounded-box text-green-300 text-xs overflow-auto">
                  {JSON.stringify(
                    metadata,
                    (k, v) => (v === null ? undefined : v),
                    2
                  )}
                </pre>
              ) : (
                <p className="opacity-60">Select a GIF to view metadata…</p>
              )}
            </div>

            <input type="radio" name="my_tabs" className="tab" aria-label="💾 Save" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <SaveTab metadata={metadata} outputPath={outputPath} setOutputPath={setOutputPath} onSave={saveGif} />
            </div>

            <input type="radio" name="my_tabs" className="tab" aria-label="🧩 About" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <AboutTab />
            </div>
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 bg-base-100 shadow p-2 flex justify-between text-sm">
        <span>Status: {status}</span>
      </footer>
    </div>
  );
}

export default GifMetaApp;
