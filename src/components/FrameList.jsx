import { useEffect, useRef } from "react";

export default function FrameList({ frames, original, selectedIndex, onSelect, unoptimize = false }) {
  const listRef = useRef(null);

  // Keep the selected frame visible (keyboard navigation / playback).
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!frames?.length) {
    return <p className="text-xs opacity-60">No frames yet…</p>;
  }

  return (
    <ul ref={listRef} className="space-y-1">
      {frames.map((f) => {
        const selected = selectedIndex === f.index;
        const changed = original && f.delay_cs !== original.frames[f.index]?.delay_cs;
        const willRekey = !f.deleted && (f.rekey || unoptimize) && !f.is_keyframe;
        const icon = f.deleted ? "🗑️" : willRekey ? "🔑" : f.is_keyframe ? "🔑" : "Δ";
        const title = f.deleted
          ? "Will be deleted"
          : willRekey
            ? "Will be converted to a full image"
            : f.is_keyframe
              ? "Keyframe — a full image on its own"
              : "Delta frame — only stores changes on top of earlier frames";
        return (
          <li
            key={f.index}
            data-index={f.index}
            onClick={() => onSelect(f.index)}
            title={title}
            className={`cursor-pointer rounded px-2 py-1.5 text-xs flex items-center gap-2 ${
              selected ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-100"
            } ${f.deleted ? "opacity-50" : ""}`}
          >
            <span className={`w-5 text-center ${willRekey ? "rounded ring-1 ring-success" : ""}`}>{icon}</span>
            <span className={`flex-1 ${f.deleted ? "line-through" : ""}`}>Frame {f.index}</span>
            <span className={`tabular-nums ${changed ? "font-bold" : "opacity-70"} ${f.deleted ? "line-through" : ""}`}>
              {f.delay_cs} cs{changed ? " ●" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
