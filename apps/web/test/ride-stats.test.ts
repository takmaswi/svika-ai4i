import { describe, expect, test } from "vitest";
import { deriveRideStats, type RideStatFact } from "../src/lib/ride-stats";

const NOW = new Date("2026-07-10T06:00:00Z"); // 08:00 CAT

function ride(
  iso: string,
  from: string | null,
  to: string | null,
  route: string | null = null,
): RideStatFact {
  return { purchasedAt: iso, fromName: from, toName: to, routeName: route };
}

describe("deriveRideStats", () => {
  test("empty history is all zeros with no favourite", () => {
    const stats = deriveRideStats([], NOW);
    expect(stats).toEqual({ total: 0, thisMonth: 0, favourite: null });
  });

  test("counts total rides and this Harare month", () => {
    const rides = [
      ride("2026-07-09T06:00:00Z", "Heights", "Town"),
      ride("2026-07-01T06:00:00Z", "Heights", "Town"),
      ride("2026-06-28T06:00:00Z", "Heights", "Town"), // last month
    ];
    const stats = deriveRideStats(rides, NOW);
    expect(stats.total).toBe(3);
    expect(stats.thisMonth).toBe(2);
  });

  test("a ride just before Harare midnight still counts in its Harare month", () => {
    // 2026-06-30T22:30Z is 2026-07-01 00:30 CAT, so it belongs to July
    const stats = deriveRideStats([ride("2026-06-30T22:30:00Z", "A", "B")], NOW);
    expect(stats.thisMonth).toBe(1);
  });

  test("favourite is the most ridden stop pair", () => {
    const rides = [
      ride("2026-07-09T06:00:00Z", "Heights", "Town"),
      ride("2026-07-08T06:00:00Z", "Heights", "Town"),
      ride("2026-07-07T06:00:00Z", "Avondale", "UZ"),
    ];
    const stats = deriveRideStats(rides, NOW);
    expect(stats.favourite).toEqual({ from: "Heights", to: "Town", count: 2 });
  });

  test("favourite falls back to the route when stop names are missing", () => {
    const rides = [
      ride("2026-07-09T06:00:00Z", null, null, "Route 4"),
      ride("2026-07-08T06:00:00Z", null, null, "Route 4"),
    ];
    const stats = deriveRideStats(rides, NOW);
    expect(stats.favourite).toEqual({ route: "Route 4", count: 2 });
  });
});
