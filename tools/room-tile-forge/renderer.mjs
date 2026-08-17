/**
 * Room Tile Forge - renderer
 *
 * Draws one "fully built room cell" of the kind the classic 2D renderer stacks:
 * a 512x512 image containing its own back wall, side walls, ceiling and floor,
 * with optional openings to the left and/or right.
 *
 * The classic 2D renderer paints cells nearest-to-furthest at shrinking scale,
 * so each cell's back wall is overdrawn by the next one. That is why a cell only
 * ever needs to encode its *side* openings - forward is never a variant.
 *
 * This module is pure: it takes a canvas plus already-loaded HTMLImageElements
 * and draws. Both the editor (index.html) and the batch exporter (export.mjs)
 * call `renderCell`, so what you tune is exactly what ships.
 */

/**
 * Perspective-correct interpolation across a receding band.
 *
 * `t` runs 0 (near edge) -> 1 (far edge) in *screen* space. Texture coordinates
 * cannot follow it linearly or the brick courses stay evenly spaced instead of
 * bunching up towards the far end. Interpolating 1/z linearly and dividing back
 * out is exact for the one-point case, and `depthRatio` (near:far size ratio) is
 * the only knob it needs. depthRatio === 1 degenerates to affine.
 */
export function perspectiveT(t, depthRatio) {
    const d = Math.max(1e-6, depthRatio);
    return t / (d * (1 - t) + t);
}

