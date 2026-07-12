// The Phase C stories, each from a fresh landing visit. Takunda's morning:
// the mined alert is live, he books from his quick pick, the simulated
// hwindi clears him, and the voice speaks as his stop nears (last stretch
// fast forwarded through the real trigger engine). Rudo's night ride, in
// night theme: a stolen wallet, a friend's real ledger transfer, a claim by
// code, a booking, and the mother's view, which is the share link itself.
import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

async function landingReady(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

async function nextStep(page: Page, expected: RegExp): Promise<void> {
  if (await page.getByTestId("home-sheet").count()) {
    await waitForHydration(page);
  }
  await page.getByTestId("story-next").click();
  await page.waitForURL(expected, { timeout: 25_000 });
}

test.describe("phase C stories", () => {
  test("Takunda's morning: alert, quick pick booking, voice as the stop nears", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await landingReady(page);
    await page.getByTestId("story-door-takunda").click();
    await page.waitForURL(/story=takunda-morning&step=0/, { timeout: 25_000 });

    // his commute alert is on screen with live minutes and a basis label
    const alert = page.getByTestId("commute-alert");
    await expect(alert).toBeVisible();
    await expect(alert.locator(".commute-alert-eta")).toContainText("min");

    // the sheet opens on his saved quick pick
    await nextStep(page, /step=1/);
    await expect(page.locator(".home-pick", { hasText: "Kubasa" })).toBeVisible();

    // next books from the wallet through the real engine. The booked home is
    // a heavy render (map, several live ETAs, status), so the ticket list can
    // take a few seconds to commit after the redirect; wait for it.
    await nextStep(page, /booked=1.*step=2/);
    await expect(page.locator(".ticket-item-code").first()).not.toHaveText("····", {
      timeout: 20_000,
    });

    // the simulated hwindi clears him; the voice step begins
    await nextStep(page, /voicedemo=1.*step=3/);

    // the voice guide speaks as his stop nears (fast forwarded ride)
    const caption = page.getByTestId("voice-caption");
    await expect(caption).toBeVisible({ timeout: 30_000 });
    await expect(caption).toHaveText("Your stop is coming up.");
    await expect(caption).toHaveText("This is your stop. Get off here.", {
      timeout: 60_000,
    });

    // the story ends back in free roam
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });

  test("Rudo's night ride: stolen wallet, a friend's credit, and the mother's view", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("story-door-rudo").click();
    await page.waitForURL(/story=rudo-night&step=0/, { timeout: 25_000 });

    // staged at night, wallet at zero
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForHydration(page);
    await expect(page.locator(".wallet-strip .wallet-amount")).toHaveText("$0.00");

    // to the wallet; the simulated friend sends real escrow
    await nextStep(page, /\/app\/wallet.*step=1/);
    await nextStep(page, /step=2/);

    // the claim lands exactly the friend's $2.00
    await nextStep(page, /step=3/);
    await expect(page.getByTestId("wallet-balance")).toHaveText("$2.00");

    // she books home from the claimed credit
    await nextStep(page, /booked=1.*step=4/);
    await expect(page.locator(".ticket-item-code").first()).not.toHaveText("····");

    // the hwindi clears her, then the share is minted
    await nextStep(page, /step=5/);
    await nextStep(page, /\/share\/[0-9a-f]{32}\?story=rudo-night&step=6/);

    // the mother's view: the live trip, on board, with the story caption
    await expect(page.getByTestId("share-view")).toBeVisible();
    await expect(page.getByTestId("share-status")).toHaveText("On board");
    await expect(page.getByTestId("story-bar")).toBeVisible();

    // the story ends back in free roam
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });
});
