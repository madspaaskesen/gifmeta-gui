import React, { useEffect, useState } from 'react';

export default function SettingsTab({ metadata, setMetadata, applyGlobalDelayToAll }) {
  const [globalDelay, setGlobalDelay] = useState(0);
  const [loopCount, setLoopCount] = useState(metadata?.loop_count ?? 0);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (metadata?.frames?.length > 0) {
        const defaultDelay = findMostCommonDelay(metadata.frames);
        setGlobalDelay(defaultDelay);
    }
  }, [metadata]);

  function findMostCommonDelay(frames) {
    const countMap = {};

    frames.forEach((frame) => {
        const delay = frame.delay_cs || 0;
        countMap[delay] = (countMap[delay] || 0) + 1;
    });

    let mostCommon = 0;
    let highestCount = 0;

    for (const [delay, count] of Object.entries(countMap)) {
        if (count > highestCount) {
        mostCommon = parseInt(delay, 10);
        highestCount = count;
        }
    }

    return mostCommon;
  }

  const handleDelayChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setGlobalDelay(value);

    const updatedMetadata = { ...metadata, total_duration_cs: value };

    if (applyToAll) {
        updatedMetadata.frames = metadata.frames.map((f) => ({
        ...f,
        delay_cs: value,
        }));
    }

    setMetadata(updatedMetadata);
  };

  const handleLoopChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setLoopCount(value);
    setMetadata({ ...metadata, loop_count: value });
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
          value={globalDelay}
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
