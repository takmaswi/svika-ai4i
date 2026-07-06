// Re-seeds the demo data before every e2e run so the suite starts from a
// known state: demo users exist, the rider wallet is refilled, the verified
// network is present. The seed is idempotent, so this is cheap.
import { execSync } from "node:child_process";
import { join } from "node:path";

export default function globalSetup(): void {
  const dbPkg = join(__dirname, "..", "..", "..", "packages", "db");
  execSync("node seed/seed.mjs", { cwd: dbPkg, stdio: "inherit" });
}
