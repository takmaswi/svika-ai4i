"use client";

// The live map: the visual heart of the rider app. Warm bone cartography,
// the real Heights <-> Rezende road in forest green, the 15 real stops, and
// kombis gliding along the actual line. Movement comes from the VehicleFeed
// adapter; today that is the simulated mock twin (declared in the disclosure
// register), and a real GPS feed swaps in without touching this component.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { corridorLine, corridorStops } from "@/lib/map/corridor-data";
import type { LngLat } from "@/lib/map/geometry";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "@/lib/map/sim-config";
import { mapStyleUrl, warmSvikaStyle } from "@/lib/map/style";
import {
  SimulatedVehicleFeed,
  type VehicleFeed,
  type VehiclePosition,
} from "@/lib/map/vehicle-feed";

// Brand v2 literals for canvas layers; CSS variables cannot reach WebGL.
// Values mirror packages/ui/tokens/colors.css exactly.
const FOREST = "#1F4D2E";
const BONE = "#FFFCEF";
const MOSS = "#4D5C44";
const SIGNAL = "#E84C30";

const TICK_MS = 1000;

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

function makeKombiElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "kombi-map-marker";
  el.dataset.testid = "kombi-marker";
  const img = document.createElement("img");
  img.src = "/map/kombi-marker.svg";
  img.alt = "";
  img.width = 44;
  img.height = 44;
  img.draggable = false;
  el.appendChild(img);
  return el;
}

// The planned trip over the corridor: ride legs ride the road in forest,
// walking legs are dashed moss, and the two ends get bone dots (forest ring
// for the start, the single coral accent for where you are going).
function addOverlayLayers(map: maplibregl.Map, overlay: LiveMapOverlay) {
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
    id: "plan-ride-casing",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "ride"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": BONE, "line-width": 10, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "plan-ride-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "ride"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": FOREST, "line-width": 5 },
  });
  map.addLayer({
    id: "plan-walk-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "walk"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": MOSS,
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
      "circle-color": BONE,
      "circle-stroke-width": 3.5,
      "circle-stroke-color": [
        "case",
        ["==", ["get", "end"], "destination"],
        SIGNAL,
        FOREST,
      ],
    },
  });
}

function addCorridorLayers(map: maplibregl.Map, muted: boolean) {
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

  // Bone casing under the forest line lifts the route off the base map.
  // Under a plan overlay the corridor fades to context so the trip reads.
  map.addLayer({
    id: "corridor-route-casing",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": BONE, "line-width": 8, "line-opacity": muted ? 0.4 : 0.9 },
  });
  map.addLayer({
    id: "corridor-route-line",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": FOREST, "line-width": 4, "line-opacity": muted ? 0.3 : 1 },
  });
  map.addLayer({
    id: "corridor-stop-dots",
    type: "circle",
    source: "corridor-stops",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6],
      "circle-color": BONE,
      "circle-stroke-color": FOREST,
      "circle-stroke-width": 2,
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
      "text-font": ["Noto Sans Regular"],
      "text-size": 11.5,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-max-width": 9,
    },
    paint: {
      "text-color": MOSS,
      "text-halo-color": BONE,
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
    const markers = new Map<string, maplibregl.Marker>();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    async function start() {
      const res = await fetch(mapStyleUrl(key));
      if (!res.ok) throw new Error(`map style fetch failed: ${res.status}`);
      const style = warmSvikaStyle(await res.json());
      if (disposed || !container) return;

      map = new maplibregl.Map({
        container,
        style: style as maplibregl.StyleSpecification,
        bounds: mapBounds(overlay),
        fitBoundsOptions: { padding: overlay ? 64 : 48 },
        attributionControl: { compact: true },
      });
      map.touchPitch.disable();

      map.on("load", () => {
        if (!map || disposed) return;
        addCorridorLayers(map, Boolean(overlay));
        if (overlay) addOverlayLayers(map, overlay);
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
        <span className="svika-pulse-dot" aria-hidden />
        {labels.demoChip}
      </span>
    </div>
  );
}
