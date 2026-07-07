# Live map milestone evidence

Proof pack for the live map gate (2026-07-07).

## Recordings

| File | What it shows |
| --- | --- |
| `recordings/svika-live-map-demo.gif` | Real Chrome walkthrough: the warm map with two simulated kombis gliding along the real Heights to Rezende road, the sheet opening onto the saved "Town trip" quick pick with its labelled demo estimate, and the switch from night to day. |
| `recordings/map-e2e.webm` | Playwright run of `map.spec.ts`: map ready, demo chip visible, two kombis, movement proven in raw coordinates over 4 seconds. |
| `recordings/saved-trip-e2e.webm` | Playwright run of `saved-trip.spec.ts`: nickname a trip on the plan page, find it on the home map, tap it back into a priced plan. |
| `recordings/theme-e2e.webm` | Playwright run of `theme.spec.ts`: toggle to night, survive a reload, follow across pages, back to day. |

## Screenshots (360px reference device)

`evidence-home-light.png`, `evidence-home-dark.png` and the open-sheet pair.

## Test totals for the gate

- Unit: 115 across the workspace (46 in apps/web, incl. 44 new map/eta tests)
- E2E: 23/23 on the dev server against the live database
- RLS security suite: 43/43 (6 new saved-trips isolation checks)
- Ledger invariants: 8/8
