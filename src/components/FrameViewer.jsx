// src/components/FrameViewer.jsx
import React from "react";

export default function FrameViewer({ frame }) {
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
