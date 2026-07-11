// The intelligence shelf: the three spines shown with their evidence and
// not a word more. Door one walks the live map's arrival number to the
// committed metrics table; the numbers on screen must be the committed
// file's own, never retyped.
import { test, expect, type Page } from "@playwright/test";
import metrics from "../../../services/spine/metrics/metrics.json";

async function landingReady(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

test.describe("the intelligence doors", () => {
  test("the shelf carries the intelligence section between stories and visions", async ({
    page,
  }) => {
    await landingReady(page);
    await expect(
      page.getByText("The intelligence, three spines with their evidence"),
    ).toBeVisible();
    for (const door of ["eta", "takunda", "watchdog"]) {
      await expect(page.getByTestId(`story-door-${door}`)).toBeVisible();
    }
  });

  test("door one: the arrival number, its basis, then the honest ladder", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("story-door-eta").click();
    await page.waitForURL(/story=eta-knows&step=0/, { timeout: 25_000 });

    // step 0: the live map with the arrives number and its measured basis;
    // the spine serves in this environment, so a demo estimate label here
    // means the door is showing the wrong story and must fail
    await expect(page.getByTestId("peek-stats")).toBeVisible();
    const basis = page.getByTestId("eta-basis").first();
    await expect(basis).toBeVisible();
    await expect(basis).toContainText(/recorded ride/);

    // step 1: the ladder page; the table renders the committed file itself
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app\/intelligence.*step=1/, { timeout: 25_000 });
    const table = page.getByTestId("intelligence-metrics");
    await expect(table).toContainText(String(metrics.journeys));
    await expect(table).toContainText(`${metrics.baseline.maeSeconds} s`);
    await expect(table).toContainText(metrics.served);
    await expect(page.getByTestId("intelligence-verdict")).toBeVisible();

    // final step: unlocked, and the two doors stand
    await expect(page.getByTestId("story-live")).toBeVisible();
    await expect(page.getByTestId("story-lock")).toHaveAttribute("data-live", "true");
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app\/intelligence$/, { timeout: 20_000 });
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });

  test("door three: the watchdog catches the live injected leak", async ({
    page,
  }) => {
    test.slow();
    await landingReady(page);
    await page.getByTestId("story-door-watchdog").click();
    await page.waitForURL(/story=watchdog-leak&step=0/, { timeout: 25_000 });

    // the before state: entry reset the staged end day to its clean variant,
    // so the newest flagged day (if any) is older history
    const watchdog = page.getByTestId("owner-watchdog");
    await expect(watchdog).toBeVisible();
    await expect(watchdog).toContainText("Simulated history");

    // next explains the plant; the following next injects it live
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=1/, { timeout: 25_000 });
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=2/, { timeout: 25_000 });

    // the injected day is flagged by the forest with the threshold silent,
    // and the card says both verdicts on screen
    const verdicts = page.getByTestId("watchdog-verdicts").first();
    await expect(verdicts).toContainText("Forest flagged this day");
    await expect(verdicts).toContainText("threshold rule stayed silent");

    // the closing step: bilingual narrative, patterns never a person
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=3/, { timeout: 25_000 });
    const narrative = page.locator(".watchdog-narrative").first();
    await expect(narrative).toBeVisible();
    await expect(watchdog).toContainText("never a person");

    // final step: unlocked, the owner can flip the narrative to Shona
    await expect(page.getByTestId("story-live")).toBeVisible();
    await page.locator(".watchdog-lang button", { hasText: "Shona" }).click();
    await expect(narrative).not.toHaveText(/^$/);

    // stay and explore keeps the owner dashboard, chrome gone
    await page.getByTestId("story-next").click();
    await page.waitForURL(/\/app\/owner$/, { timeout: 20_000 });
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });
});
