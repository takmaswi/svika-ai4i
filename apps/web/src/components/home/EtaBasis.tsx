"use client";

// The tappable basis label under an arrival estimate. Tapping it opens a
// small honest card (section 8 card grammar over a char tinted scrim,
// flagged spec addition): where the number comes from, how many recorded
// rides sit behind it, what improves it. Escape and the scrim both close it.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { EtaBasisCard } from "@/lib/eta-provenance";

interface EtaBasisProps {
  label: string;
  card: EtaBasisCard;
  className?: string;
  moreHref?: string;
  moreLabel?: string;
}

export function EtaBasis({ label, card, className, moreHref, moreLabel }: EtaBasisProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`eta-basis${className ? ` ${className}` : ""}`}
        aria-haspopup="dialog"
        aria-label={card.aria}
        data-testid="eta-basis"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div
          className="eta-basis-scrim"
          onClick={() => setOpen(false)}
          data-testid="eta-basis-scrim"
        >
          <div
            className="eta-basis-card"
            role="dialog"
            aria-modal="true"
            aria-label={card.title}
            onClick={(e) => e.stopPropagation()}
            data-testid="eta-basis-card"
          >
            <h2 className="svika-title eta-basis-title">{card.title}</h2>
            {card.lines.map((line) => (
              <p key={line} className="svika-body eta-basis-line">
                {line}
              </p>
            ))}
            {moreHref && moreLabel && (
              <Link className="inline-link" href={moreHref}>
                {moreLabel}
              </Link>
            )}
            <button
              type="button"
              className="text-btn touch-target eta-basis-close"
              onClick={() => setOpen(false)}
            >
              {card.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
