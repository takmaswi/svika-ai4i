// Flow: nickname a trip on the plan page, find it as a quick pick on the
// home map, tap it back into a plan. The quick pick carries a mock ETA that
// must always be labelled as a demo estimate (honesty tier 2, disclosure
// register entry).
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

test.describe("saved trips", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("saves a nicknamed trip and rides it from the home map", async ({ page }) => {
    await page.goto("/app/plan?from=heights&to=rezende");
    await expect(page.locator(".plan-total")).toHaveText("$1.50");

    // the save form lives in the expanded half of the plan sheet
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await page.fill("#nickname", "Town trip");
    await page.click(".plan-save-cta");
    await expect(page.getByTestId("trip-saved")).toBeVisible();

    // home: the sheet opens and the quick pick is there, demo label attached
    await page.goto("/app");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    const pick = page.locator(".home-pick", { hasText: "Town trip" });
    await expect(pick).toBeVisible();
    await expect(pick.locator(".home-pick-eta .svika-mono-code")).toContainText("min");
    await expect(pick.locator(".home-pick-demo")).toBeVisible();

    // tapping the pick's trip link lands straight on a priced plan (the eta
    // column beside it answers its own tap with the provenance card)
    await pick.locator(".home-pick-link").click();
    await expect(page.locator(".plan-total")).toHaveText("$1.50");
  });

  test("renaming the same stop pair keeps one quick pick", async ({ page }) => {
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await page.fill("#nickname", "Kumba");
    await page.click(".plan-save-cta");
    await expect(page.getByTestId("trip-saved")).toBeVisible();

    await page.goto("/app");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await expect(page.locator(".home-pick", { hasText: "Kumba" })).toHaveCount(1);
    await expect(page.locator(".home-pick", { hasText: "Town trip" })).toHaveCount(0);
  });
});
