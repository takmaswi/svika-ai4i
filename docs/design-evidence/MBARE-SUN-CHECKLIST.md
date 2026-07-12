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

## Phase C addendum (2026-07-11)

New surfaces, verified at 360px, both themes, both languages; packs in
`profile/`, `share/` and `marker/` beside this file.

| # | Check | profile | share viewer | alert banner | voice caption |
|---|-------|---------|--------------|--------------|---------------|
| 1 | Status bar correct | yes* | yes* | yes* | yes* |
| 2 | THE arrow only (§3) | yes | yes | yes | yes |
| 3 | CTA matches §5 anatomy | yes | yes | n/a | n/a |
| 4 | Day and night from §2 tokens only | yes | yes | yes | yes |
| 5 | Numbers/codes/times Plex Mono 600 | yes | yes | yes | n/a |
| 6 | Hit targets 44px+ | yes | yes | n/a | n/a |
| 7 | Press state on every button | yes | yes | n/a | n/a |
| 8 | Copy: sentence case, real Harare names, $1.50 | yes | yes | yes | yes |
| 9 | Tinted shadows, no gradients | yes | yes | yes | yes |
| 10 | Kombi marker box + bob + glow kept | n/a | yes | n/a | n/a |

Phase C item notes:

- **Profile, one primary action.** A settings surface: section forms use the
  medium pill (wallet form grammar), toggles wear the language chip grammar
  from screens 1 and 2 (`lang-toggle`), and no §5 CTA competes. Ride dates
  and history figures are Plex Mono.
- **Share viewer.** Composed from screen 2 and 3 patterns: full bleed map,
  §9 peek sheet with route, status and mono arrival, glass chips, the §11
  route treatment for the trip leg. The dead link state is a bordered card
  on the shell, quiet and identical for wrong, revoked and expired tokens.
- **Alert banner and voice caption.** Both wear the §9 sheet surface
  (`svika-glass-strong`) with svk-rise entrances honouring reduced motion;
  the alert's live dot is the §7 signal pair (live only, per hard rule 3).
- **Marker (task 0).** Verified unchanged: the client asset was already the
  glyph inside the §10 box; close-up proof in `marker/`.

Phase C spec gaps flagged (extract-only, proposals not improvisations):

4. **Checkbox.** No reference screen has one; the emergency details consent
   tick is a native checkbox tinted with the day CTA colour (forest) via
   `accent-color`, char track by night. Proposal: bless a drawn checkbox in
   the §6 control set.
5. **On/off toggle.** No reference has a boolean control; the profile reuses
   the EN|SN segmented pill with On/Off labels. Proposal: adopt it as the
   sanctioned boolean control.

## Phase D addendum (2026-07-11): the vision scenes

New surfaces, verified at 360px, both themes, both languages; packs in
`shelf/`, `vision-tinashe*/`, `vision-gogo/` and `vision-capacity/` beside
this file. Every scene carries the permanent Simulation stamp.

| # | Check | shelf | tinashe | gogo | capacity |
|---|-------|-------|---------|------|----------|
| 1 | Status bar correct | yes* | yes* | yes* | yes* |
| 2 | THE arrow only (§3) | yes | yes | yes | yes |
| 3 | CTA matches §5 anatomy | yes | yes | yes | yes |
| 4 | Day and night from §2 tokens only | yes | yes | yes | yes |
| 5 | Numbers/codes/times Plex Mono 600 | yes | yes | yes | yes |
| 6 | Hit targets 44px+ | yes | yes | yes | yes |
| 7 | Press state on every button | yes | yes | yes | yes |
| 8 | Copy: sentence case, real Harare names, $1.50 | yes | yes | yes | yes |
| 9 | Tinted shadows, no gradients | yes | yes | yes | yes |
| 10 | Kombi marker box + bob + glow kept | n/a | yes | n/a | yes |

Phase D item notes:

- **One primary action.** On every scene the story bar's next pill (the §5
  CTA from Phase A) is the primary action. The mbudzi's OK key is a control
  on a rendered object, not a screen CTA, and wears the marigold + char key
  pair.
