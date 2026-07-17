# Deck evidence: full keyboard run (headed, real GPU)

Date: 2026-07-16T22:43:03.379Z

## Network (offline proof)
Total requests: 40
Requests leaving localhost:4173: 0  (zero network at runtime: PASS)

## WebGL fps during kombi scenes (rolling 90 frame average)
scene 1 beat 1: 60 fps
scene 1 beat 2: 60 fps
scene 10 beat 1: 60 fps
scene 10 beat 2: 60 fps

## Run
All 27 beats of the 10 scenes advanced by keyboard; video beside this file.

# Deck evidence: narrated autoplay loop (listening evidence)

Date: 2026-07-17 · rig: tools/deck/record-narrated.mjs

deck-narrated-run.webm is one full ?auto loop (scene path
1..10 wrapped back past 1 so the opening line is on tape complete) recorded
with the tab's real audio, capture processing disabled.

## Mix measurements (ffmpeg ebur128 on the tape)
- Integrated loudness: -16.7 LUFS (voice law is -16)
- Loudness range: 7.5 LU
- True peak: -3.7 dBFS (no clipping)
- Shortest gap between lines: 0.88s (autoplay owes 600ms after each line)

## Network with all audio loading
Requests leaving localhost:4173: 0  (PASS)

## Per asset loudness law (tools/deck/master-audio.mjs output)
All 19 assets pass: narration s01-s10 and the voice sample at
-16.5 to -16.9 LUFS with true peak -1.2 to -2.0 dBFS; the eight SFX at
-26.4 to -26.5 LUFS except card-deal (-27.9) and type-tick (-30.2), which
sit under the law by peak cap, reported by the script.