# Design evidence packs (Phase A)

Screenshot packs for the six raised screens, captured at the 360px reference
viewport (2x) in all four variants: day and night theme, English and Shona.
Regenerate with the dev server up: `node scripts/design-evidence.mjs` from
`apps/web` (headed Chromium; the MapLibre canvas paints blank in headless).

| Folder | Screen | What to look for |
| --- | --- | --- |
| `landing/` | The landing over the live map | The change problem in two sentences, the real sign in door and the demo door with story entries, demo movement chip on the map. |
| `plan/` | Trip plan on the live map | Heights to Avondale: ride legs on the real road, the walking leg dashed, destination in coral, pay actions in the bottom sheet peek. |
| `ticket/` | The boarding card | Forest route strip, big mono code, perforated fold; `stamped-light-en.png` shows the redemption stamp moment on a cleared fare. |
| `wallet/` | Wallet with the change story | The change to credit card with the kept total riding above send, claim and history. |
| `parcel/` | Staged parcel boarding card | LOAD active and COLLECT waiting on one card, one arrow between the stages. |
| `owner/` | Owner dashboard | Forest hero band, hand rolled SVG revenue bars, route cards, the watchdog card labelled simulated with its bilingual narrative toggle, the dated ZIMRA presumptive tax card, statement link. |

All figures on these screens are live values from the seeded demo database at
capture time; nothing is mocked into the DOM for the shot.
