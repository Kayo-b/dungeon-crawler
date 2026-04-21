import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Direction } from '../../types/map';
import {
    CENTER_X,
    CENTER_Y,
    FULLSCREEN_FRAME,
    VIEWPORT_HEIGHT,
    VIEWPORT_WIDTH,
    getFacingWallState,
    getFrameDimensions,
} from './room3DShared';

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
const isWeb = Platform.OS === 'web';
const TRANSITION = 'all 0.18s ease-out';

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
const FLOOR_TOP    = BASE_OPEN_BOTTOM +50;
const FLOOR_HEIGHT = VIEWPORT_HEIGHT - BASE_OPEN_BOTTOM + 75;

// Ceiling container (Room3D formula evaluated at BASE_D)
const CEIL_BASE_H   = Math.max(0, (_ceilFarBase.top - _ceilNearBase.top) + 20);
const CEIL_TOP      = BASE_OPEN_TOP - BASE_D * 10;
const CEIL_HEIGHT   = CEIL_BASE_H + 25 + BASE_D * 3;
const CEIL_PERSP_ORIGIN = `${CENTER_X - (_ceilNearBase.left - 50)}px 50%`;

interface CorridorStretchRendererProps {
    currentArrPos: number;
    pathLength: number;
    lastTurnDir: string;
    positionX: number;
    positionY: number;
    direction: Direction;
    mapTiles: number[][];
    mapWidth: number;
    mapHeight: number;
}

