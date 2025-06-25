// src/components/FrameViewer.jsx
import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function FrameViewer({ frame, setFrame, metadata, setMetadata, inputPath }) {
  useEffect(() => {
    if (typeof frame?.index !== "number" || frame?.imageData) return;

    (async () => {
      console.log("lets go");
      const image = await fetchFrameImage(inputPath, frame.index);
      console.log("d", image);
      setFrame({ ...frame, imageData: image });
      
      const updatedFrames = metadata.frames.map((f) =>
        f.index === frame.index ? { ...f, imageData: image } : f
      );
      setMetadata({ ...metadata, frames: updatedFrames });

    })();
  }, [frame]);

  async function fetchFrameImage(path, index) {
    try {
      console.log('fetchFrameImage', path, index)
      const imageBytes = await invoke("get_frame", {
        path,
        frame: index,
      });
      console.log('imageBytes', imageBytes)

      // Convert to base64
      const blob = new Blob([new Uint8Array(imageBytes)], { type: "image/png" });
      const base64 = await blobToBase64(blob);
      return base64;
    } catch (err) {
      console.error("Failed to fetch frame image:", err);
      return null;
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

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
        <div className="rounded shadow" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <img
            src={frame.imageData}
            alt={`Frame ${frame.index}`}
            style={{
              width: `${metadata?.width}px`,
              height: `${metadata?.height}px`,
              imageRendering: "pixelated", // if you want sharp nearest-neighbor look
              backgroundColor: "white",
              border: "1px solid #ccc"
            }}

          />
        </div>

        
      ) : (
        <div className="w-full h-64 bg-gray-700 flex items-center justify-center text-white rounded">
          No image data
        </div>
      )}
    </div>
  );
}
