import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

/**
 * CorridorStretchRenderer
 *
 * Single-image-per-surface corridor depth renderer.
 *
 * Uses the SAME CSS technique as Room3D:
 *   - CSS `perspective` on the container View (web-only)
 *   - CSS `rotateY` / `rotateX` with `transformOrigin` on the inner View
 *   - Absolute positioning derived from the same getFrameDimensions math
 *
 * Instead of rendering one panel per depth tile (like Room3D does), this renders
 * ONE panel per surface whose position and rotation angle are driven by a single
 * `virtualDistance` that maps from currentArrPos / pathLength:
 *
 *   virtualDistance = 1 + distanceFactor * (MAX_DEPTH - 1)
 *     distanceFactor = 1.0 → player at corridor start → deep perspective
 *     distanceFactor = 0.0 → player near end          → shallow perspective
 *
 * CSS `transition` on all style values gives smooth per-step animation.
 */

const wallTexture  = require('../../resources/Brick_Large.png');
const floorTexture = require('../../resources/Brick_Small.png');

const VIEWPORT_WIDTH  = 512;
const VIEWPORT_HEIGHT = 512;
const CENTER_X = VIEWPORT_WIDTH  / 2;
const CENTER_Y = VIEWPORT_HEIGHT / 2;
const isWeb = Platform.OS === 'web';
const TRANSITION = 'all 0.18s ease-out';

// ── Frame-dimension profiles (mirrored from Room3D) ───────────────────────

interface FrameSurfaceProfile {
    scaleDistanceFactor:    number;
    scaleBase:              number;
    widthBase:              number;
    widthDistanceFactor:    number;
    heightBase:             number;
    heightDistanceFactor:   number;
    horizontalDivisor:      number;
    topDivisorBase:         number;
    topDivisorDistanceFactor: number;
    bottomDivisor:          number;
    verticalDistanceOffset: number;
}

const PROFILES: Record<string, FrameSurfaceProfile> = {
    walls: {
        scaleDistanceFactor: 0.4,   scaleBase: 0.5,
        widthBase: 0.51,            widthDistanceFactor: 0.1,
        heightBase: 0.5,            heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.75,       topDivisorDistanceFactor: 0.25,
        bottomDivisor: 1.72,        verticalDistanceOffset: 0,
    },
    frontWall: {
        scaleDistanceFactor: 0.5,   scaleBase: 0.8,
        widthBase: 1,               widthDistanceFactor: 0.0,
        heightBase: 0.5,            heightDistanceFactor: 0.5,
        horizontalDivisor: 1.0,
        topDivisorBase: 1.0,        topDivisorDistanceFactor: 0.0,
        bottomDivisor: 2.0,         verticalDistanceOffset: 0,
    },
    ceiling: {
        scaleDistanceFactor: 0.4,   scaleBase: 0.48,
        widthBase: 0.54,            widthDistanceFactor: 0.1,
        heightBase: 0.8,            heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.8,        topDivisorDistanceFactor: 0,
        bottomDivisor: 1.8,         verticalDistanceOffset: 0,
    },
    floor: {
        scaleDistanceFactor: 0.4,   scaleBase: 0.5,
        widthBase: 0.51,            widthDistanceFactor: 0.1,
        heightBase: 0.5,            heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.76,       topDivisorDistanceFactor: 0.2,
        bottomDivisor: 1.72,        verticalDistanceOffset: 1,
    },
};

function getFrameDimensions(surface: string, distance: number) {
    const p  = PROFILES[surface];
    const d  = Math.max(0, distance);
    const topDivisor = Math.max(0.7, p.topDivisorBase - d * p.topDivisorDistanceFactor);
    const scale  = 1 / (d * p.scaleDistanceFactor + p.scaleBase);
    const width  = VIEWPORT_WIDTH  * scale * (p.widthBase  + p.widthDistanceFactor  * d);
    const height = VIEWPORT_HEIGHT * scale * (p.heightBase + p.heightDistanceFactor * d);
    const left   = CENTER_X - width  / p.horizontalDivisor;
    const top    = CENTER_Y - height / topDivisor + p.verticalDistanceOffset * d;
    const right  = CENTER_X + width  / p.horizontalDivisor;
    const bottom = CENTER_Y + height / p.bottomDivisor;
    return { width, height, left, top, right, bottom };
}

