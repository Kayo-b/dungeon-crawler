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
    const getFrameDimensions = (distance: number) => {
        const scale = 1 / (distance * 0.4 + 0.5);
        const width = VIEWPORT_WIDTH * scale * (0.51 + (0.2 * distance/2));
        const height = VIEWPORT_HEIGHT * scale * (0.5 + (0.2 * distance/4));
        const left = CENTER_X - width / 1.8;
        const top = CENTER_Y - height / 1.8;
        const right = CENTER_X + width / 1.8;
        const bottom = CENTER_Y + height / 1.8;
        return { width, height, left, top, right, bottom, scale };
        // distance = 4;
        // if(distance === 2) {
        //     console.log('distance', distance)
        //     const scale = 1 / distance;
        //     const width = VIEWPORT_WIDTH * scale;
        //     const height = VIEWPORT_HEIGHT * scale;
        //     const left = CENTER_X - width / 1;
        //     const top = CENTER_Y - height / 2;
        //     const right = CENTER_X + width / 1;
        //     const bottom = CENTER_Y + height / 1;
        //     return { width, height, left, top, right, bottom, scale };
        // } else {
        //     console.log('distance', distance)
        //     const scale = 1 / distance;
        //     const width = VIEWPORT_WIDTH * scale;
        //     const height = VIEWPORT_HEIGHT * scale;
        //     const left = CENTER_X - width / 1;
        //     const top = CENTER_Y - height / 2;
        //     const right = CENTER_X + width / 1;
        //     const bottom = CENTER_Y + height / 1;
        //     return { width, height, left, top, right, bottom, scale };

        // }
    };

    const getBrightness = (distance: number) => {
        
        // return 1;
        return Math.max(0.3, 1 - distance * 0.12);
    };

    const isWeb = Platform.OS === 'web';

    const renderFrames = () => {
        const frames: React.ReactNode[] = [];

        // Render from far to near
        for (let i = tilesAhead.length - 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ; i >= 0; i--) {
            const tile = tilesAhead[i];
            const d = tile.distance;
            const brightness = getBrightness(d);

            const far = getFrameDimensions(d);
            const near = d === 1
                ? { left: 0, right: VIEWPORT_WIDTH, top: 0, bottom: VIEWPORT_HEIGHT }
                : getFrameDimensions(d - 1);

            const isWall = tile.type === 0;
            const isDoorAhead = tile.type === 5;
            const doorPlacement = isDoorAhead ? getDoorPlacement(tile.x, tile.y) : 'none';

            // Front wall face
            if (isWall) {
                frames.push(
                    <View
                        key={`wall-front-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: far.left,
                                top: far.top,
                                width: far.width,
                                height: far.height,
                                opacity: brightness,
                                zIndex: 100 - d,
                            }
                        ]}
                    >
                        <Image source={brickLarge} style={styles.segmentImage} resizeMode="repeat" />
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
                            activeOpacity={0.9}
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
                    </View>
                );
            }

            // Wall rotation - moderate angle for visibility while creating depth
            const wallRotation = 59.8 + (d - 1) * 4;
            const floorRotation = 60;
            const ceilingRotation= 100;

            // LEFT WALL - full height from near.top to near.bottom
            const leftWidth = far.left - near.left;
            if (leftWidth > 0) {
                frames.push(
                    <View
                        key={`wall-left-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: near.left,
                                top: near.top - 20, // Extend beyond to fill gaps
                                width: leftWidth + 10,
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
                                    resizeMode="contain"
                                />
                            )}
                        </View>
                    </View>
                );
            }

            // RIGHT WALL - full height from near.top to near.bottom
            const rightWidth = near.right - far.right;
            if (rightWidth > 0) {
                frames.push(
                    <View
                        key={`wall-right-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: far.right - 10,
                                top: near.top - 20,
                                width: rightWidth + 10,
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
                                    style={[styles.doorPlane, styles.doorRightCentered, {height:`${120 + d * 5}%`}]}
                                    resizeMode="contain"
                                />
                            )}
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
                                top: far.bottom,
                                width: near.right - near.left + 40,
                                height: floorHeight + 20,
                                zIndex: 98 - d,
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
                                    width: '100%',
                                    height: '200%',
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
                    </View>
                );
            }

            // CEILING - full width, tilting AWAY (bottom edge goes back into distance)
            const ceilingHeight = far.top - near.top;
            if (ceilingHeight > 0) {
                frames.push(
                    <View
                        key={`ceiling-${d}`}
                        style={[
                            styles.segment,
                            {
                                left: near.left - 20,
                                top: near.top + 130,
                                width: near.right - near.left + 40,
                                height: ceilingHeight + 20,
                                zIndex: 98 - d,
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
                                    width: '100%',
                                    height: '500%',
                                    marginTop: '-100%',
                                    opacity: brightness * 0.7,
                                },
                                isWeb && {
                                    // @ts-ignore
                                    transform: `rotateX(-${ceilingRotation}deg)`,
                                    transformOrigin: '50% 100%',
                                }
                            ]}
                        >
                            <Image source={brickSmall} style={styles.segmentImage} resizeMode="repeat" />
                        </View>
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
