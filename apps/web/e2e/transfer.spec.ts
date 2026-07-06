// Flow 5: transfer and claim. The rider sends credit (escrowed under a claim
// code shown in their wallet), a second person claims it into their own
// wallet. Wrong codes never pay out and the money is conserved end to end.
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function client(who: "RIDER" | "OWNER"): Promise<SupabaseClient> {
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

async function balance(c: SupabaseClient): Promise<number> {
  const { data } = await c
    .from("account_balances")
    .select("balance_cents")
    .eq("kind", "rider_wallet")
    .single();
  return data!.balance_cents as number;
}

async function loginViaApp(page: Page, who: "RIDER" | "OWNER"): Promise<void> {
  const res = await page.request.post("/e2e/login", {
    data: {
      email: process.env[`DEMO_${who}_EMAIL`]!,
      password: process.env[`DEMO_${who}_PASSWORD`]!,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test("send $1.00, the other rider claims it, money is conserved", async ({
  page,
  browser,
}) => {
  const sender = await client("RIDER");
  const receiver = await client("OWNER"); // the demo owner also has a rider wallet
  const senderBefore = await balance(sender);
  const receiverBefore = await balance(receiver);

  // sender: wallet page → send $1.00 → claim code appears in the open list
  await loginViaApp(page, "RIDER");
  await page.goto("/app/wallet");
  await page.fill("input[name=amount]", "1.00");
  await page
    .locator("form", { has: page.locator("input[name=amount]") })
    .locator("button[type=submit]")
    .click();
  await page.waitForURL("**/app/wallet?sent=1");
  const claimCode = (await page.getByTestId("claim-code").first().innerText()).trim();
  expect(claimCode).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

  expect(await balance(sender)).toBe(senderBefore - 100);

  // receiver: their own session claims the code
  const ctx = await browser.newContext();
  const page2 = await ctx.newPage();
  await loginViaApp(page2, "OWNER");
  await page2.goto("http://localhost:3000/app/wallet");
  await page2.fill("input[name=code]", claimCode);
  await page2
    .locator("form", { has: page2.locator("input[name=code]") })
    .locator("button[type=submit]")
    .click();
  await page2.waitForURL("**/app/wallet?claim=success");
  await expect(page2.getByTestId("claim-result")).toBeVisible();

  expect(await balance(receiver)).toBe(receiverBefore + 100);

  // the same code cannot be claimed twice
  await page2.fill("input[name=code]", claimCode);
  await page2
    .locator("form", { has: page2.locator("input[name=code]") })
    .locator("button[type=submit]")
    .click();
  await page2.waitForURL("**/app/wallet?claim=already_claimed");
  expect(await balance(receiver)).toBe(receiverBefore + 100);
  await ctx.close();
});

test("a wrong claim code pays nothing", async ({ page }) => {
  const rider = await client("RIDER");
  const before = await balance(rider);

  await loginViaApp(page, "RIDER");
  await page.goto("/app/wallet");
  await page.fill("input[name=code]", "222222");
  await page
    .locator("form", { has: page.locator("input[name=code]") })
    .locator("button[type=submit]")
    .click();
  await page.waitForURL("**/app/wallet?claim=invalid_code");
  expect(await balance(rider)).toBe(before);
});
