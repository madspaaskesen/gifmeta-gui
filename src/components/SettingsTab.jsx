import React, { useState } from 'react';

export default function SettingsTab({ metadata, setMetadata, loopCount, setLoopCount, defaultDelay, setDefaultDelay, applyToAll, setApplyToAll }) {
  const handleDelayChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setDefaultDelay(value);
  };

  const handleLoopChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setLoopCount(value);
  };

  const applyToAllChange = (e) => {
    if (!applyToAll) {
      const updatedFrames = metadata.frames.map((f) =>
        f.index >= 0 ? { ...f, delay: delay_cs } : f
      );
      setMetadata({ ...metadata, frames: updatedFrames });
    }
    setApplyToAll(!applyToAll);
  };

  function setTheme(theme) {
    document.querySelector('html').setAttribute('data-theme', theme)
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Global Delay (cs)</legend>
        <input
          type="number"
          className="input input-bordered"
          value={defaultDelay}
          onChange={handleDelayChange}
        />
        <p class="label">
          <label className="cursor-pointer label">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <span className="label-text ml-2">Apply to all frames</span>
          </label>
          {applyToAll && (
            <button className="btn btn-sm" onClick={() => {
              setMetadata({ ...metadata, frames: metadata.frames.map(f => ({ ...f, delay_cs: defaultDelay }))});
            }}>
              ↺ Apply Now
            </button>
          )}
        </p>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Loop Count</legend>
        <input
          type="number"
          className="input input-bordered"
          value={loopCount}
          onChange={handleLoopChange}
        />
        <p class="label">0 means infinite loop</p>
      </fieldset>

      <div>
        <label className="label">
          <span className="label-text font-semibold">Theme</span>
        </label>
        <button className="btn btn-primary block" onClick={()=>{setTheme('light')}}>Light theme</button>
        <button className="btn btn-primary block" onClick={()=>{setTheme('dark')}}>Dark theme</button>
      </div>
    </div>
  );
}
