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
  // Wait for the step's render to commit before deciding on hydration. The
  // booked home is a heavy render, so the story control can arrive a few
  // seconds after the URL settles; checking home-sheet too early skips the
  // hydration wait, and an action form that submits before hydration falls
  // back to a native POST that Next 15.1's no-JS action replay 500s.
  await page.getByTestId("story-next").waitFor({ state: "visible", timeout: 25_000 });
  if (await page.getByTestId("home-sheet").count()) {
    await waitForHydration(page);
  }
  await page.getByTestId("story-next").click();
  // resolve on navigation commit, not full load: the booked home and the
  // share map page are slow to fire load, and the caller's own assertions
  // wait for the content that matters
  await page.waitForURL(expected, { timeout: 25_000, waitUntil: "commit" });
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

  // Rudo's night ride, two layers, mirroring the flagship. Four simulated
  // preview beats (the stolen wallet filling to $2, boarding, the hwindi
  // clearing, the mother's live view opening) then the real tail where the
  // friend's escrow, the claim, the booking, the clear and the share all run
  // through the real ledger, ending on the real /share link. Night theme in
  // both languages, since Rudo is a night story.
  async function runRudo(page: Page, lang: "en" | "sn"): Promise<void> {
    // ten steps, each a heavy render; ~45s on fresh servers, so give a loaded
    // machine room rather than race it
    test.setTimeout(120_000);
    await page.context().addCookies([
      { name: "svika_lang", value: lang, url: "http://localhost:3000" },
      { name: "svika_theme", value: "dark", url: "http://localhost:3000" },
    ]);
    await landingReady(page);
    await page.getByTestId("story-door-rudo").click();
    await page.waitForURL(/story=rudo-night&step=0/, { timeout: 25_000 });

    // staged at night, in the chosen language
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".story-bar-caption")).toContainText(
      lang === "sn" ? "Muonero" : "Preview",
    );

    // layer one: four preview beats, each a labelled preview animation, none
    // touching the database. The first fills the stolen wallet to $2.00.
    const beats = ["night-wallet", "night-board", "night-clear", "night-share"];
    for (let i = 0; i < beats.length; i++) {
      await expect(page.getByTestId("story-preview-badge")).toBeVisible();
      await expect(page.getByTestId("story-animation")).toHaveAttribute(
        "data-beat",
        beats[i]!,
      );
      if (beats[i] === "night-wallet") {
        await expect(page.getByTestId("sa-wallet-amount")).toHaveText("$2.00", {
          timeout: 10_000,
        });
      }
      await page.getByTestId("story-next").click();
      await page.waitForURL(new RegExp(`step=${i + 1}`), { timeout: 20_000 });
    }

    // the switch: the preview is gone, the real screen is under the lock, and
    // the caption says to watch it happen for real
    await expect(page.getByTestId("story-animation")).toHaveCount(0);
    await expect(page.getByTestId("story-lock")).toBeVisible();
    await expect(page.locator(".story-bar-caption")).toContainText(
      lang === "sn" ? "zvichiitika chaizvo" : "watch it happen for real",
    );

    // layer two, the real tail: the simulated friend sends real escrow, the
    // claim lands exactly $2.00 on the live ledger
    await nextStep(page, /\/app\/wallet.*step=5/); // friend-sends
    await nextStep(page, /\/app\/wallet.*step=6/); // claim-friend-code
    await expect(page.getByTestId("wallet-balance")).toHaveText("$2.00", {
      timeout: 20_000,
    });

    // she books home from the claimed credit; a real board code appears
    await nextStep(page, /booked=1.*step=7/);
    await expect(page.locator(".ticket-item-code").first()).not.toHaveText("····", {
      timeout: 20_000,
    });

    // the simulated hwindi clears her, then the real share link is minted
    await nextStep(page, /booked=1.*step=8/);
    await nextStep(page, /\/share\/[0-9a-f]{32}\?story=rudo-night&step=9/);

    // the mother's view: the live trip on the real ledger, on board, story bar
    await expect(page.getByTestId("share-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("share-status")).toHaveText(
      lang === "sn" ? "Vari mukombi" : "On board",
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("story-bar")).toBeVisible();

    // the story ends back in free roam
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  }

  test("Rudo's night ride: preview beats then the real tail, night and English", async ({
    page,
  }) => {
    await runRudo(page, "en");
  });

  test("Rudo's night ride: the same two layers hold in Shona", async ({ page }) => {
    await runRudo(page, "sn");
  });
});
