// Home: start a new journey, resume an active one, or open a saved journey.
// Multiple journeys are kept separate and reload across sessions.

import { allJourneys, activeJourney, countPings } from "../db";
import { JourneyRecorder } from "../journey";
import { formatDuration } from "../geomath";
import type { Journey } from "../types";
import type { AppContext } from "./context";
import { h, mount, toast } from "./dom";

function durationText(j: Journey): string {
  if (j.status === "active") return "in progress";
  const end = j.endedAt ?? j.startedAt;
  return formatDuration(end - j.startedAt);
}

function journeyCard(j: Journey, pings: number, ctx: AppContext): HTMLElement {
  return h("button", {
    class: "card",
    onclick: () => ctx.navigate(`#/journey/${j.id}`),
  },
    h("div", {},
      h("span", { class: "card-title", text: j.label }),
      j.status === "active" ? h("span", { class: "badge active", text: " live" }) : null,
    ),
    h("div", {
      class: "card-meta",
      text: `${durationText(j)} · ${pings} points · ${new Date(j.startedAt).toLocaleString()}`,
    }),
  );
}

export async function renderHome(ctx: AppContext): Promise<void> {
  const journeys = await allJourneys();
  const active = await activeJourney();
  const counts = new Map<string, number>();
  await Promise.all(journeys.map(async (j) => counts.set(j.id, await countPings(j.id))));

  const startBtn = h("button", {
    class: "btn btn-xl btn-walking",
    text: "Start journey",
    onclick: async () => {
      startBtn.disabled = true;
      try {
        const rec = await JourneyRecorder.start("");
        ctx.setRecorder(rec);
        ctx.navigate("#/active");
      } catch (err) {
        startBtn.disabled = false;
        toast(err instanceof Error ? err.message : "Could not start");
      }
    },
  });

  const resumeBanner = active
    ? h("div", { class: "resume-banner" },
        h("div", { class: "rb-title", text: "Journey in progress" }),
        h("div", { class: "rb-meta", text: active.label }),
        h("button", {
          class: "btn btn-lg btn-accent",
          text: "Resume logging",
          onclick: async () => {
            try {
              const rec = ctx.getRecorder() ?? (await JourneyRecorder.resume(active.id));
              ctx.setRecorder(rec);
              ctx.navigate("#/active");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Could not resume");
            }
          },
        }),
      )
    : null;

  const list =
    journeys.length === 0
      ? h("div", { class: "empty", text: "No journeys yet. Tap Start journey and begin walking." })
      : h("div", { class: "list" }, ...journeys.map((j) => journeyCard(j, counts.get(j.id) ?? 0, ctx)));

  mount(
    h("div", { class: "screen" },
      h("div", { class: "topbar" }, h("h1", { text: "Svika GPS Logger" })),
      h("div", { class: "content" },
        resumeBanner,
        h("div", { class: "section-title", text: "Saved journeys" }),
        list,
      ),
      h("div", { class: "actions" }, active ? null : startBtn),
    ),
  );
}
