# Room Tile Forge

Generates the **fully-built room cells** that the classic 2D renderer (`classic2d` in
`src/features/room/Room.tsx`) stacks — one 512×512 PNG per cell type, each containing
its own back wall, side walls, ceiling and floor.

It is a standalone tool. It lives outside `src/`, so Expo never bundles it, and it
touches nothing in the game unless you point the `require`s at its output yourself.

```
npm run forge           # editor at http://localhost:5173/tools/room-tile-forge/
npm run forge:export    # batch-render every variant to src/resources/generated/
```

## Why the tiles look the way they do

The renderer paints cells **nearest-to-furthest at shrinking scale** (`0.77`, `0.67`,
then `0.67/i + 0.1`), so a further cell is drawn *on top of* a nearer one and covers
its back wall. Two consequences drive the whole design:

1. **A cell only encodes its side openings.** Forward is never a variant — whatever is
   ahead overpaints the back wall anyway. That is why the set is corridor / turn-left /
   turn-right / three-way and not a combinatorial explosion.
2. **The last cell in a strip closes the corridor by itself**, because its own back wall
   is never overpainted. Nothing needs to add a wall cap.

Use the **in-game stack** preview to judge a tile. On its own a cell is misleading —
most of it ends up hidden behind the cells in front.

## Layout

| File | Role |
|---|---|
| `renderer.mjs` | The generator. Pure: takes a canvas, a config and loaded images. |
| `variants.mjs` | The nine variant definitions, all derived from one base preset. |
| `index.html` | The editor — live preview, stack preview, every parameter. |
| `export.mjs` | Headless batch export via Playwright. |
| `serve.mjs` | Zero-dependency static server (see *Why a server* below). |
| `presets/default.json` | The shipped tuning. |

The editor and the exporter both call `renderCell` from `renderer.mjs`, so batch output
is pixel-identical to what you tuned on screen.

## Variants

| id | file | notes |
|---|---|---|
| `corridor` | `corridor.png` | No side openings. |
| `turnLeft` | `turn-left.png` | Opening on the viewer's left. |
| `turnRight` | `turn-right.png` | Opening on the viewer's right. |
| `threeWay` | `threeway.png` | Openings on both sides. |
| `fourWay` | `fourway.png` | **Identical artwork to `threeWay` by construction** — the forward cell overpaints the back wall, so a crossing and a T look the same from the viewer. Emitted separately so the renderer can reference its own file. |
| `deadEnd` | `dead-end.png` | No openings, back wall lit as a near surface. |
| `door` | `door.png` | Corridor with a door panel in the aperture. |
| `stairsUp` | `stairs-up.png` | Flight climbing away from the viewer. |
| `stairsDown` | `stairs-down.png` | Flight dropping away from the viewer. |

## Parameters

**Geometry** — `apertureWidth` / `apertureHeight` / `apertureCenterY` place the cell's far
face; `depthRatio` is the near:far size ratio, the single knob controlling how hard the
texture foreshortens. `1.0` is affine (evenly spaced brick courses all the way back),
`2.0` matches an aperture half the width of the near opening.

Defaults are measured from the existing hand-made art (`dung-corridor.png` and friends):
aperture `x 128→384`, `y ≈190→385` — the centred half-width with the horizon above centre.

**Surfaces** — `backWall`, `leftWall`, `rightWall`, `ceiling`, `floor` each take a texture,
`tilesX`/`tilesY` repeats, `offsetX`/`offsetY`, and `shadeNear`/`shadeFar` (black overlay
alpha at the near and far ends of the surface).

**Side passage** — what an *open* side is drawn with. The masonry is laid down under the
neighbouring wall's lighting, then `lip` of the band nearest the aperture is left lit as
the corner post while the rest sinks under a `shadeNear`→`shadeFar` gradient. The corner
post is what makes an opening read as a gap rather than as a patch of darker wall.

**Door / Stairs** — panel size and shading; step count, width, rise, convergence, tread
depth and nosing highlight.

## Textures

The only textures in the tree are `Brick_Large.png` (walls and ceiling, also copied as
`brickwall.png`) and `Brick_Small.png` (floor) — the same two `Room3D.tsx` and
`CorridorStretchRenderer.tsx` use. The grey stone and gravel of the current `dung-*.png`
art exist only baked into those pre-rendered images, so **forged tiles look like the 3D
and STR modes, not like today's 2D art.** Drop new PNGs into `src/resources` and they
appear in the texture dropdowns automatically.

Measured against the originals, the forged set reproduces the left/right signature the
renderer depends on — an open side at `0.42×` the brightness of a closed one, against
`0.43×` in the hand-made art — on a base that is about 17% dimmer because `Brick_Large`
is a darker stone than the original.

## Why a server

Exporting needs to read pixels back out of a canvas, and a page opened over `file://`
taints the canvas the moment it draws a `file://` image. `serve.mjs` is ~60 lines of
`node:http` with no dependencies; `export.mjs` starts it on an ephemeral port internally,
so the batch path is still a single command.

## CLI

```
node tools/room-tile-forge/export.mjs [options]

  --preset <file>   preset JSON to render        (default: presets/default.json)
  --out <dir>       output directory             (default: src/resources/generated)
  --only <ids>      comma-separated variant ids  (default: all)
```

Tune in the editor → **Download preset** → `npm run forge:export -- --preset <path>`.
