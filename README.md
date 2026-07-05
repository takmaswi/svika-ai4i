<div align="center">

# Svika

**Digital tickets, real revenue, same kombi.**

Digital ticketing and trip intelligence for Harare's informal kombi network.
Rebuild for the POTRAZ AI for Impact Challenge 2026, Track 3 (Development).

</div>

## Status

P0 (Foundations) in progress. This repo is the production rebuild of the
[GDG Harare Build with AI 2026 winning prototype](https://github.com/takmaswi/Svika),
restarted clean to carry real security (RLS everywhere), a double entry money
ledger, event sourced tickets, and a server side AI spine.

## Honesty tiers

Every feature in this repo is labelled in the feature matrix (coming with P1):
Tier 1 real and working · Tier 2 clickable with fixed backend · Tier 3 slides only, never in code.

## Workspace layout

```
apps/web         rider app, owner dashboard, landing (Next.js)
apps/conductor   offline first conductor PWA
services/spine   AI service: ETA, commute alerts, revenue anomaly
packages/shared  types, fare and ledger logic (unit tested)
packages/db      migrations, seed, RLS security tests
```

## Working rules

See [CLAUDE.md](./CLAUDE.md). Short version: phases with gates, tests ship with
features, RLS on every table, money is an append only ledger, no forced AI.
