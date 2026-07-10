// The bespoke Mbare Sun glyphs, lifted verbatim from the numbered reference
// screens. THE arrow and its mirrored back path (DESIGN.md §3) are the only
// arrow shapes allowed anywhere in the product.

interface IconProps {
  size?: number;
}

/** THE forward arrow (§3): CTA chips and the plan trip button. */
export function ArrowIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 10.1c0-.72.58-1.3 1.3-1.3H12V6.1c0-1.28 1.5-1.94 2.42-1.05l6.28 6.05c.6.58.6 1.54 0 2.12l-6.28 6.05C13.5 20.16 12 19.5 12 18.22V15.5H5.3A1.3 1.3 0 0 1 4 14.2z" />
    </svg>
  );
}

/** The mirrored back arrow (§3): only inside the 44px back button. */
export function BackIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 10.1c0-.72-.58-1.3-1.3-1.3H12V6.1c0-1.28-1.5-1.94-2.42-1.05L3.3 11.1c-.6.58-.6 1.54 0 2.12l6.28 6.05C10.5 20.16 12 19.5 12 18.22V15.5h6.7a1.3 1.3 0 0 0 1.3-1.3z" />
    </svg>
  );
}

/** Search magnifier from the reference sheet's search pill (screen 1). */
export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

/** Bottom nav home (screens 1, 2, 5): filled when active, stroke otherwise. */
export function HomeIcon({ active = false }: { active?: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

/** Bottom nav rides clock (screens 1, 2, 5). */
export function RidesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Bottom nav wallet: the outline card (§15 recommends outline everywhere). */
export function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M15 12.5h3" />
    </svg>
  );
}

/** Plus from the wallet top up chip (screen 5). */
export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Selection check from the route option card (screen 3). */
export function CheckIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/** The little kombi from the map marker placeholder (screens 1–3): used for
    fare rows so no arrow shape sneaks in beside THE arrow. */
export function KombiIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M2.4 15V9.6C2.4 8.4 3.2 7.5 4.4 7.3H15.4C16.8 7.3 18.1 7.9 19 8.9L20.9 10.9C21.4 11.4 21.7 12.1 21.7 12.8V15C21.7 15.6 21.3 16 20.7 16H3.4C2.8 16 2.4 15.6 2.4 15ZM4.8 9.1C4.4 9.1 4.2 9.4 4.2 9.7V11.6C4.2 12 4.5 12.2 4.8 12.2H13.3C13.7 12.2 13.9 12 13.9 11.6V9.7C13.9 9.4 13.7 9.1 13.3 9.1ZM15.7 9.2V11.6C15.7 12 15.9 12.2 16.3 12.2H19.9C20.3 12.2 20.5 11.8 20.2 11.5L18.8 10C18.1 9.3 17.2 9.2 16.3 9.2Z"
      />
      <circle cx="7" cy="16.4" r="2.5" />
      <circle cx="17" cy="16.4" r="2.5" />
    </svg>
  );
}
