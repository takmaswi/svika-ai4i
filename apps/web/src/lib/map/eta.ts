// Arrival estimates behind an adapter. Spine 1 (services/spine, GET /eta)
// serves real numbers derived from recorded rides; MockEtaProvider is its
// mock twin, serving when the spine is unreachable or the trip is off the
// corridor. Every estimate carries isMock and its ride count, so the UI can
// always say what the number stands on: the demo label for the mock, "from
// N recorded rides" for the real thing. See eta-live.ts for the real caller.

export interface EtaEstimate {
  minutes: number;
  /** True while the value is generated, not predicted. UI must label it. */
  isMock: boolean;
  /** Recorded rides behind a real estimate; 0 for the mock. */
  rides: number;
}

export interface EtaProvider {
  estimate(fromStopId: string, toStopId: string): Promise<EtaEstimate>;
}

const MIN_ETA = 2;
const MAX_ETA = 15;
const BUCKET_MS = 60_000;

export class MockEtaProvider implements EtaProvider {
  constructor(private readonly now: () => number = Date.now) {}

  // Deterministic within a minute per stop: stable enough to read on screen,
  // alive enough to feel like a schedule. Plain string hash, no crypto needed.
  estimate(fromStopId: string): Promise<EtaEstimate> {
    const bucket = Math.floor(this.now() / BUCKET_MS);
    let h = 2166136261;
    for (const ch of `${fromStopId}:${bucket}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    const span = MAX_ETA - MIN_ETA + 1;
    return Promise.resolve({
      minutes: MIN_ETA + (Math.abs(h) % span),
      isMock: true,
      rides: 0,
    });
  }
}
