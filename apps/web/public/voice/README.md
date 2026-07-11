# Voice guide audio: PLACEHOLDER FILES

Every file here is a stand-in generated with the local Windows SAPI voice
(`tools/generate-placeholder-voice.ps1`). The Shona lines through an English
synthesiser are knowingly wrong; they exist so the trigger engine, caching
and settings are real and testable today. Recorded Zimbabwean voices with
signed consent replace these in P5, same file names, no code change.

| File | Cue | Line |
| --- | --- | --- |
| `en/approaching.wav` | approaching | Your stop is coming up. |
| `en/get-off.wav` | get off | This is your stop. Get off here. |
| `en/walk.wav` | walk | Your walking leg starts here. |
| `sn/approaching.wav` | approaching | Wakusvika pachiteshi chako. |
| `sn/get-off.wav` | get off | Chiteshi chako ndechichi. Chiburuka pano. |
| `sn/walk.wav` | walk | Kufamba netsoka kunotangira pano. |

Declared in the disclosure register. Audio is preloaded when a ride starts
and played from memory: zero network calls at play time (proven in
`apps/web/test/voice-audio-cache.test.ts`).
