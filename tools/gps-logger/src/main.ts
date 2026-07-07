// App bootstrap and a tiny hash router. One live recorder is held here for the
// length of a session so navigating between screens never stops the logging.
// The service worker is registered automatically by vite-plugin-pwa.

import "./styles.css";
import type { JourneyRecorder } from "./journey";
import type { AppContext } from "./ui/context";
import { renderHome } from "./ui/home";
import { renderActive } from "./ui/active";
import { renderDetail } from "./ui/detail";

let recorder: JourneyRecorder | null = null;
let cleanup: () => void = () => {};

const ctx: AppContext = {
  getRecorder: () => recorder,
  setRecorder: (r) => {
    recorder = r;
  },
  navigate: (hash) => {
    if (location.hash === hash) void render();
    else location.hash = hash;
  },
};

async function render(): Promise<void> {
  cleanup();
  cleanup = () => {};

  const hash = location.hash || "#/";
  const journeyMatch = hash.match(/^#\/journey\/(.+)$/);

  if (hash === "#/active") {
    // Guard against a stale active route with no recorder (e.g. after reload).
    cleanup = recorder ? renderActive(ctx) : (ctx.navigate("#/"), () => {});
  } else if (journeyMatch?.[1]) {
    await renderDetail(ctx, journeyMatch[1]);
  } else {
    await renderHome(ctx);
  }
}

window.addEventListener("hashchange", () => void render());
void render();
