import React from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';

/**
 * Room3D - 3D dungeon renderer using CSS 3D transforms
 *
 * Uses perspective and rotateX/rotateY transforms to create
 * tilted walls, floor, and ceiling for realistic 3D corridor effect.
 */

interface Room3DProps {
    positionX: number;
    positionY: number;
    direction: string;
    mapTiles: number[][];
    mapWidth: number;
    mapHeight: number;
    viewDistance?: number;
}

// Import brick sprites
const brickLarge = require('../../resources/Brick_Large.png');
const brickSmall = require('../../resources/Brick_Small.png');

// Viewport dimensions
const VIEWPORT_WIDTH = 600;
const VIEWPORT_HEIGHT = 600;

export const Room3D: React.FC<Room3DProps> = ({
    positionX,
    positionY,
    direction,
    mapTiles,
    mapWidth,
    mapHeight,
    viewDistance = 5,
}) => {
    // Generate tiles ahead based on direction
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

            // Check bounds
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
                const type = mapTiles[tileY]?.[tileX] ?? 0;
                tiles.push({ x: tileX, y: tileY, type, distance: d });

                // Stop at walls
                if (type === 0) break;
            } else {
                // Out of bounds = wall
                tiles.push({ x: tileX, y: tileY, type: 0, distance: d });
                break;
            }
        }

        return tiles;
    };

    const tilesAhead = getTilesAhead();
    const maxDistance = tilesAhead.length > 0 ? tilesAhead[tilesAhead.length - 1].distance : 1;
    const hasEndWall = tilesAhead.length > 0 && tilesAhead[tilesAhead.length - 1].type === 0;

    // Calculate brightness based on distance (fog effect)
    const getBrightness = (distance: number) => {
        return Math.max(0.3, 1 - distance * 0.12);
    };

    // For web, we can use CSS 3D transforms
    const isWeb = Platform.OS === 'web';

    return (
        <View style={styles.container}>
            {/* Perspective container for 3D effect */}
            <View
                style={[
                    styles.viewport,
                    isWeb && {
                        // @ts-ignore - web-specific style
                        perspective: '800px',
                        perspectiveOrigin: '50% 50%',
                    }
                ]}
            >
                {/* Background - dark for unlit areas */}
                <View style={styles.background} />

                {/* Floor - tilted plane going into distance */}
                <View
                    style={[
                        styles.floor,
                        isWeb && {
                            // @ts-ignore - web-specific transform
                            transform: 'rotateX(70deg)',
                            transformOrigin: '50% 0%',
                        }
                    ]}
                >
                    <Image
                        source={brickSmall}
                        style={[styles.floorImage, { opacity: getBrightness(2) }]}
                        resizeMode="repeat"
                    />
                </View>

                {/* Ceiling - tilted plane going into distance */}
                <View
                    style={[
                        styles.ceiling,
                        isWeb && {
                            // @ts-ignore - web-specific transform
                            transform: 'rotateX(-70deg)',
                            transformOrigin: '50% 100%',
                        }
                    ]}
                >
                    <Image
                        source={brickSmall}
                        style={[styles.ceilingImage, { opacity: getBrightness(2) * 0.7 }]}
                        resizeMode="repeat"
                    />
                </View>

                {/* Left Wall - tilted toward center */}
                <View
                    style={[
                        styles.leftWall,
                        isWeb && {
                            // @ts-ignore - web-specific transform
                            transform: 'rotateY(35deg)',
                            transformOrigin: '100% 50%',
                        }
                    ]}
                >
                    <Image
                        source={brickLarge}
                        style={[styles.wallImage, { opacity: getBrightness(1) }]}
                        resizeMode="repeat"
                    />
                </View>

                {/* Right Wall - tilted toward center */}
                <View
                    style={[
                        styles.rightWall,
                        isWeb && {
                            // @ts-ignore - web-specific transform
                            transform: 'rotateY(-75deg)',
                            transformOrigin: '0% 50%',
                        }
                    ]}
                >
                    <Image
                        source={brickLarge}
                        style={[styles.wallImage, { opacity: getBrightness(1) }]}
                        resizeMode="repeat"
                    />
                </View>

                {/* End Wall - flat wall at the end of corridor */}
                {hasEndWall && (
                    <View
                        style={[
                            styles.endWall,
                            {
                                // Scale based on distance - further = smaller
                                width: VIEWPORT_WIDTH * (0.4 / maxDistance),
                                height: VIEWPORT_HEIGHT * (0.5 / maxDistance),
                                opacity: getBrightness(maxDistance),
                            }
                        ]}
                    >
                        <Image
                            source={brickLarge}
                            style={styles.endWallImage}
                            resizeMode="cover"
                        />
                    </View>
                )}

                {/* Depth indicators - lines to show corridor depth */}
                {tilesAhead.map((tile, idx) => {
                    if (tile.type === 0) return null; // Skip wall tiles for depth lines
                    const d = tile.distance;
                    const scale = 1 / (d * 0.5 + 0.5);
                    const corridorWidth = VIEWPORT_WIDTH * scale * 0.35;
                    const corridorHeight = VIEWPORT_HEIGHT * scale * 0.6;

                    return (
                        <View
                            key={`depth-${d}`}
                            style={[
                                styles.depthFrame,
                                {
                                    width: corridorWidth,
                                    height: corridorHeight,
                                    borderColor: `rgba(60, 60, 80, ${0.3 / d})`,
                                }
                            ]}
                        />
                    );
                })}

                {/* Debug overlay */}
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
        backgroundColor: '#1a1a1a',
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
    floor: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: VIEWPORT_HEIGHT * 0.6,
        overflow: 'hidden',
    },
    floorImage: {
        width: '100%',
        height: '100%',
    },
    ceiling: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: VIEWPORT_HEIGHT * 0.5,
        overflow: 'hidden',
    },
    ceilingImage: {
        width: '100%',
        height: '100%',
    },
    leftWall: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: VIEWPORT_WIDTH * 0.5,
        overflow: 'hidden',
    },
    rightWall: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: VIEWPORT_WIDTH * 0.5,
        overflow: 'hidden',
    },
    wallImage: {
        width: '100%',
        height: '100%',
    },
    endWall: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        overflow: 'hidden',
        // Center the wall
        transform: [{ translateX: -50 }, { translateY: -50 }],
    },
    endWallImage: {
        width: '100%',
        height: '100%',
    },
    depthFrame: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        borderWidth: 1,
        transform: [{ translateX: -50 }, { translateY: -50 }],
    },
    debugOverlay: {
        position: 'absolute',
        top: 5,
        left: 5,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 5,
        borderRadius: 3,
        zIndex: 100,
    },
    debugText: {
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
    },
});

export default Room3D;
