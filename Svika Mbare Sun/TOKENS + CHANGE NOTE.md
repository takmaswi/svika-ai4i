# Svika — Mbare sun customisation pass
## Tokens, components and change note

Open the numbered `.dc.html` files for the latest screens. The old approved
foundations (2a/2b) are in `foundations/` for reference only — they do NOT
contain the new headline, motion or night theme.

---

## 1. Tokens

### Core palette (unchanged from foundation)
| Token | Value | Use |
|---|---|---|
| paper | `#FFFFFF` | Day canvas, day map roads. Never cream. |
| marigold | `#F5B301` | Kombis, highlights, Kombi highlight shape, night CTA, plate chips. Never text on white. |
| char | `#161D18` | Ink, drawn 1.5px borders (day), night canvas and sheets, day CTA arrow chip. |
| forest | `#1F4D2E` | Day CTA, wordmark, day links, "Paid with EcoCash" chip. |
| signal | `#E84C30` | Live dots and route stops ONLY. |
| park | `#D9E8CC` | Day map parks, positive icon chips. |
| map base | `#F4F5F1` | Day map ground. |
| road casing | `#E1E3DA` | Day road outline. |
| soft ink | `#575F53` | Day secondary text. |

### Night palette (NEW — added this pass)
| Token | Value | Use |
|---|---|---|
| night map base | `#121710` | Night map ground. |
| night building | `#1B211A` | Night map building fills. |
| night road casing | `#222B22` | Night road outline. |
| night road | `#333E33` | Night road fill. |
| night minor road | `#2A342B` | Night minor roads. |
| night park | `#1B3423` | Night map parks, A1 route badge. |
| surface dark | `#10150F` | Night nav bar, pills, chips on map. |
| overlay card | `rgba(255,255,255,.06)` | Night cards. |
| border light | `rgba(255,255,255,.10)` – `.18` | Night borders (cards → pills). |
| text secondary night | `rgba(255,255,255,.55)` – `.62` | Night secondary text. |
| street label day | `#6E766A` | Map street names (Plex Mono 9px). |
| street label night | `#7E877E` | Map street names, night. |
| park label night | `#6F8F74` | Park names, night. |
| marigold hover | `#E3A600` | Marigold CTA hover. |
| forest hover | `#143D22` | Forest CTA hover. |

### Shadows (char/umber tinted, never grey)
- Day card: `0 10px 28px rgba(22,29,24,.12)`
- Day CTA: `0 10px 26px rgba(31,77,46,.30)`
- Night card/CTA: `0 14px 34px rgba(0,0,0,.45)` / `0 10px 26px rgba(0,0,0,.4)`
- Kombi glow (night, NEW): `drop-shadow(0 0 10–12px rgba(245,179,1,.45))`

### Type (unchanged)
- DM Sans 700 — display, tight tracking (-0.02 to -0.025em)
- IBM Plex Sans — body and UI
- IBM Plex Mono — codes, fares, plates, times, street labels
- Baloo 2 700 — wordmark only

### Motion (NEW — added this pass)
| Keyframe | Purpose | Timing |
|---|---|---|
| svk-rise | Content entrance, staggered | .6s ease-out, delays .05–.95s |
| svk-drive | Kombi highlight slides in from left | .7s cubic-bezier(.2,.8,.3,1) .25s |
| svk-draw | Route draws origin → destination (SVG mask) | 1.3–1.5s ease-out |
| svk-fadein / svk-fadeout | Pins, chips, 5 min → 4 min countdown | .35–.5s, sequenced after draw |
| svk-beam | Night headlight breathing | 2.8s ease-in-out infinite |
| svk-bob | Kombi marker idle bob | 2.4s ease-in-out infinite |
| svk-pulse / svk-ripple | Live signal dot | 1.6s / 1.8s infinite |
- Press state on every button: scale(0.99).

---

## 2. Components

- **Kombi highlight (NEW)** — the marigold headline block drawn as a
  high-roof Toyota Hiace: flat nose, windshield cutout, two char wheels with
  white rims. Word sits inside the body. Used on both landing themes.
- **Status bar (NEW)** — 11:00 day / 22:00 night, bespoke signal + battery glyphs.
- **Route draw (NEW)** — dashed route revealed by animated SVG mask;
  destination pin and place chip pop in after; kombis fade in last.
- **Headlight beam (NEW, night only)** — two stacked marigold wedges ahead of
  each kombi marker, breathing via svk-beam.
- **Ticket card (NEW)** — perforated dashed divider with punched notches;
  boarding code at 58px mono. Char ticket on white by day, white ticket on
  char by night. Plate chip, "Paid with EcoCash" chip.
- **Mini ticket stat card (NEW)** — landing boarding-code card with marigold
  stub + dashed perforation.
- **Route option card (NEW)** — badge (4B/A1), name + rank, mono time + fare,
  check circle on selection. Route, arrival, fare always visible.
- **Keypad key (NEW)** — 72px, mono 28px, conductor-grade hit targets;
  64px confirm bar.
- **Map street labels (NEW)** — IBM Plex Mono 9px: Samora Machel Ave,
  Jason Moyo Ave, Julius Nyerere Way, Chinhoyi St, Harare Gardens.
- Carried forward: wordmark pill, live pill, CTA pill (forest day / marigold
  night with counter-colored arrow chip), peek sheet, bottom nav, kombi map
  marker (PLACEHOLDER — replaced by client's kombi asset).

---

## 3. Change note (vs approved 2a/2b foundations)

**Copy**
- English only; all Shona strings removed.
- Tagline: "Know your kombi is coming." → **"Beyond the Kombi"**.
- Body copy now sells plan / smart suggestions / safety; removed wording
  negative toward kombi operators.
- Labels shortened: "Change kept", "Boarding code", "Route", "Arrives", "Fare".

**Tokens added:** the full night palette, glow shadow, street label colors,
hover tones, and all motion keyframes listed above. No core palette values
changed.

**Tokens changed:** none — paper, marigold, char, forest, signal, park,
map base, road casing, soft ink all carried over exactly.

**Screens added:** night landing + night map home, trip plan, ticket,
wallet, owner dashboard, conductor keypad (each day + night).
