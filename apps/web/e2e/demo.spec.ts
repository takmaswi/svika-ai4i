// The two door demo. The real phone sign in stays untouched; the landing
// demo door claims a pooled persona through the real backend (no E2E_AUTH
// endpoint involved), and story mode runs predefined actions through the
// real engine with the hwindi simulated and labelled. Every judge visit
// gets fresh demo state: the reset floats the wallet to exactly $5.00, so
// the change story lands on a deterministic $5.50.
import { test, expect } from "@playwright/test";

test.describe("demo door and story mode", () => {
  test("one tap in as a fresh Tariro, demo chip on and state reset", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("demo-door").click();
    await page.waitForURL("**/app", { timeout: 20_000 });

    // the demo chip rides every demo surface
    await expect(page.getByTestId("demo-account-chip")).toBeVisible();

    // fresh fixture state: the $5.00 float and the seeded Kutown quick pick
    await page.click(".home-sheet-grabber");
    await expect(page.locator(".wallet-strip .wallet-amount")).toHaveText("$5.00");
    await expect(page.locator(".home-pick", { hasText: "Kutown" })).toBeVisible();

    // the chip follows onto other demo surfaces
    await page.goto("/app/wallet");
    await expect(page.getByTestId("demo-account-chip")).toBeVisible();
  });

  test("story: Tariro's trip to town ends with change as credit", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("story-door-town").click();
    await page.waitForURL("**/app?story=tariro-town&step=0", { timeout: 20_000 });

    // walk the five steps: plan, book cash, boarding card, simulated hwindi
    // clears and keys the $2 note, wallet
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId("story-bar")).toBeVisible();
      await page.getByTestId("story-next").click();
    }

    // final step: the wallet, with the 50 cents of change credited on top
    // of the reset $5.00 float
    await page.waitForURL("**/app/wallet**", { timeout: 20_000 });
    await expect(page.getByTestId("wallet-balance")).toHaveText("$5.50");
    await expect(page.getByTestId("change-story")).toContainText("$0.50");

    // the story ends back in free roam
    await page.getByTestId("story-next").click();
    await page.waitForURL("**/app");
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });

  test("story: the transfer trip books both legs and returns to free roam", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("story-door-transfer").click();
    await page.waitForURL("**story=transfer-trip&step=0**", { timeout: 20_000 });

    // the plan on the map shows a walking leg between two ride legs
    await expect(page.locator(".plan-leg-kind")).toHaveCount(3);
    await expect(page.locator(".plan-leg-walk")).toHaveCount(1);

    await page.getByTestId("story-next").click(); // to the fare quote caption
    await page.getByTestId("story-next").click(); // books both legs (real engine)
    await page.waitForURL("**booked=1**", { timeout: 20_000 });

    // two live boarding codes, one per kombi, on top of the list
    const codes = page.locator(".ticket-item-code");
    await expect(codes.first()).not.toHaveText("····");
    await expect(codes.nth(1)).not.toHaveText("····");

    await page.getByTestId("story-next").click();
    await page.waitForURL("**/app");
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });
});
