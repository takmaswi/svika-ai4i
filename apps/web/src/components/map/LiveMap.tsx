"use client";

// The live map: the visual heart of the rider app. Warm bone cartography,
// the real Heights <-> Rezende road in forest green, the 15 real stops, and
// kombis gliding along the actual line. Movement comes from the VehicleFeed
// adapter; today that is the simulated mock twin (declared in the disclosure
// register), and a real GPS feed swaps in without touching this component.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import {
  CORRIDOR_ROUTE_CODE,
  corridorLine,
  corridorMetrics,
  corridorStops,
} from "@/lib/map/corridor-data";
import { lerpHeading, lerpLngLat, type LngLat } from "@/lib/map/geometry";
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

const TICK_MS = 1000;
const DWELL_SECONDS = 20;

export interface LiveMapLabels {
  ariaLabel: string;
  demoChip: string;
  unavailable: string;
}

interface LiveMapProps {
  labels: LiveMapLabels;
  /** Test hook: freeze vehicles so e2e screenshots are deterministic. */
  frozen?: boolean;
}

function corridorBounds(): [LngLat, LngLat] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of corridorLine.coordinates) {
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

function addCorridorLayers(map: maplibregl.Map) {
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
  map.addLayer({
    id: "corridor-route-casing",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": BONE, "line-width": 8, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "corridor-route-line",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": FOREST, "line-width": 4 },
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

export function LiveMap({ labels, frozen = false }: LiveMapProps) {
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
    // Per-vehicle animation state: where the marker is drawn now, and the
    // feed position it is gliding toward.
    const anim = new Map<
      string,
      { from: VehiclePosition; to: VehiclePosition; startedAt: number }
    >();
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
        bounds: corridorBounds(),
        fitBoundsOptions: { padding: 48 },
        attributionControl: { compact: true },
      });
      map.touchPitch.disable();

      map.on("load", () => {
        if (!map || disposed) return;
        addCorridorLayers(map);
        setReady(true);

        const feed: VehicleFeed = new SimulatedVehicleFeed(
          {
            routeCode: CORRIDOR_ROUTE_CODE,
            metrics: corridorMetrics,
            dwellSeconds: DWELL_SECONDS,
          },
          [
            { id: "sim-1", startMeters: corridorMetrics.totalMeters * 0.12, headingOut: true },
            { id: "sim-2", startMeters: corridorMetrics.totalMeters * 0.55, headingOut: false },
          ],
          { tickMs: frozen ? 2_147_000_000 : TICK_MS },
        );

        unsubscribe = feed.subscribe((positions) => {
          if (!map || disposed) return;
          const now = performance.now();
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
              anim.set(pos.id, { from: pos, to: pos, startedAt: now });
              continue;
            }
            const current = anim.get(pos.id);
            const from = current
              ? {
                  ...current.to,
                  lngLat: marker.getLngLat().toArray() as LngLat,
                  headingDeg: marker.getRotation(),
                }
              : pos;
            anim.set(pos.id, { from, to: pos, startedAt: now });
            if (reducedMotion) {
              marker.setLngLat(pos.lngLat).setRotation(pos.headingDeg);
            }
          }
        });

        if (!reducedMotion) {
          const frame = () => {
            const now = performance.now();
            for (const [id, a] of anim) {
              const marker = markers.get(id);
              if (!marker) continue;
              const t = Math.min(1, (now - a.startedAt) / TICK_MS);
              marker
                .setLngLat(lerpLngLat(a.from.lngLat, a.to.lngLat, t))
                .setRotation(lerpHeading(a.from.headingDeg, a.to.headingDeg, t));
            }
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
  }, [frozen]);

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
