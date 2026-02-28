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

        for (let d = 1; d <= viewDistance; d++) {
            let tileX = positionX;
            let tileY = positionY;

            switch (direction) {
                case 'N': tileY = positionY - d; break;
                case 'S': tileY = positionY + d; break;
                case 'E': tileX = positionX + d; break;
                case 'W': tileX = positionX - d; break;
            }
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
                const type = mapTiles[tileY]?.[tileX] ?? 0;
                tiles.push({ x: tileX, y: tileY, type, distance: d });
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

    // Get corridor opening at each distance
    const getFrameDimensionsWalls = (distance: number) => {
        const scale = 1 / (distance * 0.4 + 0.5);//set to second var to 0.9 gives narrowing corridor effect
        const width = VIEWPORT_WIDTH * scale * (0.51 + (0.2 * distance / 2));
        const height = VIEWPORT_HEIGHT * scale * (0.5 + (0.2 * distance / 4));
        const left = CENTER_X - width / 1.8;
        const top = CENTER_Y - height / (1.8 - distance/4) ;// set 1.8 -/- distance/x  to give going up/down effect   
        const right = CENTER_X + width / 1.8;
        const bottom = CENTER_Y + height / 1.8;
        return { width, height, left, top, right, bottom, scale };
    };

     // Get corridor opening at each distance
    const getFrameDimensionsCeiling = (distance: number) => {
        const scale = 1 / (distance * 0.4 + 0.5);//set to second var to 0.9 gives narrowing corridor effect
        const width = VIEWPORT_WIDTH * scale * (0.51 + (0.2 * distance / 2));
        const height = VIEWPORT_HEIGHT * scale * (0.5 + (0.2 * distance / 4));
        const left = CENTER_X - width / 1.8;
        const top = CENTER_Y - height / 1.8 - distance;// set 1.8 -/- distance/x  to give going up/down effect   
        const right = CENTER_X + width / 1.8;
        const bottom = CENTER_Y + height / 1.8;
        return { width, height, left, top, right, bottom, scale };
    };   // Get corridor opening at each distance

    const getFrameDimensionsFloor = (distance: number) => {
        const scale = 1 / (distance * 0.4 + 0.5);//set to second var to 0.9 gives narrowing corridor effect
        const width = VIEWPORT_WIDTH * scale * (0.51 + (0.2 * distance / 2));
        const height = VIEWPORT_HEIGHT * scale * (0.5 + (0.2 * distance / 4));
        const left = CENTER_X - width / 1.8;
        const top = CENTER_Y - height / (1.8 - distance/4) ;// set 1.8 -/- distance/x  to give going up/down effect   
        const right = CENTER_X + width / 1.8;
        const bottom = CENTER_Y + height / 1.8;
        return { width, height, left, top, right, bottom, scale };
    };


    const getBrightness = (_distance: number) => {
        return 1;
    };

    const getFogPaintOpacity = (distance: number) => {
        return Math.max(0, Math.min(0.58, (distance - 1) * 0.14));
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

            const far = getFrameDimensionsWalls(d);
            const near = d === 1
                ? { left: 0, right: VIEWPORT_WIDTH, top: 0, bottom: VIEWPORT_HEIGHT}
                : getFrameDimensionsWalls(d - 1);

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
                const wallFaceLeft = isImmediateWall ? near.left : far.left;
                const wallFaceTop = isImmediateWall ? near.top - 40 : far.top;
                const wallFaceWidth = isImmediateWall ? near.right - near.left : far.width + 40;
                const wallFaceHeight = isImmediateWall ? near.bottom - near.top - 40 : far.height - 40;
                const wallFaceZ = isImmediateWall ? 96 : 90 - d;
                frames.push(
                    <View
                        key={`wall-front-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: wallFaceLeft,
                                top: wallFaceTop,
                                width: wallFaceWidth,
                                height: wallFaceHeight,
                                opacity: brightness,
                                zIndex: wallFaceZ,
                            }
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
                                left: far.left,
                                top: far.top,
                                width: far.width,
                                height: far.height,
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
            const ceilingRotation = 100;
            const lastTileCeilingRotation = -65;

            // LEFT WALL - full height from near.top to near.bottom
            const isLastTile = d === 1 && isWall;
            const leftWidth = far.left - near.left;
            if (leftWidth > 0 && showLeftWall) {

                frames.push(
                    <View
                        key={`wall-left-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: isLastTile ? - 70 : near.left,
                                top: isLastTile ? near.top - 95 : near.top - 40, // Extend beyond to fill gaps
                                width: isLastTile ? leftWidth + 100 : leftWidth + 100,
                                height: isLastTile ? 450 : near.bottom - near.top + 10 + (d - 1) * 4,
                                zIndex: 99 - d,
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
                                    testID={`door-side-left-${d}`}
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
            const rightWidth = near.right - far.right;
            if (rightWidth > 0 && showRightWall) {
                frames.push(
                    <View
                        key={`wall-right-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: far.right - 100,
                                top: near.top - 40,
                                width: rightWidth + 100,
                                height: near.bottom - near.top + 10 + (d - 1) * 4,
                                zIndex: 99 - d,
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
            const floorHeight = near.bottom - far.bottom;
            if (floorHeight > 0) {
                frames.push(
                    <View
                        key={`floor-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: near.left - 20,
                                top: far.bottom - 75,
                                width: near.right - near.left + 40,
                                height: floorHeight + 10,
                                zIndex: 89 - d,
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
            const ceilingHeight = far.top - near.top;
            if (ceilingHeight > 0) {
                const isLastTile = d === 1 && isWall;
                const ceilingTop = isLastTile ? Math.max(0, near.top - 6) : near.top + 130;
                const ceilingOuterHeight = isLastTile ? Math.max(70, ceilingHeight + 56) : ceilingHeight + 20;
                const ceilingOuterZ = isLastTile ? 88 - d : 88 - d;
                const ceilingInnerHeight = isLastTile ? '400%' : '500%';
                const ceilingInnerMarginTop = isLastTile ? '0%' : '-100%';
                const ceilingTransform = isLastTile
                    ? `rotateX(${lastTileCeilingRotation}deg)`
                    : `rotateX(-${ceilingRotation}deg)`;
                const ceilingTransformOrigin = isLastTile ? '50% 0%' : '50% 100%';

                frames.push(
                    <View
                        key={`ceiling-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: near.left - 20,
                                top: ceilingTop,
                                width: near.right - near.left + 10,// this relates to perspective for ceiling length
                                height: ceilingOuterHeight,
                                zIndex: ceilingOuterZ,
                            },
                            isWeb && {
                                // @ts-ignore
                                perspective: '350px',
                            }
                        ]}
                    >
                        <View
                            style={[
                                {
                                    width: '100%',
                                    height: ceilingInnerHeight,
                                    marginTop: ceilingInnerMarginTop,
                                    opacity: isLastTile ? brightness * 0.85 : brightness * 0.7,
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
                <View style={styles.debugOverlay}>
                    <Text style={styles.debugText}>
                        3D Mode | Pos: ({positionX}, {positionY}) | Dir: {direction}
                    </Text>
                    <Text style={styles.debugText}>
                        Tiles ahead: {tilesAhead.length}
                    </Text>
                </View>
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
