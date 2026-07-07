// Theme cookie contract, shared by the server layout (stamps data-theme on
// <html> before first paint) and the client toggle. No cookie means follow
// the device via the prefers-color-scheme block in the design tokens.
export const THEME_COOKIE = "svika_theme";

export type AppTheme = "light" | "dark";

export function parseTheme(value: string | undefined): AppTheme | null {
  return value === "dark" || value === "light" ? value : null;
}
