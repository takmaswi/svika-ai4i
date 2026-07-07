// The active-journey controller. Owns the lifecycle of one recording session:
// starts / resumes a journey, wires high-accuracy location watching and the
// wake lock, and persists every ping and event the instant it arrives. The UI
// drives it through the tap methods and reads live state through snapshot().

import {
  addEvent,
  addPing,
  addPoint,
  countPings,
  getJourney,
  legsFor,
  putJourney,
  putLeg,
} from "./db";
import {
  buildEvent,
  buildJourney,
  buildLeg,
  buildPing,
  buildPoint,
  endJourney,
  transitionTo,
} from "./reducer";
import { speedMps } from "./geomath";
import { ScreenWakeLock, watchLocation, type LocationWatcher } from "./sensor";
import type {
  Direction,
  Fix,
  Journey,
  Leg,
  MarkerType,
  Mode,
} from "./types";

export interface LiveSnapshot {
  journey: Journey;
  currentLeg: Leg;
  mode: Mode;
  legIndex: number;
  pingCount: number;
  lastSpeedMps: number | null;
  hasFix: boolean;
  gpsError: string | null;
  wakeLockActive: boolean;
}

function newJourneyId(now: number): string {
  return `jrn_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

export class JourneyRecorder {
  private journey: Journey;
  private currentLeg: Leg;
  private seq: number;
  private lastFix: Fix | null = null;
  private lastSpeed: number | null = null;
  private pingCount: number;
  private gpsError: string | null = null;
  private watcher: LocationWatcher | null = null;
  private readonly wake = new ScreenWakeLock();
  private onChange: (() => void) | null = null;

  private constructor(journey: Journey, currentLeg: Leg, seq: number) {
    this.journey = journey;
    this.currentLeg = currentLeg;
    this.seq = seq;
    this.pingCount = seq;
  }

  /** Begin a brand-new journey in walking mode and start logging. */
  static async start(label: string): Promise<JourneyRecorder> {
    const now = Date.now();
    const journey = buildJourney(newJourneyId(now), now, label);
    const leg = buildLeg(journey.id, 0, "walking", now);
    await putJourney(journey);
    await putLeg(leg);
    await addEvent(buildEvent(journey, "journey_start", now, 0, "walking"));
    const rec = new JourneyRecorder(journey, leg, 0);
    await rec.startSensors();
    return rec;
  }

  /** Re-attach to an active journey after a reload, crash, or backgrounding. */
  static async resume(journeyId: string): Promise<JourneyRecorder> {
    const journey = await getJourney(journeyId);
    if (!journey || journey.status !== "active") {
      throw new Error("No active journey to resume.");
    }
    const legs = await legsFor(journeyId);
    const currentLeg =
      legs.find((l) => l.index === journey.currentLegIndex) ?? legs[legs.length - 1];
    if (!currentLeg) throw new Error("Journey has no legs to resume.");
    const seq = await countPings(journeyId);
    const rec = new JourneyRecorder(journey, currentLeg, seq);
    await rec.startSensors();
    return rec;
  }

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  snapshot(): LiveSnapshot {
    return {
      journey: this.journey,
      currentLeg: this.currentLeg,
      mode: this.journey.currentMode,
      legIndex: this.journey.currentLegIndex,
      pingCount: this.pingCount,
      lastSpeedMps: this.lastSpeed,
      hasFix: this.lastFix !== null,
      gpsError: this.gpsError,
      wakeLockActive: this.wake.supported,
    };
  }

  get id(): string {
    return this.journey.id;
  }

  async setWaiting(): Promise<void> {
    await this.transition("waiting", "mode_change");
  }

  async board(routeName: string, direction: Direction): Promise<void> {
    await this.transition("riding", "board", routeName, direction);
  }

  async alight(): Promise<void> {
    await this.transition("walking", "alight");
  }

  async markPoint(type: MarkerType, name: string): Promise<void> {
    if (!this.lastFix) throw new Error("Waiting for the first GPS fix.");
    const point = buildPoint(this.journey, this.currentLeg, type, name, this.lastFix);
    const id = await addPoint(point);
    await addEvent(
      buildEvent(
        this.journey,
        "mark_point",
        this.lastFix.timestamp,
        this.currentLeg.index,
        this.journey.currentMode,
        { pointId: id, type, name: point.name },
      ),
    );
    this.emit();
  }

  async end(): Promise<void> {
    const now = Date.now();
    const { journey, endedLeg } = endJourney(this.journey, this.currentLeg, now);
    this.journey = journey;
    this.currentLeg = endedLeg;
    await putLeg(endedLeg);
    await putJourney(journey);
    await addEvent(
      buildEvent(journey, "journey_end", now, endedLeg.index, endedLeg.mode),
    );
    this.stopSensors();
    await this.wake.release();
    this.emit();
  }

  private async transition(
    mode: Mode,
    eventType: "mode_change" | "board" | "alight",
    routeName: string | null = null,
    direction: Direction | null = null,
  ): Promise<void> {
    const now = Date.now();
    const { journey, endedLeg, newLeg } = transitionTo(
      this.journey,
      this.currentLeg,
      now,
      mode,
      routeName,
      direction,
    );
    await putLeg(endedLeg);
    await putLeg(newLeg);
    await putJourney(journey);
    await addEvent(
      buildEvent(journey, eventType, now, newLeg.index, mode, {
        routeName,
        direction,
      }),
    );
    this.journey = journey;
    this.currentLeg = newLeg;
    this.emit();
  }

  private async startSensors(): Promise<void> {
    try {
      this.watcher = watchLocation(
        (fix) => void this.onFix(fix),
        (message) => {
          this.gpsError = message;
          this.emit();
        },
      );
    } catch (err) {
      this.gpsError = err instanceof Error ? err.message : "No geolocation";
    }
    await this.wake.request();
  }

  private stopSensors(): void {
    this.watcher?.stop();
    this.watcher = null;
  }

  private async onFix(fix: Fix): Promise<void> {
    this.gpsError = null;
    this.lastSpeed = speedMps(fix, this.lastFix);
    this.lastFix = fix;
    const ping = buildPing(this.journey, this.currentLeg, this.seq, fix, this.lastSpeed);
    await addPing(ping);
    this.seq += 1;
    this.pingCount = this.seq;
    this.emit();
  }

  private emit(): void {
    this.onChange?.();
  }
}
