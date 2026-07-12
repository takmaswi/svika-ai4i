// Presentation mode: while a story runs, the page renders inside a watch
// only screen box with the caption band docked below it, so the caption can
// never cover the content it narrates and a tap on the app cannot derail the
// script. Everything under the lock is inert until the final step, whose
// caption announces the unlock; the story controls in the band are the only
// live elements before that. At desktop widths the box becomes a phone sized
// frame beside the caption (stage frame, a flagged spec addition composed
// from the section 8 card grammar). In free roam this renders children
// untouched.
import type { ReactNode } from "react";
import type { AppLanguage } from "@svika/shared";
import { resolveStoryParams } from "@/lib/stories";
import { t } from "@/lib/i18n";
import { StoryBar } from "./StoryBar";
import { StoryAnimation } from "./StoryAnimation";

interface StoryStageProps {
  params: Record<string, string | string[] | undefined>;
  lang: AppLanguage;
  children: ReactNode;
}

export function StoryStage({ params, lang, children }: StoryStageProps) {
  const active = resolveStoryParams(params);
  if (!active) return <>{children}</>;

  const preview = active.current.preview;

  return (
    <div className="story-stage" data-testid="story-stage">
      <div className="story-stage-screen">
        {preview ? (
          <div className="story-stage-preview" data-testid="story-preview">
            <span
              className="story-preview-badge svika-meta"
              data-testid="story-preview-badge"
            >
              {t(lang, "story.preview")}
            </span>
            <StoryAnimation beat={preview} lang={lang} />
          </div>
        ) : (
          <div
            className="story-stage-lock"
            inert={!active.isLast}
            data-testid="story-lock"
            data-live={active.isLast ? "true" : "false"}
          >
            {children}
          </div>
        )}
      </div>
      <div className="story-stage-side">
        <StoryBar params={params} lang={lang} />
      </div>
    </div>
  );
}
