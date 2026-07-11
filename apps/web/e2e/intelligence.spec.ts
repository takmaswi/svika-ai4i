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
    for (const door of ["eta", "takunda"]) {
      await expect(page.getByTestId(`story-door-${door}`)).toBeVisible();
    }
  });

  test("door one: the arrival number, its basis, then the honest ladder", async ({
    page,
  }) => {
    await landingReady(page);
    await page.getByTestId("story-door-eta").click();
    await page.waitForURL(/story=eta-knows&step=0/, { timeout: 25_000 });

    // step 0: the live map with the arrives number and its basis label
    await expect(page.getByTestId("peek-stats")).toBeVisible();
    await expect(page.getByTestId("eta-basis").first()).toBeVisible();

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
});
