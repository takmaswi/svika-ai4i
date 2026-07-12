import { YouIcon } from "@/components/icons";

// The rider's bespoke initial avatar: a marigold rounded square with the char
// initial, the §7 chip pairing (char on marigold, correct in both themes). It
// extracts the route badge grammar (screen 3). With no name it shows the you
// glyph so the avatar is never empty. Flagged as a spec gap proposal.
interface InitialAvatarProps {
  name: string | null | undefined;
  size?: "chip" | "lg";
}

function initialOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().charAt(0);
  return first ? first.toUpperCase() : "";
}

export function InitialAvatar({ name, size = "lg" }: InitialAvatarProps) {
  const initial = initialOf(name);
  return (
    <span
      className={`svika-avatar svika-avatar-${size}`}
      data-testid="profile-avatar"
      aria-hidden
    >
      {initial ? initial : <YouIcon />}
    </span>
  );
}
