import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
//import { open } from '@tauri-apps/api/dialog';
import { open } from '@tauri-apps/plugin-dialog';
import "./GifMetaApp.css";

function GifMetaApp() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [metadata, setMetadata] = useState(null);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  async function selectFile() {
    console.log('window.__TAURI__.dialog', window.__TAURI__.dialog)
    const selected = await open({
      filters: [{ name: "GIFs", extensions: ["gif"] }]
    });

    if (selected) {
      console.log("Selected file:", selected);
      // invoke your Rust command here
      const meta = await invoke("get_info", { path: selected });
      console.log(meta)
      setMetadata(meta)
    }
  }

  return (
    <main className="container">
      <h1>Welcome to GIF meta GUI 🦀</h1>

      <button onClick={selectFile} className="btn">📁 Select File</button>

      <pre className="pretty-json">
        {JSON.stringify(metadata, (key, value) => (value === null ? undefined : value), 2)}
      </pre>


      {/*
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
      */}
    </main>
  );
}

export default GifMetaApp;
