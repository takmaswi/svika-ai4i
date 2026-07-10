// Story mode: predefined scenarios a judge can watch run through the real
// engine, step by step with captions. A step is a real app screen; steps
// with an action run a real write (booking, the simulated hwindi clearing a
// code) when the judge taps next. Missing actors are simulated and say so
// in the caption. Every story ends back in free roam.
import type { DictKey } from "./dict";

export type StoryActionId =
  | "book-cash-town"
  | "book-wallet-transfer"
  | "hwindi-clears";

export interface StoryStep {
  /** Real app path (may carry its own query), without the story params. */
  path: string;
  captionKey: DictKey;
  /** When set, the next button runs this through the engine, then advances. */
  action?: StoryActionId;
}

export interface Story {
  slug: string;
  steps: StoryStep[];
}

export const STORIES: Record<string, Story> = {
  "tariro-town": {
    slug: "tariro-town",
    steps: [
      { path: "/app", captionKey: "story.town.0" },
      { path: "/app/plan?from=heights&to=rezende", captionKey: "story.town.1" },
      {
        path: "/app/plan?from=heights&to=rezende",
        captionKey: "story.town.2",
        action: "book-cash-town",
      },
      { path: "/app?booked=1", captionKey: "story.town.3" },
      { path: "/app?booked=1", captionKey: "story.town.4", action: "hwindi-clears" },
      { path: "/app/wallet", captionKey: "story.town.5" },
    ],
  },
  "transfer-trip": {
    slug: "transfer-trip",
    steps: [
      { path: "/app/plan?from=heights&to=avondale", captionKey: "story.transfer.0" },
      {
        path: "/app/plan?from=heights&to=avondale",
        captionKey: "story.transfer.1",
        action: "book-wallet-transfer",
      },
      { path: "/app?booked=1", captionKey: "story.transfer.2" },
    ],
  },
};

/** The step's URL with the story chrome attached. */
export function storyUrl(slug: string, step: number): string {
  const story = STORIES[slug];
  const clamped = Math.max(0, Math.min(step, (story?.steps.length ?? 1) - 1));
  const path = story?.steps[clamped]?.path ?? "/app";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}story=${slug}&step=${clamped}`;
}
