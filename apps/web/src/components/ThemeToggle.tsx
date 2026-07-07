"use client";

// Day/night switch. The chosen theme lands in a cookie so the server stamps
// data-theme on <html> before first paint (no flash); with no cookie the app
// follows the device through the prefers-color-scheme block in the tokens.
// Icons are the bespoke chunky set: the button shows where you are going,
// not where you are (moon in the day, sun at night).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { THEME_COOKIE, type AppTheme } from "@/lib/theme";

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4.6" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 2.6v2.2" />
        <path d="M12 19.2v2.2" />
        <path d="M2.6 12h2.2" />
        <path d="M19.2 12h2.2" />
        <path d="m5.1 5.1 1.6 1.6" />
        <path d="m17.3 17.3 1.6 1.6" />
        <path d="m18.9 5.1-1.6 1.6" />
        <path d="m6.7 17.3-1.6 1.6" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.2 14.4a8.6 8.6 0 0 1-10.6-10.6.9.9 0 0 0-1.2-1.1 9.8 9.8 0 1 0 12.9 12.9.9.9 0 0 0-1.1-1.2Z" />
    </svg>
  );
}

interface ThemeToggleProps {
  /** The cookie value the server rendered with, if any. */
  initialTheme: AppTheme | null;
  toDarkLabel: string;
  toLightLabel: string;
}

export function ThemeToggle({ initialTheme, toDarkLabel, toLightLabel }: ThemeToggleProps) {
  const router = useRouter();
  // Without a cookie the effective theme is the device's; that is only
  // knowable in the browser, so it settles after mount.
  const [theme, setTheme] = useState<AppTheme>(initialTheme ?? "light");

  useEffect(() => {
    if (initialTheme) return;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, [initialTheme]);

  function toggle() {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      className="theme-toggle touch-target"
      aria-label={theme === "dark" ? toLightLabel : toDarkLabel}
      data-testid="theme-toggle"
      onClick={toggle}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
