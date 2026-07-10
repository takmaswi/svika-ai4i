// Flow: the consent gate. A fresh user (created by the seed, consent wiped
// before every run) cannot reach booking or any /app surface until they
// accept; deleting their details on the your data page closes the gate again.
import { test, expect, type Page } from "@playwright/test";

function freshCreds(): { email: string; password: string } {
  const riderEmail = process.env.DEMO_RIDER_EMAIL!;
  const [local, domain] = riderEmail.split("@");
  return {
    email: `${local}+fresh@${domain}`,
    password: process.env.DEMO_RIDER_PASSWORD!,
  };
}

async function loginFresh(page: Page): Promise<void> {
  const res = await page.request.post("/e2e/login", { data: freshCreds() });
  expect(res.ok(), `fresh login failed: ${res.status()}`).toBeTruthy();
}

test("a fresh user cannot reach booking before consenting", async ({ page }) => {
  await loginFresh(page);

  // booking and home both bounce to the consent screen
  await page.goto("/app/plan?from=Heights&to=Rezende");
  await page.waitForURL("**/consent");
  await page.goto("/app");
  await page.waitForURL("**/consent");
  await expect(page.getByTestId("consent-accept")).toBeVisible();

  // accepting appends the consent record and opens the app
  await page.getByTestId("consent-accept").click();
  await page.waitForURL("**/app");
  await page.goto("/app/plan?from=Heights&to=Rezende");
  await expect(page).toHaveURL(/\/app\/plan/);
});

test("deleting your details closes the app behind the gate again", async ({ page }) => {
  await loginFresh(page);

  // reach the your data page, consenting first if this test runs alone
  await page.goto("/app/privacy");
  if (page.url().includes("/consent")) {
    await page.getByTestId("consent-accept").click();
    await page.waitForURL("**/app");
    await page.goto("/app/privacy");
  }
  await expect(page.getByTestId("your-data")).toBeVisible();

  // two step delete: arm, then confirm; the action signs the session out
  await page.getByTestId("delete-data").click();
  await page.getByTestId("delete-data-confirm").click();
  await page.waitForURL(/\/$/);

  // signing back in lands behind the gate: the withdrawal blocks the app
  await loginFresh(page);
  await page.goto("/app");
  await page.waitForURL("**/consent");
});
