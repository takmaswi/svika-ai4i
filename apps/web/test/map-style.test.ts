import { describe, expect, test } from "vitest";
import { MAP_COLORS, mapStyleUrl, mbareSunStyle } from "../src/lib/map/style";

describe("mapStyleUrl", () => {
  test("builds the MapTiler style url from the raw key", () => {
    expect(mapStyleUrl("abc123")).toBe(
      "https://api.maptiler.com/maps/basic-v2/style.json?key=abc123",
    );
  });

  test("url-encodes the key", () => {
    expect(mapStyleUrl("a&b=c")).toContain("key=a%26b%3Dc");
  });

  test("rejects an empty key with a message naming the env var", () => {
    expect(() => mapStyleUrl("")).toThrow(/NEXT_PUBLIC_MAP_TILES_URL/);
  });
});

// A slice of MapTiler basic-v2, with the layer names the transform keys on.
function baseStyle() {
  return {
    version: 8,
    name: "basic-v2",
    sources: {},
    layers: [
      { id: "Background", type: "background", paint: { "background-color": "#f8f4f0" } },
      { id: "Grass", type: "fill", paint: { "fill-color": "hsl(82, 46%, 72%)" } },
      { id: "Water", type: "fill", paint: { "fill-color": "hsl(205, 56%, 73%)" } },
      { id: "Building", type: "fill", paint: { "fill-color": "hsl(39, 41%, 86%)" } },
      {
        id: "Road network",
        type: "line",
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 14, 8],
        },
      },
      { id: "Path minor", type: "line", paint: { "line-color": "#fff", "line-width": 1 } },
      { id: "Railway", type: "line", paint: { "line-color": "hsl(0, 0%, 73%)" } },
      {
        id: "Road labels",
        type: "symbol",
        layout: { "text-field": "{name:latin}", "text-font": ["Noto Sans Regular"], "text-size": 12 },
        paint: { "text-color": "#333333", "text-halo-color": "#ffffff" },
      },
      {
        id: "City labels",
        type: "symbol",
        layout: { "text-field": "{name:latin}", "text-font": ["Noto Sans Regular"] },
        paint: { "text-color": "#333333", "text-halo-color": "#ffffff" },
      },
    ],
  };
}

function layerOf(out: ReturnType<typeof baseStyle>, id: string) {
  const layer = out.layers.find((l) => l.id === id);
  if (!layer) throw new Error(`missing layer ${id}`);
  return layer as { paint: Record<string, unknown>; layout?: Record<string, unknown> };
}

describe("mbareSunStyle", () => {
  test("returns a new object and leaves the input untouched", () => {
    const base = baseStyle();
    const before = JSON.stringify(base);
    const out = mbareSunStyle(base, "day");
    expect(JSON.stringify(base)).toBe(before);
    expect(out).not.toBe(base);
  });

  test.each(["day", "night"] as const)(
    "%s ground, parks, buildings and roads take the DESIGN.md palette",
    (theme) => {
      const c = MAP_COLORS[theme];
      const out = mbareSunStyle(baseStyle(), theme);
      expect(layerOf(out, "Background").paint["background-color"]).toBe(c.base);
      expect(layerOf(out, "Grass").paint["fill-color"]).toBe(c.park);
      expect(layerOf(out, "Building").paint["fill-color"]).toBe(c.building);
      expect(layerOf(out, "Road network").paint["line-color"]).toBe(c.road);
      expect(layerOf(out, "Path minor").paint["line-color"]).toBe(c.minorRoad);
      expect(layerOf(out, "Railway").paint["line-color"]).toBe(c.roadCasing);
    },
  );

  test("water joins the park family (no spec value of its own)", () => {
    const out = mbareSunStyle(baseStyle(), "day");
    expect(layerOf(out, "Water").paint["fill-color"]).toBe(MAP_COLORS.day.park);
  });

  test("inserts a casing layer under the road network reusing its width curve", () => {
    const base = baseStyle();
    const out = mbareSunStyle(base, "day");
    const ids = out.layers.map((l) => l.id);
    const casingAt = ids.indexOf("Road network casing");
    expect(casingAt).toBeGreaterThan(-1);
    expect(casingAt).toBe(ids.indexOf("Road network") - 1);
    const casing = layerOf(out, "Road network casing");
    expect(casing.paint["line-color"]).toBe(MAP_COLORS.day.roadCasing);
    expect(casing.paint["line-width"]).toBe(3);
    expect(casing.paint["line-gap-width"]).toEqual(
      layerOf(base, "Road network").paint["line-width"],
    );
  });

  test("street labels go IBM Plex Mono at 9px with the label colour", () => {
    const out = mbareSunStyle(baseStyle(), "night");
    const label = layerOf(out, "Road labels");
    expect(label.layout?.["text-font"]).toEqual(["IBM Plex Mono SemiBold"]);
    expect(label.layout?.["text-size"]).toBe(9);
    expect(label.paint["text-color"]).toBe(MAP_COLORS.night.streetLabel);
    expect(label.paint["text-halo-color"]).toBe(MAP_COLORS.night.base);
  });

  test("non-road labels keep their font but take the label colour", () => {
    const out = mbareSunStyle(baseStyle(), "day");
    const label = layerOf(out, "City labels");
    expect(label.layout?.["text-font"]).toEqual(["Noto Sans Regular"]);
    expect(label.paint["text-color"]).toBe(MAP_COLORS.day.streetLabel);
  });

  test("night and day produce different grounds", () => {
    const day = mbareSunStyle(baseStyle(), "day");
    const night = mbareSunStyle(baseStyle(), "night");
    expect(layerOf(day, "Background").paint["background-color"]).not.toBe(
      layerOf(night, "Background").paint["background-color"],
    );
  });
});