// ── Fixed layout constants (computed ONCE at baseline vd=1) ─────────────────
//
// All panel positions are FIXED. Nothing moves horizontally or vertically.
// Only the rotation/perspective angle changes with depth to create the stretch.
//
const BASE_D = 1;   // baseline depth = player right at the exit wall

const _ceilNearBase = getFrameDimensions('ceiling', BASE_D);
const _ceilFarBase  = getFrameDimensions('ceiling', BASE_D + 1);
const _floorFarBase = getFrameDimensions('floor',   BASE_D);

// Corridor-opening edges at baseline
const BASE_OPEN_TOP    = _ceilNearBase.top + 75 - BASE_D * 10;
const BASE_OPEN_BOTTOM = _floorFarBase.bottom - 55;

// Side wall constants — rotation is fixed; only left & width animate
const SIDE_WALL_HEIGHT     = 473.5;
const SIDE_WALL_TOP        = (VIEWPORT_HEIGHT - SIDE_WALL_HEIGHT) / 2;
const SIDE_WALL_BASE_WIDTH = 609;   // width at corridor start (farthest tile)
const SIDE_WALL_MIN_WIDTH  = 350;   // width at corridor end (exit wall)
// Anchors keep each wall edge stationary while width shrinks from the other side:
//   Right wall: right edge fixed at 507  (base left -102 + base width 609)
//   Left  wall: right edge fixed at 614  (mirror: VIEWPORT_WIDTH - base left = 512 - (-102))
const RIGHT_WALL_ANCHOR    = 507;
const LEFT_WALL_ANCHOR     = 604;

// Fixed wall positions — X never changes, only the rotation angle animates
const RIGHT_WALL_LEFT = RIGHT_WALL_ANCHOR - SIDE_WALL_BASE_WIDTH;
const LEFT_WALL_LEFT  = LEFT_WALL_ANCHOR  - SIDE_WALL_BASE_WIDTH;

// Floor container
const FLOOR_TOP    = BASE_OPEN_BOTTOM - 20;
const FLOOR_HEIGHT = VIEWPORT_HEIGHT - BASE_OPEN_BOTTOM + 75;

// Ceiling container (Room3D formula evaluated at BASE_D)
const CEIL_BASE_H   = Math.max(0, (_ceilFarBase.top - _ceilNearBase.top) + 20);
const CEIL_TOP      = BASE_OPEN_TOP - BASE_D * 10;
const CEIL_HEIGHT   = CEIL_BASE_H + 25 + BASE_D * 3;
const CEIL_PERSP_ORIGIN = `${CENTER_X - (_ceilNearBase.left - 50)}px 50%`;

interface CorridorStretchRendererProps {
    currentArrPos: number;
    pathLength: number;
}

