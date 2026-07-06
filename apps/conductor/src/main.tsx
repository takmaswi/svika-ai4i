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

// Service worker registration is injected at build time by vite-plugin-pwa
// (registerType autoUpdate); the precached shell opens the keypad with no
// signal at all.
