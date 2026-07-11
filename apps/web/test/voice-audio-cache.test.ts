import { describe, expect, test, vi } from "vitest";
import { VoiceAudioCache } from "../src/lib/voice/audio-cache";

function fakeFetch(ok = true) {
  return vi.fn(async (input: RequestInfo | URL) => ({
    ok,
    url: String(input),
    blob: async () => new Blob([`audio:${String(input)}`]),
  })) as unknown as typeof fetch;
}

describe("VoiceAudioCache", () => {
  test("preload fetches every cue once; play time never fetches", async () => {
    const fetchFn = fakeFetch();
    let minted = 0;
    const cache = new VoiceAudioCache({
      fetchFn,
      createObjectUrl: () => `blob:mock-${++minted}`,
    });

    await cache.preload("sn");
    expect(fetchFn).toHaveBeenCalledTimes(3);
    const called = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(called).toEqual(
      expect.arrayContaining([
        "/voice/sn/approaching.wav",
        "/voice/sn/get-off.wav",
        "/voice/sn/walk.wav",
      ]),
    );

    // the zero network proof: reading sources for playback fetches nothing
    expect(cache.src("approaching")).toMatch(/^blob:mock-/);
    expect(cache.src("getOff")).toMatch(/^blob:mock-/);
    expect(cache.src("walk")).toMatch(/^blob:mock-/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  test("a missing file mutes its cue instead of crashing the ride", async () => {
    const cache = new VoiceAudioCache({
      fetchFn: fakeFetch(false),
      createObjectUrl: () => "blob:never",
    });
    await cache.preload("en");
    expect(cache.src("approaching")).toBeNull();
  });
});
