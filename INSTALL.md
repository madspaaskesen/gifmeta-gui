## 🧭 Installation Instructions

Download the file for your platform from the
👉 [latest release](https://github.com/madspaaskesen/gifmeta-gui/releases/latest)

### 🪟 Windows — `GIFmeta_<version>_x64_en-US.msi`

1. **Double-click** the `.msi` installer and follow the steps.
2. Start **GIFmeta** from the Start menu.

> The installer is signed (publisher: Mads Paaskesen). If SmartScreen still warns you while the app
> builds up reputation, click **"More info" → "Run anyway"**. ✨

---

### 🍏 macOS — `GIFmeta_<version>_aarch64.dmg` (Apple Silicon) or `GIFmeta_<version>_x64.dmg` (Intel)

1. Pick **aarch64** for M1/M2/M3/M4 Macs, **x64** for Intel Macs ( → About This Mac).
2. Open the `.dmg` and drag **GIFmeta** into **Applications**.
3. Start it from Applications / Launchpad.

> From v0.4.0 the macOS builds are signed and notarized by Apple, so they open without warnings.
> Older builds: if macOS says the app is from an "unidentified developer", open
> **System Settings → Privacy & Security → Open Anyway**, or in Terminal:
> `xattr -d com.apple.quarantine /Applications/GIFmeta.app`

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


