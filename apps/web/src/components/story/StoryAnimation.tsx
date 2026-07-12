"use client";

// The simulated preview layer for a story beat: a clean, purpose built frame
// that shows the beat's motion on a 360px phone, with nothing waiting on the
// database, so it plays instantly. The stage always labels it a preview; the
// live tail that follows is the real proof. Motion is entrance only, and the
// wallet count up is skipped under reduced motion (the final figure shows at
// once). Scoped to the change into wallet story; extend the switch to add more.
import { useEffect, useRef, useState } from "react";
import type { AppLanguage } from "@svika/shared";
import type { StoryPreviewBeat } from "@/lib/stories";
// t comes from the pure dict module, not lib/i18n: i18n pulls in next/headers
// (getLang), which cannot be bundled into a client component.
import { t } from "@/lib/dict";
import { ArrowIcon } from "@/components/icons";

const SAMPLE_CODE = "4821";
const FLOAT_CENTS = 500;
const CHANGE_CENTS = 50;

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

interface StoryAnimationProps {
  beat: StoryPreviewBeat;
  lang: AppLanguage;
}

export function StoryAnimation({ beat, lang }: StoryAnimationProps) {
  return (
    <div className="story-animation" data-testid="story-animation" data-beat={beat}>
      {beat === "town-book" && <BookBeat lang={lang} />}
      {beat === "town-clear" && <ClearBeat lang={lang} />}
      {beat === "town-wallet" && <WalletBeat lang={lang} />}
    </div>
  );
}

function BookBeat({ lang }: { lang: AppLanguage }) {
  return (
    <div className="sa-card svk-rise">
      <p className="sa-route svika-mono-code">
        Heights <ArrowIcon size={16} /> Town
      </p>
      <p className="sa-fare svika-mono-code">$1.50</p>
      <div className="sa-code svk-rise sa-delay">
        <span className="sa-code-label svika-meta">{t(lang, "story.beatCode")}</span>
        <span className="sa-code-value svika-mono-code" data-testid="sa-code">
          {SAMPLE_CODE}
        </span>
      </div>
    </div>
  );
}

function ClearBeat({ lang }: { lang: AppLanguage }) {
  return (
    <div className="sa-card svk-rise">
      <span className="sa-hwindi svika-meta">HWINDI</span>
      <span
        className="sa-code-value sa-code-cleared svika-mono-code"
        data-testid="sa-code"
      >
        {SAMPLE_CODE}
      </span>
      <span className="sa-cleared svk-rise sa-delay">
        <span className="sa-check" aria-hidden>
          ✓
        </span>
        <span className="svika-meta">{t(lang, "story.beatCleared")}</span>
      </span>
    </div>
  );
}

function WalletBeat({ lang }: { lang: AppLanguage }) {
  const cents = useCountUp(FLOAT_CENTS, FLOAT_CENTS + CHANGE_CENTS);
  return (
    <div className="sa-card sa-wallet svk-rise">
      <span className="sa-change-chip svk-rise sa-delay svika-mono-code">
        +{money(CHANGE_CENTS)}
      </span>
      <span
        className="sa-wallet-amount svika-mono-code"
        data-testid="sa-wallet-amount"
      >
        {money(cents)}
      </span>
      <span className="sa-wallet-label svika-meta">
        {t(lang, "rider.walletBalance")}
      </span>
    </div>
  );
}

/** Counts from `from` to `to` over one short pass; jumps straight to `to` when
 *  reduced motion is asked for. */
function useCountUp(from: number, to: number): number {
  const [value, setValue] = useState(from);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const DURATION = 750;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / DURATION);
      setValue(Math.round(from + (to - from) * progress));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [from, to]);
  return value;
}
