// The Mbare Sun map. MapTiler's basic-v2 ships cool greys and blues;
// mbareSunStyle re-paints it to DESIGN.md §11 for the active theme: calm
// paper-toned ground by day, char by night, roads as casing + fill, parks in
// park green, street labels in IBM Plex Mono. Pure functions, no map objects:
// the transform is unit tested against style JSON shapes.

const MAPTILER_STYLE = "basic-v2";

export function mapStyleUrl(rawKey: string): string {
  if (!rawKey || rawKey.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_MAP_TILES_URL is empty: it must hold the raw MapTiler key",
    );
  }
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${encodeURIComponent(rawKey)}`;
}

export type MapTheme = "day" | "night";

/** DESIGN.md §2 and §11 map colours, verbatim, per theme. */
export const MAP_COLORS = {
  day: {
    base: "#F4F5F1",
    building: "#EAECE5",
    roadCasing: "#E1E3DA",
    road: "#FFFFFF",
    minorRoad: "#FFFFFF",
    park: "#D9E8CC",
    streetLabel: "#6E766A",
    parkLabel: "#6E766A",
    route: "#161D18",
    routeOpacity: 0.85,
    stop: "#E84C30",
    stopStroke: "#FFFFFF",
    walk: "#575F53",
  },
  night: {
    base: "#121710",
    building: "#1B211A",
    roadCasing: "#222B22",
    road: "#333E33",
    minorRoad: "#2A342B",
    park: "#1B3423",
    streetLabel: "#7E877E",
    parkLabel: "#6F8F74",
    route: "#FFFFFF",
    routeOpacity: 0.75,
    stop: "#E84C30",
    stopStroke: "#FFFFFF",
    walk: "rgba(255, 255, 255, 0.55)",
  },
} as const;

// Street labels are IBM Plex Mono per §11; MapTiler serves these glyphs.
const STREET_LABEL_FONT = ["IBM Plex Mono SemiBold"];

interface StyleLayerLike {
  id?: unknown;
  type?: unknown;
  "source-layer"?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

function setPaint(layer: StyleLayerLike, key: string, value: unknown) {
  layer.paint = { ...(layer.paint ?? {}), [key]: value };
}

/**
 * basic-v2 layer names → Mbare Sun families. Anything green or watery joins
 * the park family (water has no spec value of its own — flagged as a spec
 * gap; the corridor has no visible water), transport lines join the casing
 * family, labels join the street label family.
 */
function familyOf(layer: StyleLayerLike):
  | "base"
  | "park"
  | "water"
  | "building"
  | "road"
  | "minor-road"
  | "transport-line"
  | "label"
  | "other" {
  const id = String(layer.id ?? "").toLowerCase();
  const type = String(layer.type ?? "");
  if (type === "background") return "base";
  if (type === "symbol") return "label";
  if (id.includes("water") || id.includes("river")) return "water";
  if (
    id.includes("forest") ||
    id.includes("grass") ||
    id.includes("wood") ||
    id.includes("park")
  ) {
    return "park";
  }
  if (id.includes("building")) return "building";
  if (id.includes("path")) return "minor-road";
  if (id.includes("road network")) return "road";
  if (type === "line") return "transport-line";
  if (type === "fill") return "base";
  return "other";
}

/**
 * Takes the fetched MapTiler basic-v2 style and returns a Mbare Sun copy for
 * the given theme. Roads get the spec's casing + fill treatment (a casing
 * layer is inserted under the road layer, reusing the road's own width as
 * line-gap-width so the casing hugs any zoom curve). The input is never
 * mutated.
 */
export function mbareSunStyle<T>(style: T, theme: MapTheme): T {
  const c = MAP_COLORS[theme];
  const out = structuredClone(style) as { layers?: StyleLayerLike[] };
  const layers: StyleLayerLike[] = [];

  for (const layer of out.layers ?? []) {
    switch (familyOf(layer)) {
      case "base":
        setPaint(layer, layer.type === "background" ? "background-color" : "fill-color", c.base);
        break;
      case "park":
      case "water":
        setPaint(layer, layer.type === "line" ? "line-color" : "fill-color", c.park);
        break;
      case "building":
        setPaint(layer, "fill-color", c.building);
        break;
      case "road": {
        const width = layer.paint?.["line-width"] ?? 2;
        layers.push({
          ...structuredClone(layer),
          id: `${String(layer.id)} casing`,
          paint: {
            ...structuredClone(layer.paint ?? {}),
            "line-color": c.roadCasing,
            "line-width": 3,
            "line-gap-width": structuredClone(width),
          },
        });
        setPaint(layer, "line-color", c.road);
        break;
      }
      case "minor-road":
        setPaint(layer, "line-color", c.minorRoad);
        if (theme === "day") setPaint(layer, "line-opacity", 0.9);
        break;
      case "transport-line":
        setPaint(layer, "line-color", c.roadCasing);
        break;
      case "label": {
        setPaint(layer, "text-color", c.streetLabel);
        setPaint(layer, "text-halo-color", c.base);
        const id = String(layer.id ?? "").toLowerCase();
        if (id.includes("road")) {
          layer.layout = {
            ...(layer.layout ?? {}),
            "text-font": [...STREET_LABEL_FONT],
            "text-size": 9,
            "text-letter-spacing": 0.07,
          };
        }
        break;
      }
      case "other":
        break;
    }
    layers.push(layer);
  }

  out.layers = layers;
  return out as T;
}
