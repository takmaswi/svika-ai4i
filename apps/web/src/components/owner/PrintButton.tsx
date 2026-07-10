"use client";

interface PrintButtonProps {
  label: string;
}

export function PrintButton({ label }: PrintButtonProps) {
  return (
    <button
      type="button"
      className="auth-submit touch-target no-print"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
