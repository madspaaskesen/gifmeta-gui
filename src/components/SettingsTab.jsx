import { useState, useEffect } from "react";

export default function SettingsTab({ metadata, defaultDelay, onApplyDelayToAll, loop, setLoop, edits, setEdits }) {
  const [delay, setDelay] = useState(defaultDelay);
  useEffect(() => setDelay(defaultDelay), [defaultDelay]);

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("gifmeta-theme", theme);
    } catch {
      /* ignore */
    }
  }

  const disabled = !metadata;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Delay for all frames (cs)</legend>
        <div className="join">
          <input
            type="number"
            min={0}
            className="input input-bordered join-item w-28"
            value={delay}
            disabled={disabled}
            onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <button className="btn join-item" disabled={disabled} onClick={() => onApplyDelayToAll(delay)}>
            ↺ Apply to all frames
          </button>
        </div>
        <p className="label">1 cs = 10 ms. Values below 2 play as 10 cs in browsers.</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">Loop</legend>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={loop.infinite}
            disabled={disabled}
            onChange={(e) => setLoop({ ...loop, infinite: e.target.checked })}
          />
          <span>∞ Loop forever</span>
        </label>
        <label className="flex items-center gap-2">
          <span className={loop.infinite ? "opacity-50" : ""}>Plays</span>
          <input
            type="number"
            min={1}
            className="input input-bordered w-24"
            value={loop.count}
            disabled={disabled || loop.infinite}
            onChange={(e) => setLoop({ ...loop, count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          />
          <span className={loop.infinite ? "opacity-50" : ""}>{loop.count === 1 ? "time (once)" : "times"}</span>
        </label>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">Frame editing</legend>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-success"
            checked={edits.unoptimize}
            disabled={disabled}
            onChange={(e) => setEdits({ ...edits, unoptimize: e.target.checked })}
          />
          <span>🧱 Unoptimize — save every frame as a full image</span>
        </label>
        <p className="label">Bigger file, but every frame is independent and safe to edit anywhere.</p>
        <label className="flex items-center gap-2 mt-2">
          <span>Delay of deleted frames</span>
          <select
            className="select select-bordered select-sm w-auto"
            value={edits.deleteMode}
            disabled={disabled}
            onChange={(e) => setEdits({ ...edits, deleteMode: e.target.value })}
          >
            <option value="merge">Add to previous frame (same duration)</option>
            <option value="drop">Drop (shorter animation)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">Theme</legend>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setTheme("light")}>☀️ Light</button>
          <button className="btn btn-sm" onClick={() => setTheme("dark")}>🌙 Dark</button>
        </div>
      </fieldset>
    </div>
  );
}
