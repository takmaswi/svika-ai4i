"use client";

// The live map: the visual heart of the rider app. Mbare Sun cartography
// (DESIGN.md §11), the real Heights <-> Rezende road as the dotted route, the
// 15 real stops, and kombis gliding along the actual line. Movement comes
// from the VehicleFeed adapter; today that is the simulated mock twin
// (declared in the disclosure register), and a real GPS feed swaps in
// without touching this component.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { corridorLine, corridorStops } from "@/lib/map/corridor-data";
import type { LngLat } from "@/lib/map/geometry";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "@/lib/map/sim-config";
import { MAP_COLORS, mapStyleUrl, mbareSunStyle, type MapTheme } from "@/lib/map/style";
import {
  SimulatedVehicleFeed,
  type VehicleFeed,
  type VehiclePosition,
} from "@/lib/map/vehicle-feed";

const TICK_MS = 1000;

// §11 route: stroke 5, dasharray 1 11 (in line-width units at width 5).
const ROUTE_WIDTH = 5;
const ROUTE_DASH = [0.2, 2.2];

export interface LiveMapLabels {
  ariaLabel: string;
  demoChip: string;
  unavailable: string;
}

/** A planned trip drawn over the corridor; see lib/map/plan-overlay.ts. */
export interface LiveMapOverlay {
  legs: { kind: "ride" | "walk"; coordinates: LngLat[] }[];
  origin: LngLat;
  destination: LngLat;
}

interface LiveMapProps {
  labels: LiveMapLabels;
  overlay?: LiveMapOverlay;
}

/** The active Mbare Sun map theme, from the same signals the CSS tokens use. */
function currentMapTheme(): MapTheme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return "night";
  if (forced === "light") return "day";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "night"
    : "day";
}

function boundsOf(coords: LngLat[]): [LngLat, LngLat] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function mapBounds(overlay?: LiveMapOverlay): [LngLat, LngLat] {
  if (!overlay) return boundsOf(corridorLine.coordinates);
  return boundsOf([
    overlay.origin,
    overlay.destination,
    ...overlay.legs.flatMap((l) => l.coordinates),
  ]);
}

// §10: the marigold box, bob and night beam are law; the glyph inside is the
// client's kombi asset. Theme flips (stroke, glow, beam) ride on CSS tokens.
function makeKombiElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "kombi-map-marker";
  el.dataset.testid = "kombi-marker";
  el.innerHTML = `
    <div class="kombi-map-bob svika-bob">
      <svg class="kombi-beam" width="140" height="140" viewBox="-70 -70 140 140" aria-hidden="true">
        <g transform="rotate(-90)">
          <path d="M13 -5 L68 -28 L68 28 L13 5 Z" fill="#F5B301" opacity="0.12"></path>
          <path d="M13 -4 L48 -16 L48 16 L13 4 Z" fill="#F5B301" opacity="0.15"></path>
        </g>
      </svg>
      <span class="kombi-map-box">
        <img src="/map/kombi-marker.svg" alt="" width="30" height="30" draggable="false" />
      </span>
    </div>`;
  return el;
}

// The planned trip over the corridor: ride legs take THE route treatment,
// walking legs are dashed, and both ends get §11 stop pins.
function addOverlayLayers(
  map: maplibregl.Map,
  overlay: LiveMapOverlay,
  theme: MapTheme,
) {
  const c = MAP_COLORS[theme];
  const legFeatures = overlay.legs.map((l) => ({
    type: "Feature" as const,
    properties: { kind: l.kind },
    geometry: { type: "LineString" as const, coordinates: l.coordinates },
  }));
  map.addSource("plan-legs", {
    type: "geojson",
    data: { type: "FeatureCollection", features: legFeatures },
  });
  map.addSource("plan-ends", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature" as const,
          properties: { end: "origin" },
          geometry: { type: "Point" as const, coordinates: overlay.origin },
        },
        {
          type: "Feature" as const,
          properties: { end: "destination" },
          geometry: { type: "Point" as const, coordinates: overlay.destination },
        },
      ],
    },
  });

  map.addLayer({
    id: "plan-ride-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "ride"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.route,
      "line-width": ROUTE_WIDTH,
      "line-dasharray": ROUTE_DASH,
      "line-opacity": c.routeOpacity,
    },
  });
  map.addLayer({
    id: "plan-walk-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "walk"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.walk,
      "line-width": 3.5,
      "line-dasharray": [0.1, 1.8],
    },
  });
  map.addLayer({
    id: "plan-ends",
    type: "circle",
    source: "plan-ends",
    paint: {
      "circle-radius": 7,
      "circle-color": c.stop,
      "circle-stroke-width": 3,
      "circle-stroke-color": c.stopStroke,
    },
  });
}

function addCorridorLayers(
  map: maplibregl.Map,
  theme: MapTheme,
  muted: boolean,
) {
  const c = MAP_COLORS[theme];
  map.addSource("corridor-route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: corridorLine.coordinates },
    },
  });
  map.addSource("corridor-stops", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: corridorStops.map((s) => ({
        type: "Feature" as const,
        properties: { name: s.name, order: s.order },
        geometry: { type: "Point" as const, coordinates: s.lngLat },
      })),
    },
  });

  // THE route: dotted char by day, dotted white by night (§11). Under a plan
  // overlay the corridor fades to context so the trip reads.
  map.addLayer({
    id: "corridor-route-line",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.route,
      "line-width": ROUTE_WIDTH,
      "line-dasharray": ROUTE_DASH,
      "line-opacity": muted ? c.routeOpacity * 0.35 : c.routeOpacity,
    },
  });
  map.addLayer({
    id: "corridor-stop-dots",
    type: "circle",
    source: "corridor-stops",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 7],
      "circle-color": c.stop,
      "circle-stroke-color": c.stopStroke,
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 3],
      "circle-opacity": muted ? 0.5 : 1,
      "circle-stroke-opacity": muted ? 0.5 : 1,
    },
  });
  map.addLayer({
    id: "corridor-stop-labels",
    type: "symbol",
    source: "corridor-stops",
    minzoom: 12,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["IBM Plex Mono SemiBold"],
      "text-size": 9,
      "text-letter-spacing": 0.07,
      "text-offset": [0, 1.3],
      "text-anchor": "top",
      "text-max-width": 9,
    },
    paint: {
      "text-color": c.streetLabel,
      "text-halo-color": c.base,
      "text-halo-width": 1.4,
    },
  });
}

