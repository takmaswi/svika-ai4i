// The story caption card: it lives in the stage's caption band (never
// floating over the screen it narrates). Next either links to the next step
// or runs the step's engine action (see lib/demo-actions.ts); back a step is
// a view only link and never reruns an action. Exit always lands on the
// shelf; the final step announces the unlock and offers two doors, back to
// the shelf or stay and explore.
import Link from "next/link";
import type { AppLanguage } from "@svika/shared";
import { storyAdvance } from "@/lib/demo-actions";
import { resolveStoryParams, SHELF_PATH, storyUrl } from "@/lib/stories";
import { t } from "@/lib/i18n";
import { ArrowIcon, BackIcon } from "@/components/icons";

interface StoryBarProps {
  params: Record<string, string | string[] | undefined>;
  lang: AppLanguage;
}

export function StoryBar({ params, lang }: StoryBarProps) {
  const active = resolveStoryParams(params);
  if (!active) return null;
  const { story, step, current, isLast } = active;

  const showErr = params.err === "story";

  return (
    <aside className="story-bar svika-glass-strong" data-testid="story-bar">
      <div className="story-bar-head">
        {step > 0 && (
          <Link
            className="back-btn story-bar-back"
            href={storyUrl(story.slug, step - 1)}
            aria-label={t(lang, "story.back")}
            data-testid="story-back"
          >
            <BackIcon />
          </Link>
        )}
        <span className="svika-meta story-bar-count svika-mono-code">
          {step + 1}/{story.steps.length}
        </span>
        <Link
          className="svika-meta story-bar-exit touch-target"
          href={SHELF_PATH}
          data-testid="story-exit"
        >
          {t(lang, "story.exit")}
        </Link>
      </div>
      <p className="svika-body story-bar-caption">{t(lang, current.captionKey)}</p>
      {isLast && (
        <p className="svika-meta story-bar-live" data-testid="story-live">
          {t(lang, story.persona === "none" ? "story.liveVision" : "story.live")}
        </p>
      )}
      {showErr && <p className="auth-error svika-meta story-bar-err">{t(lang, "story.err")}</p>}
      {isLast ? (
        <div className="story-bar-actions story-bar-doors">
          <Link
            className="cta touch-target story-bar-next"
            href={story.stayPath}
            data-testid="story-next"
          >
            {t(lang, "story.stay")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </Link>
          <Link
            className="text-btn touch-target story-bar-shelf"
            href={SHELF_PATH}
            data-testid="story-shelf"
          >
            {t(lang, "story.shelf")}
          </Link>
        </div>
      ) : current.action ? (
        <form action={storyAdvance} className="story-bar-actions">
          <input type="hidden" name="story" value={story.slug} />
          <input type="hidden" name="step" value={step} />
          <button
            className="cta touch-target story-bar-next"
            type="submit"
            data-testid="story-next"
          >
            {t(lang, "story.next")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </button>
        </form>
      ) : (
        <div className="story-bar-actions">
          <Link
            className="cta touch-target story-bar-next"
            href={storyUrl(story.slug, step + 1)}
            data-testid="story-next"
          >
            {t(lang, "story.next")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
