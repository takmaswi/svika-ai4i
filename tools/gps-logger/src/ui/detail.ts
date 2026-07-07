// Journey detail: review the recorded legs and marked points, fix up names or a
// route after the fact, then export (GeoJSON + CSV + bundle) or upload.

import {
  deleteJourney,
  getJourney,
  legsFor,
  pingsFor,
  pointsFor,
  putLeg,
  putPoint,
} from "../db";
import { buildExportFiles, type JourneyExport } from "../export";
import { deliverFiles } from "../deliver";
import { uploadJourney } from "../upload";
import { formatDuration, pathDistanceMeters } from "../geomath";
import type { Leg, MarkedPoint, Mode, Ping } from "../types";
import type { AppContext } from "./context";
import { confirmSheet, h, mount, toast } from "./dom";
import { boardModal, editTextModal } from "./modals";

const MODE_TEXT: Record<Mode, string> = {
  walking: "Walk",
  waiting: "Wait for kombi",
  riding: "Ride",
};

function metres(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} km` : `${Math.round(n)} m`;
}

function legRow(leg: Leg, legPings: Ping[], onEdit: () => void): HTMLElement {
  const dur = leg.endedAt ? formatDuration(leg.endedAt - leg.startedAt) : "open";
  const title =
    leg.mode === "riding"
      ? `${MODE_TEXT.riding}: ${leg.routeName || "unnamed route"}`
      : MODE_TEXT[leg.mode];
  const sub =
    leg.mode === "riding"
      ? `${leg.direction ?? "no direction"} · ${dur} · ${legPings.length} pts · ${metres(pathDistanceMeters(legPings))}`
      : `${dur} · ${legPings.length} pts · ${metres(pathDistanceMeters(legPings))}`;
  return h("div", { class: "leg-row" },
    h("span", { class: `dot ${leg.mode}` }),
    h("div", { class: "grow" },
      h("div", { class: "leg-title", text: `${leg.index + 1}. ${title}` }),
      h("div", { class: "leg-sub", text: sub }),
    ),
    leg.mode === "riding"
      ? h("button", { class: "icon-btn", text: "✎", onclick: onEdit, attrs: { "aria-label": "Edit route" } })
      : null,
  );
}

function pointRow(point: MarkedPoint, onRename: () => void): HTMLElement {
  return h("div", { class: "point-row" },
    h("div", { class: "grow" },
      h("div", { class: "pt-type", text: point.type }),
      h("div", { text: point.name || "(unnamed)" }),
    ),
    h("button", { class: "icon-btn", text: "✎", onclick: onRename, attrs: { "aria-label": "Rename point" } }),
  );
}

export async function renderDetail(ctx: AppContext, journeyId: string): Promise<void> {
  const journey = await getJourney(journeyId);
  if (!journey) {
    toast("Journey not found");
    ctx.navigate("#/");
    return;
  }
  const [legs, pings, points] = await Promise.all([
    legsFor(journeyId),
    pingsFor(journeyId),
    pointsFor(journeyId),
  ]);
  const data: JourneyExport = { journey, legs, pings, points };
  const pingsByLeg = new Map<number, Ping[]>();
  for (const p of pings) {
    const bucket = pingsByLeg.get(p.legIndex);
    if (bucket) bucket.push(p);
    else pingsByLeg.set(p.legIndex, [p]);
  }

  const totalDist = pathDistanceMeters(pings);
  const dur = formatDuration((journey.endedAt ?? Date.now()) - journey.startedAt);

  const legList = h("div", {},
    ...legs.map((leg) =>
      legRow(leg, pingsByLeg.get(leg.index) ?? [], async () => {
        const edited = await boardModal({
          routeName: leg.routeName ?? "",
          direction: leg.direction ?? undefined,
        });
        if (!edited) return;
        await putLeg({ ...leg, routeName: edited.routeName, direction: edited.direction });
        toast("Route updated");
        void renderDetail(ctx, journeyId);
      }),
    ),
  );

  const pointList =
    points.length === 0
      ? h("div", { class: "empty", text: "No marked points." })
      : h("div", {},
          ...points.map((point) =>
            pointRow(point, async () => {
              const name = await editTextModal("Rename point", point.name);
              if (name === null) return;
              await putPoint({ ...point, name });
              toast("Renamed");
              void renderDetail(ctx, journeyId);
            }),
          ),
        );

  const exportBtn = h("button", {
    class: "btn btn-lg btn-walking",
    text: "Export GeoJSON + CSV",
    onclick: async () => {
      exportBtn.disabled = true;
      try {
        const results = await deliverFiles(buildExportFiles(data));
        const toOutput = results.filter((r) => r.via === "output").length;
        toast(
          toOutput === results.length
            ? `Saved ${results.length} files to output/`
            : `Downloaded ${results.length} files`,
        );
      } finally {
        exportBtn.disabled = false;
      }
    },
  });

  const uploadBtn = h("button", {
    class: "btn btn-lg btn-outline",
    text: "Upload to database",
    onclick: async () => {
      uploadBtn.disabled = true;
      const res = await uploadJourney(data);
      toast(res.message);
      uploadBtn.disabled = false;
    },
  });

  const deleteBtn = h("button", {
    class: "btn btn-lg btn-ghost",
    text: "Delete journey",
    onclick: async () => {
      if (!(await confirmSheet("Delete this journey for good?", "Delete"))) return;
      await deleteJourney(journeyId);
      toast("Deleted");
      ctx.navigate("#/");
    },
  });

  mount(
    h("div", { class: "screen" },
      h("div", { class: "topbar" },
        h("h1", { text: journey.label }),
        h("button", { class: "icon-btn", text: "‹", onclick: () => ctx.navigate("#/") }),
      ),
      h("div", { class: "content" },
        h("div", { class: "stat-grid" },
          h("div", { class: "stat" }, h("div", { class: "label", text: "Duration" }), h("div", { class: "value mono", text: dur })),
          h("div", { class: "stat" }, h("div", { class: "label", text: "Points" }), h("div", { class: "value", text: `${pings.length}` })),
          h("div", { class: "stat" }, h("div", { class: "label", text: "Legs" }), h("div", { class: "value", text: `${legs.length}` })),
          h("div", { class: "stat" }, h("div", { class: "label", text: "Distance" }), h("div", { class: "value mono small", text: metres(totalDist) })),
        ),
        h("div", { class: "section-title", text: "Legs" }),
        legList,
        h("div", { class: "section-title", text: "Marked points" }),
        pointList,
        h("div", { class: "section-title", text: "Export" }),
        h("div", { class: "list" }, exportBtn, uploadBtn, deleteBtn),
      ),
    ),
  );
}
