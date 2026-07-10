// Flow: the live map on the rider home. The warm style loads, the corridor
// and its 15 real stops are on the map, and four simulated kombis replay the
// recorded field rides along the real road (declared as demo movement on
// screen and in the disclosure register). Movement is asserted in coordinates
// via marker data attributes; pixel positions round away at corridor zoom.
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

    // four simulated kombis ride the corridor, two per direction
    const markers = page.locator('[data-testid="kombi-marker"]');
    await expect(markers).toHaveCount(4, { timeout: 15_000 });

    const read = async () => {
      const out: { lng: number; lat: number; heading: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const el = markers.nth(i);
        await expect(el).toHaveAttribute("data-lat", /.+/);
        out.push({
          lng: Number(await el.getAttribute("data-lng")),
          lat: Number(await el.getAttribute("data-lat")),
          heading: Number(await el.getAttribute("data-heading")),
        });
      }
      return out;
    };

    const before = await read();
    // any one kombi may be genuinely dwelling at a rank or a recorded stop,
    // so movement is asserted across the fleet: in 6 s at the recorded pace
    // at least one kombi covers far more than GPS jitter
    await page.waitForTimeout(6_000);
    const after = await read();
    const moved = before.map((b, i) =>
      Math.hypot(after[i]!.lng - b.lng, after[i]!.lat - b.lat),
    );
    expect(Math.max(...moved)).toBeGreaterThan(0.0001); // ≈ 11 m or more

    // headings are real compass bearings the markers rotate to
    for (const m of after) {
      expect(m.heading).toBeGreaterThanOrEqual(0);
      expect(m.heading).toBeLessThan(360);
    }
  });
});
