# Room3D Frame Parameters

This document explains the frame profile parameters used by `src/features/room/Room3D.tsx` and how they shape the 3D corridor.

## Core Idea

Each rendered surface has a profile:

- `walls`
- `frontWall`
- `ceiling`
- `floor`

Each profile has two phase variants:

- `near`
- `far`

The renderer computes two frames per surface per tile distance:

- current tile frame: `surfaceFar = getFrameDimensions(surface, d, 'far')`
- previous tile frame: `surfaceNear = getFrameDimensions(surface, d - 1, 'near')` (or full viewport when `d === 1`)

Those two frames are then used to build trapezoids/quads for left wall, right wall, floor, ceiling, and front wall face.

## Exact Frame Formula

For a given `surface`, `distance`, and `phase`, the function computes:

```ts
topDivisor = max(0.7, topDivisorBase - distance * topDivisorDistanceFactor)

scale = (1 / (distance * scaleDistanceFactor + scaleBase)) * phase.scaleMultiplier

width = VIEWPORT_WIDTH
  * scale
  * (widthBase + widthDistanceFactor * distance)
  * phase.widthMultiplier

height = VIEWPORT_HEIGHT
  * scale
  * (heightBase + heightDistanceFactor * distance)
  * phase.heightMultiplier

left = CENTER_X - width / horizontalDivisor + phase.leftOffset
top = CENTER_Y - height / topDivisor + verticalDistanceOffset * distance + phase.topOffset
right = CENTER_X + width / horizontalDivisor + phase.rightOffset
bottom = CENTER_Y + height / bottomDivisor + phase.bottomOffset
```

## `FrameSurfaceProfile` Parameters

### Perspective + scale behavior

- `scaleDistanceFactor`
  - Higher values make distant tiles shrink faster.
  - Lower values keep distant tiles larger (flatter depth).
- `scaleBase`
  - Base denominator term in `1 / (distance * factor + base)`.
  - Higher values shrink everything globally; lower values enlarge everything.

### Width/height growth terms

- `widthBase`
  - Base width term before distance contribution.
- `widthDistanceFactor`
  - Distance contribution to width term.
  - Your original formula maps to `0.1` (`0.2 / 2`).
- `heightBase`
  - Base height term before distance contribution.
- `heightDistanceFactor`
  - Distance contribution to height term.
  - Your original formula maps to `0.05` (`0.2 / 4`).

### Horizontal framing

- `horizontalDivisor`
  - Controls how far left/right edges move from center.
  - Larger divisor pulls edges inward (narrower aperture).
  - Smaller divisor pushes edges outward (wider aperture).

### Vertical framing

- `topDivisorBase`
  - Starting top divisor.
- `topDivisorDistanceFactor`
  - Per-distance reduction of the top divisor.
  - Implements effects like `1.8 - distance / 4` (`0.25` factor).
  - Higher values can create more aggressive vertical perspective.
- `bottomDivisor`
  - Controls where bottom edge lands vertically.
- `verticalDistanceOffset`
  - Linear vertical shift by distance, independent of divisor math.
  - Useful for effects like ceiling drift (`-distance`) or floor drift (`+distance`).

## `FramePhaseProfile` Parameters (`near` / `far`)

- `widthMultiplier`, `heightMultiplier`
  - Scale width/height per phase only.
  - Lets near and far geometry diverge per surface without changing base profile.
- `scaleMultiplier`
  - Additional multiplier on final `scale`.
  - Global phase-level zoom.
- `leftOffset`, `topOffset`, `rightOffset`, `bottomOffset`
  - Pixel offsets applied after base frame math.
  - Useful for fine alignment or stylized asymmetry.

If all phase values are neutral (`1` multipliers and `0` offsets), behavior is equivalent to a single formula without near/far variance.

## How Frames Drive Each Rendered Surface

In `renderFrames`:

- Side walls use `wallNear` and `wallFar`:
  - left wall width: `wallFar.left - wallNear.left`
  - right wall width: `wallNear.right - wallFar.right`
- Front wall face uses `frontNear`/`frontFar`.
- Door on front face uses `frontFar`.
- Floor strip uses `floorNear.bottom - floorFar.bottom` and `floorNear` width.
- Ceiling strip uses `ceilingFar.top - ceilingNear.top` and `ceilingNear` width.

So each surface can have its own perspective envelope even at the same tile distance.

## Original Formula Mapping

Your original common formulas map to:

- `scaleDistanceFactor: 0.4`
- `scaleBase: 0.5`
- `widthBase: 0.51`
- `widthDistanceFactor: 0.1`
- `heightBase: 0.5`
- `heightDistanceFactor: 0.05`
- `horizontalDivisor: 1.8`
- `topDivisorBase: 1.8`
- `topDivisorDistanceFactor: 0.25` (except ceiling if you want fixed `/1.8`)
- `bottomDivisor: 1.8`
- `verticalDistanceOffset: 0` (except ceiling if you want `-distance`)
- `phase near/far`: all multipliers `1`, all offsets `0`

## Practical Tuning Tips

- Make corridor narrower with distance:
  - increase `scaleDistanceFactor`, or increase `horizontalDivisor` for a surface.
- Push ceiling upward with depth:
  - use negative `verticalDistanceOffset`, or more negative `phase.far.topOffset`.
- Make floor feel closer near camera:
  - increase `phase.near.heightMultiplier` and/or `phase.near.bottomOffset`.
- Reduce seam gaps between surfaces:
  - small `near`/`far` edge offsets (`left/right/top/bottom`) are usually cleaner than changing base perspective constants.