export const CorridorStretchRenderer: React.FC<CorridorStretchRendererProps> = ({
    currentArrPos,
    pathLength,
}) => {
    // distanceFactor: 0 = player just entered corridor (deep), 1 = at exit wall (baseline)
    const distanceFactor = currentArrPos / Math.max(pathLength - 1, 1);

    // vd: 5 = deepest (just entered), 1 = baseline (at exit wall)
    const vd = Math.max(1, Math.min(5, 5 - distanceFactor * 4));

    // ── Front wall: the ONE thing that changes position/size (it IS the depth cue) ──
    const frontFar = getFrameDimensions('frontWall', vd);

    // ── Side walls: FIXED position + FIXED angle, only perspective animates ────────
    // Smaller perspective = more dramatic stretch (far end); larger = shallower (near exit)
    const wallPerspective = `${300 + distanceFactor * 400}px`; // 300px deep → 700px shallow

    // ── Angles: the ONLY things that change for floor/ceiling ─────────────────
    const floorRotation   = 55 + (vd - 1) * 5;           // 55° baseline → 75° deepest
    const ceilRotation    = vd <= 1.5 ? 102 : 90;         // Room3D's formula
    const ceilPerspective = `${560 - vd * 45}px`;         // tighter perspective when deeper

    return (
        <View style={styles.viewport}>
            <View style={styles.background} />

            {/* ── FRONT WALL — changes size with depth (this IS the depth cue) ── */}
            <View
                style={[
                    styles.segment,
                    {
                        left:   CENTER_X - frontFar.width / 2,
                        top:    CENTER_Y - frontFar.height / 2,
                        width:  frontFar.width,
                        height: frontFar.height,
                        zIndex: 80,
                    },
                    isWeb && { // @ts-ignore
                        transition: TRANSITION,
                    },
                ]}
            >
                <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
            </View>

            {/* ── LEFT WALL — perspective on container, rotateY on inner child ── */}
            <View
                style={[
                    styles.segment,
                    {
                        left:   LEFT_WALL_LEFT,
                        top:    SIDE_WALL_TOP,
                        width:  SIDE_WALL_BASE_WIDTH,
                        height: SIDE_WALL_HEIGHT,
                        zIndex: 90,
                        overflow: 'hidden',
                    },
                    isWeb && { // @ts-ignore
                        perspective: wallPerspective,
                        transition:  TRANSITION,
                    },
                ]}
            >
                <View
                    style={[
                        { width: '200%', height: '100%' },
                        ...(isWeb ? [{ transform: `rotateY(100deg)`, transformOrigin: '0% 50%', transition: TRANSITION } as any] : []),
                    ]}
                >
                    <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                </View>
            </View>

            {/* ── RIGHT WALL — perspective on container, rotateY on inner child ── */}
            <View
                style={[
                    styles.segment,
                    {
                        left:   RIGHT_WALL_LEFT,
                        top:    SIDE_WALL_TOP,
                        width:  SIDE_WALL_BASE_WIDTH,
                        height: SIDE_WALL_HEIGHT,
                        zIndex: 90,
                        overflow: 'hidden',
                    },
                    isWeb && { // @ts-ignore
                        perspective: wallPerspective,
                        transition:  TRANSITION,
                    },
                ]}
            >
                <View
                    style={[
                        { width: '200%', height: '100%', marginLeft: '-100%' },
                        ...(isWeb ? [{ transform: `rotateY(-100deg)`, transformOrigin: '100% 50%', transition: TRANSITION } as any] : []),
                    ]}
                >
                    <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                </View>
            </View>

            {/* ── FLOOR — FIXED container, only floorRotation changes ──────────
                Top pivot: far end (corridor opening bottom) stays fixed.
                More rotateX = texture appears to stretch further into distance. */}
            <View
                style={[
                    styles.segment,
                    {
                        left:     0,
                        top:      FLOOR_TOP,
                        width:    VIEWPORT_WIDTH,
                        height:   FLOOR_HEIGHT,
                        zIndex:   85,
                        overflow: 'hidden',
                    },
                    isWeb && { // @ts-ignore
                        perspective: '400px',
                        transition:  TRANSITION,
                    },
                ]}
            >
                <View
                    style={[
                        { width: '100%', height: '250%', opacity: 0.9 },
                        ...(isWeb ? [{ transform: `rotateX(${floorRotation}deg)`, transformOrigin: '50% 0%', transition: TRANSITION } as any] : []),
                    ]}
                >
                    <Image source={floorTexture} style={styles.segmentImage} resizeMode="repeat" />
                </View>
            </View>

            {/* ── CEILING — FIXED container, Room3D technique, angle+persp vary */}
            {CEIL_HEIGHT > 0 && (
                <View
                    style={[
                        styles.segment,
                        {
                            left:   0,
                            top:    CEIL_TOP,
                            width:  VIEWPORT_WIDTH,
                            height: CEIL_HEIGHT,
                            zIndex: 91,
                        },
                        isWeb && { // @ts-ignore
                            perspective:       ceilPerspective,
                            perspectiveOrigin: CEIL_PERSP_ORIGIN,
                            transition:        TRANSITION,
                        },
                    ]}
                >
                    <View
                        style={[
                            { width: '126%', height: '350%', marginTop: '-110%' },
                            ...(isWeb ? [{ transform: `rotateX(${ceilRotation}deg)`, transformOrigin: '50% 90% 30px', transition: TRANSITION } as any] : []),
                        ]}
                    >
                        <Image
                            source={wallTexture}
                            style={[styles.segmentImage, { transform: [{ rotate: '90deg' }] }]}
                            resizeMode="repeat"
                        />
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    viewport: {
        width:           VIEWPORT_WIDTH,
        height:          VIEWPORT_HEIGHT,
        overflow:        'hidden',
        position:        'relative',
        backgroundColor: '#0a0a12',
        borderWidth:     2,
        borderColor:     '#333',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0a0a12',
    },
    segment: {
        position: 'absolute',
    },
    segmentImage: {
        width:  '100%',
        height: '100%',
    },
});

export default CorridorStretchRenderer;