/** Resolve the aperture (the cell's far face) in pixels for a given canvas size. */
export function apertureRect(size, geometry) {
    const halfW = (size * geometry.apertureWidth) / 2;
    const halfH = (size * geometry.apertureHeight) / 2;
    const cx = size / 2;
    const cy = size * geometry.apertureCenterY;
    return { left: cx - halfW, right: cx + halfW, top: cy - halfH, bottom: cy + halfH };
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Wrap a texture coordinate into [0, 1). */
const wrap01 = v => {
    const m = v % 1;
    return m < 0 ? m + 1 : m;
};

/**
 * Draw a vertical-strip band: a wall receding from a screen edge to the aperture.
 * Used for the left and right walls, where each screen column is one texture column.
 */
function drawVerticalBand(ctx, tex, opts) {
    const { xNear, xFar, yTopNear, yBotNear, yTopFar, yBotFar, surface, depthRatio } = opts;
    const span = Math.abs(xFar - xNear);
    if (span < 1) return;

    const step = xFar >= xNear ? 1 : -1;
    const texW = tex.naturalWidth || tex.width;
    const texH = tex.naturalHeight || tex.height;

    for (let i = 0; i <= span; i++) {
        const x = xNear + step * i;
        const t = i / span;
        const u = perspectiveT(t, depthRatio);
        const sx = Math.min(texW - 1, Math.floor(wrap01(u * surface.tilesX + surface.offsetX) * texW));

        const yTop = lerp(yTopNear, yTopFar, t);
        const yBot = lerp(yBotNear, yBotFar, t);
        const h = yBot - yTop;
        if (h <= 0) continue;

        const dx = step > 0 ? x : x - 1;

        // A wall's vertical axis does not foreshorten (it is parallel to the image
        // plane), so the texture simply repeats tilesY times over the column.
        const rows = Math.max(1, surface.tilesY);
        const rowH = h / rows;
        for (let r = 0; r < rows; r++) {
            ctx.drawImage(tex, sx, 0, 1, texH, dx, yTop + r * rowH, 1, rowH + 0.5);
        }

        const shade = lerp(surface.shadeNear, surface.shadeFar, t);
        if (shade > 0) {
            ctx.fillStyle = `rgba(0,0,0,${clamp01(shade)})`;
            ctx.fillRect(dx, yTop, 1, h);
        }
    }
}

/**
 * Draw a horizontal-strip band: ceiling or floor receding from a screen edge to
 * the aperture. Each screen row is one texture row.
 */
function drawHorizontalBand(ctx, tex, opts) {
    const { yNear, yFar, xLeftNear, xRightNear, xLeftFar, xRightFar, surface, depthRatio } = opts;
    const span = Math.abs(yFar - yNear);
    if (span < 1) return;

    const step = yFar >= yNear ? 1 : -1;
    const texW = tex.naturalWidth || tex.width;
    const texH = tex.naturalHeight || tex.height;

    for (let i = 0; i <= span; i++) {
        const y = yNear + step * i;
        const t = i / span;
        const v = perspectiveT(t, depthRatio);
        const sy = Math.min(texH - 1, Math.floor(wrap01(v * surface.tilesY + surface.offsetY) * texH));

        const xL = lerp(xLeftNear, xLeftFar, t);
        const xR = lerp(xRightNear, xRightFar, t);
        const w = xR - xL;
        if (w <= 0) continue;

        const dy = step > 0 ? y : y - 1;
        ctx.drawImage(tex, 0, sy, texW, 1, xL, dy, w, 1);

        const shade = lerp(surface.shadeNear, surface.shadeFar, t);
        if (shade > 0) {
            ctx.fillStyle = `rgba(0,0,0,${clamp01(shade)})`;
            ctx.fillRect(xL, dy, w, 1);
        }
    }
}

/** Fill a path with a flat, tiled texture (no perspective) then darken it. */
function fillPathWithTexture(ctx, tex, path, rect, surface, shade) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();

    const tileW = rect.w / Math.max(1, surface.tilesX);
    const tileH = rect.h / Math.max(1, surface.tilesY);
    for (let ty = 0; ty < surface.tilesY; ty++) {
        for (let tx = 0; tx < surface.tilesX; tx++) {
            ctx.drawImage(tex, rect.x + tx * tileW, rect.y + ty * tileH, tileW, tileH);
        }
    }

    if (shade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${clamp01(shade)})`;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
}

/** The cell's far face: a flat tiled wall filling the aperture. */
function drawBackWall(ctx, tex, ap, surface) {
    const rect = { x: ap.left, y: ap.top, w: ap.right - ap.left, h: ap.bottom - ap.top };
    fillPathWithTexture(
        ctx,
        tex,
        c => c.rect(rect.x, rect.y, rect.w, rect.h),
        rect,
        surface,
        surface.shadeNear
    );
}

/**
 * An open side.
 *
 * The wall band is drawn normally first - what you see through the gap is the
 * neighbouring corridor's own masonry, so the texture must still be there - and
 * then the part of the band that is *missing* is sunk in shadow. A lip adjacent
 * to the aperture is left lit: that is the corner post between this cell and the
 * side passage, and it is what makes the opening read as a gap rather than as a
 * patch of darker wall.
 */
function drawSidePassage(ctx, tex, side, size, ap, surface, wall, geometry) {
    const isLeft = side === 'left';
    const bandEdge = isLeft ? 0 : size;
    const bandFar = isLeft ? ap.left : ap.right;

    // Lay the masonry down under the wall's own lighting, not the passage's - the
    // passage shades are the *void*, and applying them here as well would darken
    // the gap twice and swallow the corner post along with it.
    drawVerticalBand(ctx, tex, {
        xNear: bandEdge, xFar: bandFar,
        yTopNear: 0, yBotNear: size,
        yTopFar: ap.top, yBotFar: ap.bottom,
        surface: { ...surface, shadeNear: wall.shadeNear, shadeFar: wall.shadeFar },
        depthRatio: geometry.depthRatio,
    });

    // The void spans the band from the screen edge up to the corner post.
    const lip = clamp01(surface.lip);
    const tVoid = 1 - lip;
    const xVoid = lerp(bandEdge, bandFar, tVoid);
    const yTopVoid = lerp(0, ap.top, tVoid);
    const yBotVoid = lerp(size, ap.bottom, tVoid);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bandEdge, 0);
    ctx.lineTo(xVoid, yTopVoid);
    ctx.lineTo(xVoid, yBotVoid);
    ctx.lineTo(bandEdge, size);
    ctx.closePath();
    ctx.clip();

    const g = ctx.createLinearGradient(bandEdge, 0, xVoid, 0);
    g.addColorStop(0, `rgba(0,0,0,${clamp01(surface.shadeNear)})`);
    g.addColorStop(1, `rgba(0,0,0,${clamp01(surface.shadeFar)})`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(bandEdge, xVoid), 0, Math.abs(xVoid - bandEdge), size);
    ctx.restore();
}

/** A door panel standing in the aperture. */
function drawDoor(ctx, doorTex, ap, door) {
    const apW = ap.right - ap.left;
    const apH = ap.bottom - ap.top;
    const w = apW * door.width;
    const h = apH * door.height;
    const x = (ap.left + ap.right) / 2 - w / 2;
    const y = ap.bottom - h;

    if (doorTex) {
        ctx.drawImage(doorTex, x, y, w, h);
    } else {
        ctx.fillStyle = '#241a12';
        ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = Math.max(1, apW * 0.012);
    ctx.strokeRect(x, y, w, h);

    if (door.shade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${clamp01(door.shade)})`;
        ctx.fillRect(x, y, w, h);
    }
}

