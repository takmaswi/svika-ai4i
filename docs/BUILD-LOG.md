# BUILD-LOG

Append-only. One line per completed task: `<phase> | <task> | <commit> | <proof>`
P0 | scaffold: workspaces, CLAUDE.md, README pushed (CI held back, token lacks workflow scope) | 06d699a | repo live
P0 | supabase project svika created, eu-west-2 (closest consistent RTT to Harare, no African region offered) | 0f81225 | project ref xbsawnsdvibarhjobvrm ACTIVE_HEALTHY
P0 | core schema migrations 0001-0005: identity, network, ledger, tickets, hardening; RLS on every table at creation | 0eea247 | supabase migration history + advisor rerun clean of actionable items
P0 | RLS security test, 29 checks passing with anon key only (rider isolation, no money printing, append only history) | b9f6dda | test output in P0 gate report
P0 | generated TS types + env wiring (.env.local real values git ignored, .env.example documents every key) | a0adc0b | packages/db/src/database.types.ts
