# Mbare Sun — agreed deviations from the reference screens

The seven numbered screens in `Svika Mbare Sun/` are the visual truth for this
app. Two deviations are agreed with Mhofu (2026-07-10) and are deliberate.
Everything else follows DESIGN.md verbatim.

## 1. No fake status bar

Every reference screen opens with a status bar (11:00 day / 22:00 night,
signal and battery glyphs). That bar represents device chrome in the mockups,
not app UI. The web app runs inside a real phone's chrome, so it never renders
a simulated status bar. Layouts start where the reference's app content starts.

## 2. Bilingual English and Shona

DESIGN.md hard rule 4 says English only. That rule describes the reference
copy, not the product: the app stays bilingual English/Shona from the
translation file (`apps/web/src/lib/dict.ts`), as product law in CLAUDE.md
requires. Every screen must look right in both languages, in both themes.
Sentence case, no em dashes, no hyphenated compounds still apply to both
languages.