/**
 * A flight of stairs in the aperture. Treads are drawn as receding bands with the
 * floor texture; risers are the same texture held darker so the steps read at the
 * small scales the renderer shrinks these tiles to.
 */
function drawStairs(ctx, tex, ap, stairs, direction) {
    const apW = ap.right - ap.left;
    const apH = ap.bottom - ap.top;
    const cx = (ap.left + ap.right) / 2;
    const steps = Math.max(2, stairs.steps);
    const texW = tex.naturalWidth || tex.width;
    const texH = tex.naturalHeight || tex.height;

    ctx.save();
    ctx.beginPath();
    ctx.rect(ap.left, ap.top, apW, apH);
    ctx.clip();

    // A flight only reads as stairs if the two faces of each step contrast: the
    // riser is a vertical face turned away from the light, the tread a horizontal
    // face catching it. Drawing both from the same texture at the same brightness
    // just produces a grid, so the shading is what carries the shape - and it has
    // to survive the renderer scaling these tiles down to a third of their size.
    const yStart = direction === 'up' ? ap.bottom : ap.top + apH * stairs.mouth;
    const dir = direction === 'up' ? -1 : 1;

    // Far steps first so nearer ones overlap them, as they would in the real solid.
    for (let i = steps - 1; i >= 0; i--) {
        const t = i / steps;
        const tNext = (i + 1) / steps;

        const halfW = (apW * stairs.width * lerp(1, stairs.converge, t)) / 2;
        const halfWNext = (apW * stairs.width * lerp(1, stairs.converge, tNext)) / 2;

        const y = yStart + dir * apH * stairs.rise * t;
        const yNext = yStart + dir * apH * stairs.rise * tNext;
        const riserTop = Math.min(y, yNext);
        const riserH = Math.max(1, Math.abs(yNext - y));

        // Depth shading: further along the flight is deeper in the dark.
        const depth = direction === 'up' ? t : t;
        const shade = lerp(stairs.shadeNear, stairs.shadeFar, depth);

        // Riser - vertical face.
        ctx.drawImage(tex, 0, 0, texW, texH, cx - halfW, riserTop, halfW * 2, riserH);
        ctx.fillStyle = `rgba(0,0,0,${clamp01(shade)})`;
        ctx.fillRect(cx - halfW, riserTop, halfW * 2, riserH);

        // Tread - the horizontal face on top of the riser, one notch lighter.
        const treadH = Math.max(1, riserH * clamp01(stairs.tread));
        const treadY = direction === 'up' ? riserTop : riserTop + riserH - treadH;
        ctx.drawImage(tex, 0, 0, texW, texH, cx - halfWNext, treadY, halfWNext * 2, treadH);
        ctx.fillStyle = `rgba(0,0,0,${clamp01(Math.max(0, shade - stairs.treadLift))})`;
        ctx.fillRect(cx - halfWNext, treadY, halfWNext * 2, treadH);

        // Nosing highlight along the step edge.
        if (stairs.edgeLight > 0) {
            ctx.fillStyle = `rgba(255,255,255,${clamp01(stairs.edgeLight * (1 - depth))})`;
            ctx.fillRect(cx - halfWNext, treadY, halfWNext * 2, Math.max(1, apH * 0.008));
        }
    }

    ctx.restore();
}

