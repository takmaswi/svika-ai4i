// The mock twin. Deterministic, dependency-free stand-ins for the three spines
// so every other surface can integrate now and the demo has a live fallback.
// These are baselines, not models: ETA is a flat average, the alert is a fixed
// rule, anomaly is a fixed threshold. P4 replaces them with trained models that
// must beat exactly these baselines.
import type {
  Spines,
  EtaRequest,
  EtaResult,
  CommuteAlertRequest,
  CommuteAlertResult,
  AnomalyRequest,
  AnomalyResult,
} from "./types";

/** Naive average-speed baseline: a flat per-leg time nudged by rush hours. */
const BASE_LEG_SECONDS = 15 * 60;
const RUSH_HOURS = new Set([6, 7, 8, 16, 17, 18]);

/** Fixed-threshold baseline for the revenue watchdog. */
const ANOMALY_DROP_RATIO = 0.6;

export const mockSpines: Spines = {
  provider: "mock",

  async eta(req: EtaRequest): Promise<EtaResult> {
    const rushFactor = RUSH_HOURS.has(req.hourOfDay) ? 1.5 : 1;
    return { etaSeconds: Math.round(BASE_LEG_SECONDS * rushFactor), source: "mock" };
  },

  async commuteAlert(req: CommuteAlertRequest): Promise<CommuteAlertResult> {
    const message = RUSH_HOURS.has(req.hourOfDay)
      ? "Your usual kombi is a few minutes away."
      : null;
    return { message, source: "mock" };
  },

  async anomaly(req: AnomalyRequest): Promise<AnomalyResult> {
    const expected = Math.max(req.expectedTickets, 1);
    const ratio = req.ticketCount / expected;
    const flagged = ratio < ANOMALY_DROP_RATIO;
    const score = Math.min(Math.max(1 - ratio, 0), 1);
    return { flagged, score, source: "mock" };
  },
};
