// No dead ends anywhere: every step of every story and every vision scene
// carries a visible exit that lands back on the shelf, and browser back
// never traps. Steps are directly addressable once the persona is signed in
// (rendering a step never runs an action; actions only gate advancement),
// so the matrix walks each story once and clicks exit at every step without
// re-running money writes.
import { test, expect, type Page } from "@playwright/test";
import { STORIES, SHARE_PATH_SENTINEL, storyUrl } from "../src/lib/stories";

async function landingReady(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

async function assertExitLandsOnShelf(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const exit = page.getByTestId("story-exit");
  await expect(exit).toBeVisible();
  await exit.click();
  await page.waitForURL(/\/#shelf$/, { timeout: 20_000 });
  await expect(page.getByTestId("demo-door")).toBeVisible();
}

test.describe("no dead ends", () => {
  test("exit lands on the shelf from every step of every vision scene", async ({
    page,
  }) => {
    for (const story of Object.values(STORIES)) {
      if (story.persona !== "none") continue;
      for (let step = 0; step < story.steps.length; step++) {
        await assertExitLandsOnShelf(page, storyUrl(story.slug, step));
      }
    }
  });

  test("exit lands on the shelf from every step of every signed in story", async ({
    page,
  }) => {
    test.slow();
    for (const story of Object.values(STORIES)) {
      if (story.persona === "none") continue;
      // one real door entry per story: the persona and its reset are real
      await landingReady(page);
      await page.getByTestId(`story-door-${doorSuffix(story.slug)}`).click();
      await page.waitForURL(new RegExp(`story=${story.slug}&step=0`), {
        timeout: 25_000,
      });
      for (let step = 0; step < story.steps.length; step++) {
        // the share sentinel step only exists after its action ran; its exit
        // is covered by the stories spec walking the full Rudo run
        if (story.steps[step]!.path === SHARE_PATH_SENTINEL) continue;
        await assertExitLandsOnShelf(page, storyUrl(story.slug, step));
      }
    }
  });

  test("browser back from a story never traps", async ({ page }) => {
    await landingReady(page);
    await page.getByTestId("vision-door-gogo").click();
    await page.waitForURL(/story=gogo-ussd&step=0/, { timeout: 25_000 });
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=1/, { timeout: 25_000 });

    // back walks the steps down and out to the landing, no trap
    await page.goBack();
    await page.waitForURL(/step=0/, { timeout: 20_000 });
    await expect(page.getByTestId("story-bar")).toBeVisible();
    await page.goBack();
    await page.waitForURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByTestId("demo-door")).toBeVisible();
  });
});

/** The landing door testids abbreviate the slugs. */
function doorSuffix(slug: string): string {
  const suffix: Record<string, string> = {
    "tino-town": "town",
    "transfer-trip": "transfer",
    "takunda-morning": "takunda",
    "rudo-night": "rudo",
    "eta-knows": "eta",
    "watchdog-leak": "watchdog",
  };
  return suffix[slug] ?? slug;
}
