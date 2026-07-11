// The voice guide's audio store. Everything is fetched once when the ride
// starts and held as object URLs; play time never touches the network,
// which the unit test proves by counting fetches. Files are the labelled
// placeholders in public/voice until recorded voices land (P5).
import type { VoiceCue } from "./triggers";

const CUE_FILES: Record<VoiceCue, string> = {
  approaching: "approaching.wav",
  getOff: "get-off.wav",
  walk: "walk.wav",
};

export type VoiceLang = "en" | "sn";

interface CacheDeps {
  fetchFn?: typeof fetch;
  createObjectUrl?: (blob: Blob) => string;
}

export class VoiceAudioCache {
  private readonly urls = new Map<VoiceCue, string>();
  private readonly fetchFn: typeof fetch;
  private readonly createObjectUrl: (blob: Blob) => string;

  constructor(deps: CacheDeps = {}) {
    this.fetchFn = deps.fetchFn ?? fetch.bind(globalThis);
    this.createObjectUrl =
      deps.createObjectUrl ?? ((blob) => URL.createObjectURL(blob));
  }

  /** Pulls every cue for the language into memory. The only network moment. */
  async preload(lang: VoiceLang): Promise<void> {
    await Promise.all(
      (Object.keys(CUE_FILES) as VoiceCue[]).map(async (cue) => {
        const res = await this.fetchFn(`/voice/${lang}/${CUE_FILES[cue]}`);
        if (!res.ok) return; // a missing file mutes that cue, never crashes
        const blob = await res.blob();
        this.urls.set(cue, this.createObjectUrl(blob));
      }),
    );
  }

  /** The in-memory source for a cue. Never fetches. */
  src(cue: VoiceCue): string | null {
    return this.urls.get(cue) ?? null;
  }
}
