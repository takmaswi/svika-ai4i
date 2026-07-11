// Fixture capacity for the vision scene: what each conductor declares
// against what redeemed tickets and check ins prove. Synthetic values in the
// reference plate grammar, attached to the four simulated kombis. Drift is
// always a pattern to review, never a person to accuse, and the scene ships
// for real only when vehicles stream data.
export interface KombiCapacity {
  plate: string;
  declared: number;
  proven: number;
  seats: number;
}

export const CAPACITY_FIXTURES: Record<string, KombiCapacity> = {
  "sim-1": { plate: "AEH 6647", declared: 11, proven: 11, seats: 15 },
  "sim-2": { plate: "AFK 3310", declared: 8, proven: 8, seats: 15 },
  "sim-3": { plate: "ADT 8892", declared: 14, proven: 9, seats: 15 },
  "sim-4": { plate: "AFK 3311", declared: 6, proven: 6, seats: 15 },
};

/** The map badge wears the declared number: the card holds it to account. */
export function capacityBadges(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CAPACITY_FIXTURES).map(([id, c]) => [
      id,
      `${c.declared}/${c.seats}`,
    ]),
  );
}
