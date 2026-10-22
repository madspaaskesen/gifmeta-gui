import React from "react";
import ReactDOM from "react-dom/client";
import GifMetaApp from "./GifMetaApp";

// Restore the theme the user picked last time.
try {
  const theme = localStorage.getItem("gifmeta-theme");
  if (theme) document.documentElement.setAttribute("data-theme", theme);
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GifMetaApp />
  </React.StrictMode>,
);
