import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import FrameViewer from "./components/FrameViewer";
import "./GifMetaApp.css";

function GifMetaApp() {
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus]   = useState("Ready");
  const [activeTab, setActiveTab] = useState("viewer");
  const [selectedFrame, setSelectedFrame] = useState(null);

  const handleSelect = async () => {
    const path = await open({
      filters: [{ name: "GIFs", extensions: ["gif"] }],
    });
    if (!path) return;

    setStatus("Loading…");
    try {
      const meta = await invoke("get_info", { path });
      setMetadata(meta);
      setStatus("Loaded metadata ✔");
    } catch (err) {
      console.error(err);
      setStatus("Error reading GIF");
    }
  };

  function setTheme(theme) {
    document.querySelector('html').setAttribute('data-theme', theme)
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
                className="bg-base-300 rounded p-2 text-center text-xs"
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
            <input type="radio" name="my_tabs_3" className="tab" aria-label="🖼️ Viewer" defaultChecked />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <FrameViewer frame={selectedFrame} />
            </div>

            <input type="radio" name="my_tabs_3" className="tab" aria-label="🧠 JSON" />
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

            <input type="radio" name="my_tabs_3" className="tab" aria-label="⚙️ Layout" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <button className="btn btn-primary block" onClick={()=>{setTheme('light')}}>Light theme</button>
              <button className="btn btn-primary block" onClick={()=>{setTheme('cupcake')}}>Cupcake theme</button>
              <button className="btn btn-primary block" onClick={()=>{setTheme('dark')}}>Dark theme</button>
            </div>
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 bg-base-100 shadow p-2 flex justify-between text-sm">
        <span>Status: {status}</span>
        <button className="btn btn-accent btn-sm relative top-[-16px] left-[-10px]">💾 Save All</button>
      </footer>
    </div>
  );
}

export default GifMetaApp;
