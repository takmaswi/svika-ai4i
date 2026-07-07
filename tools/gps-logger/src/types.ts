// Domain types for the field GPS logger.
//
// A JOURNEY is one recorded trip: a chain of LEGS. A leg is a maximal run of a
// single MODE (walking, waiting, or riding). Boarding a kombi opens a riding
// leg with its own route + direction; getting off opens a walking leg. There is
// no fixed number of legs: a journey may be one kombi or several with walking
// transfers between ranks. Every PING and marked POINT carries the mode and leg
// index it was captured under, so the export reconstructs the trip with no
// dependence on wall-clock joins.

export type Mode = "walking" | "waiting" | "riding";

// Matches public.route_direction in packages/db/migrations/0002_transit_network.sql.
export type Direction = "outbound" | "inbound";

// Kombis have no fixed stops. A marked point is where something actually
// happened: a drop-off, a rank, a terminal, or a landmark the rider named.
export type MarkerType = "dropoff" | "rank" | "terminal" | "landmark";

export type JourneyStatus = "active" | "ended";

export interface Journey {
  id: string;
  label: string;
  status: JourneyStatus;
  startedAt: number; // epoch ms
  endedAt: number | null;
  createdAt: number;
  // Denormalised live state so a crashed / backgrounded session resumes exactly
  // where it left off without replaying the event log.
  currentLegIndex: number;
  currentMode: Mode;
  notes: string;
}

export interface Leg {
  journeyId: string;
  index: number; // 0-based, monotonic within the journey
  mode: Mode;
  routeName: string | null; // riding legs only
  direction: Direction | null; // riding legs only
  startedAt: number;
  endedAt: number | null;
}

export interface Ping {
  id?: number; // autoIncrement
  journeyId: string;
  seq: number; // monotonic within the journey, 0-based
  legIndex: number;
  mode: Mode;
  routeName: string | null; // stamped on riding pings for export robustness
  direction: Direction | null;
  recordedAt: number; // epoch ms (GPS timestamp)
  lat: number;
  lng: number;
  accuracy: number | null; // metres
  speed: number | null; // m/s, from the GPS or null
  heading: number | null; // degrees, 0..360 or null
  altitude: number | null; // metres or null
}

export interface MarkedPoint {
  id?: number; // autoIncrement
  journeyId: string;
  legIndex: number;
  mode: Mode;
  type: MarkerType;
  name: string; // editable; may be empty at drop time
  recordedAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type EventType =
  | "journey_start"
  | "mode_change"
  | "board"
  | "alight"
  | "mark_point"
  | "journey_end";

// Append-only audit log. Every state change lands here as captured, so a lost
// signal, a backgrounded app, or a dying battery never loses the shape of the
// journey even if the derived tables were mid-write.
export interface JourneyEvent {
  id?: number;
  journeyId: string;
  type: EventType;
  at: number;
  legIndex: number;
  mode: Mode;
  payload: Record<string, string | number | null>;
}

// A single GPS fix as handed to the logger (decoupled from GeolocationPosition
// so it is trivial to unit test and to feed synthetic fixes).
export interface Fix {
  timestamp: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
}
