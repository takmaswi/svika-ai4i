// Spine 2 commute alerts: Takunda (seeded two week commute, pref on) gets
// the alert with live minutes and a basis label; a rider with no pattern and
// no pref never sees one. Takunda is a demo persona, so the "is it the usual
// time" window is waived and the alert plays on any stage clock (see
// alertPattern); the CAT hour it runs at is annotated so the recording shows
// it was not the mined morning window.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

/** Harare (CAT, UTC+2) hour on the machine the server shares. */
function catHour(): number {
  return new Date(Date.now() + 2 * 60 * 60_000).getUTCHours();
}

const TAKUNDA_EMAIL = "demo.takunda@svika.app";

async function loginTakunda(page: Page): Promise<void> {
  const res = await page.request.post("/e2e/login", {
    data: { email: TAKUNDA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
  });
  expect(res.ok(), `Takunda login failed: ${res.status()}`).toBeTruthy();
}

test.describe("commute alerts", () => {
  test("Takunda gets his alert as the usual kombi approaches", async ({ page }) => {
    await loginTakunda(page);
    await page.goto("/app");
    const alert = page.getByTestId("commute-alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Your usual kombi is close");
    await expect(alert.locator(".commute-alert-eta")).toContainText("min");
    // honesty: the number always says what it stands on
    await expect(alert).toContainText(/demo estimate|recorded ride/);
  });

  test("the demo alert fires at any time of day, not just the morning window", async ({
    page,
  }, testInfo) => {
    const hour = catHour();
    const morning = hour >= 5 && hour < 9;
    testInfo.annotations.push({
      type: "stage clock (CAT)",
      description: `${String(hour).padStart(2, "0")}:xx — ${
        morning ? "inside" : "OUTSIDE"
      } the mined morning window`,
    });
    // whatever the wall clock, a demo persona shows the alert: the window
    // check is waived for the demo, the ETA and basis label stay real
    await loginTakunda(page);
    await page.goto("/app");
    const alert = page.getByTestId("commute-alert");
    await expect(alert).toBeVisible();
    await expect(alert.locator(".commute-alert-eta")).toContainText("min");
    await expect(alert).toContainText(/demo estimate|recorded ride/);
  });

  test("a fresh rider never sees an alert", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");
    await expect(page.getByTestId("home-sheet")).toBeVisible();
    await expect(page.getByTestId("commute-alert")).toHaveCount(0);
  });
});
