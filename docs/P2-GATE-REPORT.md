# P2 gate report: offline boarding

Status: PASSED PENDING VIDEO (built and proven 2026-07-06). The offline →
redeem → reconnect → reconcile → conflict cycle is proven three independent
ways: a 34 check integration suite against the live database, unit tests of
the device engine, and a Playwright run that toggles the browser offline and
watches the ledger catch up. The named gate evidence, a single take video of
a real Android in airplane mode, is Mhofu's step; the recording script is
ready at docs/p2-recording-script.md. Two small inputs stay open below
(deploy login, CI secrets), both blocked on repo/hosting access only Mhofu
holds.

## What P2 delivered

The conductor PWA clears fares with no network and the money stays exact.

1. Local cache, hashes only: on sync the phone downloads the PENDING board
   codes for its route + direction as per ticket salted SHA-256 hashes
   (pull_offline_cache, migration 0014). A stolen phone holds no code list;
   matching an entered code costs the device one hash. Every pull is audit
   logged in cache_pulls.
2. Offline redeem: the keypad validates against the cache (window checked on
   a skew corrected clock), shows the same full screen verdicts, marks the
   code consumed on the device and queues an event. Failed entries rate
   limit locally, 5 per 10 minutes, mirroring the server.
3. Queued sync: on reconnect the queue replays in order through
   sync_offline_redemption / sync_offline_change_credit. Settlement runs
   through private.apply_redemption, the SAME function online redemption now
   uses, so the ledger rules cannot fork. Change to credit recorded offline
   lands in the rider's wallet after the fact.
4. Conflict rule, the crux: every event carries a client UUID and the server
   keeps a receipt per UUID. Replays return the receipt and move nothing.
   The same code from a second device resolves first sync wins; the loser
   gets already_redeemed and the owner gets an anomaly_flags row (pattern
   and ids, no person accused). anomaly_flags is live as of this phase,
   ready for Spine 3.
5. Clock discipline: the device clock is testimony, never authority. Future
   claims are clamped and flagged; claims must sit inside the code's
   validity window; syncs arriving over 72 hours after the code expired are
   refused with money untouched; anything claiming to be older than 7 days
   is refused as a stale replay.
6. Real PWA: workbox precaches the app shell (vite-plugin-pwa), the route
   list and the conductor's shift survive a cold start with no signal, and
   the app installs to the Android home screen.

## Why the cache is hashes, not encryption

Encrypting the cache with a key stored on the same phone is theatre: the key
ships with the ciphertext. The honest controls are (a) the plaintext codes
never reach the device at all, only per ticket salted hashes, (b) the cache
is scoped to one route + direction + validity window, (c) every pull is
audit logged against the conductor identity. The residual risk is stated
plainly in the register below: a 4 digit space is small, so any offline
verifiable form of it can be brute forced by the device holder. Offline
validation with human typeable codes cannot dodge that; the design bounds
the blast radius and makes abuse visible instead of pretending the phone is
a vault.

## Gate proofs at close

### Offline cycle vs the live database (34 checks)

`pnpm db:offline-test` — packages/db/test/offline.sync.test.mjs, run twice
back to back to prove rerun determinism:

```
O1 cache pull: hashes only, salted hash matches sha256(salt||code),
   fare/window carried, pull audit logged ................ 6 checks PASS
O2 offline redemption syncs, settles once, balanced double entry,
   event history records the offline claim ............... 6 checks PASS
O3 replayed event: same receipt, zero new postings,
   no second redeemed event .............................. 3 checks PASS
O4 second device same code: already_redeemed + owner scoped
   anomaly flag, still exactly one settlement ............ 4 checks PASS
O5 future claimed time: clamped, flagged, settles once ... 3 checks PASS
O6 stale replay: refused, money untouched ................ 2 checks PASS
O7 cash fare offline + change credit: rider credited exactly
   once across replay and a second device duplicate ...... 7 checks PASS
   attempt log dedupe + refuses client claimed success ... 2 checks PASS
O8 the whole ledger sums to zero ......................... 1 check  PASS

34 passed, 0 failed   (both consecutive runs)
```

### Device engine and sync rules (unit, runs in CI today)

`pnpm --filter conductor test` — 34 tests: hash vector, local verdicts
(success / wrong / already used / expired without an oracle), skew corrected
expiry both directions, local rate limiting, queue dedupe and ordering,
consumed marker surviving cache refreshes, flush stops on transport error,
mid flush drop keeps only the unsynced tail, rate_limited retries later.

### Playwright, browser genuinely offline

`apps/web/e2e/offline.spec.ts` — 3 tests green (and the full 19 test suite
green with them):

1. Airplane redeem then reconnect: verdict offline, server still shows
   issued, reconnect settles exactly one balanced transaction, event detail
   carries offline/claimed/synced.
2. Same code twice offline on one device: refused on the phone.
3. The conflict: offline clear, the same code cleared online elsewhere,
   reconnect; queued event refused, anomaly flag written, one settlement,
   one redeemed event.

### RLS and advisors

RLS suite 37/37 after migrations 0014-0016 (new tables anomaly_flags,
offline_sync_receipts, cache_pulls all carry RLS + append only triggers +
no client write path). Supabase security advisor: only the known
intentional class (security definer RPCs are the write paths) plus the
pre-existing leaked password protection notice.

