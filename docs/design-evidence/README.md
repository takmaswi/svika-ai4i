# Design evidence packs (Mbare Sun reskin)

Screenshot packs for every screen, captured at the 360px reference viewport
(2x) in all four variants: day and night theme, English and Shona.
Regenerate with the dev servers up: `node scripts/design-evidence.mjs` from
`apps/web` (headed Chromium; the MapLibre canvas paints blank in headless).
The pre-ship answers per DESIGN.md section 14 live in
[MBARE-SUN-CHECKLIST.md](MBARE-SUN-CHECKLIST.md); agreed deviations in
[../DESIGN-DEVIATIONS.md](../DESIGN-DEVIATIONS.md).

| Folder | Screen | Reference | What to look for |
| --- | --- | --- | --- |
| `landing/` | Landing | 1 | Kombi highlight headline, live map in a drawn card, change story stat cards, the section 5 CTA, demo doors below the fold line. |
| `home/` | Map home | 2 | Full screen map with the dotted route and marigold kombi markers (night: glow and headlight beams), peek sheet with route + arrival + fare visible without scrolling, floating bottom nav. |
| `plan/` | Trip plan | 3 | Back button and title pill over the map, ride legs on the real road, the walking leg dashed, one CTA to pay from wallet, cash reserve as the text action. |
| `ticket/` | The boarding card | 4 | Char card on white by day, white card on char by night, 58px mono code, perforated fold; `stamped-light-en.png` shows the redemption stamp on a cleared fare. |
| `wallet/` | Wallet | 5 | Balance as the dark feature card with the change kept chip, icon transaction rows, bottom nav with wallet active (outline glyph per section 15). |
| `owner/` | Owner dashboard | 6 | Takings as the dark feature card with the marigold amount, route badges, the watchdog card labelled simulated with its bilingual narrative toggle, the ZIMRA statement as the one CTA. |
| `keypad/` | Conductor keypad | 7 | Route pill, code slot boxes, 72px keys, the 64px plain confirm; offline pill wears marigold + char. |
| `parcel/` | Staged parcel card | composed | LOAD active and COLLECT waiting on one bordered card with the perforation. |
| `profile/` | Profile (Phase C) | composed | Identity form, saved trips with rename, warm ride history in mono, alert and voice toggles on the language chip grammar, emergency details behind the consent tick. Full page shots; regenerate with `node scripts/phase-c-evidence.mjs`. |
| `share/` | Share viewer (Phase C) | composed from 2 and 3 | The mother's view: full bleed map with the trip leg, peek sheet with route, on board status and mono arrival with its basis label, no account behind it. |
| `marker/` | Kombi marker proof (Phase C task 0) | 2 | Close ups proving the glyph inside the §10 box is the client's kombi asset, day and night; see `marker/README.md` for the verification chain. |
| `recordings/` | Story runs (Phase C) | - | `takunda-morning.webm` and `rudo-night.webm`, each from a fresh landing visit through the live engine. |

All figures on these screens are live values from the seeded demo database at
capture time; nothing is mocked into the DOM for the shot. The only staged
values in the product are the landing stat card examples, declared in the
disclosure register.
