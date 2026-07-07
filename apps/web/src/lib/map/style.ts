// The warm Svika map. MapTiler's basic style ships cool greys and blues;
// warmSvikaStyle re-paints every colour in the style toward Brand v2 so the
// base map reads as bone and linen, roads stay calm, and the forest route
// line plus the kombi are the loudest things on screen. Pure functions, no
// map objects: the transform is unit tested against style JSON shapes.

const MAPTILER_STYLE = "basic-v2";

export function mapStyleUrl(rawKey: string): string {
  if (!rawKey || rawKey.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_MAP_TILES_URL is empty: it must hold the raw MapTiler key",
    );
  }
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${encodeURIComponent(rawKey)}`;
}

interface Hsla {
  h: number;
  s: number; // 0..1
  l: number; // 0..1
  a: number; // 0..1
}

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function parseColor(raw: string): Hsla | null {
  const input = (NAMED[raw.trim().toLowerCase()] ?? raw).trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input);
  if (hex) {
    let hexDigits = hex[1]!;
    if (hexDigits.length === 3) {
      hexDigits = [...hexDigits].map((c) => c + c).join("");
    }
    const r = parseInt(hexDigits.slice(0, 2), 16) / 255;
    const g = parseInt(hexDigits.slice(2, 4), 16) / 255;
    const b = parseInt(hexDigits.slice(4, 6), 16) / 255;
    const a = hexDigits.length === 8 ? parseInt(hexDigits.slice(6, 8), 16) / 255 : 1;
    return { ...rgbToHsl(r, g, b), a };
  }

  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*(?:\.\d+)?)\s*)?\)$/i.exec(
      input,
    );
  if (rgb) {
    return {
      ...rgbToHsl(Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }

  const hsl =
    /^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*(\d*(?:\.\d+)?)\s*)?\)$/i.exec(
      input,
    );
  if (hsl) {
    return {
      h: Number(hsl[1]),
      s: Number(hsl[2]) / 100,
      l: Number(hsl[3]) / 100,
      a: hsl[4] === undefined ? 1 : Number(hsl[4]),
    };
  }

  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function formatHsla({ h, s, l, a }: Hsla): string {
  const hh = Math.round(h);
  const ss = Math.round(s * 100);
  const ll = Math.round(l * 100);
  return a >= 1 ? `hsl(${hh}, ${ss}%, ${ll}%)` : `hsla(${hh}, ${ss}%, ${ll}%, ${a})`;
}

// Brand anchors: bone is hsl(49, 100%, 97%), char is hsl(140, 30%, 8%).
const BONE_HUE = 49;
const INK_HUE = 140;
const SAGE_HUE = 150;

/**
 * Re-paints one colour toward the warm Svika family:
 * dark inks go warm green-black, water goes calm sage, greens just calm
 * down, and everything else joins the bone/linen family. Unparseable
 * strings pass through untouched.
 */
export function warmColor(raw: string): string {
  const c = parseColor(raw);
  if (!c) return raw;
  if (c.l < 0.3) {
    return formatHsla({ h: INK_HUE, s: 0.3, l: c.l, a: c.a });
  }
  if (c.h >= 170 && c.h <= 260 && c.s > 0.08) {
    return formatHsla({ h: SAGE_HUE, s: clamp(c.s * 0.3, 0.1, 0.2), l: c.l, a: c.a });
  }
  if (c.h >= 60 && c.h < 170 && c.s > 0.08) {
    return formatHsla({ h: c.h, s: c.s * 0.5, l: c.l, a: c.a });
  }
  const s =
    c.l >= 0.92
      ? Math.max(c.s, 0.7)
      : c.l >= 0.8
        ? clamp(c.s, 0.25, 0.5)
        : clamp(c.s, 0.12, 0.3);
  return formatHsla({ h: BONE_HUE, s, l: Math.min(c.l, 0.97), a: c.a });
}

/** Recolours every string inside a style expression tree that parses as a colour. */
function warmExpression(value: unknown): unknown {
  if (typeof value === "string") {
    return parseColor(value) ? warmColor(value) : value;
  }
  if (Array.isArray(value)) return value.map(warmExpression);
  return value;
}

interface StyleLayerLike {
  id?: unknown;
  type?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/**
 * Takes a MapLibre style JSON and returns a warm Svika copy: every *-color
 * property (including colours buried in expressions) is re-painted, and the
 * background is pinned to bone. The input is never mutated.
 */
export function warmSvikaStyle<T>(style: T): T {
  const out = structuredClone(style) as { layers?: StyleLayerLike[] };
  for (const layer of out.layers ?? []) {
    for (const bag of [layer.paint, layer.layout]) {
      if (!bag) continue;
      for (const [key, value] of Object.entries(bag)) {
        if (!key.endsWith("-color")) continue;
        bag[key] = warmExpression(value);
      }
    }
    if (layer.type === "background" && layer.paint) {
      layer.paint["background-color"] = "#FFFCEF";
    }
  }
  return out as T;
}
