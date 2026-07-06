// The three AI spines behind a single interface. Every implementation (mock or,
// later, a trained model served on ZCHPC CCE) is swappable behind this contract,
// so the ride path never calls a live vendor directly and the demo never dies
// because a provider is down. Each real spine must beat a named baseline on held
// out data before it replaces the mock (see PHASE-4-BUILD-PLAN P4).

export interface EtaRequest {
  routeId: string;
  fromStopId: string;
  toStopId: string;
  /** 0-23 local hour, the main signal with no timetable to lean on. */
  hourOfDay: number;
}

export interface EtaResult {
  etaSeconds: number;
  source: string;
}

export interface CommuteAlertRequest {
  riderId: string;
  routeId: string;
  hourOfDay: number;
}

export interface CommuteAlertResult {
  /** null when the rider has no recurring pattern at this hour yet. */
  message: string | null;
  source: string;
}

export interface AnomalyRequest {
  ownerId: string;
  day: string;
  ticketCount: number;
  expectedTickets: number;
}

export interface AnomalyResult {
  flagged: boolean;
  /** 0..1, higher means more anomalous. */
  score: number;
  source: string;
}

export interface Spines {
  readonly provider: string;
  eta(req: EtaRequest): Promise<EtaResult>;
  commuteAlert(req: CommuteAlertRequest): Promise<CommuteAlertResult>;
  anomaly(req: AnomalyRequest): Promise<AnomalyResult>;
}
