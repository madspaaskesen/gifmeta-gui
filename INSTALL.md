## 🧭 Installation Instructions

Download the file for your platform from the
👉 [latest release](https://github.com/madspaaskesen/gifmeta-gui/releases/latest)

### 🪟 Windows — `gifmeta-gui_<version>_x64_en-US.msi`

1. **Double-click** the `.msi` installer and follow the steps.
2. Start **gifmeta-gui** from the Start menu.

> If SmartScreen warns you, click **"More info" → "Run anyway"**.
> This is normal for new indie apps while they build up reputation. ✨

---

### 🍏 macOS — `gifmeta-gui_<version>_x64.dmg`

1. Open the `.dmg` and drag **gifmeta-gui** into **Applications**.
2. Start it from Applications / Launchpad.

> If macOS says the app is from an "unidentified developer", open
> **System Settings → Privacy & Security → Open Anyway**, then relaunch it.
> Or in Terminal: `xattr -d com.apple.quarantine /Applications/gifmeta-gui.app`
>
> The current build is for Intel (x64) and runs on Apple Silicon via Rosetta.
> Signed + notarized builds (and a native Apple Silicon build) are planned.

---

### 🐧 Linux — `gifmeta-gui_<version>_amd64.AppImage`

```bash
chmod +x gifmeta-gui_*_amd64.AppImage
./gifmeta-gui_*_amd64.AppImage
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

### 👀 Preview (Screenshot)

![Screenshot preview 1](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-1.png)
![Screenshot preview 2](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-2.png)
![Screenshot preview 3](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-3.png)
![Screenshot preview 4](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-4.png)
![Screenshot preview 5](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-5.png)

Darkmode
![Screenshot preview 1 Darkmode](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-1-darkmode.png)
![Screenshot preview 2 Darkmode](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-2-darkmode.png)
![Screenshot preview 3 Darkmode](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-3-darkmode.png)
![Screenshot preview 4 Darkmode](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-4-darkmode.png)
![Screenshot preview 5 Darkmode](https://ojkwbrxgljlgelqndiai.supabase.co/storage/v1/object/public/sacred-ai/web/gifmeta-gui/Screen-5-darkmode.png)

---

### 💡 Tip

> If something doesn’t work, feel free to open an [issue](https://github.com/madspaaskesen/gifmeta-gui/issues) or leave a star if you enjoy it! 🌟


