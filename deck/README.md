# Svika showcase deck

An animated HTML deck for the future features Mhofu chose not to build before
the bootcamp. Ten stepped scenes, one 3D kombi, every unbuilt feature stamped
roadmap or vision. The honesty law is the aesthetic. Governed by
`docs/SHOWCASE-DECK-PLAN.md`; every visual value comes from
`Svika Mbare Sun/DESIGN.md`.

## Run it (offline, showtime path)

```bash
node tools/deck/serve.mjs
# open http://localhost:4173
```

No internet needed at any point: GSAP, Three.js, fonts, the compressed kombi
GLB and the QR all live in this folder.

## Controls

- **Advance:** space, right arrow, enter, or click. A scene consumes its
  beats first (the turntable and the flywheel scrub on the same key), then
  moves on.
- **Back:** left arrow. **Home/End:** first and last scene. **F:** fullscreen.
- **`?auto`** runs the whole deck on timers and loops, for booth play.
- **`#s6-city-maps`** style hashes deep link a scene on load.
- Reduced motion (OS setting or `?reduced`) settles every scene instantly.
- **`?nowebgl`** forces the pre rendered poster fallback, the same swap that
  happens if WebGL init fails.

## Insurance

`deck-frames.pdf` holds the settled final frame of all ten scenes for the day
the demo machine dies.

## Rebuilding assets (tools/deck, needs `npm i` there once)

```bash
node compress-kombi.mjs   # 33 MB Meshy GLB -> assets/kombi.glb (< 5 MB gate)
node make-posters.mjs     # poster fallbacks, per theme (server must be up)
node export-pdf.mjs       # deck-frames.pdf (server must be up)
node snap.mjs             # every beat screenshotted, for QA
node evidence.mjs run     # gate evidence: video, offline proof, fps
```

The 33.1 MB source model stays in `assets/Kombi 3d model/` and never ships.
