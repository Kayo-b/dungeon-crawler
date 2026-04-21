import { Direction } from '../../types/map';

export const VIEWPORT_WIDTH = 512;
export const VIEWPORT_HEIGHT = 512;
export const CENTER_X = VIEWPORT_WIDTH / 2;
export const CENTER_Y = VIEWPORT_HEIGHT / 2;

export type FrameSurface = 'walls' | 'frontWall' | 'ceiling' | 'floor';
export type FramePhase = 'near' | 'far';

export interface FrameDimensions {
    width: number;
    height: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
    scale: number;
}

interface FramePhaseProfile {
    widthMultiplier: number;
    heightMultiplier: number;
    scaleMultiplier: number;
    leftOffset: number;
    topOffset: number;
    rightOffset: number;
    bottomOffset: number;
}

interface FrameSurfaceProfile {
    scaleDistanceFactor: number;
    scaleBase: number;
    widthBase: number;
    widthDistanceFactor: number;
    heightBase: number;
    heightDistanceFactor: number;
    horizontalDivisor: number;
    topDivisorBase: number;
    topDivisorDistanceFactor: number;
    bottomDivisor: number;
    verticalDistanceOffset: number;
    phase: Record<FramePhase, FramePhaseProfile>;
}

export const FULLSCREEN_FRAME: FrameDimensions = {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    left: 0,
    top: 0,
    right: VIEWPORT_WIDTH,
    bottom: VIEWPORT_HEIGHT,
    scale: 1,
};

const FRAME_SURFACE_PROFILES: Record<FrameSurface, FrameSurfaceProfile> = {
    walls: {
        scaleDistanceFactor: 0.4,
        scaleBase: 0.5,
        widthBase: 0.51,
        widthDistanceFactor: 0.1,
        heightBase: 0.5,
        heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.75,
        topDivisorDistanceFactor: 0.25,
        bottomDivisor: 1.72,
        verticalDistanceOffset: 0,
        phase: {
            near: { widthMultiplier: 1.02, heightMultiplier: 1.02, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
            far: { widthMultiplier: 1, heightMultiplier: 1, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
        },
    },
    frontWall: {
        scaleDistanceFactor: 0.5,
        scaleBase: 0.8,
        widthBase: 1,
        widthDistanceFactor: 0,
        heightBase: 0.5,
        heightDistanceFactor: 0.5,
        horizontalDivisor: 1,
        topDivisorBase: 1,
        topDivisorDistanceFactor: 0,
        bottomDivisor: 2,
        verticalDistanceOffset: 0,
        phase: {
            near: { widthMultiplier: 1, heightMultiplier: 1, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
            far: { widthMultiplier: 1, heightMultiplier: 1, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
        },
    },
    ceiling: {
        scaleDistanceFactor: 0.4,
        scaleBase: 0.48,
        widthBase: 0.54,
        widthDistanceFactor: 0.1,
        heightBase: 0.8,
        heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.8,
        topDivisorDistanceFactor: 0,
        bottomDivisor: 1.8,
        verticalDistanceOffset: 0,
        phase: {
            near: { widthMultiplier: 1, heightMultiplier: 1, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
            far: { widthMultiplier: 1, heightMultiplier: 1, scaleMultiplier: 1, leftOffset: 0, topOffset: 0, rightOffset: 0, bottomOffset: 0 },
        },
    },
    floor: {
        scaleDistanceFactor: 0.4,
        scaleBase: 0.5,
        widthBase: 0.51,
        widthDistanceFactor: 0.1,
        heightBase: 0.5,
        heightDistanceFactor: 0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.76,
        topDivisorDistanceFactor: 0.2,
        bottomDivisor: 1.72,
        verticalDistanceOffset: 1,
        phase: {
            near: { widthMultiplier: 1.01, heightMultiplier: 1.08, scaleMultiplier: 1, leftOffset: 0, topOffset: 6, rightOffset: 0, bottomOffset: 8 },
            far: { widthMultiplier: 0.97, heightMultiplier: 0.88, scaleMultiplier: 1, leftOffset: 0, topOffset: 3, rightOffset: 0, bottomOffset: -8 },
        },
    },
};

export function getFrameDimensions(
    surface: FrameSurface,
    distance: number,
    phase: FramePhase = 'far',
): FrameDimensions {
    const profile = FRAME_SURFACE_PROFILES[surface];
    const phaseProfile = profile.phase[phase];
    const clampedDistance = Math.max(0, distance);
    const topDivisor = Math.max(
        0.7,
        profile.topDivisorBase - clampedDistance * profile.topDivisorDistanceFactor,
    );

    const scale = (
        1 / (clampedDistance * profile.scaleDistanceFactor + profile.scaleBase)
    ) * phaseProfile.scaleMultiplier;
    const width = (
        VIEWPORT_WIDTH * scale * (
            profile.widthBase + profile.widthDistanceFactor * clampedDistance
        )
    ) * phaseProfile.widthMultiplier;
    const height = (
        VIEWPORT_HEIGHT * scale * (
            profile.heightBase + profile.heightDistanceFactor * clampedDistance
        )
    ) * phaseProfile.heightMultiplier;

    const left = CENTER_X - width / profile.horizontalDivisor + phaseProfile.leftOffset;
    const top = (
        CENTER_Y - height / topDivisor
        + profile.verticalDistanceOffset * clampedDistance
        + phaseProfile.topOffset
    );
    const right = CENTER_X + width / profile.horizontalDivisor + phaseProfile.rightOffset;
    const bottom = CENTER_Y + height / profile.bottomDivisor + phaseProfile.bottomOffset;

    return { width, height, left, top, right, bottom, scale };
}

const getFacingVectors = (direction: Direction) => {
    if (direction === 'N') return { forward: { x: 0, y: -1 }, left: { x: -1, y: 0 } };
    if (direction === 'S') return { forward: { x: 0, y: 1 }, left: { x: 1, y: 0 } };
    if (direction === 'E') return { forward: { x: 1, y: 0 }, left: { x: 0, y: -1 } };
    return { forward: { x: -1, y: 0 }, left: { x: 0, y: 1 } };
};

export function getFacingWallState(
    positionX: number,
    positionY: number,
    direction: Direction,
    mapTiles: number[][],
    mapWidth: number,
    mapHeight: number,
) {
    const getTileTypeAt = (x: number, y: number) => {
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return 0;
        return mapTiles[y]?.[x] ?? 0;
    };

    const isWalkable = (x: number, y: number) => getTileTypeAt(x, y) > 0;
    const vectors = getFacingVectors(direction);
    const right = { x: -vectors.left.x, y: -vectors.left.y };

    const facingWall = !isWalkable(positionX + vectors.forward.x, positionY + vectors.forward.y);
    const leftOpen = isWalkable(positionX + vectors.left.x, positionY + vectors.left.y);
    const rightOpen = isWalkable(positionX + right.x, positionY + right.y);
    const showNoSideWalls = facingWall && leftOpen && rightOpen;
    const showLeftOnly = facingWall && rightOpen && !leftOpen;
    const showRightOnly = facingWall && leftOpen && !rightOpen;

    return {
        facingWall,
        leftOpen,
        rightOpen,
        showLeftWall: !showNoSideWalls && !showRightOnly,
        showRightWall: !showNoSideWalls && !showLeftOnly,
    };
}
