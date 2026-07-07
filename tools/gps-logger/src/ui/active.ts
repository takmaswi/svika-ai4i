// The field screen: big live stats and big one-handed mode buttons. Structure
// is built once; ping and clock updates patch text in place so a tap is never
// interrupted by a re-render. The action buttons rebuild only when the mode
// changes (walking <-> waiting <-> riding).

import type { JourneyRecorder, LiveSnapshot } from "../journey";
import { formatDuration, formatKmh } from "../geomath";
import type { Mode } from "../types";
import type { AppContext } from "./context";
import { confirmSheet, h, mount, toast } from "./dom";
import { boardModal, markPointModal } from "./modals";

const MODE_TEXT: Record<Mode, string> = {
  walking: "Walking",
  waiting: "Waiting",
  riding: "Riding",
};

export function renderActive(ctx: AppContext): () => void {
  const maybeRecorder = ctx.getRecorder();
  if (!maybeRecorder) {
    ctx.navigate("#/");
    return () => {};
  }
  // Non-null binding so the nested handlers below never see `null`.
  const recorder: JourneyRecorder = maybeRecorder;

  const modeLabel = h("div", { class: "mode-label", text: "Current mode" });
  const modeValue = h("div", { class: "mode-value" });
  const modeRoute = h("div", { class: "mode-route" });
  const banner = h("div", { class: "mode-banner" }, modeLabel, modeValue, modeRoute);

  const gpsWarn = h("div", { class: "gps-warn" });
  const statLeg = h("div", { class: "value" });
  const statPoints = h("div", { class: "value" });
  const statElapsed = h("div", { class: "value mono" });
  const statSpeed = h("div", { class: "value mono small" });

  const statGrid = h("div", { class: "stat-grid" },
    h("div", { class: "stat" }, h("div", { class: "label", text: "Leg" }), statLeg),
    h("div", { class: "stat" }, h("div", { class: "label", text: "Points" }), statPoints),
    h("div", { class: "stat" }, h("div", { class: "label", text: "Elapsed" }), statElapsed),
    h("div", { class: "stat" }, h("div", { class: "label", text: "Speed" }), statSpeed),
  );

  const actions = h("div", { class: "actions" });

  const screen = h("div", { class: "screen" },
    h("div", { class: "topbar" },
      h("h1", { text: recorder.snapshot().journey.label }),
      h("button", { class: "icon-btn", text: "‹", onclick: () => ctx.navigate("#/") }),
    ),
    h("div", { class: "content" }, banner, gpsWarn, statGrid),
    actions,
  );
  mount(screen);

  const markBtn = h("button", {
    class: "btn btn-lg btn-accent",
    text: "Mark point",
    onclick: async () => {
      const input = await markPointModal();
      if (!input) return;
      try {
        await recorder.markPoint(input.type, input.name);
        toast(input.name ? `Marked ${input.type}: ${input.name}` : `Marked ${input.type}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not mark");
      }
    },
  });

  const endBtn = h("button", {
    class: "btn btn-lg btn-danger",
    text: "Arrived / End",
    onclick: async () => {
      if (!(await confirmSheet("End this journey?", "End journey"))) return;
      await recorder.end();
      ctx.setRecorder(null);
      ctx.navigate(`#/journey/${recorder.id}`);
    },
  });

  function transitionButtons(mode: Mode): HTMLElement[] {
    if (mode === "walking") {
      return [
        h("button", {
          class: "btn btn-xl btn-riding",
          text: "Boarded kombi",
          onclick: onBoard,
        }),
        h("button", {
          class: "btn btn-lg btn-waiting",
          text: "Waiting for kombi",
          onclick: async () => {
            await recorder.setWaiting();
            toast("Waiting for kombi");
          },
        }),
      ];
    }
    if (mode === "waiting") {
      return [
        h("button", { class: "btn btn-xl btn-riding", text: "Boarded kombi", onclick: onBoard }),
      ];
    }
    // riding
    return [
      h("button", {
        class: "btn btn-xl btn-walking",
        text: "Got off kombi",
        onclick: async () => {
          await recorder.alight();
          toast("Walking");
        },
      }),
    ];
  }

  async function onBoard(): Promise<void> {
    const input = await boardModal();
    if (!input) return;
    await recorder.board(input.routeName, input.direction);
    toast(input.routeName ? `Riding: ${input.routeName}` : "Riding");
  }

  let lastMode: Mode | null = null;
  function rebuildActions(mode: Mode): void {
    actions.replaceChildren(
      ...transitionButtons(mode),
      h("div", { class: "btn-grid" }, markBtn, endBtn),
    );
    lastMode = mode;
  }

  function paint(): void {
    const snap: LiveSnapshot = recorder.snapshot();
    banner.className = `mode-banner ${snap.mode}`;
    modeValue.textContent = MODE_TEXT[snap.mode];
    const route = snap.currentLeg.routeName;
    modeRoute.textContent =
      snap.mode === "riding" && route
        ? `${route}${snap.currentLeg.direction ? ` · ${snap.currentLeg.direction}` : ""}`
        : "";
    modeRoute.style.display = modeRoute.textContent ? "block" : "none";

    statLeg.textContent = `${snap.legIndex + 1}`;
    statPoints.textContent = `${snap.pingCount}`;
    statSpeed.textContent = formatKmh(snap.lastSpeedMps);

    const warn = snap.gpsError ?? (!snap.hasFix ? "Waiting for GPS fix..." : null);
    gpsWarn.textContent = warn ?? "";
    gpsWarn.style.display = warn ? "block" : "none";

    if (snap.mode !== lastMode) rebuildActions(snap.mode);
  }

  function tickElapsed(): void {
    const snap = recorder.snapshot();
    statElapsed.textContent = formatDuration(Date.now() - snap.journey.startedAt);
  }

  recorder.setOnChange(paint);
  paint();
  tickElapsed();
  const interval = window.setInterval(tickElapsed, 1000);

  return () => {
    window.clearInterval(interval);
    recorder.setOnChange(() => {});
  };
}
