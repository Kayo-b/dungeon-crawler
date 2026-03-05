# Room3D Visual Review - Alignment/Ceiling Fix (2026-02-28)

## Context

Follow-up pass focused on:

- wall edge alignment across depth
- ceiling visibility in corridor frames
- removing "walls getting taller with distance" behavior

Reference target: `src/resources/hallway_example.png`

## Capture Set

Screenshots collected with Playwright:

- `output/playwright/corridor-frames-2026-02-28-fix/00_start_view.png`
- `output/playwright/corridor-frames-2026-02-28-fix/01_forward_1.png`
- `output/playwright/corridor-frames-2026-02-28-fix/02_forward_2.png`
- `output/playwright/corridor-frames-2026-02-28-fix/03_turn_right.png`
- `output/playwright/corridor-frames-2026-02-28-fix/04_turn_right_forward.png`
- `output/playwright/corridor-frames-2026-02-28-fix/05_turn_left_twice.png`

## Outcome

- **Ceiling visibility:** improved
  - Ceiling plane is now visible in open corridor depth frames (`00`, `01`, `02`), unlike prior run where upper space was mostly missing/dark.
- **Wall height scaling:** improved
  - Distance segments no longer expand upward as distance increases.
- **Side alignment:** improved
  - Left/right wall edges track more consistently through forward movement.

## Remaining Notes

- Immediate wall states (`03+`) are still mostly front-wall dominant, with less visible ceiling context. This is acceptable for blocked-close views but could be tuned further if a stronger "boxed room" look is desired at near distance 1.

## Technical Summary

The fix pass did three key things in `Room3D.tsx`:

- Restored profile constants to stable baseline values (`heightDistanceFactor` back to `0.05`, neutralized over-tuned phase offsets).
- Removed distance-based side-wall height growth term.
- Derived floor/ceiling bands from wall frame edges and used absolute top/bottom deltas so ceiling strips do not disappear when sign flips between near/far top values.
