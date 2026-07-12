// Story mode: predefined scenarios a judge can watch run through the real
// engine, step by step with captions. A step is a real app screen; steps
// with an action run a real write (booking, the simulated hwindi clearing a
// code, a simulated friend's transfer) when the judge taps next. Missing
// actors are simulated and say so in the caption. While a story runs the
// screen is watch only (the StoryStage makes it inert); the final step
// unlocks it and offers two doors, back to the shelf or stay and explore.
import type { DictKey } from "./dict";

/** Where every story exit and the shelf door land: the sandbox shelf. */
export const SHELF_PATH = "/#shelf";

export type StoryActionId =
  | "book-cash-town"
  | "book-wallet-transfer"
  | "book-wallet-corridor"
  | "hwindi-clears"
  | "friend-sends"
  | "claim-friend-code"
  | "share-ride"
  | "inject-bad-day";

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
  /** Who the door signs the judge in as: a pooled Tino, a named persona,
   *  or the demo owner. "none" is a vision scene: nobody signs in and
   *  nothing writes. */
  persona: "pool" | "takunda" | "rudo" | "owner" | "none";
  /** The theme the story is staged in; unset leaves the visitor's choice. */
  theme?: "light" | "dark";
  /** Where the final step's stay and explore door lands. Exit always lands
   *  on the shelf (SHELF_PATH). */
  stayPath: string;
  steps: StoryStep[];
}

export const STORIES: Record<string, Story> = {
  "tino-town": {
    slug: "tino-town",
    persona: "pool",
    stayPath: "/app/wallet",
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
    stayPath: "/app",
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
    stayPath: "/app",
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
  // --- the intelligence doors: the spines shown honestly. Door one rides a
  // pooled persona onto the live map, then the committed evidence page.
  // Door two is takunda-morning above; door three is watchdog-leak below. --
  "eta-knows": {
    slug: "eta-knows",
    persona: "pool",
    stayPath: "/app/intelligence",
    steps: [
      { path: "/app", captionKey: "story.eta.0" },
      { path: "/app/intelligence", captionKey: "story.eta.1" },
    ],
  },
  "watchdog-leak": {
    slug: "watchdog-leak",
    persona: "owner",
    stayPath: "/app/owner",
    steps: [
      { path: "/app/owner", captionKey: "story.wd.0" },
      { path: "/app/owner", captionKey: "story.wd.1", action: "inject-bad-day" },
      { path: "/app/owner", captionKey: "story.wd.2" },
      { path: "/app/owner", captionKey: "story.wd.3" },
    ],
  },
  // --- vision scenes: public simulations of what ships next. persona
  // "none", no sign in, no writes, every screen stamped Simulation. --------
  "tinashe-crash": {
    slug: "tinashe-crash",
    persona: "none",
    stayPath: "/vision/tinashe?view=responder",
    steps: [
      { path: "/vision/tinashe?view=alert", captionKey: "story.tin.0" },
      { path: "/vision/tinashe?view=kin", captionKey: "story.tin.1" },
      { path: "/vision/tinashe?view=responder", captionKey: "story.tin.2" },
      { path: "/vision/tinashe?view=responder", captionKey: "story.tin.3" },
    ],
  },
  "gogo-ussd": {
    slug: "gogo-ussd",
    persona: "none",
    stayPath: "/vision/gogo",
    steps: [
      { path: "/vision/gogo", captionKey: "story.gogo.0" },
      { path: "/vision/gogo", captionKey: "story.gogo.1" },
    ],
  },
  "kombi-capacity": {
    slug: "kombi-capacity",
    persona: "none",
    stayPath: "/vision/capacity",
    steps: [
      { path: "/vision/capacity", captionKey: "story.cap.0" },
      { path: "/vision/capacity", captionKey: "story.cap.1" },
    ],
  },
  "rudo-night": {
    slug: "rudo-night",
    persona: "rudo",
    theme: "dark",
    stayPath: "/app",
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

export interface ActiveStory {
  story: Story;
  step: number;
  current: StoryStep;
  isLast: boolean;
}

/** The running story named by a page's search params, or null when the page
 *  is in free roam. Shared by the stage (inert lock) and the caption bar. */
export function resolveStoryParams(
  params: Record<string, string | string[] | undefined>,
): ActiveStory | null {
  const slug = typeof params.story === "string" ? params.story : "";
  const rawStep = typeof params.step === "string" ? Number(params.step) : NaN;
  const story = STORIES[slug];
  const step = Number.isInteger(rawStep) ? rawStep : -1;
  const current = story?.steps[step];
  if (!story || !current) return null;
  return { story, step, current, isLast: step === story.steps.length - 1 };
}

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
