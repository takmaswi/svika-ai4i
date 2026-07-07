// IndexedDB storage. Offline-first and crash-safe: every ping and event is
// written the instant it is captured, so a lost signal, a backgrounded tab, or
// a dead battery never loses the journey. Nothing here talks to the network.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Journey, Leg, Ping, MarkedPoint, JourneyEvent } from "./types";

interface LoggerDB extends DBSchema {
  journeys: { key: string; value: Journey };
  legs: {
    key: [string, number];
    value: Leg;
    indexes: { byJourney: string };
  };
  pings: {
    key: number;
    value: Ping;
    indexes: { byJourney: string };
  };
  points: {
    key: number;
    value: MarkedPoint;
    indexes: { byJourney: string };
  };
  events: {
    key: number;
    value: JourneyEvent;
    indexes: { byJourney: string };
  };
}

const DB_NAME = "svika-gps-logger";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LoggerDB>> | null = null;

function db(): Promise<IDBPDatabase<LoggerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LoggerDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("journeys", { keyPath: "id" });

        const legs = database.createObjectStore("legs", {
          keyPath: ["journeyId", "index"],
        });
        legs.createIndex("byJourney", "journeyId");

        const pings = database.createObjectStore("pings", {
          keyPath: "id",
          autoIncrement: true,
        });
        pings.createIndex("byJourney", "journeyId");

        const points = database.createObjectStore("points", {
          keyPath: "id",
          autoIncrement: true,
        });
        points.createIndex("byJourney", "journeyId");

        const events = database.createObjectStore("events", {
          keyPath: "id",
          autoIncrement: true,
        });
        events.createIndex("byJourney", "journeyId");
      },
    });
  }
  return dbPromise;
}

export async function putJourney(journey: Journey): Promise<void> {
  await (await db()).put("journeys", journey);
}

export async function getJourney(id: string): Promise<Journey | undefined> {
  return (await db()).get("journeys", id);
}

export async function allJourneys(): Promise<Journey[]> {
  const rows = await (await db()).getAll("journeys");
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}

export async function activeJourney(): Promise<Journey | undefined> {
  return (await allJourneys()).find((j) => j.status === "active");
}

export async function putLeg(leg: Leg): Promise<void> {
  await (await db()).put("legs", leg);
}

export async function legsFor(journeyId: string): Promise<Leg[]> {
  const rows = await (await db()).getAllFromIndex("legs", "byJourney", journeyId);
  return rows.sort((a, b) => a.index - b.index);
}

export async function addPing(ping: Ping): Promise<void> {
  await (await db()).add("pings", ping);
}

export async function pingsFor(journeyId: string): Promise<Ping[]> {
  const rows = await (await db()).getAllFromIndex("pings", "byJourney", journeyId);
  return rows.sort((a, b) => a.seq - b.seq);
}

export async function countPings(journeyId: string): Promise<number> {
  return (await db()).countFromIndex("pings", "byJourney", journeyId);
}

export async function addPoint(point: MarkedPoint): Promise<number> {
  return (await db()).add("points", point) as Promise<number>;
}

export async function putPoint(point: MarkedPoint): Promise<void> {
  await (await db()).put("points", point);
}

export async function pointsFor(journeyId: string): Promise<MarkedPoint[]> {
  const rows = await (await db()).getAllFromIndex("points", "byJourney", journeyId);
  return rows.sort((a, b) => a.recordedAt - b.recordedAt);
}

export async function addEvent(event: JourneyEvent): Promise<void> {
  await (await db()).add("events", event);
}

export async function eventsFor(journeyId: string): Promise<JourneyEvent[]> {
  const rows = await (await db()).getAllFromIndex("events", "byJourney", journeyId);
  return rows.sort((a, b) => a.at - b.at);
}

export async function deleteJourney(journeyId: string): Promise<void> {
  const database = await db();
  const tx = database.transaction(
    ["journeys", "legs", "pings", "points", "events"],
    "readwrite",
  );
  await tx.objectStore("journeys").delete(journeyId);
  for (const store of ["legs", "pings", "points", "events"] as const) {
    const index = tx.objectStore(store).index("byJourney");
    let cursor = await index.openCursor(journeyId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}
