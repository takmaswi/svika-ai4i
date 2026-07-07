// Flow: the day/night switch. Toggling stamps data-theme on <html> and the
// cookie keeps the choice across reloads and pages.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("day and night theme", () => {
  test("toggles to night and the choice survives a reload", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");

    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", "dark");

    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // other pages ride the same cookie
    await page.goto("/app/wallet");
    await expect(html).toHaveAttribute("data-theme", "dark");

    // and back to day
    await page.goto("/app");
    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });
});
