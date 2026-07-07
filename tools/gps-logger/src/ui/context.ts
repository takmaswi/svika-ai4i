import type { JourneyRecorder } from "../journey";

// Passed to every screen so they can reach the single live recorder and move
// between screens without a router library.
export interface AppContext {
  getRecorder(): JourneyRecorder | null;
  setRecorder(recorder: JourneyRecorder | null): void;
  navigate(hash: string): void;
}
