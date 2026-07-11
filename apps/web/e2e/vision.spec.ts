// Phase D vision scenes: public simulations of what ships next. Nothing here
// signs in and nothing writes; the gate assertion is honesty itself, the
// permanent Simulation stamp on every scene in both themes, and the sandbox
// shelf splitting real money stories from stamped simulations in one glance.
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

const SCENES = [
  { name: "tinashe", url: "/vision/tinashe?view=alert&story=tinashe-crash&step=0" },
  { name: "gogo", url: "/vision/gogo?story=gogo-ussd&step=0" },
  { name: "capacity", url: "/vision/capacity?story=kombi-capacity&step=0" },
] as const;

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.context().addCookies([{ name: "svika_theme", value: theme, url: BASE }]);
}

async function nextStep(page: Page, expected: RegExp): Promise<void> {
  await page.getByTestId("story-next").click();
  await page.waitForURL(expected, { timeout: 25_000 });
}

test.describe("vision scenes", () => {
  test("the sandbox shelf splits real stories from vision scenes", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Real stories, real money on the live system"),
    ).toBeVisible();
    await expect(
      page.getByText("Vision scenes, simulations of what ships next"),
    ).toBeVisible();
    for (const slug of ["town", "transfer", "takunda", "rudo"]) {
      await expect(page.getByTestId(`story-door-${slug}`)).toBeVisible();
    }
    for (const scene of SCENES) {
      await expect(page.getByTestId(`vision-door-${scene.name}`)).toBeVisible();
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`every vision scene wears the Simulation stamp in ${theme} theme`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      for (const scene of SCENES) {
        await page.goto(scene.url);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByTestId("sim-stamp")).toBeVisible();
        await expect(page.getByTestId("story-bar")).toBeVisible();
      }
    });
  }

  test("Tinashe's crash flow stays stamped through every step and exits to the landing", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("vision-door-tinashe").click();
    await page.waitForURL(/story=tinashe-crash&step=0/, { timeout: 25_000 });
    await expect(page.getByTestId("vision-tinashe")).toHaveAttribute(
      "data-view",
      "alert",
    );
    await expect(page.getByTestId("sim-stamp")).toBeVisible();

    // his mother's phone gets the auto message with the live location link
    await nextStep(page, /view=kin.*step=1/);
    await expect(page.getByTestId("sim-stamp")).toBeVisible();
    await expect(page.locator(".vision-sms-link")).toContainText("svika.app");

    // the responder view shows the Phase C profile fields, demo persona data
    await nextStep(page, /view=responder.*step=2/);
    await expect(page.getByTestId("sim-stamp")).toBeVisible();
    const details = page.getByTestId("vision-responder-details");
    await expect(details).toContainText("Amai Moyo");
    await expect(details).toContainText("PSMAS");

    // the closing caption unlocks the scene; the shelf door lands back on
    // the landing shelf, never the app
    await nextStep(page, /step=3/);
    await expect(page.getByTestId("sim-stamp")).toBeVisible();
    await expect(page.getByTestId("story-live")).toBeVisible();
    await page.getByTestId("story-shelf").click();
    await page.waitForURL(/\/#shelf$/);
    await expect(page.getByTestId("story-bar")).toHaveCount(0);
  });

  test("Gogo's mbudzi runs the real menu machine from the keypad", async ({
    page,
  }) => {
    // the keypad is watch only until the story's final step unlocks it
    await page.goto("/vision/gogo?story=gogo-ussd&step=0");
    await expect(page.getByTestId("story-lock")).toHaveAttribute("data-live", "false");
    await page.getByTestId("story-next").click();
    await page.waitForURL(/step=1/, { timeout: 25_000 });
    await expect(page.getByTestId("story-lock")).toHaveAttribute("data-live", "true");
    await expect(page.getByTestId("sim-stamp")).toBeVisible();
    const screen = page.getByTestId("phone-screen");

    const dial = async () => {
      for (const key of ["star", "1", "2", "3", "hash"]) {
        await page.getByTestId(`phone-key-${key}`).click();
      }
      await page.getByTestId("phone-ok").click();
      await expect(screen).toContainText("Svika");
    };

    // dial *123#: the main menu answers
    await dial();
    await expect(screen).toContainText("1.");

    // 1 reads her staged credit
    await page.getByTestId("phone-key-1").click();
    await page.getByTestId("phone-ok").click();
    await expect(screen).toContainText("$2.50");

    // dial again and ask how far the kombi is: the real eta wiring answers
    await dial();
    await page.getByTestId("phone-key-3").click();
    await page.getByTestId("phone-ok").click();
    await expect(screen).toContainText("min", { timeout: 15_000 });
  });

  test("the capacity scene holds declared against proven and badges the fleet", async ({
    page,
  }) => {
    await page.goto("/vision/capacity?story=kombi-capacity&step=0");
    await expect(page.getByTestId("sim-stamp")).toBeVisible();

    // the card: four kombis, declared and proven, drift named as a pattern
    const rows = page.getByTestId("capacity-rows");
    await expect(rows).toContainText("AEH 6647");
    await expect(rows).toContainText("ADT 8892");
    await expect(page.getByTestId("capacity-drift")).toContainText("pattern");

    // the map badges ride above the simulated kombis once they join
    await expect(page.getByTestId("capacity-badge").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("capacity-badge")).toHaveCount(4);
  });
});
