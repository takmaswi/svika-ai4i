"use client";

// The story's next button for steps that run a real engine action. It shows an
// honest pending state while the server action works (a real booking, or the
// live hwindi clear that touches the ledger and can take a second or two), so
// the judge sees the load instead of a frozen tap. View only steps keep the
// plain link button in StoryBar.
import { useFormStatus } from "react-dom";
import { ArrowIcon } from "@/components/icons";

interface StoryNextButtonProps {
  label: string;
  pendingLabel: string;
}

export function StoryNextButton({ label, pendingLabel }: StoryNextButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      className="cta touch-target story-bar-next"
      type="submit"
      data-testid="story-next"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
      <span className="cta-chip" aria-hidden>
        {pending ? <span className="story-spinner" /> : <ArrowIcon />}
      </span>
    </button>
  );
}