/** Radial darkening towards the frame edges. */
function drawVignette(ctx, size, vignette) {
    if (!vignette || vignette.strength <= 0) return;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${clamp01(vignette.strength)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
}

/**
 * Render one room cell.
 *
 * @param {HTMLCanvasElement} canvas  destination, resized to config.size
 * @param {object} config             see presets/default.json
 * @param {Record<string, HTMLImageElement>} textures  keyed by file name
 */
export function renderCell(canvas, config, textures) {
    const size = config.size;
    const ss = Math.max(1, config.supersample | 0);
    const N = size * ss;

    const work = canvas.ownerDocument.createElement('canvas');
    work.width = N;
    work.height = N;
    const ctx = work.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const geo = config.geometry;
    const ap = apertureRect(N, geo);
    const S = config.surfaces;
    const tex = name => textures[name] || textures[Object.keys(textures)[0]];

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, N, N);

    // Ceiling and floor first, then side walls, then the back wall on top - the
    // same near-to-far ordering the game uses, so seams are always covered by the
    // surface that is closer to the aperture.
    drawHorizontalBand(ctx, tex(S.ceiling.texture), {
        yNear: 0, yFar: ap.top,
        xLeftNear: 0, xRightNear: N,
        xLeftFar: ap.left, xRightFar: ap.right,
        surface: S.ceiling, depthRatio: geo.depthRatio,
    });

    drawHorizontalBand(ctx, tex(S.floor.texture), {
        yNear: N, yFar: ap.bottom,
        xLeftNear: 0, xRightNear: N,
        xLeftFar: ap.left, xRightFar: ap.right,
        surface: S.floor, depthRatio: geo.depthRatio,
    });

    if (config.openings.left) {
        drawSidePassage(ctx, tex(S.passage.texture), 'left', N, ap, S.passage, S.leftWall, geo);
    } else {
        drawVerticalBand(ctx, tex(S.leftWall.texture), {
            xNear: 0, xFar: ap.left,
            yTopNear: 0, yBotNear: N,
            yTopFar: ap.top, yBotFar: ap.bottom,
            surface: S.leftWall, depthRatio: geo.depthRatio,
        });
    }

    if (config.openings.right) {
        drawSidePassage(ctx, tex(S.passage.texture), 'right', N, ap, S.passage, S.rightWall, geo);
    } else {
        drawVerticalBand(ctx, tex(S.rightWall.texture), {
            xNear: N, xFar: ap.right,
            yTopNear: 0, yBotNear: N,
            yTopFar: ap.top, yBotFar: ap.bottom,
            surface: S.rightWall, depthRatio: geo.depthRatio,
        });
    }

    drawBackWall(ctx, tex(S.backWall.texture), ap, S.backWall);

    const f = config.features || {};
    if (f.stairs === 'up' || f.stairs === 'down') {
        drawStairs(ctx, tex(S.floor.texture), ap, config.stairs, f.stairs);
    }
    if (f.door) {
        drawDoor(ctx, textures[config.door.texture], ap, config.door);
    }

    drawVignette(ctx, N, config.vignette);

    canvas.width = size;
    canvas.height = size;
    const out = canvas.getContext('2d');
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = 'high';
    out.clearRect(0, 0, size, size);
    out.drawImage(work, 0, 0, N, N, 0, 0, size, size);
    return canvas;
}
