"use client";
import { useState } from "react";

interface DeleteMyDataButtonProps {
  action: () => Promise<void>;
  ctaLabel: string;
  confirmLabel: string;
  cancelLabel: string;
}

// Two step delete: the first press only reveals the real button, so a fat
// finger cannot anonymise an account. No browser confirm dialogs.
export function DeleteMyDataButton({
  action,
  ctaLabel,
  confirmLabel,
  cancelLabel,
}: DeleteMyDataButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        className="delete-data-cta touch-target"
        type="button"
        data-testid="delete-data"
        onClick={() => setArmed(true)}
      >
        {ctaLabel}
      </button>
    );
  }

  return (
    <div className="delete-data-confirm">
      <form action={action}>
        <button
          className="delete-data-cta delete-data-armed touch-target"
          type="submit"
          data-testid="delete-data-confirm"
        >
          {confirmLabel}
        </button>
      </form>
      <button
        className="auth-link touch-target"
        type="button"
        onClick={() => setArmed(false)}
      >
        {cancelLabel}
      </button>
    </div>
  );
}
