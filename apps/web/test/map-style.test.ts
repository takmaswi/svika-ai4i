import { describe, expect, test } from "vitest";
import { mapStyleUrl, warmColor, warmSvikaStyle } from "../src/lib/map/style";

function hslOf(color: string): { h: number; s: number; l: number } {
  const m = /^hsla?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%/.exec(
    color,
  );
  if (!m) throw new Error(`not an hsl string: ${color}`);
  return { h: Number(m[1]), s: Number(m[2]) / 100, l: Number(m[3]) / 100 };
}

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

describe("warmColor", () => {
  test("pulls neutral greys into the warm bone family", () => {
    const { h, s } = hslOf(warmColor("#e0e0e0"));
    expect(h).toBeGreaterThan(35);
    expect(h).toBeLessThan(60);
    expect(s).toBeGreaterThan(0);
  });

  test("never leaves pure white in the map", () => {
    expect(warmColor("#ffffff")).not.toMatch(/100%\)$/);
    const { h } = hslOf(warmColor("#ffffff"));
    expect(h).toBeGreaterThan(35);
  });

  test("mutes water blues toward calm sage", () => {
    const { h, s } = hslOf(warmColor("hsl(205, 56%, 73%)"));
    expect(h).toBeGreaterThan(120);
    expect(h).toBeLessThan(180);
    expect(s).toBeLessThan(0.3);
  });

  test("calms greens instead of hue-shifting them", () => {
    const src = hslOf("hsl(100, 60%, 80%)");
    const out = hslOf(warmColor("hsl(100, 60%, 80%)"));
    expect(out.h).toBeCloseTo(src.h, 0);
    expect(out.s).toBeLessThan(src.s);
  });

  test("keeps alpha", () => {
    expect(warmColor("hsla(0, 0%, 100%, 0.5)")).toMatch(/0\.5\)$/);
    expect(warmColor("rgba(255, 255, 255, 0.25)")).toMatch(/0\.25\)$/);
  });

  test("returns unparseable strings unchanged", () => {
    expect(warmColor("{name:latin}")).toBe("{name:latin}");
    expect(warmColor("Noto Sans Regular")).toBe("Noto Sans Regular");
  });
});

describe("warmSvikaStyle", () => {
  const base = {
    version: 8,
    name: "basic-v2",
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
      {
        id: "water",
        type: "fill",
        paint: { "fill-color": "hsl(205, 56%, 73%)" },
      },
      {
        id: "road_major",
        type: "line",
        paint: {
          "line-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            "#ffffff",
            10,
            "hsl(0, 0%, 90%)",
          ],
          "line-width": 2,
        },
      },
      {
        id: "place_label",
        type: "symbol",
        layout: { "text-field": "{name:latin}", "text-font": ["Noto Sans Regular"] },
        paint: { "text-color": "#333333", "text-halo-color": "#ffffff" },
      },
    ],
  };

  test("returns a new object and leaves the input untouched", () => {
    const before = JSON.stringify(base);
    const out = warmSvikaStyle(base);
    expect(JSON.stringify(base)).toBe(before);
    expect(out).not.toBe(base);
  });

  test("sets the background to bone", () => {
    const out = warmSvikaStyle(base) as typeof base;
    const bg = out.layers.find((l) => l.id === "background")!;
    expect((bg.paint as Record<string, unknown>)["background-color"]).toBe("#FFFCEF");
  });

  test("recolors colors nested inside expressions", () => {
    const out = warmSvikaStyle(base) as typeof base;
    const road = out.layers.find((l) => l.id === "road_major")!;
    const expr = (road.paint as Record<string, unknown>)["line-color"] as unknown[];
    expect(expr[4]).not.toBe("#ffffff");
    expect(String(expr[4])).toMatch(/^hsl/);
    // non-color members of the expression survive
    expect(expr[0]).toBe("interpolate");
    expect(expr[3]).toBe(6);
  });

  test("leaves non-color layout values alone", () => {
    const out = warmSvikaStyle(base) as typeof base;
    const label = out.layers.find((l) => l.id === "place_label")!;
    const layout = label.layout as Record<string, unknown>;
    expect(layout["text-field"]).toBe("{name:latin}");
    expect(layout["text-font"]).toEqual(["Noto Sans Regular"]);
  });

  test("gives labels warm ink and a bone halo", () => {
    const out = warmSvikaStyle(base) as typeof base;
    const label = out.layers.find((l) => l.id === "place_label")!;
    const paint = label.paint as unknown as Record<string, string>;
    const ink = hslOf(paint["text-color"]!);
    expect(ink.l).toBeLessThan(0.4);
    const halo = hslOf(paint["text-halo-color"]!);
    expect(halo.h).toBeGreaterThan(35);
    expect(halo.h).toBeLessThan(60);
  });
});
