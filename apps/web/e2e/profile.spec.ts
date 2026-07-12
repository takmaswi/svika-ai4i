// The profile page: identity edits, prefs on the language chip grammar, and
// the consent gated emergency details. The last test proves the emergency
// consent stream never moves the app gate: removing details (which records
// an emergency withdrawal) must leave the app open.
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

test.describe("profile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("opens from the home sheet and saves a name", async ({ page }) => {
    await page.goto("/app?sheet=open");
    await waitForHydration(page);
    await page.getByTestId("profile-link").click();
    // the profile page derives ride stats server side; on a loaded dev server
    // with a heavily reused pool persona the RSC nav can commit past the 5s
    // default, so give the URL room
    await expect(page).toHaveURL(/\/app\/profile/, { timeout: 20_000 });

    await page.fill("#full_name", "Tatenda Demo");
    await page
      .locator('[data-testid="profile-identity"] button[type="submit"]')
      .click();
    await expect(page.getByTestId("identity-saved")).toBeVisible();
    await expect(page.locator("#full_name")).toHaveValue("Tatenda Demo");
  });

  test("commute alerts pref persists", async ({ page }) => {
    await page.goto("/app/profile");
    const toggle = page.getByTestId("pref-commute_alerts");
    await toggle.locator('button[value="on"]').click();
    await expect(toggle.locator('button[value="on"]')).toHaveClass(/lang-on/);

    await page.reload();
    await expect(
      page.getByTestId("pref-commute_alerts").locator('button[value="on"]'),
    ).toHaveClass(/lang-on/);
  });

  test("the You tab and the map profile chip both open the profile", async ({
    page,
  }) => {
    await page.goto("/app");
    await waitForHydration(page);

    await page.getByTestId("you-tab").click();
    await expect(page).toHaveURL(/\/app\/profile/);

    await page.goto("/app");
    await waitForHydration(page);
    await page.getByTestId("profile-chip").click();
    await expect(page).toHaveURL(/\/app\/profile/);
  });

  test("the welcome header shows greeting, name, avatar and stats, with Settings below", async ({
    page,
  }) => {
    await page.goto("/app/profile");

    const welcome = page.getByTestId("profile-welcome");
    await expect(welcome).toBeVisible();
    await expect(welcome.locator(".welcome-greeting")).not.toBeEmpty();
    await expect(page.getByTestId("welcome-name")).not.toBeEmpty();
    await expect(page.getByTestId("profile-avatar")).toBeVisible();
    await expect(page.getByTestId("profile-rides")).toBeVisible();

    // every control lives under one Settings group, below the welcome
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByTestId("profile-identity")).toBeVisible();
    await expect(page.getByTestId("profile-appearance")).toBeVisible();
  });

  test("the greeting speaks Shona when the language is Shona", async ({ page }) => {
    await page.goto("/app/profile");
    await page.evaluate(() => {
      document.cookie = "svika_lang=sn; path=/; max-age=3600";
    });
    await page.reload();
    await expect(
      page.getByTestId("profile-welcome").locator(".welcome-greeting"),
    ).toHaveText(/Mangwanani|Masikati|Manheru/);
  });

  test("emergency details need the consent tick, save, then remove without closing the app", async ({
    page,
  }) => {
    await page.goto("/app/profile");

    // consent unticked: native required blocks the submit, nothing saves
    await page.fill("#kin_name", "Amai Rudo");
    await page.getByTestId("emergency-save").click();
    await expect(page.getByTestId("emergency-details")).toHaveCount(0);

    // ticked: the RPC stores details and the page shows them
    await page.getByTestId("emergency-consent").check();
    await page.fill("#kin_phone", "+263 77 234 5678");
    await page.fill("#aid_name", "PSMAS");
    await page.getByTestId("emergency-save").click();
    await expect(page.getByTestId("emergency-saved")).toBeVisible();
    await expect(page.getByTestId("emergency-details")).toContainText("Amai Rudo");
    await expect(page.getByTestId("emergency-details")).toContainText("PSMAS");

    // remove: details gone, withdrawal noted
    await page.getByTestId("emergency-remove").click();
    await expect(page.getByTestId("emergency-removed")).toBeVisible();
    await expect(page.getByTestId("emergency-details")).toHaveCount(0);

    // the emergency withdrawal must not close the app consent gate
    await page.goto("/app");
    await expect(page).not.toHaveURL(/\/consent/);
    await expect(page.getByTestId("home-sheet")).toBeVisible();
  });
});
