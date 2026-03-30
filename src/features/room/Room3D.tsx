import React from 'react';
import { View, Text, StyleSheet, Platform, Image, TouchableOpacity } from 'react-native';

/**
 * Room3D - 3D dungeon renderer
 *
 * Renders corridor with tilted wall/floor/ceiling segments.
 * Walls extend full height, floor/ceiling extend full width to eliminate gaps.
 */

interface Room3DProps {
    positionX: number;
    positionY: number;
    direction: string;
    mapTiles: number[][];
    mapWidth: number;
    mapHeight: number;
    viewDistance?: number;
    onDoorInteract?: () => void;
}

const brickLarge = require('../../resources/Brick_Large.png');
const brickSmall = require('../../resources/Brick_Small.png');
const doorSprite = require('../../resources/door_parts/door_cut.png');

const VIEWPORT_WIDTH = 512;
const VIEWPORT_HEIGHT = 512;
const CENTER_X = VIEWPORT_WIDTH / 2;
const CENTER_Y = VIEWPORT_HEIGHT / 2;

type FrameSurface = 'walls' | 'frontWall' | 'ceiling' | 'floor';
type FramePhase = 'near' | 'far';

interface FrameDimensions {
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

const FULLSCREEN_FRAME: FrameDimensions = {
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
        scaleDistanceFactor: 0.4,
        scaleBase: 0.4,
        widthBase: 0.51,
        widthDistanceFactor: 0.5,
        heightBase: 0.5,
        heightDistanceFactor: 0.05,//0.05,
        horizontalDivisor: 1.8,
        topDivisorBase: 1.8,
        topDivisorDistanceFactor: 0.25,
        bottomDivisor: 1.8,
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

export const Room3D: React.FC<Room3DProps> = ({
    positionX,
    positionY,
    direction,
    mapTiles,
    mapWidth,
    mapHeight,
    viewDistance = 5,
    onDoorInteract,
}) => {
    type DoorPlacement = 'none' | 'front' | 'left' | 'right';
    interface TurnOptions {
        leftOpen: boolean;
        rightOpen: boolean;
    }

    const getTileTypeAt = (x: number, y: number) => {
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return 0;
        return mapTiles[y]?.[x] ?? 0;
    };

    const getForwardTilePos = (distance: number) => {
        let x = positionX;
        let y = positionY;
        switch (direction) {
            case 'N': y = positionY - distance; break;
            case 'S': y = positionY + distance; break;
            case 'E': x = positionX + distance; break;
            case 'W': x = positionX - distance; break;
        }
        return { x, y };
    };

    const getFacingVectors = () => {
        if (direction === 'N') return { forward: { x: 0, y: -1 }, left: { x: -1, y: 0 } };
        if (direction === 'S') return { forward: { x: 0, y: 1 }, left: { x: 1, y: 0 } };
        if (direction === 'E') return { forward: { x: 1, y: 0 }, left: { x: 0, y: -1 } };
        return { forward: { x: -1, y: 0 }, left: { x: 0, y: 1 } };
    };

    const isWalkable = (x: number, y: number): boolean => {
        return getTileTypeAt(x, y) > 0;
    };

    const getTurnOptionsAtDistance = (distance: number): TurnOptions => {
        const tilePos = getForwardTilePos(Math.max(0, distance));
        const vectors = getFacingVectors();
        const right = { x: -vectors.left.x, y: -vectors.left.y };
        return {
            leftOpen: isWalkable(tilePos.x + vectors.left.x, tilePos.y + vectors.left.y),
            rightOpen: isWalkable(tilePos.x + right.x, tilePos.y + right.y),
        };
    };

    const getDoorPlacement = (tileX: number, tileY: number): DoorPlacement => {
        const vectors = getFacingVectors();
        const right = { x: -vectors.left.x, y: -vectors.left.y };

        const isOutOfBounds = (x: number, y: number) => x < 0 || y < 0 || x >= mapWidth || y >= mapHeight;
        const tileState = (x: number, y: number): 'out' | 'wall' | 'open' => {
            if (isOutOfBounds(x, y)) return 'out';
            return (mapTiles[y]?.[x] ?? 0) === 0 ? 'wall' : 'open';
        };

        const leftState = tileState(tileX + vectors.left.x, tileY + vectors.left.y);
        const rightState = tileState(tileX + right.x, tileY + right.y);
        const frontState = tileState(tileX + vectors.forward.x, tileY + vectors.forward.y);

        if (leftState === 'out' && rightState !== 'out') return 'left';
        if (rightState === 'out' && leftState !== 'out') return 'right';
        if (frontState === 'out') return 'front';

        if (leftState === 'wall' && rightState !== 'wall') return 'left';
        if (rightState === 'wall' && leftState !== 'wall') return 'right';
        if (frontState === 'wall') return 'front';

        return 'none';
    };

    const getTilesAhead = () => {
        const tiles: { x: number; y: number; type: number; distance: number }[] = [];
        const maxScanDistance = Math.max(mapWidth, mapHeight) + 1;

        for (let d = 1; d <= maxScanDistance; d++) {
            let tileX = positionX;
            let tileY = positionY;
            const isWithinViewDistance = d <= viewDistance;

            switch (direction) {
                case 'N': tileY = positionY - d; break;
                case 'S': tileY = positionY + d; break;
                case 'E': tileX = positionX + d; break;
                case 'W': tileX = positionX - d; break;
            }
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
                const type = mapTiles[tileY]?.[tileX] ?? 0;
                    tiles.push({ x: tileX, y: tileY, type, distance: d });
                // if (isWithinViewDistance || type === 0) {
                //     tiles.push({ x: tileX, y: tileY, type, distance: d });
                // }
                if (type === 0) break;
            } else {
                tiles.push({ x: tileX, y: tileY, type: 0, distance: d });
                break;
            }
        }

        return tiles;
    };

    const tilesAhead = getTilesAhead();
    const isOnDoorTile = getTileTypeAt(positionX, positionY) === 5;
    const currentTileDoorPlacement = isOnDoorTile ? getDoorPlacement(positionX, positionY) : 'none';

    const getFrameDimensions = (
        surface: FrameSurface,
        distance: number,
        phase: FramePhase = 'far',
    ): FrameDimensions => {
        const profile = FRAME_SURFACE_PROFILES[surface];
        const phaseProfile = profile.phase[phase];
        const clampedDistance =  Math.max(0, distance);
        const topDivisor = Math.max(
            0.7,
            profile.topDivisorBase - clampedDistance * profile.topDivisorDistanceFactor
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
    };
 

    const getBrightness = (_distance: number) => {
        return 1;
    };

    const getFogPaintOpacity = (distance: number) => {
        return 0;Math.max(0, Math.min(0.58, (distance - 1) * 0.14));
    };

    const isWeb = Platform.OS === 'web';

    const renderFrames = () => {
        const frames: React.ReactNode[] = [];

        // Render from far to near
        for (let i = tilesAhead.length - 1; i >= 0; i--) {
            const tile = tilesAhead[i];
            const d = tile.distance;
            const brightness = getBrightness(d);
            const fogPaintOpacity = getFogPaintOpacity(d);

            const wallFar = getFrameDimensions('walls', d, 'far');
            const wallNear = d === 1
                ? FULLSCREEN_FRAME
                : getFrameDimensions('walls', d - 1, 'near');
            const frontFar = getFrameDimensions('frontWall', d, 'far');
            const frontNear = d === 1
                ? FULLSCREEN_FRAME
                : getFrameDimensions('frontWall', d - 1, 'near');
            const ceilingFar = getFrameDimensions('ceiling', d + 1, 'far');
            const ceilingNear = getFrameDimensions('ceiling', d, 'near');
            const floorFar = getFrameDimensions('floor', d, 'far');
            const floorNear = d === 1
                ? FULLSCREEN_FRAME
                : getFrameDimensions('floor', d - 1, 'near');

            const isWall = tile.type === 0;
            const isDoorAhead = tile.type === 5;
            const doorPlacement = isDoorAhead ? getDoorPlacement(tile.x, tile.y) : 'none';
            const isImmediateWall = isWall && d === 1;
            const approachDistance = isWall ? Math.max(0, d - 1) : d;
            const turnOptions = getTurnOptionsAtDistance(approachDistance);
            const showNoSideWalls = isWall && turnOptions.leftOpen && turnOptions.rightOpen;
            const showLeftOnly = isWall && turnOptions.rightOpen && !turnOptions.leftOpen;
            const showRightOnly = isWall && turnOptions.leftOpen && !turnOptions.rightOpen;
            const showLeftWall = !showNoSideWalls && !showRightOnly;
            const showRightWall = !showNoSideWalls && !showLeftOnly;

            // Front wall face
            if (isWall) {
                const wallFaceLeft = isImmediateWall ? frontNear.left : 110;//frontFar.left;
                const wallFaceTop = isImmediateWall ? frontNear.top - 40 : 150 ;
                const wallFaceWidth = isImmediateWall ? frontNear.right - frontNear.left : 300 +(150/d)//frontFar.width + 40;
                const wallFaceHeight = isImmediateWall ? frontNear.bottom - frontNear.top - 40 : 80 + (300/d);//frontFar.height - 40;
                const wallFaceZ = isImmediateWall ? 89 : 89 - d;
                console.log('FRONT WALL : ', wallFaceTop)
                frames.push(
                    <View
                        key={`wall-front-${d}`}
                        testID='wall-front-facing'
                        style={[
                            styles.segment,
                            {
                                left: wallFaceLeft,
                                top: wallFaceTop,
                                width: wallFaceWidth,
                                height: wallFaceHeight,
                                opacity: brightness,
                                zIndex: wallFaceZ,
                            },
                        ]}
                    >
                        <Image source={brickLarge} style={styles.segmentImage} resizeMode="repeat" />
                        <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity }]} />
                    </View>
                );
            }

            const renderDoorOnFrontWall =
                (isDoorAhead && doorPlacement === 'front') ||
                (d === 1 && isWall && currentTileDoorPlacement === 'front');

            if (renderDoorOnFrontWall) {
                frames.push(
                    <View
                        key={`door-front-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: frontFar.left,
                                top: frontFar.top,
                                width: frontFar.width,
                                height: frontFar.height,
                                zIndex: 101 - d,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: '300px',
                            }
                        ]}
                    >
                        <TouchableOpacity
                            onPress={onDoorInteract}
                            disabled={!isOnDoorTile || !onDoorInteract}
                            style={styles.doorInteractWrap}
                        >
                            <Image
                                testID={`door-front-${d}`}
                                source={doorSprite}
                                style={[styles.doorPlane, styles.doorFrontCentered]}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                        <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity }]} />
                    </View>
                );
            }

            // Wall rotation - moderate angle for visibility while creating depth
            const wallRotation = 65 + (d - 1) * 4;
            const floorRotation = 60;
            const ceilingRotation = d === 1 ? 102 : 90;

            // LEFT WALL - full height from near.top to near.bottom
            const isLastTile = d === 1 && isWall;
            const leftWidth = wallFar.left - wallNear.left;
            if (leftWidth > 0 && showLeftWall) {

                frames.push(
                    <View
                        key={`wall-left-${d}`}
                        testID={`wall-test-id${d}`}
                        style={[
                            styles.segment,
                            {
                                left: isLastTile ? - 70 : wallNear.left,
                                top: isLastTile ? wallNear.top - 95 : wallNear.top - 40, // Extend beyond to fill gaps
                                width: isLastTile ? leftWidth + 100 : leftWidth + 100,
                                height: isLastTile ? 450 : wallNear.bottom - wallNear.top + 15 + (d - 1) * 2,
                                zIndex: d === 1 ? 280 : 91 - d,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: '300px',
                            }
                        ]}
                    >
                        <View
                            style={[
                                {
                                    width: '200%',
                                    height: isLastTile ? '200%' : '100%',
                                    opacity: brightness,
                                },
                                isWeb && {
                                    // @ts-ignore
                                    transform: `rotateY(${wallRotation}deg)`,
                                    transformOrigin: '0% 50%',
                                }
                            ]}
                        >
                            <Image source={brickLarge} style={styles.segmentImage} resizeMode="repeat" />
                            {doorPlacement === 'left' && (
                                <Image
                                    source={doorSprite}
                                    style={[styles.doorPlane, styles.doorLeftCentered]}
                                    resizeMode= {isLastTile ? "cover" : "repeat"}
                                />
                            )}
                            <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity }]} />
                        </View>
                    </View>
                );

            }

            // RIGHT WALL - full height from near.top to near.bottom
            const rightWidth = wallNear.right - wallFar.right;
            if (rightWidth > 0 && showRightWall) {
                frames.push(
                    <View
                        key={`wall-right-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: wallFar.right - 100,
                                top: wallNear.top - 40,
                                width: rightWidth + 100,
                                height: wallNear.bottom - wallNear.top + 10 + (d - 1) * 4,
                                zIndex: d === 1 ? 280 : 91 - d,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: '330px',
                            }
                        ]}
                    >
                        <View
                            style={[
                                {
                                    width: '200%',
                                    height: '100%',
                                    marginLeft: '-100%',
                                    opacity: brightness,
                                },
                                isWeb && {
                                    // @ts-ignore
                                    transform: `rotateY(-${wallRotation}deg)`,
                                    transformOrigin: '100% 50%',
                                }
                            ]}
                        >
                            <Image source={brickLarge} style={styles.segmentImage} resizeMode="repeat" />
                            {doorPlacement === 'right' && (
                                <Image
                                    testID={`door-side-right-${d}`}
                                    source={doorSprite}
                                    style={[styles.doorPlane, styles.doorRightCentered, { height: `${120 + d * 5}%` }]}
                                    resizeMode="contain"
                                />
                            )}
                            <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity }]} />
                        </View>
                    </View>
                );
            }

            // FLOOR - full width, tilting AWAY (top edge goes back into distance)
            const floorHeight = floorNear.bottom - floorFar.bottom;
            if (floorHeight > 0) {
                {console.log(floorHeight,'FLOOR COUNT <<<')}
                frames.push(
                    <View
                        key={`floor-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: floorNear.left + (d % 2 === 0 ? d * 5 : -d * 5),
                                top: floorFar.bottom - 55,
                                width: floorNear.right - floorNear.left + (d*20),
                                height: floorHeight + 20,
                                zIndex: 88 - d,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: '400px',
                            }
                        ]}
                    >
                        <View
                            style={[
                                {
                                    width: '100%',
                                    height: '250%',
                                    opacity: brightness * 0.9,
                                },
                                isWeb && {
                                    // @ts-ignore
                                    transform: `rotateX(${floorRotation}deg)`,
                                    transformOrigin: '50% 0%',
                                }
                            ]}
                        >
                            <Image source={brickSmall} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
                        <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity * 0.85 }]} />
                    </View>
                );
            }

            // CEILING - full width, tilting AWAY (bottom edge goes back into distance)
            const ceilingHeight = (ceilingFar.top - ceilingNear.top) + 20;
            console.log(ceilingFar, 'ceiling far stats')
            console.log(ceilingNear, 'ceiling near stats')
            console.log(floorFar, 'floor far stats')
            console.log(floorNear, 'floor near stats')
            if (ceilingHeight >  0) {
                const ceilingTop = d === 2 ? ceilingNear.top + 90 : ceilingNear.top + 75;
                const ceilingOuterHeight = ceilingHeight + 25;
                const sideWallZ = (d === 1 && isWall) ? 280 : 91 - d;
                const ceilingZ = sideWallZ + 1;
                const ceilingInnerHeight = '350%';
                const ceilingInnerMarginTop = '-110%';
                const ceilingTransform = `rotateX(${ceilingRotation}deg)`;
                const ceilingTransformOrigin = '50% 90% 30px';

                {console.log(ceilingHeight,'CEILING COUNT <<<')}
                frames.push(
                    <View
                        key={`ceiling-${d}`}
                        testID={`ceilingTestId-${ceilingHeight}---${d} ${isLastTile}`}
                        style={[
                            styles.segment,
                            {
                                left: ceilingNear.left - 60,// tile alignment depends on this value
                                top: ceilingTop - d*10,
                                width: ceilingNear.right - ceilingNear.left  + d*8,// this relates to perspective for ceiling length
                                height: ceilingOuterHeight + (d < 3 ? d* 3 : d * 3),
                                zIndex: ceilingZ,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: `${560 - d*45}px`,
                                perspectiveOrigin: `${CENTER_X - (ceilingNear.left - 50)}px 50%`,//tile alignment
                            }
                        ]}
                    >
                        <View
                            style={[
                                {
                                    width: '126%',
                                    height: ceilingInnerHeight,
                                    marginTop: ceilingInnerMarginTop,
                                    opacity: 1,//isLastTile ? brightness * 0.85 : brightness * 0.7,
                                },
                                isWeb && {
                                    // @ts-ignore
                                    transform: ceilingTransform,
                                    transformOrigin: ceilingTransformOrigin,
                                }
                            ]}
                        >
                            <Image source={brickSmall} style={styles.segmentImage} resizeMode="repeat"/>
                        </View>
                        <View pointerEvents="none" style={[styles.fogPaint, { opacity: fogPaintOpacity * 0.9 }]} />
                    </View>
                );
            }
        }

        return frames;
    };

    return (
        <View style={styles.container}>
            <View style={styles.viewport}>
                <View style={styles.background} />
                {renderFrames()}
                {/* <View style={styles.debugOverlay}>
                    <Text style={styles.debugText}>
                        3D Mode | Pos: ({positionX}, {positionY}) | Dir: {direction}
                    </Text>
                    <Text style={styles.debugText}>
                        Tiles ahead: {tilesAhead.length}
                    </Text>
                </View> */}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a12',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewport: {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        backgroundColor: '#0a0a12',
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 2,
        borderColor: '#333',
    },
    background: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a12',
    },
    segment: {
        position: 'absolute',
    },
    fogPaint: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
    },
    segmentImage: {
        width: '100%',
        height: '100%',
    },
    doorPlane: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: 500,
    },
    doorInteractWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    doorFrontCentered: {
        width: '42%',
        height: '120%',
        left: '29%',
        top: '5%',
        right: 'auto',
        bottom: 'auto',
    },
    doorLeftCentered: {
        width: '30%',
        height: '120%',
        left: '10%',
        top: '8%',
        right: 'auto',
        bottom: 'auto',
    },
    doorRightCentered: {
        width: '150%',
        height: '122%',
        left: 'auto',
        top: '8%',
        right: '20%',
        bottom: 'auto',
    },
    debugOverlay: {
        position: 'absolute',
        top: 5,
        left: 5,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 5,
        borderRadius: 3,
        zIndex: 200,
    },
    debugText: {
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
    },
});

export default Room3D;
