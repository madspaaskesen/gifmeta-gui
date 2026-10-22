## 🧭 Installation Instructions

Download the file for your platform from the
👉 [latest release](https://github.com/madspaaskesen/gifmeta-gui/releases/latest)

### 🪟 Windows — `GIFmeta_<version>_x64_en-US.msi`

1. **Double-click** the `.msi` installer and follow the steps.
2. Start **GIFmeta** from the Start menu.

> If SmartScreen warns you, click **"More info" → "Run anyway"**.
> This is normal for new indie apps while they build up reputation. ✨

---

### 🍏 macOS — `GIFmeta_<version>_x64.dmg`

1. Open the `.dmg` and drag **GIFmeta** into **Applications**.
2. Start it from Applications / Launchpad.

> If macOS says the app is from an "unidentified developer", open
> **System Settings → Privacy & Security → Open Anyway**, then relaunch it.
> Or in Terminal: `xattr -d com.apple.quarantine /Applications/GIFmeta.app`
>
> The current build is for Intel (x64) and runs on Apple Silicon via Rosetta.
> Signed + notarized builds (and a native Apple Silicon build) are planned.

---

### 🐧 Linux — `GIFmeta_<version>_amd64.AppImage`

```bash
chmod +x GIFmeta_*_amd64.AppImage
./GIFmeta_*_amd64.AppImage
```

If it complains about missing libraries (Ubuntu/Debian):

```bash
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0
```

---

### 🛠️ Build from source

```bash
git clone https://github.com/madspaaskesen/gifmeta-gui.git
cd gifmeta-gui
npm install
npm run tauri build
```

Requires [Rust](https://www.rust-lang.org/tools/install) and Node.js; on Linux also the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

---

### 👀 Preview

![Viewer – light](docs/screenshots/light-viewer.png)
![Raw view – light](docs/screenshots/light-raw.png)
![Settings – light](docs/screenshots/light-settings.png)

Darkmode

![Viewer – dark](docs/screenshots/dark-viewer.png)
![Raw view – dark](docs/screenshots/dark-raw.png)
![Settings – dark](docs/screenshots/dark-settings.png)

---

### 💡 Tip

> If something doesn’t work, feel free to open an [issue](https://github.com/madspaaskesen/gifmeta-gui/issues) or leave a star if you enjoy it! 🌟


