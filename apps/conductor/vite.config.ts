import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// env comes from the repo root .env.local; the app reads the same
// NEXT_PUBLIC_ Supabase keys the web app uses (anon key only, RLS is the wall)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  preview: { port: 5174 },
  envDir: repoRoot,
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
