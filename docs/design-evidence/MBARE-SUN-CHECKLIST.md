# Mbare Sun pre-ship checklist (DESIGN.md section 14)

Recorded 2026-07-10 for the full reskin. Every answer below was verified on
the running app at 360px, day and night, English and Shona; the screenshot
packs beside this file are the proof. Two agreed deviations apply everywhere
and are recorded in `docs/DESIGN-DEVIATIONS.md`: the status bar in the
reference files is device chrome so the web app never renders one (item 1
passes as the deviation), and the app stays bilingual EN/SN (item 8's
"English only" reads as "sentence case, real names, correct fares" for both
languages).

Screens covered: landing (1), map home (2), trip plan (3), ticket (4),
wallet (5), owner dashboard + statement (6), conductor keypad (7), and the
composed screens with no reference: parcels, your data, privacy notice,
consent, login, story overlays.

| # | Check | landing | home | plan | ticket | wallet | owner | keypad | composed |
|---|-------|---------|------|------|--------|--------|-------|--------|----------|
| 1 | Status bar correct | yes* | yes* | yes* | yes* | yes* | yes* | yes* | yes* |
| 2 | THE arrow only (§3) | yes | yes | yes | yes | yes | yes | yes | yes |
| 3 | CTA matches §5 anatomy | yes | yes | yes | yes | yes | yes | yes | yes |
| 4 | Day and night from §2 tokens only | yes | yes | yes | yes | yes | yes | yes | yes |
| 5 | Numbers/codes/times Plex Mono 600 | yes | yes | yes | yes | yes | yes | yes | yes |
| 6 | Hit targets 44px+ (72px keys) | yes | yes | yes | yes | yes | yes | yes | yes |
| 7 | Press state on every button | yes | yes | yes | yes | yes | yes | yes | yes |
| 8 | Copy: sentence case, real Harare names, $1.50 | yes | yes | yes | yes | yes | yes | yes | yes |
| 9 | Tinted shadows, no gradients | yes | yes | yes | yes | yes | yes | yes | yes |
| 10 | Kombi marker box + bob + glow kept | n/a | yes | yes | n/a | n/a | n/a | n/a | n/a |

\* as the agreed device-chrome deviation.

Item notes, where a check needed a decision:

- **2, THE arrow.** All text arrows (`→`, `←`, `⌫`) are gone; stop pairs use
  the word "to" (EN) / "kusvika" (SN). The wallet reference's own up/down
  transaction arrows conflict with §3 and were not copied: credits carry the
  plus glyph from the top up chip, fares carry the kombi glyph from the
  marker placeholder, both lifted from the numbered screens. The conductor
  delete key uses the reference screen 7 glyph verbatim. The remaining SVGs
  in the product are the §3 pair plus reference glyphs (search, home, clock,
  wallet card, plus, check, kombi, sun/moon, signal/battery none).
- **3, one primary action per screen.** Landing: find your kombi. Home: the
  plan-trip arrow button in the search pill (reference screen 1's own
  anatomy). Plan: pay from wallet (cash reserve demoted to the §6 text
  button; cash is still always accepted). Ticket: none, the code is the
  screen's job. Wallet: send/claim are equal form actions, styled as medium
  pills. Owner: download/print the ZIMRA statement. Keypad: the 64px plain
  confirm. Consent and login: their single CTA.
- **10, the marker.** The marigold 30px rx10 box with bob, night white
  stroke, glow and headlight beam is law; the glyph inside is the client's
  exported kombi asset (`packages/ui/assets/kombi-marker.svg`), not a
  redesign.

Fix candidates from §15, applied as recommended:

- Wallet nav glyph is the outline card everywhere (the filled variant from
  reference screen 5 was the flagged inconsistency).
- The landing "English" chip border difference per theme was kept: it is
  intentional theme grammar.
- The plan sheet auto-height vs the home sheet fixed peek was kept as the
  reference intends.

Spec gaps flagged (extract-only rule, proposals for the design system, not
improvised in code):

1. **Map water colour.** §11 has no water value; the transform maps water to
   the park family. Proposal: add a water token (the corridor shows no water,
   so nothing visible rides on this today).
2. **Walking legs on the map.** Reference 3 shows no walk legs; they render
   dashed in soft ink (day) / 55% white (night), the §2 secondary text
   values. Proposal: bless a walking-leg token.
3. **Wallet transaction row icons.** See item 2 note; proposal: add plus and
   kombi glyphs to the icon set as the sanctioned transaction pair.
