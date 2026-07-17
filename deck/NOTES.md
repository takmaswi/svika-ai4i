# Deck notes: gaps, rulings applied and quiet choices

Everything here is a gap the plan or DESIGN.md left open, with the quietest
choice taken, or a decision Mhofu may want to overrule.

## Rulings applied (Mhofu, 2026-07-16, after first delivery)

- **Team name is Svika**; scene 10 now reads "Team Svika. Overall winner,
  GDG Harare Build with AI Hackathon 2026. Built in Harare."
- **English only in this deck.** The scene 4 voice caption became "You are
  at the turn off. Get off here." and the flywheel nickname chips became
  "the turn off" and "the market". The app itself stays bilingual.
- **Licence to break DESIGN.md** where it buys quality. Breaks taken, all
  deck only: a radial char vignette on night scenes (gradient), a film
  grain overlay at 4 to 5 percent, editorial ghost scene numerals bleeding
  off the bottom edge, display type extrapolated far past the 360px spec,
  and the progress rail restyled as a dashed route with a glowing marigold
  kombi pill for the current scene. Nothing here migrates into the app.

## Polish round 2 (Mhofu's review, 2026-07-16)

- **Settle then step input model.** A press during a running beat fast
  forwards it to its end state; the next press advances. Every press has
  a visible result. Auto mode is untouched. Implementation detail that
  matters: GSAP's isActive() reports false for tweens still waiting out a
  delay, so the settle walks totalProgress instead, and pending sound
  cues are cancelled on settle rather than fired. A 220ms debounce and a
  key repeat guard stop double advances; rail and fullscreen buttons blur
  after click so Space or Enter cannot fire twice. The capture rigs wait
  for the beat to finish before pressing.
- **Bottom safe lane.** Scene content keeps clamp(76px, 10vh, 116px)
  clear at the bottom for the rail, counter and hint, and tall stacks
  keep their kicker below the fullscreen button. Full bleed background
  art (the dawn skyline, the flywheel canvas, ghost numerals) still runs
  under the lane on purpose.
- **Descender room.** Line masks carry 0.16em of padding pulled back with
  a negative margin, and titles revert to natural text when the reveal
  completes, so g, y and p are whole both mid flight and settled.
- **Audio layer.** All local, WebAudio mixed, generated once by
  tools/deck/make-audio.mjs from ELEVENLABS_API_KEY in .env.local (never
  in the repo). N toggles narration, off by default; ?auto and ?narrate
  start with it on, because the booth loop is the narrated surface and
  the Mutare stage stays silent. SFX play in both modes, ducked under the
  voice; reduced motion means no audio at all. Autoplay holds a scene
  until its narration ends or the hold elapses, whichever is longer. A
  booth machine should launch Chromium with
  --autoplay-policy=no-user-gesture-required or click once, since
  browsers gate sound behind a first gesture.
- **Both gates answered (2026-07-17).** Voice is takunda-man
  (wRW2mPeN6V5fVfWsUQjX, "Takunda Zimbabwean Man"); the unused sample was
  deleted so one Takunda lives in the repo. The narration script was
  approved exactly as drafted. Three flags were raised and ruled on, and
  the rulings are final, do not revisit: line 4 keeps "any place in the
  city" as written; line 6 keeps present tense; line 10 keeps the GDG
  win off the voice, screen only.

## One piece mix (2026-07-17)

- **One loudness law, applied at build.** tools/deck/master-audio.mjs
  masters every committed asset once: voice at -16 LUFS integrated, mono,
  true peak under -1.5 dBTP (two pass loudnorm plus a measure and correct
  loop, because loudnorm alone drifts on takes shorter than its 3s window
  and mp3 encoding nudges peaks up); SFX 10 dB under the voice at
  -26 LUFS. No per file volume lives in code anymore; the old SFX gain
  map is gone. The script prints the measured table and fails the build
  if any file drifts. Last run: all 19 assets pass; card-deal and
  type-tick sit slightly under the law by design (peak cap), and the
  table says so.
