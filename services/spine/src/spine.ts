// Provider selection. AI_PROVIDER picks the implementation; only the mock twin
// exists today, so anything other than a known provider falls back to mock and
// says so, rather than throwing in the ride path.
import type { Spines } from "./adapters/types";
import { mockSpines } from "./adapters/mock";

export function getSpines(provider = process.env.AI_PROVIDER ?? "mock"): Spines {
  switch (provider) {
    case "mock":
    default:
      return mockSpines;
  }
}

export function health(spines: Spines = getSpines()): {
  ok: boolean;
  provider: string;
} {
  return { ok: true, provider: spines.provider };
}
