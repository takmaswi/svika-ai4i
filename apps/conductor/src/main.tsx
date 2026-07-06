import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@svika/ui/styles.css";
import "./app.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A missing service worker must never block the app; offline is P2.
    });
  });
}
