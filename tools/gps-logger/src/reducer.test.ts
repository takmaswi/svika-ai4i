import { describe, it, expect } from "vitest";
import {
  buildJourney,
  buildLeg,
  buildPing,
  buildPoint,
  transitionTo,
  endJourney,
} from "./reducer";
import type { Fix, Leg } from "./types";

const fix: Fix = {
  timestamp: 1000,
  lat: -17.8,
  lng: 31.05,
  accuracy: 5,
  speed: 3,
  heading: 90,
  altitude: 1400,
};

describe("buildJourney", () => {
  it("starts active in walking mode on leg 0", () => {
    const j = buildJourney("j1", 1000, "Morning run");
    expect(j.status).toBe("active");
    expect(j.currentMode).toBe("walking");
    expect(j.currentLegIndex).toBe(0);
    expect(j.label).toBe("Morning run");
  });

  it("falls back to a generated label when none is given", () => {
    const j = buildJourney("j1", 1000, "   ");
    expect(j.label).toMatch(/^Journey \d{4}-\d{2}-\d{2}/);
  });
});

describe("transitionTo", () => {
  it("ends the current leg and opens the next, bumping the index", () => {
    const j = buildJourney("j1", 0, "x");
    const leg0 = buildLeg("j1", 0, "walking", 0);
    const t = transitionTo(j, leg0, 500, "waiting");
    expect(t.endedLeg.endedAt).toBe(500);
    expect(t.newLeg.index).toBe(1);
    expect(t.newLeg.mode).toBe("waiting");
    expect(t.journey.currentLegIndex).toBe(1);
    expect(t.journey.currentMode).toBe("waiting");
  });

  it("keeps route and direction only on riding legs", () => {
    const j = buildJourney("j1", 0, "x");
    const leg0 = buildLeg("j1", 0, "walking", 0);
    const ride = transitionTo(j, leg0, 100, "riding", "Heights to Rezende", "outbound");
    expect(ride.newLeg.routeName).toBe("Heights to Rezende");
    expect(ride.newLeg.direction).toBe("outbound");

    const walk = transitionTo(ride.journey, ride.newLeg, 200, "walking", "ignored", "inbound");
    expect(walk.newLeg.routeName).toBeNull();
    expect(walk.newLeg.direction).toBeNull();
  });

  it("supports a multi-kombi journey with a walking transfer", () => {
    // walk -> wait -> ride A -> walk (transfer) -> ride B -> walk (arrive)
    let j = buildJourney("j1", 0, "x");
    let leg: Leg = buildLeg("j1", 0, "walking", 0);
    const sequence: [Parameters<typeof transitionTo>[3], string | null, "outbound" | "inbound" | null][] = [
      ["waiting", null, null],
      ["riding", "Route A", "outbound"],
      ["walking", null, null],
      ["riding", "Route B", "inbound"],
      ["walking", null, null],
    ];
    const modes: string[] = [leg.mode];
    for (const [mode, route, dir] of sequence) {
      const t = transitionTo(j, leg, 0, mode, route, dir);
      j = t.journey;
      leg = t.newLeg;
      modes.push(leg.mode);
    }
    expect(modes).toEqual(["walking", "waiting", "riding", "walking", "riding", "walking"]);
    expect(j.currentLegIndex).toBe(5);
    expect(leg.routeName).toBeNull(); // final walking leg
  });
});

describe("endJourney", () => {
  it("marks the journey ended and closes the current leg", () => {
    const j = buildJourney("j1", 0, "x");
    const leg = buildLeg("j1", 0, "walking", 0);
    const { journey, endedLeg } = endJourney(j, leg, 900);
    expect(journey.status).toBe("ended");
    expect(journey.endedAt).toBe(900);
    expect(endedLeg.endedAt).toBe(900);
  });
});

describe("buildPing / buildPoint", () => {
  it("stamps the riding leg's route onto the ping", () => {
    const j = buildJourney("j1", 0, "x");
    const leg = buildLeg("j1", 2, "riding", 0, "Route A", "outbound");
    const ping = buildPing(j, leg, 7, fix, 3);
    expect(ping.legIndex).toBe(2);
    expect(ping.mode).toBe("riding");
    expect(ping.routeName).toBe("Route A");
    expect(ping.direction).toBe("outbound");
    expect(ping.seq).toBe(7);
    expect(ping.recordedAt).toBe(fix.timestamp);
  });

  it("trims marked point names and carries the leg context", () => {
    const j = buildJourney("j1", 0, "x");
    const leg = buildLeg("j1", 1, "walking", 0);
    const point = buildPoint(j, leg, "rank", "  Rezende Rank  ", fix);
    expect(point.name).toBe("Rezende Rank");
    expect(point.type).toBe("rank");
    expect(point.legIndex).toBe(1);
  });
});
