import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// env comes from the repo root .env.local; the app reads the same
// NEXT_PUBLIC_ Supabase keys the web app uses (anon key only, RLS is the wall)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig({
  plugins: [
    react(),
    // Offline first is architecture: the app shell precaches so the keypad
    // opens with no signal. Only the shell is cached; ticket and money data
    // never flow through an HTTP cache (IndexedDB + the sync queue own that).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false, // the Brand v2 manifest in public/ is the truth
      includeAssets: ["logo.svg", "manifest.webmanifest"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
        navigateFallback: "/index.html",
        // never intercept Supabase calls; offline behaviour is explicit app
        // logic, not a stale HTTP cache
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5174 },
  preview: { port: 5174 },
  envDir: repoRoot,
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
