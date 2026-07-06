# P0 gate report: foundations complete

Date: 6 July 2026. Scope: the rest of P0 on top of the database slice. The
monorepo workspaces, the security advisor cleanup, continuous integration, and
the phone authentication flow with seeded demo users. The database slice gate
report (docs/P0-DB-GATE-REPORT.md) still stands; this covers everything after it.

## What P0 now contains

- A pnpm monorepo with five workspaces: `apps/web` (Next.js rider, owner and
  landing), `apps/conductor` (offline first PWA for the hwindi), `services/spine`
  (the AI service), `packages/shared` (money, fares, roles, types) and
  `packages/db` (migrations, seed, security test). Plus `packages/ui`, the Brand
  v2 token package exported from the design system.
- One flat ESLint config across every workspace, Prettier, a shared TypeScript
  base config, and a committed, pinned lockfile.
- Continuous integration that runs typecheck, lint and unit tests on every push
  and pull request.
- A phone one time passcode login, session handling and a role aware app shell,
  with three seeded demo users for rehearsal.

## The security advisor fix

The instruction was to revoke execute on the two internal RLS helper functions,
`current_owner_id()` and `is_party_to_transaction()`, from the signed in and
anonymous roles. I applied that first and the security test caught a real
problem: revoking execute broke the `ledger_transactions` policy, because
Postgres evaluates a function referenced inside an RLS policy as the querying
role, so that role must hold execute on it. The revoke would also have broken the
owner fleet policies later. This confirmed the earlier database gate report was
right about the mechanism.

The correct fix, which is also what the Supabase advisor lists as a remedy, is to
move the helpers out of the REST exposed schema. Migration 0006 moves both into a
new `private` schema. They stay security definer (they exist to avoid RLS
recursion) and the signed in role keeps execute on them, so every policy still
works, but PostgREST cannot reach them at `/rest/v1/rpc/*` any more. Both helper
warnings clear.

Two advisor warnings remain on `purchase_ticket()` and `redeem_board_code()`, and
they stay on purpose. These are the only client write paths, so they must be
callable over REST, and they must be security definer because they write ledger
and ticket rows the caller has no direct grant on. Both derive the actor from
`auth.uid()` and raise `not authenticated` when it is null, so a caller can only
ever act as themselves. Wrapping them to silence the linter would add indirection
without adding safety, so I left them and documented why. One further advisor
item, leaked password protection, is a dashboard toggle for Mhofu to enable under
Auth settings; it is not reachable from the tooling here.

Advisor before: four security definer warnings plus the password item.
Advisor after: two intentional write path warnings plus the password item.

## Proof

### RLS security test, still green after the advisor fix

```
29 passed, 0 failed, 0 skipped
```

Run with the anon key only, after migration 0006. Full check list is in the
database gate report; the point here is that moving the helpers to `private`
changed nothing about isolation. Rider A still cannot read rider B's tickets,
wallet, board codes or events, and there is still no direct client write path
into money or history.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: install with a
frozen lockfile, then typecheck, lint and unit tests. Run locally with the exact
CI steps, all six workspaces are green:

- typecheck: passes in every workspace
- lint: eslint exits clean
- unit tests: 24 passing (shared 14, spine 5, conductor 3, web 2)
- `next build`: the web app compiles for production; routes are landing, login
  and the protected app shell, first load JS 110 to 149 kB per route

The GitHub Actions run link populates on the first push (the push needs write
credentials, so Mhofu runs it).

### Auth flow with a seeded user

`pnpm db:seed` created a rider, an owner and a conductor with roles and gave the
rider ten dollars of wallet credit. `pnpm auth:verify` then signed the demo rider
in with the anon key, the same key the browser has, and resolved the session and
role through RLS:

```
PASS  seeded demo user signed in
PASS  session resolves to the signed-in user
PASS  rider reads own profile under RLS
PASS  role resolved: rider

{ "signedIn": true, "phone": "+263770000001", "role": "rider" }
```

The product login is phone one time passcode, built in `LoginForm.tsx`
(`signInWithOtp` then `verifyOtp`). The proof above uses the demo user's email
and password because no SMS provider is wired yet, which keeps rehearsal and CI
independent of a live vendor, in line with the mock twin rule. The demo users
carry real phone numbers so the same screen switches to live passcodes once Mhofu
enables the phone provider and registers the demo numbers as test numbers.

## Honesty notes

- Auth: the phone passcode screen is real and wired to Supabase, tier 1. The live
  passcode path is tier 2 until an SMS provider or test numbers are configured;
  the password path proves session and role handling today.
- The conductor app, the spine service and the owner and rider surfaces beyond
  login are scaffolds. The conductor holds the offline queue logic with tests but
  not the real redemption keypad; that is P2. The spine ships the adapter and mock
  twin only; the trained models are P4.
- Demo commission is zero. Real conductor rates come from fieldwork, never
  invented here.
- Every rider facing string exists in English and Shona from the first commit. A
  parity test fails the build if any string is missing a translation.

## What Mhofu owes to close P0 fully

1. Push `main` so CI runs and the green badge and run link exist (write
   credentials needed; the push is a clean fast forward of every local commit).
2. Enable leaked password protection in the Supabase Auth dashboard.
3. When ready for live passcodes, enable the phone provider and add the three demo
   numbers as test numbers, or connect an SMS provider.

## Plain English summary

The foundation is now real, not just the database. There are five project areas
wired together, code checks that run automatically, and a working sign in. A
seeded demo rider can log in and the app correctly sees who they are and what they
are allowed to touch, all enforced by the database, not by trust. Along the way
the security cleanup you asked for turned out to break the very isolation it was
meant to tidy, so I did the safer version that hides those internal functions
from the public interface instead, and proved with the 29 check test that nothing
leaked. Two security notices remain and they are meant to: they are the only two
ways the app is allowed to move money and tickets, and both check who you are
before doing anything. To fully close P0 you push the branch so the automated
checks run in the cloud, flip one password safety switch in the dashboard, and
later turn on real SMS codes.
