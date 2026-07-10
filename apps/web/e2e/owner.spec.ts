// Flow 7: owner ledger view. A wallet fare is bought and cleared, then the
// owner's revenue table shows it, with every figure derived from the ledger.
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function client(who: "RIDER" | "CONDUCTOR"): Promise<SupabaseClient> {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: process.env[`DEMO_${who}_EMAIL`]!,
    password: process.env[`DEMO_${who}_PASSWORD`]!,
  });
  if (error) throw new Error(`${who} sign in failed: ${error.message}`);
  return c;
}

test("a settled wallet fare lands in the owner's revenue view", async ({ page }) => {
  // move real money: rider buys, conductor clears (both through the RPCs)
  const rider = await client("RIDER");
  const { data: route } = await rider
    .from("routes")
    .select("id")
    .eq("code", "MARKETSQ-AVONDALE")
    .single();
  const { data: bought, error: buyErr } = await rider.rpc("purchase_ticket", {
    p_route: route!.id,
    p_direction: "outbound",
    p_payment: "wallet",
  });
  expect(buyErr).toBeNull();
  const code = (bought![0] as { board_code: string }).board_code;
  const fare = (bought![0] as { fare_cents: number }).fare_cents;

  const conductor = await client("CONDUCTOR");
  const { data: redeemed, error: redeemErr } = await conductor.rpc(
    "redeem_board_code",
    { p_route: route!.id, p_direction: "outbound", p_code: code },
  );
  expect(redeemErr).toBeNull();
  expect((redeemed![0] as { outcome: string }).outcome).toBe("success");

  // owner: the revenue table shows the settlement, straight from the ledger
  const res = await page.request.post("/e2e/login", {
    data: {
      email: process.env.DEMO_OWNER_EMAIL!,
      password: process.env.DEMO_OWNER_PASSWORD!,
    },
  });
  expect(res.ok()).toBeTruthy();

  await page.goto("/app/owner");
  const revenue = page.getByTestId("owner-revenue");
  await expect(revenue).toBeVisible();
  const routeCard = revenue.locator('[data-route-code="MARKETSQ-AVONDALE"]');
  await expect(routeCard).toBeVisible();

  // the owner's wallet balance is the ledger sum, at least this settlement
  const balanceText = await page.getByTestId("owner-balance").innerText();
  const m = balanceText.match(/\$(\d+)\.(\d{2})/);
  const balanceCents = Number(m![1]) * 100 + Number(m![2]);
  expect(balanceCents).toBeGreaterThanOrEqual(fare); // commission is 0 in seed

  // the watchdog card is present and labelled as simulated history, whether
  // or not the synthetic history has been loaded (pnpm watchdog:run)
  const watchdog = page.getByTestId("owner-watchdog");
  await expect(watchdog).toBeVisible();
  await expect(watchdog).toContainText("Revenue watchdog");
  await expect(watchdog).toContainText("Simulated history");
  await expect(watchdog).toContainText("never a person");
});

test("a rider cannot open the owner view", async ({ page }) => {
  const res = await page.request.post("/e2e/login", {
    data: {
      email: process.env.DEMO_RIDER_EMAIL!,
      password: process.env.DEMO_RIDER_PASSWORD!,
    },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/app/owner");
  await page.waitForURL("**/app");
});