### Security review (skill + subagent)

Three findings. Fixed in migration 0016 (applied): sync receipts are now
scoped to the calling conductor (a replayed foreign event id raises instead
of answering), and change credit rejections store a coarse fixed vocabulary
instead of raw sqlerrm. Kept as designed: per pull random salts (they
prevent joining two pulls into a rainbow table; consumed markers key on
ticket id, so determinism is not needed).

## Adversarial review, attack by attack

| Attack | What happens | Proof |
|---|---|---|
| Clock skew, device ahead | claim clamped to server now, info flag, settles once | O5 + engine unit tests |
| Clock skew, device behind | skew measured at sync corrects local expiry | engine unit tests |
| Code redeemed online while device offline | first sync wins; queued event refused, warning flag, one settlement | e2e test 3, O4 |
| Queue drops mid flush | acked events removed, tail stays queued, replay idempotent | syncFlow unit + O3 |
| Hours offline then reconnect | claims honoured inside the code window, 72h sync grace | O2/O5 design + O6 boundary |
| Replayed full queue | receipts return stored outcomes, zero money movement | O3, O7 |
| Brute force via sync RPC | same 5 per 10 min failure window as online, no receipt on rate_limited so legit retries survive | migration 0014, syncFlow unit |
| Forged claimed_at to mint money | claim must sit inside the code's real validity window; expired-forever codes refused; stale > 7 days refused | O6 |
| Client claims "success" in the attempt log | whitelist rejects it; only the server grants success | attempt log check |
| Phone stolen with cache | hashes only, one route + direction + window, pulls audit logged | O1 + design |

## Honesty register

- Tier 1, real: everything above. No mocks anywhere in the offline path;
  the proofs ran against the live Supabase project.
- Residual risk, stated: a conductor's device can brute force the 4 digit
  space against its own cached hashes (10,000 guesses is nothing). Accepted
  because conductors are enrolled, tied to an owner, commissioned on honest
  redemptions, every pull is logged, and a cracked-code redemption of a
  rider's live ticket surfaces as a conflict flag the moment the rider is
  refused. A human typeable offline code cannot beat device-holder brute
  force; we bound it and watch it instead.
- Residual risk, stated: a stolen, unsynced phone holds the plaintext codes
  of fares it already cleared (they are needed for sync). Replaying them
  yields already_redeemed once the victim's queue lands; if the thief's
  conductor account syncs first, the settlement is still the rider's real
  fare to the owner, and the victim's later sync raises the conflict flag.
- UX divergence, deliberate: a fresh cache drops spent codes, so entering a
  code redeemed before the last pull reads "Wrong code" offline where the
  server would say "Already used". No oracle, no money impact.
- Local rate limiting is slightly softer than the server's (lockout entries
  do not extend the local window). The server re-enforces at sync.
- The e2e "airplane mode" is Playwright's setOffline; the real phone video
  is Mhofu's take with the script provided.

## Open inputs (blocking the last two deliverables, not the build)

1. **Deploy login (5 minutes).** No hosting credential exists on this
   machine. Recommended: Cloudflare Pages, static upload of the already
   built bundle (env is inlined at build, nothing to configure):

   ```bash
   pnpm --filter conductor build
   npx wrangler login
   npx wrangler pages deploy "apps/conductor/dist" --project-name svika-hwindi
   ```

   The URL comes back as `https://svika-hwindi.pages.dev` (HTTPS, so the
   service worker and Add to Home screen work on Android). Vercel works
   too if preferred; say the word and it gets wired instead.

2. **CI secrets (5 minutes).** The `offline sync proof (live db)` job in
   ci.yml runs the 34 check suite on every push once these repo secrets
   exist (Settings → Secrets and variables → Actions, values from
   .env.local): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `TEST_RIDER_A_EMAIL`,
   `TEST_RIDER_A_PASSWORD`, `TEST_CONDUCTOR_EMAIL`,
   `TEST_CONDUCTOR_PASSWORD`. Until then the job reports itself skipped and
   the device side simulation still runs in the unit test job.

3. **The video.** docs/p2-recording-script.md, single take, under two
   minutes. Drop it in docs/p2-evidence/ and the gate closes fully.

## Plain English summary

The conductor's phone now works like a real hwindi's memory. While there is
signal, it quietly keeps a list of which tickets are waiting on its route,
but as locked fingerprints, never the actual codes. When the network dies,
the keypad keeps working: the rider says the 4 digit code, the phone checks
it against the fingerprints, shows the big green Cleared screen, and writes
an IOU in its notebook. Change on a cash note gets the same treatment. The
moment signal comes back, the notebook replays to the server one line at a
time, the rider's ticket flips to redeemed, the change lands in their
wallet, and the money books balance to the cent. If two phones try to clear
the same code while offline, whoever reaches the server first wins; the
second attempt bounces off and the owner gets a quiet flag saying "this
pattern needs a look", with nobody accused by name. Every trick we could
think of, fake clocks, replayed queues, half finished syncs, stolen phones,
was tried against it and the money never moved twice. What is left for you:
one login so the app gets a public address for your phone, seven secrets
pasted into GitHub so the proof runs on every push, and the airplane mode
video, script ready.
