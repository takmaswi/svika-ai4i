// Flow: the live map on the rider home. The warm style loads, the corridor
// and its 15 real stops are on the map, and the simulated kombis move along
// the real road (declared as demo movement on screen and in the disclosure
// register). Movement is asserted in coordinates via marker data attributes;
// pixel positions round away at corridor zoom.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("live map", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("renders the corridor with moving, honest kombis", async ({ page }) => {
    await page.goto("/app");

    const map = page.getByTestId("live-map");
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-map-ready", "true", {
      timeout: 30_000,
    });

    // the movement is labelled as a demo right on the map
    await expect(page.getByTestId("demo-chip")).toBeVisible();

    // two simulated kombis ride the corridor
    const markers = page.locator('[data-testid="kombi-marker"]');
    await expect(markers).toHaveCount(2, { timeout: 15_000 });

    const first = markers.first();
    await expect(first).toHaveAttribute("data-lat", /.+/);
    const before = {
      lng: Number(await first.getAttribute("data-lng")),
      lat: Number(await first.getAttribute("data-lat")),
    };
    // at ~8 m/s the kombi covers ~33 m in 4 s: far beyond GPS jitter,
    // clearly visible in raw coordinates
    await page.waitForTimeout(4_000);
    const after = {
      lng: Number(await first.getAttribute("data-lng")),
      lat: Number(await first.getAttribute("data-lat")),
    };
    const movedDeg = Math.hypot(after.lng - before.lng, after.lat - before.lat);
    expect(movedDeg).toBeGreaterThan(0.0001); // ≈ 11 m or more

    // heading is a real compass bearing the marker can rotate to
    const heading = Number(await first.getAttribute("data-heading"));
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(360);
  });
});