- **The Simulation stamp.** The demo movement chip's pill family (§7,
  `svika-glass`, 11px 600) without the signal dot, because signal marks live
  truth only (hard rule 3) and nothing on a vision scene is live.
- **The mbudzi is an object, not a surface.** Char body, park LCD with char
  mono text (a lit screen reads the same at night), §6 key anatomy at 46px
  with mono digits and press states. All values are §2 tokens; the object
  keeps them in both themes on purpose.
- **Capacity badges.** The §7 map place chip grammar (20px rect, mono 9px,
  char by day, night surface + light stroke via `--border-pill`), riding as
  its own unrotated marker so the kombi marker itself stays untouched.
- **Plates.** Three plates come from reference screen 6 (AEH 6647, AFK 3310,
  ADT 8892); the fourth kombi wears AFK 3311, synthetic in the same format,
  declared in the disclosure register as fixture data.

Phase D spec gaps flagged (extract-only, proposals not improvisations):

6. **Simulation stamp.** No reference has a staged-content marker. Proposal:
   bless the dot-less §7 pill with the word Simulation as the sanctioned
   stamp for any staged surface.
7. **Message bubble.** No reference shows a phone-to-phone message. The
   mother's view composes the §8 dark feature card with the night overlay
   card as the bubble and mono for the link. Proposal: bless this pair for
   framed device views.
8. **Feature phone shell.** No reference has a rendered handset. Composed
   from §2 tokens and the §6 key anatomy; flagged for the design system if
   feature phone surfaces recur.
9. **Warning card.** The staged alert reuses the marigold + char pair (the
   keypad's offline pill grammar) as a warning card at card scale. Proposal:
   adopt marigold + char as the sanctioned warning surface at any scale.

## Stage addendum (2026-07-11): the presentation stage and the intelligence shelf

New surfaces, verified at 360px and desktop width, both themes, both
languages; packs in `stage/`, `intelligence/`, `eta-provenance/`,
`owner-watchdog/` and the reshot `shelf/` beside this file.

| # | Check | stage band | stage frame | intelligence page | provenance card | shelf intel row |
|---|-------|------------|-------------|-------------------|-----------------|-----------------|
| 1 | Status bar correct | yes* | yes* | yes* | yes* | yes* |
| 2 | THE arrow only (§3) | yes | yes | yes | yes | yes |
| 3 | CTA matches §5 anatomy | yes | yes | n/a | n/a | n/a |
| 4 | Day and night from §2 tokens only | yes | yes | yes | yes | yes |
| 5 | Numbers/codes/times Plex Mono 600 | yes | yes | yes | yes | yes |
| 6 | Hit targets 44px+ | yes | yes | yes | yes** | yes |
| 7 | Press state on every button | yes | yes | yes | yes | yes |
| 8 | Copy: sentence case, real Harare names, $1.50 | yes | yes | yes | yes | yes |
| 9 | Tinted shadows, no gradients | yes | yes | yes | yes | yes |
| 10 | Kombi marker box + bob + glow kept | n/a | n/a | n/a | n/a | n/a |

Stage item notes:

- **One primary action.** While a story runs the story bar's next pill is
  the screen's one primary action, and the lock under it is inert so nothing
  competes. The final step's two doors keep the §5 pill as the primary (stay
  and explore) with the shelf door as a §6 text button.
- **The caption band.** The story bar keeps its Phase A glass card grammar;
  it now sits in a reserved band below the screen box instead of floating,
  so it can never cover cards, codes or the map focus.
- **The back a step control** is the §6 back button (44px circle, the
  mirrored §3 arrow) inside the story bar head.
- \* No fake status bar per agreed deviation 1.
- \** The basis label keeps its 11px meta type; its hit area is expanded to
  44px+ with an invisible pseudo element so the peek card layout holds.

Stage spec gaps flagged (extract-only, proposals not improvisations):

10. **Desktop stage frame.** No reference screen is wider than 360px. At
    desktop widths the story stage renders the app in a 360px phone sized
    frame composed from the §8 card grammar (`--border-card`, `--radius-lg`,
    the dark card shadow), centred beside the caption card. Proposal: bless
    this frame as the sanctioned way to stage the phone app on a wide
    screen.
