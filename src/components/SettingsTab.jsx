import React, { useEffect, useState } from 'react';

export default function SettingsTab({ loopCount, setLoopCount, defaultDelay, setDefaultDelay, applyGlobalDelayToAll }) {
  const [applyToAll, setApplyToAll] = useState(false);

  const handleDelayChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setDefaultDelay(value);
  };

  const handleLoopChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setLoopCount(value);
  };

  function setTheme(theme) {
    document.querySelector('html').setAttribute('data-theme', theme)
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <label className="label">
          <span className="label-text font-semibold">Global Delay (cs)</span>
        </label>
        <input
          type="number"
          className="input input-bordered w-full max-w-xs"
          value={defaultDelay}
          onChange={handleDelayChange}
        />
        <div className="mt-2">
          <label className="cursor-pointer label">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={applyToAll}
              onChange={() => setApplyToAll(!applyToAll)}
            />
            <span className="label-text ml-2">Apply to all frames</span>
          </label>
        </div>
      </div>

      <div className="mt-3">
        <label className="label">
          <span className="label-text font-semibold">Loop Count</span>
        </label>
        <input
          type="number"
          className="input input-bordered w-full max-w-xs"
          value={loopCount}
          onChange={handleLoopChange}
        />
        <div className="text-xs text-gray-400 mt-1">0 means infinite loop</div>
      </div>

      <div className="mt-3">
        <label className="label">
          <span className="label-text font-semibold">Theme</span>
        </label>
        <button className="btn btn-primary block" onClick={()=>{setTheme('light')}}>Light theme</button>
        <button className="btn btn-primary block" onClick={()=>{setTheme('cupcake')}}>Cupcake theme</button>
        <button className="btn btn-primary block" onClick={()=>{setTheme('dark')}}>Dark theme</button>
      </div>
    </div>
  );
}
