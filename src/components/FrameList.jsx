import { useEffect, useRef, useState } from "react";
import { originalDelay } from "../lib/gif";

/**
 * Frame list: one row per item (frame of the GIF, copy or inserted image).
 * Drag a row by its ⠿ handle to re-order. Uses pointer events instead of HTML5 drag & drop,
 * because Tauri's file-drop handling disables HTML5 drag & drop on Windows.
 */
export default function FrameList({ frames, original, selectedIndex, onSelect, onMove, disabled = false, unoptimize = false }) {
  const listRef = useRef(null);
  const [drag, setDrag] = useState(null); // { from, over } — over = insertion slot 0…n

  // Keep the selected frame visible (keyboard navigation / playback).
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-pos="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!frames?.length) {
    return <p className="text-xs opacity-60">No frames yet…</p>;
  }

  const slotAt = (clientY) => {
    const rows = [...(listRef.current?.querySelectorAll("[data-pos]") ?? [])];
    const i = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return clientY < b.top + b.height / 2;
    });
    return i === -1 ? rows.length : i;
  };

  const startDrag = (e, from) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    let over = from;
    setDrag({ from, over });
    const move = (ev) => {
      over = slotAt(ev.clientY);
      setDrag({ from, over });
      // Auto-scroll near the edges of the list.
      const box = listRef.current?.parentElement;
      if (box) {
        const b = box.getBoundingClientRect();
        if (ev.clientY < b.top + 24) box.scrollTop -= 12;
        else if (ev.clientY > b.bottom - 24) box.scrollTop += 12;
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      const to = over > from ? over - 1 : over;
      if (to !== from) onMove?.(from, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const showSlot = (slot) => drag && slot === drag.over && slot !== drag.from && slot !== drag.from + 1;

  return (
    <ul ref={listRef} className={`space-y-1 ${drag ? "cursor-grabbing" : ""}`}>
      {frames.map((f, pos) => {
        const selected = selectedIndex === pos;
        const isImage = f.kind === "image";
        const changed = !isImage && original && f.delay_cs !== originalDelay(original, f);
        const willRekey = !isImage && !f.deleted && (f.rekey || unoptimize) && !f.is_keyframe;
        const icon = f.deleted
          ? "🗑️"
          : isImage
            ? "🖼️"
            : willRekey || f.is_keyframe
              ? "🔑"
              : "Δ";
        const title = f.deleted
          ? "Will be deleted"
          : isImage
            ? `Image: ${f.path}`
            : willRekey
              ? "Will be converted to a full image"
              : f.is_keyframe
                ? "Keyframe — a full image on its own"
                : "Delta frame — only stores changes on top of earlier frames";
        const label = isImage ? f.name : `Frame ${f.index}`;
        return (
          <li
            key={f.key}
            data-pos={pos}
            onClick={() => onSelect(pos)}
            title={title}
            className={`relative cursor-pointer rounded px-1 py-1.5 text-xs flex items-center gap-1.5 ${
              selected ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-100"
            } ${f.deleted ? "opacity-50" : ""} ${drag?.from === pos ? "opacity-40" : ""}`}
          >
            {showSlot(pos) && <span className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-accent" />}
            <span
              className={`px-0.5 opacity-50 hover:opacity-100 ${disabled ? "invisible" : "cursor-grab"}`}
              onPointerDown={(e) => startDrag(e, pos)}
              onClick={(e) => e.stopPropagation()}
              title="Drag to move"
            >
              ⠿
            </span>
            <span className={`w-5 text-center ${willRekey ? "rounded ring-1 ring-success" : ""}`}>{icon}</span>
            <span className={`flex-1 truncate ${f.deleted ? "line-through" : ""}`}>
              {label}
              {f.copy && <span className="ml-1 badge badge-xs badge-info">copy</span>}
              {isImage && <span className="ml-1 badge badge-xs badge-secondary">new</span>}
            </span>
            <span className={`tabular-nums ${changed ? "font-bold" : "opacity-70"} ${f.deleted ? "line-through" : ""}`}>
              {f.delay_cs} cs{changed ? " ●" : ""}
            </span>
            {pos === frames.length - 1 && showSlot(frames.length) && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-accent" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