export const CorridorStretchRenderer: React.FC<CorridorStretchRendererProps> = ({
    currentArrPos,
    pathLength,
    lastTurnDir,
    positionX,
    positionY,
    direction,
    mapTiles,
    mapWidth,
    mapHeight,
}) => {
    // distanceFactor: 0 = player just entered corridor (deep), 1 = at exit wall (baseline)
    const distanceFactor = currentArrPos / Math.max(pathLength - 1, 1);

    const facingWallState = getFacingWallState(
        positionX,
        positionY,
        direction,
        mapTiles,
        mapWidth,
        mapHeight,
    );
    const shouldSnapFacingWall = facingWallState.facingWall && lastTurnDir !== '';
    const motionTransition = shouldSnapFacingWall ? 'none' : TRANSITION;
    // vd: 5 = deepest (just entered), 1 = baseline (at exit wall)
    const vd = facingWallState.facingWall
        ? 1
        : Math.max(1, Math.min(5, 5 - distanceFactor * 5));

    // ── Front wall: the ONE thing that changes position/size (it IS the depth cue) ──
    const frontFar = getFrameDimensions('frontWall', vd);
    const facingWallFrame = getFrameDimensions('walls', 1);
    const immediateLeftWidth = facingWallFrame.left - FULLSCREEN_FRAME.left;
    const immediateRightWidth = FULLSCREEN_FRAME.right - facingWallFrame.right;

    // ── Side walls: FIXED position + FIXED angle, only perspective animates ────────
    // Smaller perspective = more dramatic stretch (far end); larger = shallower (near exit)
    const wallPerspective = `${300 + distanceFactor * 400}px`; // 300px deep → 700px shallow

    // ── Angles: (floor and ceiling now computed inside JSX using Room3D technique) ──
    // ceilRotation and ceilPerspective are computed inline per vd

    return (
        <View style={styles.viewport}>
            <View style={styles.background} />

            {/* ── FRONT WALL — changes size with depth (this IS the depth cue) ── */}
            {facingWallState.facingWall ? (
                <View
                    style={[
                        styles.segment,
                        {
                            left: FULLSCREEN_FRAME.left,
                            top: FULLSCREEN_FRAME.top - 40,
                            width: FULLSCREEN_FRAME.right - FULLSCREEN_FRAME.left,
                            height: FULLSCREEN_FRAME.bottom - FULLSCREEN_FRAME.top,
                            zIndex: 89,
                        },
                        isWeb && { // @ts-ignore
                            transition: motionTransition,
                        },
                    ]}
                >
                    <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                </View>
            ) : (
                <View
                    style={[
                        styles.segment,
                        {
                            left: CENTER_X - frontFar.width / 2,
                            top: CENTER_Y - frontFar.height / 2,
                            width: frontFar.width,
                            height: frontFar.height,
                            zIndex: 80,
                        },
                        isWeb && { // @ts-ignore
                            transition: motionTransition,
                        },
                    ]}
                >
                    <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                </View>
            )}

            {/* ── LEFT WALL — perspective on container, rotateY on inner child ── */}
            {facingWallState.showLeftWall && (
                facingWallState.facingWall ? (
                    <View
                        style={[
                            styles.segment,
                            {
                                left: -70,
                                top: -95,
                                width: immediateLeftWidth + 100,
                                height: 450,
                                zIndex: 90,
                            },
                            isWeb && { // @ts-ignore
                                perspective: '300px',
                                transition: motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '200%', height: '200%' },
                                ...(isWeb ? [{ transform: 'rotateY(65deg)', transformOrigin: '0% 50%', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                    </View>
                ) : (
                    <View
                        style={[
                            styles.segment,
                            {
                                left: LEFT_WALL_LEFT,
                                top: SIDE_WALL_TOP,
                                width: SIDE_WALL_BASE_WIDTH,
                                height: SIDE_WALL_HEIGHT,
                                zIndex: 90,
                                overflow: 'hidden',
                            },
                            isWeb && { // @ts-ignore
                                perspective: wallPerspective,
                                transition: motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '200%', height: '100%' },
                                ...(isWeb ? [{ transform: 'rotateY(100deg)', transformOrigin: '0% 50%', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                    </View>
                )
            )}

            {/* ── RIGHT WALL — perspective on container, rotateY on inner child ── */}
            {facingWallState.showRightWall && (
                facingWallState.facingWall ? (
                    <View
                        style={[
                            styles.segment,
                            {
                                left: facingWallFrame.right - 100,
                                top: -40,
                                width: immediateRightWidth + 100,
                                height: 482,
                                zIndex: 90,
                            },
                            isWeb && { // @ts-ignore
                                perspective: '330px',
                                transition: motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '200%', height: '100%', marginLeft: '-100%' },
                                ...(isWeb ? [{ transform: 'rotateY(-65deg)', transformOrigin: '100% 50%', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                    </View>
                ) : (
                    <View
                        style={[
                            styles.segment,
                            {
                                left: RIGHT_WALL_LEFT,
                                top: SIDE_WALL_TOP,
                                width: SIDE_WALL_BASE_WIDTH,
                                height: SIDE_WALL_HEIGHT,
                                zIndex: 90,
                                overflow: 'hidden',
                            },
                            isWeb && { // @ts-ignore
                                perspective: wallPerspective,
                                transition: motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '200%', height: '100%', marginLeft: '-100%' },
                                ...(isWeb ? [{ transform: 'rotateY(-100deg)', transformOrigin: '100% 50%', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image source={wallTexture} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                    </View>
                )
            )}

            {/* ── FLOOR — one panel per depth tile, farthest first (Room3D technique) ── */}
            {Array.from({ length: Math.round(vd) }, (_, i) => {
                const d = Math.round(vd) - i; // render far→near so near panels sit on top
                const floorFar  = getFrameDimensions('floor', d);
                const floorNear = d === 1
                    ? { left: 0, right: VIEWPORT_WIDTH, bottom: VIEWPORT_HEIGHT }
                    : getFrameDimensions('floor', d - 1);
                const floorHeight = (floorNear as any).bottom - floorFar.bottom;
                if (floorHeight <= 0) return null;
                return (
                    <View
                        key={`floor-${d}`}
                        style={[
                            styles.segment,
                            {
                                left:   (floorNear as any).left + (d % 2 === 0 ? d * 5 : -d * 5),
                                top:    floorFar.bottom - 55,
                                width:  ((floorNear as any).right - (floorNear as any).left) + d * 20,
                                height: floorHeight + 20,
                                zIndex: 88 - d,
                            },
                            isWeb && { // @ts-ignore
                                perspective: '400px',
                                transition:  motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '100%', height: '250%', opacity: 0.9 },
                                ...(isWeb ? [{ transform: `rotateX(60deg)`, transformOrigin: '50% 0%', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image source={floorTexture} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                    </View>
                );
            })}

            {/* ── CEILING — one panel per depth tile, farthest first (Room3D technique) ── */}
            {Array.from({ length: Math.round(vd) }, (_, i) => {
                const d = Math.round(vd) - i; // render far→near so near panels sit on top
                const ceilingFar  = getFrameDimensions('ceiling', d + 1);
                const ceilingNear = getFrameDimensions('ceiling', d);
                const ceilingHeight = (ceilingFar.top - ceilingNear.top) + 20;
                if (ceilingHeight <= 0) return null;
                const ceilingTop         = (d === 2 ? ceilingNear.top + 90 : ceilingNear.top + 75);
                const ceilingOuterHeight = ceilingHeight + 25;
                const ceilRotation       = d === 1 ? 102 : 90;
                const ceilPersp          = `${560 - d * 45}px`;
                const ceilOrigin         = `${CENTER_X - (ceilingNear.left - 50)}px 50%`;
                return (
                    <View
                        key={`ceiling-${d}`}
                        style={[
                            styles.segment,
                            {
                                left:   ceilingNear.left - 60,
                                top:    ceilingTop - d * 10,
                                width:  ceilingNear.right - ceilingNear.left + d * 8,
                                height: ceilingOuterHeight + d * 3,
                                zIndex: 92 - d,
                            },
                            isWeb && { // @ts-ignore
                                perspective:       ceilPersp,
                                perspectiveOrigin: ceilOrigin,
                                transition:        motionTransition,
                            },
                        ]}
                    >
                        <View
                            style={[
                                { width: '126%', height: '350%', marginTop: '-110%' },
                                ...(isWeb ? [{ transform: `rotateX(${ceilRotation}deg)`, transformOrigin: '50% 90% 30px', transition: motionTransition } as any] : []),
                            ]}
                        >
                            <Image
                                source={wallTexture}
                                style={styles.segmentImage}
                                resizeMode="repeat"
                            />
                        </View>
                    </View>
                );
            })}
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