11. **Scrim dialog.** No reference has a modal. The provenance card floats a
    §8 bordered card over a char tinted scrim (rgba(22,29,24,.45), tinted
    per the shadow rule). Proposal: bless the pair as the sanctioned small
    dialog.
12. **Verdict pair line.** The watchdog card states two detector verdicts on
    one meta line per flagged day (forest flagged, threshold silent). It is
    §2 meta type with the mono day above it; flagged in case verdict
    comparisons recur elsewhere.

## Profile home addendum (2026-07-12): the welcome home and its two doors

The profile became a welcoming home, not a settings screen, and gained two
doors from the map home (a fourth "You" tab and a glass profile chip). New and
changed surfaces, verified at 360px, both themes, both languages; the reshot
`profile/` and `home/` packs beside this file are the proof, regenerated with
`node scripts/profile-home-evidence.mjs`.

| # | Check | welcome header | profile chip | You tab | reorg (settings) |
|---|-------|----------------|--------------|---------|------------------|
| 1 | Status bar correct | yes* | yes* | yes* | yes* |
| 2 | THE arrow only (§3) | yes | yes | yes | yes |
| 3 | CTA matches §5 anatomy | n/a | n/a | n/a | yes |
| 4 | Day and night from §2 tokens only | yes | yes | yes | yes |
| 5 | Numbers/codes/times Plex Mono 600 | yes | n/a | n/a | yes |
| 6 | Hit targets 44px+ | yes | yes | yes | yes |
| 7 | Press state on every button | n/a | yes | yes | yes |
| 8 | Copy: sentence case, real Harare names, $1.50 | yes | yes | yes | yes |
| 9 | Tinted shadows, no gradients | yes | yes | yes | yes |
| 10 | Kombi marker box + bob + glow kept | n/a | n/a | n/a | n/a |

Profile home item notes:

- **Two doors, one primary action each stays intact.** The You tab and the
  profile chip are quiet navigation, not screen CTAs: the map home keeps its
  plan-trip arrow as its one primary action, and the profile page keeps its
  section form buttons (§6 medium pills) with no competing §5 CTA.
- **The initial avatar** is char on marigold, the §7 chip pairing, correct in
  both themes without flipping (unlike a CTA). It extracts the route badge
  (screen 3): marigold square, char glyph, DM Sans 700. With no name it holds
  the you glyph so it is never empty.
- **The You glyph** is a chunky rounded head over shoulders in the same
  grammar as the other nav glyphs (home, clock, wallet card), filled when
  active, stroked otherwise, `currentColor`.
- **The stat tiles** reuse the §9 peek-stats grammar (uppercase meta label,
  Plex Mono count) inside a §8 bordered card. Counts are mono; the top trip is
  §2 sub type. Demo personas carry an honest "simulated demo history" line.
- **The settings group** folds identity, alerts, voice, language, theme,
  emergency and the your data link under one §9 sheet-title heading set off by
  a hairline. Toggles keep the language chip grammar (Phase C gap 5); theme
  and language reuse the map home chips.

Profile home spec gaps flagged (extract-only, proposals not improvisations):

13. **Initial avatar.** No reference screen shows an account avatar. Composed
    from the route badge (screen 3) as a marigold rounded square with a char
    initial. Proposal: bless the initial avatar (char on marigold, both
    themes) as the sanctioned identity token, with a chip size and a large
    size.
14. **Time based greeting header.** No reference has a greeting. The eyebrow
    is §2 meta uppercase over the name in §2 headline, computed in Harare
    time from the three greetings the dictionary already carries. Proposal:
    bless the greeting header as the sanctioned welcome pattern.
15. **Stat tiles.** No reference has a stats block. Composed from the §9
    peek-stats grammar in a §8 card. Proposal: bless a stat tile row (meta
    label, mono count) as the sanctioned way to show honest personal counts.
16. **You nav glyph.** No reference has a person glyph (the reference nav is
    three items). Drawn in the existing nav grammar. Proposal: adopt the
    person glyph as the sanctioned fourth nav item.
