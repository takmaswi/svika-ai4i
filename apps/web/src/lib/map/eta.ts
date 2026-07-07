// Arrival estimates behind an adapter. The real ETA model is Spine 2 of the
// AI layer and is not built yet; MockEtaProvider is the clearly-declared
// stand-in so the home surface can hold the "your kombi is N minutes away"
// slot without faking a prediction. Every rendering of a mock ETA must carry
// the demo label (dict key home.etaDemo) and the disclosure register entry.

export interface EtaProvider {
  /** True while the value is generated, not predicted. UI must label it. */
  readonly isMock: boolean;
  etaMinutes(stopId: string): Promise<number>;
}

const MIN_ETA = 2;
const MAX_ETA = 15;
const BUCKET_MS = 60_000;

export class MockEtaProvider implements EtaProvider {
  readonly isMock = true;

  constructor(private readonly now: () => number = Date.now) {}

  // Deterministic within a minute per stop: stable enough to read on screen,
  // alive enough to feel like a schedule. Plain string hash, no crypto needed.
  etaMinutes(stopId: string): Promise<number> {
    const bucket = Math.floor(this.now() / BUCKET_MS);
    let h = 2166136261;
    for (const ch of `${stopId}:${bucket}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    const span = MAX_ETA - MIN_ETA + 1;
    return Promise.resolve(MIN_ETA + (Math.abs(h) % span));
  }
}

export const etaProvider: EtaProvider = new MockEtaProvider();
