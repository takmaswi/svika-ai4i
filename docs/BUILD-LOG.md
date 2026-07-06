# BUILD-LOG

Append-only. One line per completed task: `<phase> | <task> | <commit> | <proof>`
P0 | scaffold: workspaces, CLAUDE.md, README pushed (CI held back, token lacks workflow scope) | 06d699a | repo live
P0 | supabase project svika created, eu-west-2 (closest consistent RTT to Harare, no African region offered) | 0f81225 | project ref xbsawnsdvibarhjobvrm ACTIVE_HEALTHY
P0 | core schema migrations 0001-0005: identity, network, ledger, tickets, hardening; RLS on every table at creation | 0eea247 | supabase migration history + advisor rerun clean of actionable items
P0 | RLS security test, 29 checks passing with anon key only (rider isolation, no money printing, append only history) | b9f6dda | test output in P0 gate report
P0 | generated TS types + env wiring (.env.local real values git ignored, .env.example documents every key) | a0adc0b | packages/db/src/database.types.ts
P0 | advisor fix: moved RLS helpers current_owner_id/is_party_to_transaction into non-exposed private schema (revoke alone broke RLS) | 4080c55 | 2 helper advisor warnings cleared, security test still 29/29
P0 | monorepo tooling: services/* workspace, flat ESLint, Prettier, root scripts, pinned lockfile | a115752 | pnpm install --frozen-lockfile clean
P0 | @svika/ui Brand v2 token package exported from the design system (Forest/Bone/Signal) | 3b73789 | apps link @svika/ui/styles.css |
P0 | @svika/shared money/fares/roles/types with unit tests | 203810b | 14 tests pass
P0 | services/spine AI scaffold: three spines behind adapter + mock twin, /health | 2fd5ee7 | 5 tests pass
P0 | apps/conductor offline-first PWA scaffold with queue logic | e11f5ad | 3 tests pass
P0 | apps/web Next.js shell: phone OTP auth, derived roles, session middleware, bilingual EN/SN | 96ae32e | next build passes, 2 i18n tests
P0 | idempotent demo seed: rider/owner/conductor with roles + $10 rider credit | 70b06bd | seed run created 3 users
P0 | auth flow proof: seeded demo user signs in via anon key, session + role resolve under RLS | 96ae32e | pnpm auth:verify 4/4 PASS, role=rider
P0 | CI workflow: typecheck/lint/test on push + PR | fe4c687 | green locally across 6 workspaces (24 tests)
