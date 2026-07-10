// The story chrome: a caption bar floating over the real screens while a
// predefined scenario runs through the real engine. Server rendered; the
// next button is either a link to the next step or a form that runs the
// step's engine action (see lib/demo-actions.ts). Exiting always lands in
// free roam.
import Link from "next/link";
import type { AppLanguage } from "@svika/shared";
import { storyAdvance } from "@/lib/demo-actions";
import { STORIES, storyUrl } from "@/lib/stories";
import { t } from "@/lib/i18n";
import { ArrowIcon } from "@/components/icons";

interface StoryBarProps {
  params: Record<string, string | string[] | undefined>;
  lang: AppLanguage;
}

export function StoryBar({ params, lang }: StoryBarProps) {
  const slug = typeof params.story === "string" ? params.story : "";
  const rawStep = typeof params.step === "string" ? Number(params.step) : NaN;
  const story = STORIES[slug];
  const step = Number.isInteger(rawStep) ? rawStep : -1;
  const current = story?.steps[step];
  if (!story || !current) return null;

  const isLast = step === story.steps.length - 1;
  const showErr = params.err === "story";

  return (
    <aside className="story-bar svika-glass-strong" data-testid="story-bar">
      <div className="story-bar-head">
        <span className="svika-meta story-bar-count svika-mono-code">
          {step + 1}/{story.steps.length}
        </span>
        <Link className="svika-meta story-bar-exit" href="/app">
          {t(lang, "story.exit")}
        </Link>
      </div>
      <p className="svika-body story-bar-caption">{t(lang, current.captionKey)}</p>
      {showErr && <p className="auth-error svika-meta story-bar-err">{t(lang, "story.err")}</p>}
      {current.action ? (
        <form action={storyAdvance} className="story-bar-actions">
          <input type="hidden" name="story" value={slug} />
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
            href={isLast ? "/app" : storyUrl(slug, step + 1)}
            data-testid="story-next"
          >
            {t(lang, isLast ? "story.done" : "story.next")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
