// The two door demo. The real phone sign in stays untouched; the landing
// demo door claims a pooled persona through the real backend (no E2E_AUTH
// endpoint involved), and story mode runs predefined actions through the
// real engine with the hwindi simulated and labelled. Every judge visit
// gets fresh demo state: the reset floats the wallet to exactly $5.00, so
// the change story lands on a deterministic $5.50.
//
// URL waits use regexes: Playwright's URL globs do not reach into query
// strings, and the story chrome lives in query params.
import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

/** The landing page is a form too; do not race its hydration either. */
async function landingReady(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

test.describe("demo door and story mode", () => {
  test("one tap in as a fresh Tino, demo chip on and state reset", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("demo-door").click();
    await page.waitForURL(/\/app$/, { timeout: 20_000 });

    // the demo chip rides every demo surface
    await expect(page.getByTestId("demo-account-chip")).toBeVisible();

    // fresh fixture state: the $5.00 float and the seeded Kutown quick pick
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await expect(page.locator(".wallet-strip .wallet-amount")).toHaveText("$5.00");
    await expect(page.locator(".home-pick", { hasText: "Kutown" })).toBeVisible();

    // the chip follows onto other demo surfaces
    await page.goto("/app/wallet");
    await expect(page.getByTestId("demo-account-chip")).toBeVisible();

    // provenance at the point of use: the arrival basis label answers a tap
    // with the honest card saying where the number comes from
    await page.goto("/app");
    await waitForHydration(page);
    const basis = page.getByTestId("eta-basis").first();
    await expect(basis).toBeVisible();
    await basis.click();
    // the card lives in the one open dialog (every EtaBasis mounts one)
    const card = page.locator("dialog[open]").getByTestId("eta-basis-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/recorded|demo/i);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  // The flagship, two layers: three simulated preview beats (book code, hwindi
  // clear, change into wallet) then the real tail where the judge taps to book
  // and to clear on the live ledger, and the real wallet shows the credit. Run
  // in both languages and both themes so the layer holds either way.
  async function runFlagship(
    page: Page,
    opts: { lang: "en" | "sn"; theme: "light" | "dark" },
  ): Promise<void> {
    await page.context().addCookies([
      { name: "svika_lang", value: opts.lang, url: "http://localhost:3000" },
      { name: "svika_theme", value: opts.theme, url: "http://localhost:3000" },
    ]);
    await landingReady(page);
    await page.getByTestId("story-door-town").click();
    await page.waitForURL(/story=tino-town&step=0/, { timeout: 20_000 });

    // the staged theme and language both hold (the rename is in the URL above)
    await expect(page.locator("html")).toHaveAttribute("data-theme", opts.theme);
    await expect(page.locator(".story-bar-caption")).toContainText(
      opts.lang === "sn" ? "Muonero" : "Preview",
    );

    // layer one: three preview beats, each labelled a preview and animated,
    // none of them touching the database
    const beats = ["town-book", "town-clear", "town-wallet"];
    for (let i = 0; i < beats.length; i++) {
      await expect(page.getByTestId("story-preview-badge")).toBeVisible();
      await expect(page.getByTestId("story-animation")).toHaveAttribute(
        "data-beat",
        beats[i]!,
      );
      await page.getByTestId("story-next").click();
      await page.waitForURL(new RegExp(`step=${i + 1}`), { timeout: 20_000 });
    }

    // the switch: the preview is gone and the real app screen is under the lock
    await expect(page.getByTestId("story-animation")).toHaveCount(0);
    await expect(page.getByTestId("story-lock")).toBeVisible();

    // layer two, the real tail: tap to book the real cash trip through the
    // engine, then tap to let the simulated hwindi clear it on the live ledger
    await waitForHydration(page);
    await page.getByTestId("story-next").click();
    await page.waitForURL(/booked=1.*step=4/, { timeout: 20_000 });
    await expect(page.locator(".ticket-item-code").first()).not.toHaveText("····");

    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app\/wallet.*step=5/, { timeout: 20_000 });

    // the wallet actually updated on the real ledger: the reset floats it to
    // exactly $5.00 and the live clear adds 50 cents of change. The change
    // story card's lifetime figure grows with each reuse of a pooled persona
    // (money history is append only), so it is asserted present, not exact.
    await expect(page.getByTestId("wallet-balance")).toHaveText("$5.50");
    await expect(page.getByTestId("change-story")).toContainText(/\$\d+\.\d{2}/);

    // the final step unlocks the screen and offers the stay door: free roam on
    // the wallet, story chrome gone
    await expect(page.getByTestId("story-live")).toBeVisible();
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app\/wallet$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  }

  test("flagship: preview beats then the real tail, day and English", async ({
    page,
  }) => {
    await runFlagship(page, { lang: "en", theme: "light" });
  });

  test("flagship: the same two layers hold at night and in Shona", async ({
    page,
  }) => {
    await runFlagship(page, { lang: "sn", theme: "dark" });
  });

  test("story: the transfer trip books both legs and returns to free roam", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("story-door-transfer").click();
    await page.waitForURL(/story=transfer-trip&step=0/, { timeout: 20_000 });

    // the plan on the map shows a walking leg between two ride legs
    await expect(page.locator(".plan-leg")).toHaveCount(3);
    await expect(page.locator(".route-badge-soft")).toHaveCount(1);

    await waitForHydration(page);
    await page.getByTestId("story-next").click(); // to the fare quote caption
    await page.waitForURL(/step=1/, { timeout: 20_000 });
    await waitForHydration(page);
    await page.getByTestId("story-next").click(); // books both legs (real engine)
    await page.waitForURL(/booked=1/, { timeout: 20_000 });

    // two live boarding codes, one per kombi, on top of the list
    const codes = page.locator(".ticket-item-code");
    await expect(codes.first()).not.toHaveText("····");
    await expect(codes.nth(1)).not.toHaveText("····");

    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });

  test("mid story the screen is watch only; the final step unlocks it", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("story-door-transfer").click();
    await page.waitForURL(/story=transfer-trip&step=0/, { timeout: 20_000 });

    // the app surface under the story is inert: the plan page's pay buttons
    // exist but cannot be driven, so the script cannot be derailed
    await expect(page.getByTestId("story-lock")).toHaveAttribute("data-live", "false");
    const payCash = page.locator(".pay-cash");
    await expect(payCash).toBeVisible();
    let derailed = false;
    try {
      await payCash.click({ timeout: 1_500 });
      derailed = true;
    } catch {
      // unclickable is the point: inert strips hit testing
    }
    expect(derailed).toBe(false);

    // the story controls are the only live elements
    await waitForHydration(page);
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=1/, { timeout: 20_000 });
    await waitForHydration(page);
    await page.getByTestId("story-next").click();
    await page.waitForURL(/booked=1/, { timeout: 20_000 });

    // the final step says the screen is live and drops the lock: the booked
    // sheet arrives open, and the grabber now really responds to a tap
    await expect(page.getByTestId("story-live")).toBeVisible();
    await expect(page.getByTestId("story-lock")).toHaveAttribute("data-live", "true");
    await waitForHydration(page);
    const grabber = page.locator(".home-sheet-grabber");
    await expect(grabber).toHaveAttribute("aria-expanded", "true");
    await grabber.click();
    await expect(grabber).toHaveAttribute("aria-expanded", "false");

    // two doors: the shelf door lands back on the landing shelf
    await expect(page.getByTestId("story-next")).toBeVisible();
    await page.getByTestId("story-shelf").click();
    await page.waitForURL(/\/#shelf$/);
    await expect(page.getByTestId("story-door-transfer")).toBeVisible();
  });
});
