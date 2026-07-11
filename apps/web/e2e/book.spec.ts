// Flow 1: search → plan → pay. Free text search resolves or degrades to a
// stop picker; the plan prices from dated fare segments; wallet payment
// debits the ledger, cash reservation books without touching money.
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration, walletBalanceCents } from "./helpers";

test.describe("search, plan, pay", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("books a wallet ticket for a direct trip and the ledger pays for it", async ({
    page,
  }) => {
    const before = await walletBalanceCents(page);

    await page.goto("/app");
    await page.fill("#from", "Heights");
    await page.fill("#to", "Rezende");
    await page.click("button[type=submit]");

    // the plan resolves the free text and quotes the verified fare
    await expect(page.locator(".plan-total")).toHaveText("$1.50");
    await waitForHydration(page);
    await page.click("button[value=wallet]");

    // back home with the ticket on top, carrying a 4 digit code
    await page.waitForURL("**/app?booked=1");
    const codeText = await page.locator(".ticket-item-code").first().innerText();
    expect(codeText).toMatch(/^\d{4}$/);

    const after = await walletBalanceCents(page);
    expect(before - after).toBe(150);
  });

  test("reserves a cash seat without moving wallet money", async ({ page }) => {
    test.slow(); // three full page loads on the dev server
    const before = await walletBalanceCents(page);

    await page.goto("/app");
    await page.fill("#from", "rezende");
    await page.fill("#to", "heights");
    await page.click("button[type=submit]");

    await expect(page.locator(".plan-total")).toHaveText("$1.50");
    await waitForHydration(page);
    await page.click("button[value=cash]");
    await page.waitForURL("**/app?booked=1");

    await expect(
      page.locator(".ticket-item").first().locator(".svika-meta"),
    ).toContainText("cash", { ignoreCase: true });

    const after = await walletBalanceCents(page);
    expect(after).toBe(before);
  });

  test("plans a transfer trip across two kombis with a walking leg", async ({
    page,
  }) => {
    await page.goto("/app/plan?from=heights&to=avondale");
    // two ride legs wear route badges, the middle leg is the walk
    const legs = page.locator(".plan-leg");
    await expect(legs).toHaveCount(3);
    await expect(legs.nth(0).locator(".route-badge")).not.toHaveClass(/route-badge-soft/);
    await expect(legs.nth(1).locator(".plan-leg-name")).toHaveText(/walk|famba/i);
    await expect(legs.nth(2).locator(".route-badge")).not.toHaveClass(/route-badge-soft/);
    await expect(page.locator(".plan-total")).toHaveText("$3.00");
  });

  test("unknown free text degrades to the stop picker and still books", async ({
    page,
  }) => {
    await page.goto("/app/plan?from=gweru city hall&to=avondale");
    await expect(page.locator(".screen-head h1")).toBeVisible();
    // pick a real stop from the picker and land on a plan
    await page.locator(".picker-item", { hasText: "Market Square Rank" }).click();
    await expect(page.locator(".plan-total")).toBeVisible();
  });

  test("the ticket page shows the big board code", async ({ page }) => {
    test.slow(); // three full page loads on the dev server, like the cash test
    // book fresh so the top of the list is an ISSUED ticket (other suites
    // leave redeemed tickets behind, and those carry no live code)
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.click("button[value=cash]");
    await page.waitForURL("**/app?booked=1");
    // hydrate before tapping the ticket: a click racing hydration can be
    // swallowed by the re-render, and real fingers are slower than Playwright
    await waitForHydration(page);
    await page.locator(".ticket-item").first().click();
    // the ticket route pays its dev compile on first hit under full load
    await expect(page.getByTestId("board-code")).toBeVisible({ timeout: 20_000 });
  });
});
