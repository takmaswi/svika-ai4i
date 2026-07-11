// Re-seeds the demo data before every e2e run so the suite starts from a
// known state: demo users exist, the rider wallet is refilled, the verified
// network is present. The seed is idempotent, so this is cheap. The watchdog
// pipeline runs after it so the owner card has scored synthetic history and
// the staged end day variants the watchdog story swaps between.
import { execSync } from "node:child_process";
import { join } from "node:path";

export default function globalSetup(): void {
  const repoRoot = join(__dirname, "..", "..", "..");
  const dbPkg = join(repoRoot, "packages", "db");
  execSync("node seed/seed.mjs", { cwd: dbPkg, stdio: "inherit" });
  execSync("pnpm watchdog:run", { cwd: repoRoot, stdio: "inherit" });
}
