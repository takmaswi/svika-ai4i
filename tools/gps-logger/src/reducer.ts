// Pure builders for journey state transitions. No IDs are minted and no I/O
// happens here: callers pass timestamps and ids in, so every transition is
// deterministic and unit-testable. A leg is a maximal run of one mode; opening a
// new leg ends the previous one and bumps the journey's live pointers.

import type {
  Direction,
  Fix,
  Journey,
  JourneyEvent,
  Leg,
  MarkedPoint,
  MarkerType,
  Mode,
  Ping,
} from "./types";

export function buildJourney(id: string, now: number, label: string): Journey {
  return {
    id,
    label: label.trim() || defaultLabel(now),
    status: "active",
    startedAt: now,
    endedAt: null,
    createdAt: now,
    currentLegIndex: 0,
    currentMode: "walking",
    notes: "",
  };
}

export function defaultLabel(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Journey ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildLeg(
  journeyId: string,
  index: number,
  mode: Mode,
  startedAt: number,
  routeName: string | null = null,
  direction: Direction | null = null,
): Leg {
  return {
    journeyId,
    index,
    mode,
    routeName: mode === "riding" ? routeName : null,
    direction: mode === "riding" ? direction : null,
    startedAt,
    endedAt: null,
  };
}

export interface Transition {
  journey: Journey;
  endedLeg: Leg;
  newLeg: Leg;
}

/**
 * End the current leg and open a new one in `mode`. Route + direction are only
 * retained for riding legs. Works any number of times per journey: board,
 * alight, walk, board again all funnel through here.
 */
export function transitionTo(
  journey: Readonly<Journey>,
  currentLeg: Readonly<Leg>,
  now: number,
  mode: Mode,
  routeName: string | null = null,
  direction: Direction | null = null,
): Transition {
  const nextIndex = journey.currentLegIndex + 1;
  return {
    journey: { ...journey, currentLegIndex: nextIndex, currentMode: mode },
    endedLeg: { ...currentLeg, endedAt: now },
    newLeg: buildLeg(journey.id, nextIndex, mode, now, routeName, direction),
  };
}

export function endJourney(
  journey: Readonly<Journey>,
  currentLeg: Readonly<Leg>,
  now: number,
): { journey: Journey; endedLeg: Leg } {
  return {
    journey: { ...journey, status: "ended", endedAt: now },
    endedLeg: { ...currentLeg, endedAt: now },
  };
}

export function buildPing(
  journey: Readonly<Journey>,
  leg: Readonly<Leg>,
  seq: number,
  fix: Fix,
  speed: number | null,
): Ping {
  return {
    journeyId: journey.id,
    seq,
    legIndex: leg.index,
    mode: leg.mode,
    routeName: leg.routeName,
    direction: leg.direction,
    recordedAt: fix.timestamp,
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy,
    speed,
    heading: fix.heading,
    altitude: fix.altitude,
  };
}

export function buildPoint(
  journey: Readonly<Journey>,
  leg: Readonly<Leg>,
  type: MarkerType,
  name: string,
  fix: Fix,
): MarkedPoint {
  return {
    journeyId: journey.id,
    legIndex: leg.index,
    mode: leg.mode,
    type,
    name: name.trim(),
    recordedAt: fix.timestamp,
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy,
  };
}

export function buildEvent(
  journey: Readonly<Journey>,
  type: JourneyEvent["type"],
  at: number,
  legIndex: number,
  mode: Mode,
  payload: JourneyEvent["payload"] = {},
): JourneyEvent {
  return { journeyId: journey.id, type, at, legIndex, mode, payload };
}