- **One room.** The whole SFX set gets the same chain: high pass 80 Hz,
  low pass 13 kHz, 8-12 ms edge fades, mono 44.1 kHz mp3 like everything
  else. type-tick is trimmed to the 1.4s the s4 typing actually runs.
- **Mix feel in the runtime.** SFX duck to 40 percent under the voice,
  ~80ms down and ~400ms back up. Narration starts 300ms after a scene's
  entrance begins, fades out over 180ms on scene exit, and autoplay owes
  600ms of silence after a line before it may cut. Both buses feed a
  -3 dB master: a voice peak meeting a cue peak summed past 0 dBFS
  (measured, not theorized) and clipped the destination.
- **Cues sit on motion.** Every cue delay was re-derived from its tween:
  stop pops on the back.out landing frames (0.55 and 1.8), the chime as
  the notify card springs (0.5), odometer ticks starting with the count
  they ride, the Flip whoosh with the motion at 0. Settle still cancels
  pending cues silently. Audio preloads at script parse, not engine boot,
  because scene 1's first cue lands 0.65s in, before a boot time decode
  finished.
- **Listening evidence.** tools/deck/record-narrated.mjs tapes one full
  ?auto loop with the tab's real audio (capture processing disabled;
  Chrome's default auto gain control was riding the levels and faked a
  clip on the first tape). docs/deck-evidence/deck-narrated-run.webm:
  integrated -16.7 LUFS, LRA 7.5, true peak -3.7 dBFS, shortest gap
  between lines 0.88s, zero requests leaving localhost with all audio
  loading.

## Round 3: presenter voice and the stutter post mortem (2026-07-17)

- **The stutter was generation side, in the mastering chain, not the
  runtime.** The round 2 pipeline re-encoded every line to 128k mp3 on each
  correction pass (loudnorm render plus up to four refine passes: up to five
  lossy generations plus repeated limiting per line). Differential test on a
  real line: one encode leaves cumulative coding error at -24.6 dB below the
  signal; five encodes leave it at -12.6 dB, roughly 23 percent error
  amplitude, which the ear reads as grainy stutter. A signal scan of the
  committed files found zero stutter shaped repeats and no dropouts beyond
  natural stop consonant closures, and buffer source playback is immune to
  main thread jank, which cleared the playback engine. Fix:
  master-audio.mjs now does every intermediate pass on lossless WAV and
  encodes each file to mp3 exactly once, with a verify and trim loop that
  re-encodes from the kept WAV if the encoder's peak bump (measured 0.3 to
  1.2 dB) pushes true peak over the law. Mastering is not idempotent, so
  the script now only re-renders groups named on the command line
  (`node master-audio.mjs voice sfx`) and measure only reports the rest;
  regeneration always starts from fresh renders, never from shipped mp3s.
