// Repo root .env loading for spine CLI scripts (ingest, train) and the dev
// server. Same behaviour as the seed script: .env.local wins, then .env, and
// nothing already set in the environment is overwritten.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export function loadRepoEnv(): void {
  for (const f of [".env.local", ".env"]) {
    const p = join(repoRoot, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
}
