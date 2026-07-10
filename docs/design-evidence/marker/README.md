# Kombi marker evidence (Phase C task 0)

Requested fix: swap the cartoonish placeholder glyph from the reference
screens out of the map marker and restore the client's real kombi asset.

Finding: the placeholder never shipped. The only marker implementation is
`makeKombiElement` in `apps/web/src/components/map/LiveMap.tsx`, and the
glyph inside the DESIGN.md section 10 box has been the client's asset since
the reskin landed (commit 3f873e0). Proof chain:

- `apps/web/public/map/kombi-marker.svg` is byte identical to
  `packages/ui/assets/kombi-marker.svg` (the pre reskin client asset, added
  in commit c877649) and to the client's own export in
  `assets/Kombi map marker icon/assets/kombi-marker.svg`.
- The reference screens' placeholder (the little side view bus path) appears
  nowhere on any map. Its only surviving use is the wallet transaction row
  icon (`KombiIcon` in `apps/web/src/components/icons.tsx`), an approved
  purge pass choice so no arrow shape sits beside THE arrow. It is a 16px
  list icon, not a map marker.

So no code changed for this task. The shots below were re-taken fresh from
the live map to prove the current state, per the task instruction.

| File | What it shows |
| --- | --- |
| `home-light-en.png` | Map home, day, full screen at 360px (3x). |
| `home-dark-en.png` | Map home, night: white stroke, marigold glow, headlight beams. |
| `closeup-light.png` | 130px crop around a live marker, day: client kombi asset inside the section 10 marigold box, char 2.5 stroke. |
| `closeup-dark.png` | Same crop by night: white 3 stroke, glow, beam behind the box. |

Regenerate with the dev server on :3000 (`E2E_AUTH=on`):
`node scripts/marker-evidence.mjs` from `apps/web`.
