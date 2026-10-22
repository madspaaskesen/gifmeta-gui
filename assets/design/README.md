# 🦀 gifmeta crab — design history

| File | What |
|---|---|
| `gifmeta-crab-original-mp-it.gif` | Original crab from the gifmeta project page on mp-it.dk (raster, 1024×1024) |
| `gifmeta-crab-v1.svg` | v1 — first clean SVG redraw (4 colours, left side drawn once + mirrored) |
| `gifmeta-crab-v2-inkscape.svg` | v2 — Mads' Inkscape edit: wider claws and legs (sides scaled slightly differently) |
| `../gifmeta-crab.svg` | **Current** — v2 made exactly symmetric (average of both side scalings) |
| `../gifmeta-crab-1024.png` | Current, rendered 1024×1024 → source for `npx tauri icon` |

Editing: open `../gifmeta-crab.svg` in Inkscape and edit the **left** side group (`#side`);
the right side is a mirrored `<use>` clone and follows automatically.
Colours: body `#E0592C`, outline `#862E13`, eyes `#45190D`, eye highlight `#F3E9EA`.
