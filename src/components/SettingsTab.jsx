import React, { useState } from 'react';

export default function SettingsTab({ metadata, setMetadata, applyGlobalDelayToAll }) {
  const [globalDelay, setGlobalDelay] = useState(metadata?.total_duration_cs ?? 0);
  const [loopCount, setLoopCount] = useState(metadata?.loop_count ?? 0);
  const [applyToAll, setApplyToAll] = useState(false);

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

      <div>
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
    </div>
  );
}
