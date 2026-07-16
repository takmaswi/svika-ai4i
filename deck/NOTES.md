# Deck notes: gaps, rulings applied and quiet choices

Everything here is a gap the plan or DESIGN.md left open, with the quietest
choice taken, or a decision Mhofu may want to overrule.

## Copy and content gaps

1. **Team name.** No verified team name exists anywhere in the repo, so the
   close says only "Built in Harare" beside the GDG win line. If a team name
   was registered for AI4I, it belongs on scene 10.
2. **Shona gaps.** Scene 5 (guardian) and scene 10 (thesis) both wanted a
   Shona echo line; `dict.ts` has no matching strings and inventing Shona is
   banned, so English shipped. Add to the translator worksheet if wanted.
   Scene 4's "Wakusvika pa turn off, chiburuka" is quoted verbatim from the
   storyboard in SHOWCASE-DECK-PLAN.md, ruled by Mhofu.
3. **Illustrative numbers.** The flywheel counters (412 journeys, 118 places,
   37 shortcuts), the seat count, the 17:42 arrival and board code 4729 are
   example values in the register's landing stat card grammar, all inside
   scenes stamped roadmap or vision. Nothing real is implied.

## Stamp system decisions

4. **Scene 1 carries no stamp.** The cold open has no words and makes no
   product claim; a chip would be the first words on screen. Deliberate.
5. **Scene 2's chip reads "A true ride"** in the vision chip anatomy. The
   founding story is not a feature, so none of the three register stamps fit
   honestly. Same chip system, fourth label, used exactly once.

## Spec gaps flagged (DESIGN.md has no pattern for these)

6. **Fullscreen glyph.** No expand glyph exists in the reference screens; a
   minimal chunky rounded one was drawn in the house stroke style. Proposed
   as a spec addition.
7. **Deck scale type.** DESIGN.md specs 360px screens; the deck's display
   sizes (clamped 44 to 118px DM Sans) extrapolate the H1 grammar to stage
   scale. Tokens, weights and tracking are verbatim.

## Technical choices worth knowing

8. **Wordmark is inlined** with the same paths the reference screens inline,
   because an external SVG in an img tag cannot use the page's Baloo 2 font.
   `wordmark.svg` and `logo.svg` ship untouched in `deck/assets/` as well.
9. **No fake status bar** inside the scene 7 phone frames, following the
   DESIGN-DEVIATIONS ruling that device chrome is never rendered.
10. **Serving.** ES modules cannot load from `file://`; run
    `node tools/deck/serve.mjs` and open http://localhost:4173. This is the
    showtime path and it needs no internet.
11. **`?nolag` flag** exists for software rendered capture rigs (CI,
    SwiftShader) where GSAP lag smoothing would stretch entrances. Never
    needed on a real GPU.
12. **Meshy model defects.** The compression pipeline reports doubled
    primitives and forces double sided materials so any inverted normals
    cannot render black holes on stage. Metalness is overridden at load
    (Meshy exports metallic 1.0, which reads coal black under studio light).
