import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { dirname, resolve, normalize, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, "output");
// The tool reads the same repo-root env as the other apps so an optional
// upload can reuse the anon Supabase key. RLS is the wall; no service key here.
const repoRoot = resolve(here, "..", "..");

// Dev-only endpoint: when the phone (or laptop) can reach the dev server, the
// Export button POSTs files straight into tools/gps-logger/output/. In the
// field with no server the app falls back to a normal download, so capture is
// never blocked on connectivity. This plugin does nothing in the built PWA.
function saveToOutput(): Plugin {
  return {
    name: "svika-gps-save-to-output",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
              filename?: unknown;
              content?: unknown;
            };
            const filename = String(body.filename ?? "");
            const content = String(body.content ?? "");
            // Guard against path traversal: basename only, land inside output/.
            const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
            const target = normalize(resolve(outputDir, safe));
            if (!target.startsWith(outputDir + sep)) {
              res.statusCode = 400;
              res.end("bad filename");
              return;
            }
            await mkdir(outputDir, { recursive: true });
            await writeFile(target, content, "utf8");
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, path: `output/${safe}` }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err instanceof Error ? err.message : err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    saveToOutput(),
    // Offline first is architecture: only the app shell is precached so the
    // logger opens with no signal. Journey data lives in IndexedDB and never
    // flows through an HTTP cache.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false, // public/manifest.webmanifest is the truth
      includeAssets: ["icon.svg", "manifest.webmanifest"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5175, host: true },
  preview: { port: 5175, host: true },
  envDir: repoRoot,
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