export function LiveMap({ labels, overlay }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const key = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";
    if (!container || key.trim() === "") {
      setFailed(true);
      return;
    }

    let disposed = false;
    let map: maplibregl.Map | null = null;
    let unsubscribe: (() => void) | null = null;
    let raf = 0;
    let theme = currentMapTheme();
    let rawStyle: unknown = null;
    const markers = new Map<string, maplibregl.Marker>();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeObserver = new MutationObserver(applyTheme);

    // Repaints the whole canvas when the theme flips; style.load re-adds the
    // corridor and plan layers, markers restyle through CSS tokens.
    function applyTheme() {
      const next = currentMapTheme();
      if (disposed || !map || !rawStyle || next === theme) return;
      theme = next;
      map.setStyle(mbareSunStyle(rawStyle, theme) as maplibregl.StyleSpecification);
    }

    async function start() {
      const res = await fetch(mapStyleUrl(key));
      if (!res.ok) throw new Error(`map style fetch failed: ${res.status}`);
      rawStyle = await res.json();
      if (disposed || !container) return;

      map = new maplibregl.Map({
        container,
        style: mbareSunStyle(rawStyle, theme) as maplibregl.StyleSpecification,
        bounds: mapBounds(overlay),
        // under a plan the bottom sheet peeks over the map; the trip must
        // fit in the visible band above it
        fitBoundsOptions: {
          padding: overlay
            ? { top: 72, left: 48, right: 48, bottom: 356 }
            : 48,
        },
        attributionControl: { compact: true },
      });
      map.touchPitch.disable();

      // Fires on the first style and again after every theme swap.
      map.on("style.load", () => {
        if (!map || disposed) return;
        addCorridorLayers(map, theme, Boolean(overlay));
        if (overlay) addOverlayLayers(map, overlay, theme);
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      darkQuery.addEventListener("change", applyTheme);

      map.on("load", () => {
        if (!map || disposed) return;
        setReady(true);

        // The fixed epoch keeps these markers in step with the server side
        // ETA caller, which measures from the same simulated fleet.
        const feed: VehicleFeed = new SimulatedVehicleFeed(simConfig, SIM_VEHICLES, {
          tickMs: TICK_MS,
          epochMs: SIM_EPOCH_MS,
        });

        const apply = (positions: VehiclePosition[], stampData: boolean) => {
          if (!map || disposed) return;
          for (const pos of positions) {
            let marker = markers.get(pos.id);
            if (!marker) {
              marker = new maplibregl.Marker({
                element: makeKombiElement(),
                rotationAlignment: "map",
                pitchAlignment: "map",
              })
                .setLngLat(pos.lngLat)
                .setRotation(pos.headingDeg)
                .addTo(map);
              markers.set(pos.id, marker);
            } else {
              marker.setLngLat(pos.lngLat).setRotation(pos.headingDeg);
            }
            if (stampData) {
              // e2e reads these to prove movement in coordinates, not pixels
              const el = marker.getElement();
              el.dataset.lng = String(pos.lngLat[0]);
              el.dataset.lat = String(pos.lngLat[1]);
              el.dataset.heading = String(Math.round(pos.headingDeg));
            }
          }
        };

        if (reducedMotion || !feed.sample) {
          // Discrete once-a-second steps: no gliding under reduced motion,
          // and a future real GPS feed lands here until it earns smoothing.
          unsubscribe = feed.subscribe((positions) => apply(positions, true));
        } else {
          // The simulation is a pure function of wall clock time, so every
          // frame samples the exact position along the recorded road line:
          // no interpolation between ticks, no cut corners, no teleporting.
          const sample = feed.sample.bind(feed);
          let lastStamp = 0;
          const frame = () => {
            if (disposed) return;
            const stamp = performance.now() - lastStamp > TICK_MS;
            if (stamp) lastStamp = performance.now();
            apply(sample(Date.now()), stamp);
            raf = requestAnimationFrame(frame);
          };
          raf = requestAnimationFrame(frame);
        }
      });

      map.on("error", () => {
        // Tile or glyph hiccups should never take the home page down; the
        // map keeps whatever it has already drawn.
      });
    }

    start().catch(() => {
      if (!disposed) setFailed(true);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      darkQuery.removeEventListener("change", applyTheme);
      unsubscribe?.();
      map?.remove();
    };
  }, []);

  if (failed) {
    return (
      <div className="live-map live-map-unavailable" data-testid="live-map">
        <p className="svika-body">{labels.unavailable}</p>
      </div>
    );
  }

  return (
    <div className="live-map" data-testid="live-map" data-map-ready={ready}>
      <div
        ref={containerRef}
        className="live-map-canvas"
        role="img"
        aria-label={labels.ariaLabel}
      />
      <span className="live-map-chip svika-glass" data-testid="demo-chip">
        <span className="svika-live-dot">
          <span className="svika-ripple-ring" aria-hidden />
          <span className="svika-pulse-dot" aria-hidden />
        </span>
        {labels.demoChip}
      </span>
    </div>
  );
}
