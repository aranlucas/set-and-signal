import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { MOBILE } from "./lib/mobile";
// CSS is loaded for its global side effects.
// oxlint-disable-next-line import/no-unassigned-import
import "./index.css";

const rootElement = document.querySelector("#root");
if (!rootElement) throw new Error("Missing #root application mount point");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Not in the mobile build: the native shell already serves everything from disk.
if (!MOBILE && "serviceWorker" in navigator && location.protocol === "https:") {
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch {
    // Service workers are optional for local/browser environments.
  }
}
