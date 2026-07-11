"use client";

// The tappable basis label under an arrival estimate. Tapping it opens a
// small honest card (section 8 card grammar over a char tinted scrim,
// flagged spec addition): where the number comes from, how many recorded
// rides sit behind it, what improves it. A native dialog carries it in the
// browser's top layer, because the label often lives inside the transformed
// bottom sheet where a fixed overlay would stack under the nav. Escape and
// a scrim tap both close it.
import { useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={`eta-basis${className ? ` ${className}` : ""}`}
        aria-haspopup="dialog"
        aria-label={card.aria}
        data-testid="eta-basis"
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className="eta-basis-dialog"
        aria-label={card.title}
        data-testid="eta-basis-dialog"
        onClick={(e) => {
          // a click on the backdrop targets the dialog element itself
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="eta-basis-card" data-testid="eta-basis-card">
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
            onClick={() => dialogRef.current?.close()}
          >
            {card.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
