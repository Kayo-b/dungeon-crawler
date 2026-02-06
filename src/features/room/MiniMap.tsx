import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../app/hooks';

interface MiniMapProps {
    size?: number; // Size of each tile in pixels
}

export const MiniMap: React.FC<MiniMapProps> = ({ size = 18 }) => {
    const positionX = useAppSelector(state => state.room.posX);
    const positionY = useAppSelector(state => state.room.posY);
    const currentDir = useAppSelector(state => state.room.direction);
    const mapTiles = useAppSelector(state => state.room.mapTiles);
    const mapWidth = useAppSelector(state => state.room.mapWidth);
    const mapHeight = useAppSelector(state => state.room.mapHeight);
    const exploredTiles = useAppSelector(state => state.room.exploredTiles);

    if (!mapTiles || mapTiles.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>MAP</Text>
                <Text style={styles.noMap}>No map loaded</Text>
            </View>
        );
    }

    // Direction arrow for player marker
    const getDirectionArrow = () => {
        switch (currentDir) {
            case 'N': return '^';
            case 'S': return 'v';
            case 'E': return '>';
            case 'W': return '<';
            default: return '@';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>MAP</Text>
            <View style={[
                styles.mapContainer,
                {
                    width: mapWidth * size + 4,
                    height: mapHeight * size + 4,
                }
            ]}>
                {mapTiles.map((row, y) => (
                    <View key={y} style={styles.mapRow}>
                        {row.map((tile, x) => {
                            const isExplored = exploredTiles[`${x},${y}`];
                            const isPlayer = x === positionX && y === positionY;

                            // If not explored and not player, show nothing (black)
                            if (!isExplored && !isPlayer) {
                                return (
                                    <View
                                        key={`${x}-${y}`}
                                        style={[
                                            styles.mapTile,
                                            styles.hiddenTile,
                                            { width: size, height: size },
                                        ]}
                                    />
                                );
                            }

                            // Get tile style based on type
                            const getTileStyle = () => {
                                switch (tile) {
                                    case 0: return styles.wallTile;
                                    case 1: return styles.corridorTile;
                                    case 2: return styles.turnTile;
                                    case 3: return styles.threeWayTile;
                                    case 4: return styles.fourWayTile;
                                    case 5: return styles.doorTile;
                                    case 6: return styles.stairsUpTile;
                                    case 7: return styles.stairsDownTile;
                                    case 8: return styles.deadEndTile;
                                    default: return styles.corridorTile;
                                }
                            };

                            return (
                                <View
                                    key={`${x}-${y}`}
                                    style={[
                                        styles.mapTile,
                                        { width: size, height: size },
                                        getTileStyle(),
                                        isPlayer && styles.playerTile,
                                    ]}
                                >
                                    {isPlayer && (
                                        <Text style={[styles.playerMarker, { fontSize: size - 4 }]}>
                                            {getDirectionArrow()}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(20, 20, 30, 0.95)',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#444',
    },
    title: {
        color: '#ffcc00',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: 12,
        marginBottom: 8,
    },
    noMap: {
        color: '#666',
        fontFamily: 'monospace',
        fontSize: 10,
    },
    mapContainer: {
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#555',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapRow: {
        flexDirection: 'row',
    },
    mapTile: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    hiddenTile: {
        backgroundColor: '#000',
    },
    wallTile: {
        backgroundColor: '#3a3a3a',
        borderWidth: 0.5,
        borderColor: '#222',
    },
    corridorTile: {
        backgroundColor: '#5a5a4a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    turnTile: {
        backgroundColor: '#6a5a3a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    threeWayTile: {
        backgroundColor: '#3a6a5a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    fourWayTile: {
        backgroundColor: '#5a3a6a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    doorTile: {
        backgroundColor: '#8a6a3a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    stairsUpTile: {
        backgroundColor: '#3a8a5a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    stairsDownTile: {
        backgroundColor: '#5a3a8a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    deadEndTile: {
        backgroundColor: '#6a4a4a',
        borderWidth: 0.5,
        borderColor: '#333',
    },
    playerTile: {
        backgroundColor: '#0077ff',
        borderColor: '#00aaff',
        borderWidth: 1.5,
    },
    playerMarker: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
});

export default MiniMap;
