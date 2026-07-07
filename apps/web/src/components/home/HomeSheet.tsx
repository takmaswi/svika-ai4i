"use client";

// The idle bottom sheet over the live map. Two resting states: peeking
// (map is the hero, search is at hand) and open (trips, wallet, tickets).
// The grabber and the title row both toggle it; motion is the brand's
// bottom-sheet spring and collapses to nothing under reduced motion.
import { useState, type ReactNode } from "react";

interface HomeSheetProps {
  openLabel: string;
  closeLabel: string;
  /** Open on arrival, e.g. right after a booking so the code is in view. */
  defaultOpen?: boolean;
  /** Always visible: title + search live here. */
  peek: ReactNode;
  /** Revealed when the sheet opens. */
  children: ReactNode;
}

export function HomeSheet({
  openLabel,
  closeLabel,
  defaultOpen = false,
  peek,
  children,
}: HomeSheetProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`home-sheet svika-glass-strong${open ? " home-sheet-open" : ""}`}
      data-testid="home-sheet"
    >
      <button
        type="button"
        className="home-sheet-grabber touch-target"
        aria-expanded={open}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="svika-sheet-handle" aria-hidden />
      </button>
      <div className="home-sheet-body">
        {peek}
        <div className="home-sheet-more" inert={!open}>
          {children}
        </div>
      </div>
    </section>
  );
}