- **Voice is takunda-presenter** (AugQODMJmD6Ng81JQeKf, "Takunda Zimbabwean
  Presenter"), all ten lines regenerated word for word from the approved
  script (the NOTES rulings on lines 4, 6 and 10 stand untouched). Stability
  raised 0.5 to 0.65 with style moderate at 0.2 on the stable multilingual
  model, per the stutter ruling. The old takunda-man files and sample are
  deleted; git history keeps them.
- **Playback hardened as belt and braces:** every audio asset is fully
  decoded to an AudioBuffer before the deck reports ready (boot now waits on
  the audio cache beside fonts and the 3D model), and narration starts on
  the audio clock rather than a JS timer. SFX cue delays deliberately stay
  on the GSAP frame clock: cues sit on rendered motion frames, and an audio
  clock schedule would desync from a lagging GPU.

## Round 3: the music bed (2026-07-17)

- **Architecture: loopable intensity stems, not one timed track.** Manual
  driving makes scene timing unpredictable, so the bed is five stems cut
  from one ElevenLabs composition plan (the /v1/music/plan endpoint), one
  dark minor key and one BPM (140, halftime) so any pair can crossfade:
  bed-low (scenes 1-2), bed-mid (3-5), bed-rise (6-8), bed-pull (9) and
  close-swell (10, the peak, allowed to resolve, never loops). A short
  open-hit sting from the same plan lands with the cold open's route draw;
  it ships as an SFX cue on the sfx bus (mono, the SFX law) so the bed can
  never mask it and settle cancels it like any cue.
- **Loops are found, not trusted.** tools/deck/make-music.mjs generates 42s
  raw renders (music-raw/, gitignored, credits spent once), then finds each
  loop: whole bars at 140 BPM scored for musical continuity across three
  windows, then a joint micro-shift of both cut points (a few ms, inaudible
  against the bar grid) to the zero crossing alignment that minimises the
  discontinuity the runtime actually plays. No edge fades on loop points.
  `verify` re-decodes every shipped file, measures the seam jump against the
  file's typical sample step, and cuts three cycle tapes to
  docs/deck-evidence/music-loops/; all four loops pass. bed-rise was
  regenerated once: a build that climbs forever cannot loop, so its styles
  ask for rolling waves over a consistent energy floor.
- **Music ships stereo ogg.** Two deliberate breaks from the mono mp3 room:
  vorbis is sample exact end to end so the file loops where the WAV loops
  (mp3 padding breaks seams), and a bed earns its stereo width. Mastering is
  static gain only to -28 LUFS integrated (~12 dB under the voice when
  solo); loudnorm's dynamic riding would bend a loop's ends apart.
  master-audio.mjs measures the stems into the one table and polices the
  law but never re-renders them.
- **Mix behaviour.** M toggles music, on by default, independent of N, both
  states in the HUD. The bed runs continuously across scene changes inside
  a group; group boundaries crossfade equal power over 1.8s. Under
  narration the bus ducks a further 6 dB (~-34) on the 80/400ms ramp
  grammar; a firing cue dips the bed another step (0.65) for half a second,
  so when a cue and the bed fight, the bed loses level, never the cue.
  Silent under reduced motion; starts with the existing first gesture
  unlock. The -3 dB master stays; the tape re-measure below is the proof it
  still holds.

## Copy and content gaps

1. **Illustrative numbers.** The flywheel counters (412 journeys, 118 places,
   37 shortcuts), the seat count, the 17:42 arrival and board code 4729 are
   example values in the register's landing stat card grammar, all inside
   scenes stamped roadmap or vision. Nothing real is implied.

## Stamp system decisions

2. **Scene 1 carries no stamp.** The cold open has no words and makes no
   product claim; a chip would be the first words on screen. Deliberate.
3. **Scene 2's chip reads "A true ride"** in the vision chip anatomy. The
   founding story is not a feature, so none of the three register stamps fit
   honestly. Same chip system, fourth label, used exactly once.

## Spec gaps flagged (DESIGN.md has no pattern for these)

4. **Fullscreen glyph.** No expand glyph exists in the reference screens; a
   minimal chunky rounded one was drawn in the house stroke style. Proposed
   as a spec addition.
5. **Deck scale type.** DESIGN.md specs 360px screens; the deck's display
   sizes (clamped 44 to 118px DM Sans) extrapolate the H1 grammar to stage
   scale. Tokens, weights and tracking are verbatim.

## Technical choices worth knowing

6. **Wordmark is inlined** with the same paths the reference screens inline,
   because an external SVG in an img tag cannot use the page's Baloo 2 font.
   `wordmark.svg` and `logo.svg` ship untouched in `deck/assets/` as well.
7. **No fake status bar** inside the scene 7 phone frames, following the
   DESIGN-DEVIATIONS ruling that device chrome is never rendered.
8. **Serving.** ES modules cannot load from `file://`; run
    `node tools/deck/serve.mjs` and open http://localhost:4173. This is the
    showtime path and it needs no internet.
9. **`?nolag` flag** exists for software rendered capture rigs (CI,
    SwiftShader) where GSAP lag smoothing would stretch entrances. Never
    needed on a real GPU.
10. **Meshy model defects.** The compression pipeline reports doubled
    primitives and forces double sided materials so any inverted normals
    cannot render black holes on stage. Metalness is overridden at load
    (Meshy exports metallic 1.0, which reads coal black under studio light).
