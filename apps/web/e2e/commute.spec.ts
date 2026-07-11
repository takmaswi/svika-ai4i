// Spine 2 commute alerts: Takunda (seeded two week commute, pref on) gets
// the alert inside his usual window with live minutes and a basis label; a
// rider with no pattern and no pref never sees one.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

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

  test("a fresh rider never sees an alert", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");
    await expect(page.getByTestId("home-sheet")).toBeVisible();
    await expect(page.getByTestId("commute-alert")).toHaveCount(0);
  });
});
