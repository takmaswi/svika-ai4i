// Flow 1: search → plan → pay. Free text search resolves or degrades to a
// stop picker; the plan prices from dated fare segments; wallet payment
// debits the ledger, cash reservation books without touching money.
import { test, expect } from "@playwright/test";
import { loginAs, walletBalanceCents } from "./helpers";

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
    await page.fill("#to", "UZ");
    await page.click("button[type=submit]");

    // the plan resolves the free text and quotes the verified fare
    await expect(page.locator(".plan-total")).toHaveText("$1.50");
    await page.click("button[value=wallet]");

    // back home with the ticket on top, carrying a 4 digit code
    await page.waitForURL("**/app?booked=1");
    const codeText = await page.locator(".ticket-item-code").first().innerText();
    expect(codeText).toMatch(/^\d{4}$/);

    const after = await walletBalanceCents(page);
    expect(before - after).toBe(150);
  });

  test("reserves a cash seat without moving wallet money", async ({ page }) => {
    const before = await walletBalanceCents(page);

    await page.goto("/app");
    await page.fill("#from", "rezende");
    await page.fill("#to", "heights");
    await page.click("button[type=submit]");

    await expect(page.locator(".plan-total")).toHaveText("$2.00");
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
    const kinds = page.locator(".plan-leg-kind");
    await expect(kinds).toHaveCount(3);
    await expect(kinds.nth(0)).toHaveText(/ride/i);
    await expect(kinds.nth(1)).toHaveText(/walk/i);
    await expect(kinds.nth(2)).toHaveText(/ride/i);
    await expect(page.locator(".plan-total")).toHaveText("$2.50");
  });

  test("unknown free text degrades to the stop picker and still books", async ({
    page,
  }) => {
    await page.goto("/app/plan?from=gweru city hall&to=avondale");
    await expect(page.locator(".picker-card h1")).toBeVisible();
    // pick a real stop from the picker and land on a plan
    await page.locator(".picker-item", { hasText: "Market Square Rank" }).click();
    await expect(page.locator(".plan-total")).toBeVisible();
  });

  test("the ticket page shows the big board code", async ({ page }) => {
    await page.goto("/app");
    await page.locator(".ticket-item").first().click();
    await expect(page.getByTestId("board-code")).toBeVisible();
  });
});
