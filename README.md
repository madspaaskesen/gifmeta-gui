<p align="center">
  <img src="assets/gifmeta-crab.svg" width="180" alt="gifmeta crab logo">
</p>

<h1 align="center">🦀 GIFmeta GUI</h1>

<p align="center">
  <a href="https://github.com/madspaaskesen/gifmeta-gui/releases/latest"><img src="https://img.shields.io/github/v/release/madspaaskesen/gifmeta-gui?label=release&color=E0592C" alt="Latest release"></a>
  <a href="https://github.com/madspaaskesen/gifmeta-gui/releases"><img src="https://img.shields.io/github/downloads/madspaaskesen/gifmeta-gui/total?color=862E13" alt="Downloads"></a>
  <a href="https://github.com/madspaaskesen/gifmeta-gui/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/madspaaskesen/gifmeta-gui/ci.yml?label=CI" alt="CI"></a>
  <a href="https://crates.io/crates/gifmeta"><img src="https://img.shields.io/crates/v/gifmeta?label=gifmeta%20crate" alt="gifmeta crate"></a>
</p>

**A lightweight cross-platform desktop app to inspect and edit GIF metadata.**  
Built with love using [Tauri](https://tauri.app), [Rust](https://www.rust-lang.org/), and [React](https://react.dev/).

> Edit loop counts and frame delays, play your changes before saving, and see how frame-optimized GIFs are built — all in a clean native GUI.  
> Powered by the [gifmeta](https://crates.io/crates/gifmeta) Rust crate.

<p align="center">
  <a href="https://github.com/madspaaskesen/gifmeta-gui/releases/latest"><b>📥 Download for macOS · Windows · Linux</b></a>
</p>

---

## 🚀 Features

- 📁 Open GIF files via native dialog — or drag & drop onto the window
- 🧠 Inspect metadata: dimensions, frames, loop count, transparency, etc.
- 🔑 / Δ Detect **frame-optimized GIFs**: see which frames are keyframes and which are delta frames
- ✨ **Pretty / 🧩 Raw view**: see a frame as it plays, or only the pixels it stores
- ▶ **Play** the GIF with your edited delays before saving
- ⏱️ Edit per-frame delays or set one delay for all frames
- 🔄 Loop forever or a fixed number of plays
- 💾 Save via native dialog, with unsaved-changes indicator and reset
- ⌨️ Keyboard: ↑/↓ change frame, Space play/pause
- 🌒 Light & dark theme
- 💨 Ultra-fast thanks to the Rust backend via Tauri

![Rust](https://img.shields.io/badge/built_with-rust-orange)
![MadeWithTauri](https://img.shields.io/badge/ui-tauri-8d64c0?logo=tauri&logoColor=white)
![GIFmeta](https://img.shields.io/badge/gifmeta--cli--core-blue)
[![SacredAI](https://img.shields.io/badge/powered%20by-%F0%9F%95%8A%EF%B8%8F%20Sacred%20AI-lightgrey?style=flat-square)](https://sacred-ai.com)
[![mySiteChart](https://badges.mysitechart.com/github-project/madspaaskesen/gifmeta-gui?site=COM)](https://mysitechart.com/In?github-project=madspaaskesen%2Fgifmeta-gui)

---

## ⚙️ Getting Started

```bash
# Install dependencies
npm install

# Start in development mode
npm run tauri dev
```

Make sure you have Rust installed:
👉 [Install Rust](https://www.rust-lang.org/tools/install)

---

## 🧭 Installation Instructions

Download the installer for your platform from the [latest release](https://github.com/madspaaskesen/gifmeta-gui/releases/latest), then follow the steps here:

👉 [INSTALL.md](INSTALL.md)

---

### 👀 Preview

**Viewer** — frame list with 🔑 keyframes / Δ delta frames, playback and frame info

![Viewer – light](docs/screenshots/light-viewer.png)

**Raw view** — only the pixels a delta frame stores (checkerboard = reused from earlier frames)

![Raw view – dark](docs/screenshots/dark-raw.png)

<details>
<summary>More screenshots (settings, light & dark)</summary>

![Settings – light](docs/screenshots/light-settings.png)
![Viewer – dark](docs/screenshots/dark-viewer.png)
![Raw view – light](docs/screenshots/light-raw.png)
![Settings – dark](docs/screenshots/dark-settings.png)

</details>

---

## 💻 Recommended IDE Setup

* [Visual Studio Code](https://code.visualstudio.com/)

  * [Tauri Plugin for VSCode](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  * [Rust Analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## 🌐 Related Projects

* 🔨 [Hardcore Websmith](https://hardcorewebsmith.com) — digital blacksmithing & Rust development, software à la carte
* 🎬 [Flixlar](https://flixlar.com) — fast subtitle editing and export for video, offline speech-to-text, your videos stay on your computer
* 🕊️ [Sacred-AI](https://sacred-ai.com) — gentle AI for emotional reflection
* 📈 [MySiteChart](https://mysitechart.com) — website uptime + visit tracker
* 🛠️ [MP-IT](https://mp-it.dk) — freelance & micro tool development
* 🧵 [DDD Favoritter](https://ddd-favoritter.dk) — personal Danish archive

---

## 🙏 Created by

Forged with clarity and care by
**[🔨 HardcoreWebsmith](https://hardcorewebsmith.com)** — *forging digital solutions since 1993* · *[Mads Paaskesen](https://mp-it.dk)*

---

💛 [@madspaaskesen](https://github.com/madspaaskesen) • [HardcoreWebsmith.com](https://hardcorewebsmith.com) • [Flixlar.com](https://flixlar.com)

---

## 🧠 Philosophy

> GIFmeta is the sacred heart of a minimalist toolkit.
> It brings transparency and control to your looping art,
> so you can create more intentionally — and beautifully.

---

## 📜 License

MIT — feel free to remix, improve, and share with credit.
