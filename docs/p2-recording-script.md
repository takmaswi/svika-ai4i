# P2 recording script: the airplane mode clip

One phone, one take. The clip shows a real Android in airplane mode clearing a fare, then the ledger catching up when signal returns. Read the whole script once before recording; the take itself is under two minutes.

## What you need

- Your Android phone with the Hwindi PWA installed (see setup below).
- A laptop (or second phone) signed in as the demo rider at the web app, plus one browser tab on the rider's wallet page.
- Both devices on camera at the start helps, but the phone is the star. Screen record the laptop separately if you want the reconciliation shot crisp.

## One-time setup (before the take, off camera)

1. Deploy the conductor build and open the URL in Chrome on the phone (see the deploy section of the P2 gate report for the two commands).
2. Sign in as `demo.conductor@svika.app`. Chrome will offer "Add Svika Hwindi to Home screen"; accept it. If it does not offer, use Chrome menu → Add to Home screen → Install.
3. Open the installed app once while online so the shell caches.
4. On the laptop, sign in to the web app as `demo.rider@svika.app`. Keep two tabs ready: the rider home (ticket list) and the wallet page.

## The take

**Step 1 — buy the ticket (laptop, ~15s).**
On the rider home, search Heights → UZ, choose the plan, pay **cash** (cash shows the change-to-credit magic later; wallet works too if you prefer). The new ticket lands on top of the list with a 4 digit code. Leave this tab open showing the ticket as `issued`. Say the code out loud or keep it visible.

**Step 2 — cache the route (phone, ~10s).**
Open Svika Hwindi from the home screen icon. If it is not already on the keypad, pick **HEIGHTS-REZENDE → Rezende Rank**. Tap the green **Online** pill once — this forces a fresh cache pull so the ticket you just bought is on the phone. Wait a beat.

**Step 3 — airplane mode, on camera (phone, ~10s).**
Swipe down and toggle **airplane mode ON** where the camera can see the icon. Back in the app, the pill flips to **Offline** (dark). If you want the stronger proof, kill the app and reopen it from the icon: it launches fully offline, straight back to your route.

**Step 4 — clear the fare offline (phone, ~15s).**
Type the 4 digit code on the keypad, tap **Tambira mari / Clear fare**. Full screen green **Yabhadharwa / Cleared** with the fare, plus the line "Saved offline. Syncs when signal returns." The pill reads **Offline · 1 to sync**.

**Step 5 — change to credit offline (phone, ~15s, cash tickets only).**
Tap **Chenji kuita kiredhiti / Change to credit**, leave fares covered at 1, tap the **$5** note. The confirmation shows the change amount and "Change saved. Credits when signal returns." Pill now reads **Offline · 2 to sync**.

**Step 6 — the server does not know yet (laptop, ~10s).**
Refresh the rider's ticket tab: still `issued`. Refresh the wallet: unchanged. Say it to camera: the phone has the money truth, the server does not, and nothing is lost.

**Step 7 — signal returns (phone, ~15s).**
Toggle **airplane mode OFF** on camera. The pill flips to **Online** and the queue count drains to zero on its own; if it lingers, tap the pill once to force the sync.

**Step 8 — the ledger catches up (laptop, ~20s).**
Refresh the rider tab: the ticket now reads `redeemed`. Refresh the wallet: the change credit has landed as USD balance. That is the whole promise in one shot — fare cleared with no network, money settled to the cent when the network came back.

## If something goes sideways

- **Pill stays Offline after airplane off:** give it five seconds, then tap the pill. Android sometimes delays the connectivity event.
- **"Wrong code" offline:** the cache was pulled before you bought the ticket. Go back online, tap the pill (fresh pull), start again from step 3.
- **"Too many tries":** more than 5 failed entries in 10 minutes locks the keypad (that is the product working). Run `pnpm db:seed` from the repo to reset the demo conductor's attempt log, wait a beat, retake.
- **Retakes:** each retake needs a fresh ticket (step 1). Everything else repeats cleanly; the seed keeps the rider funded.

## Optional second clip: the conflict (30s, needs the laptop)

1. Buy a ticket (laptop), force a cache pull (phone, tap pill), airplane ON.
2. Clear the code offline on the phone.
3. On the laptop, sign in as the conductor in another browser and clear the SAME code online (it succeeds — the phone is offline and silent).
4. Airplane OFF on the phone. The queued clear is refused: the server kept exactly one redemption, and the owner's watchdog gets an anomaly flag instead of the money moving twice.

This second clip is the "first sync wins" proof if the judges ask; the automated tests cover it either way (`packages/db/test/offline.sync.test.mjs` O4, `apps/web/e2e/offline.spec.ts` test 3).
