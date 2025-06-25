// src/components/FrameViewer.jsx
import React from "react";

export default function FrameViewer({ frame, setFrame, metadata, setMetadata }) {
  const handleDelayChange = (e) => {
    const newDelay = parseInt(e.target.value, 10) || 0;
    setFrame({ ...frame, delay_cs: newDelay });

    const updatedFrames = metadata.frames.map((f) =>
      f.index === frame.index ? { ...f, delay_cs: newDelay } : f
    );

    setMetadata({ ...metadata, frames: updatedFrames });
  };


  if (!frame) {
    return (
      <div className="text-center text-gray-400 italic p-4">
        No frame selected…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h2 className="text-lg font-bold">🖼️ Frame {frame.index}</h2>
    
      <div className="form-control w-40">
        <label className="label">
            <span className="label-text">Delay (cs)</span>
        </label>
        <input
            type="number"
            className="input input-bordered input-sm"
            value={frame?.delay_cs ?? ''}
            min={0}
            onChange={handleDelayChange}
        />
      </div>

      {frame.imageData ? (
        <img
          src={frame.imageData}
          alt={`Frame ${frame.index}`}
          className="rounded shadow max-h-64 object-contain"
        />
      ) : (
        <div className="w-full h-64 bg-gray-700 flex items-center justify-center text-white rounded">
          No image data
        </div>
      )}
    </div>
  );
}
