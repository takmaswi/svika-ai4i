// Getting exports off the phone. Two paths, download is the reliable one:
//   1. When the dev server is reachable (you opened the app from your laptop's
//      `pnpm dev`), POST straight into tools/gps-logger/output/.
//   2. Otherwise download to the phone; move the files into output/ later.
// The built/installed PWA in the field has no dev server, so it always
// downloads. Capture is never blocked on connectivity.

import type { ExportFile } from "./export";

export type DeliveryVia = "output" | "download";

export interface DeliveryResult {
  filename: string;
  via: DeliveryVia;
  path?: string;
}

async function saveToOutput(file: ExportFile): Promise<string | null> {
  try {
    const res = await fetch("/__save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.filename, content: file.content }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; path?: string };
    return data.ok ? (data.path ?? `output/${file.filename}`) : null;
  } catch {
    return null;
  }
}

function download(file: ExportFile): void {
  const blob = new Blob([file.content], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function deliverFiles(files: ExportFile[]): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  for (const file of files) {
    const path = await saveToOutput(file);
    if (path) {
      results.push({ filename: file.filename, via: "output", path });
    } else {
      download(file);
      results.push({ filename: file.filename, via: "download" });
    }
  }
  return results;
}
