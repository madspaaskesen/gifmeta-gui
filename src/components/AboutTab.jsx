export default function AboutTab() {
  return (
    <div className="p-4 space-y-4 prose max-w-none">
      <h2 className="text-xl font-bold">🦀 GIFmeta</h2>
      <p>
        <strong>GIFmeta</strong> is a small but powerful tool designed to let you view and modify GIF metadata — frame delays, loop counts, and more.
        It's built with care, beauty, and freedom in mind. No watermarks, no limitations, no ads.
      </p>

      <h3>🌱 Why it exists</h3>
      <p>
        Sometimes the tiniest things matter most. GIF delays breaking or looping forever can be frustrating — especially in professional or sacred creative work.
        GIFmeta was made to give creators and developers a way to take back control and preserve the timing and structure of their GIFs.
      </p>

      <h3>🛠 Technology</h3>
      <ul>
        <li>Tauri (Rust-based desktop engine)</li>
        <li>React + Vite frontend</li>
        <li>TailwindCSS + DaisyUI</li>
      </ul>

      <h3>🌍 Created by</h3>
      <p>
        <a href="https://mp-it.dk" target="_blank" rel="noopener noreferrer" className="link">
          Mads Paaskesen
        </a> — a passionate developer and digital craftsman.  
      </p>

      <h3>🔗 Links</h3>
      <ul>
        <li><a href="https://github.com/madspaaskesen/gifmeta-gui" className="link">GitHub Repository</a></li>
        <li><a href="https://mp-it.dk" className="link">MP-IT.dk</a></li>
        <li><a href="https://sacred-ai.com" className="link">Sacred-AI.com</a></li>
      </ul>

      <p className="italic text-sm text-gray-500">
        This tool is part of a greater journey — a small helper born from sacred design, utility, and love.
      </p>
    </div>
  );
}
