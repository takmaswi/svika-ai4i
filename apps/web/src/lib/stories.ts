// Story mode: predefined scenarios a judge can watch run through the real
// engine, step by step with captions. A step is a real app screen; steps
// with an action run a real write (booking, the simulated hwindi clearing a
// code, a simulated friend's transfer) when the judge taps next. Missing
// actors are simulated and say so in the caption. Every story ends back in
// free roam.
import type { DictKey } from "./dict";

export type StoryActionId =
  | "book-cash-town"
  | "book-wallet-transfer"
  | "book-wallet-corridor"
  | "hwindi-clears"
  | "friend-sends"
  | "claim-friend-code"
  | "share-ride";

/** A step path resolved at run time to the rider's live share link. */
export const SHARE_PATH_SENTINEL = "@share-latest";

export interface StoryStep {
  /** Real app path (may carry its own query), without the story params;
   *  or SHARE_PATH_SENTINEL, resolved server side after the share action. */
  path: string;
  captionKey: DictKey;
  /** When set, the next button runs this through the engine, then advances. */
  action?: StoryActionId;
}

export interface Story {
  slug: string;
  /** Who the door signs the judge in as: a pooled Tariro or a named persona.
   *  "none" is a vision scene: nobody signs in and nothing writes. */
  persona: "pool" | "takunda" | "rudo" | "none";
  /** The theme the story is staged in; unset leaves the visitor's choice. */
  theme?: "light" | "dark";
  /** Where exit and done land. Vision scenes exit to the landing; real
   *  stories keep the default free roam. */
  exitPath?: string;
  steps: StoryStep[];
}

export const STORIES: Record<string, Story> = {
  "tariro-town": {
    slug: "tariro-town",
    persona: "pool",
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
    persona: "pool",
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
  "takunda-morning": {
    slug: "takunda-morning",
    persona: "takunda",
    theme: "light",
    steps: [
      { path: "/app", captionKey: "story.tk.0" },
      {
        path: "/app?sheet=open",
        captionKey: "story.tk.1",
        action: "book-wallet-corridor",
      },
      { path: "/app?booked=1", captionKey: "story.tk.2", action: "hwindi-clears" },
      { path: "/app?voicedemo=1", captionKey: "story.tk.3" },
    ],
  },
  // --- vision scenes: public simulations of what ships next. persona
  // "none", no sign in, no writes, every screen stamped Simulation. --------
  "tinashe-crash": {
    slug: "tinashe-crash",
    persona: "none",
    exitPath: "/",
    steps: [
      { path: "/vision/tinashe?view=alert", captionKey: "story.tin.0" },
      { path: "/vision/tinashe?view=kin", captionKey: "story.tin.1" },
      { path: "/vision/tinashe?view=responder", captionKey: "story.tin.2" },
      { path: "/vision/tinashe?view=responder", captionKey: "story.tin.3" },
    ],
  },
  "rudo-night": {
    slug: "rudo-night",
    persona: "rudo",
    theme: "dark",
    steps: [
      { path: "/app?sheet=open", captionKey: "story.ru.0" },
      { path: "/app/wallet", captionKey: "story.ru.1", action: "friend-sends" },
      {
        path: "/app/wallet",
        captionKey: "story.ru.2",
        action: "claim-friend-code",
      },
      {
        path: "/app/wallet",
        captionKey: "story.ru.3",
        action: "book-wallet-corridor",
      },
      { path: "/app?booked=1", captionKey: "story.ru.4", action: "hwindi-clears" },
      { path: "/app?booked=1", captionKey: "story.ru.5", action: "share-ride" },
      { path: SHARE_PATH_SENTINEL, captionKey: "story.ru.6" },
    ],
  },
};

/** The step's URL with the story chrome attached. The share sentinel is
 *  resolved by storyAdvance (it always follows the share action); anything
 *  else asking for it lands safely on the app. */
export function storyUrl(slug: string, step: number): string {
  const story = STORIES[slug];
  const clamped = Math.max(0, Math.min(step, (story?.steps.length ?? 1) - 1));
  let path = story?.steps[clamped]?.path ?? "/app";
  if (path === SHARE_PATH_SENTINEL) path = "/app";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}story=${slug}&step=${clamped}`;
}
