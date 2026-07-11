"use client";

// The voice guide: geofence cues computed from the same simulated vehicle
// positions the map draws, spoken from preloaded audio (zero network at
// play time) and announced through an aria-live region so screen readers
// ride the same triggers. In replay mode (story steps) the ride's last
// stretch is compressed to seconds through the exact same engine; the
// story caption says so, and the register records it.
import { useEffect, useRef, useState } from "react";
import { pickApproachingVehicle } from "@/lib/map/eta-live";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "@/lib/map/sim-config";
import { simulatedTravelAt } from "@/lib/map/vehicle-feed";
import { VoiceAudioCache, type VoiceLang } from "@/lib/voice/audio-cache";
import { VoiceTriggerEngine, type VoiceCue, type VoiceTrip } from "@/lib/voice/triggers";

const LIVE_TICK_MS = 1000;
const REPLAY_TICK_MS = 400;
/** Fast forward: the last stretch rides at this many metres per tick. */
const REPLAY_STEP_METERS = 24;
const REPLAY_LEAD_METERS = 1100;

export interface VoiceGuideProps {
  /** null means every voice pref is off: render nothing, play nothing. */
  lang: VoiceLang | null;
  trip: VoiceTrip;
  mode: "live" | "replay";
  captions: Record<VoiceCue, string>;
}

export function VoiceGuide({ lang, trip, mode, captions }: VoiceGuideProps) {
  const [caption, setCaption] = useState("");
  const trackedVehicle = useRef<number>(-1);

  useEffect(() => {
    if (!lang) return;
    const cache = new VoiceAudioCache();
    const engine = new VoiceTriggerEngine(trip);
    let disposed = false;
    let replayMeters =
      trip.direction === "outbound"
        ? trip.targetMeters - REPLAY_LEAD_METERS
        : trip.targetMeters + REPLAY_LEAD_METERS;

    const speak = (cue: VoiceCue) => {
      setCaption(captions[cue]);
      const src = cache.src(cue);
      if (src) {
        // from the preloaded blob: no network between trigger and sound
        void new Audio(src).play().catch(() => {});
      }
    };

    const liveTick = () => {
      const travels = SIM_VEHICLES.map((v) =>
        simulatedTravelAt(simConfig, v, Date.now() - SIM_EPOCH_MS),
      );
      // lock onto the kombi serving this ride: the one the arrival logic
      // picks first, then followed by index so the cues stay on one vehicle
      if (trackedVehicle.current === -1) {
        const pick = pickApproachingVehicle(travels, trip.direction, trip.targetMeters);
        if (!pick) return;
        trackedVehicle.current = travels.indexOf(pick);
      }
      const mine = travels[trackedVehicle.current];
      if (!mine) return;
      const cue = engine.next(mine.meters, mine.direction);
      if (cue) speak(cue);
    };

    const replayTick = () => {
      replayMeters +=
        trip.direction === "outbound" ? REPLAY_STEP_METERS : -REPLAY_STEP_METERS;
      const cue = engine.next(replayMeters, trip.direction);
      if (cue) speak(cue);
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    void cache.preload(lang).then(() => {
      if (disposed) return;
      timer = setInterval(
        mode === "replay" ? replayTick : liveTick,
        mode === "replay" ? REPLAY_TICK_MS : LIVE_TICK_MS,
      );
    });

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
    // the trip is identity-stable per ride; a new ride remounts the component
  }, [lang, mode]);

  if (!lang) return null;
  return (
    <div aria-live="assertive" role="status" className="voice-caption-region">
      {caption && (
        <p className="voice-caption svika-glass-strong" data-testid="voice-caption">
          {caption}
        </p>
      )}
    </div>
  );
}
