import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../../app/hooks';

interface MiniMapProps {
    size?: number; // Size of each tile in pixels
}
const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

export const MiniMap: React.FC<MiniMapProps> = ({ size = 12 }) => {
    const positionX = useAppSelector(state => state.room.posX);
    const positionY = useAppSelector(state => state.room.posY);
    const currentDir = useAppSelector(state => state.room.direction);
    const mapTiles = useAppSelector(state => state.room.mapTiles);
    const mapWidth = useAppSelector(state => state.room.mapWidth);
    const mapHeight = useAppSelector(state => state.room.mapHeight);
    const exploredTiles = useAppSelector(state => state.room.exploredTiles);

    if (!mapTiles || mapTiles.length === 0) return null;

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
        <View
          style={[
            styles.mapContainer,
            {
              width: mapWidth * size + 2,
              height: mapHeight * size + 2,
            },
          ]}
        >
          {mapTiles.map((row, y) => (
            <View key={y} style={styles.mapRow}>
              {row.map((tile, x) => {
                const isExplored = exploredTiles[`${x},${y}`];
                const isPlayer = x === positionX && y === positionY;

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

                const getTileStyle = () => {
                  switch (tile) {
                    case 0:
                      return styles.wallTile;
                    case 1:
                      return styles.corridorTile;
                    case 2:
                      return styles.turnTile;
                    case 3:
                      return styles.threeWayTile;
                    case 4:
                      return styles.fourWayTile;
                    case 5:
                      return styles.doorTile;
                    case 6:
                      return styles.stairsUpTile;
                    case 7:
                      return styles.stairsDownTile;
                    case 8:
                      return styles.deadEndTile;
                    default:
                      return styles.corridorTile;
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
                      <Text style={[styles.playerMarker, { fontSize: Math.max(8, size - 4) }]}>
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
        padding: 2,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#d7d7d7',
        backgroundColor: '#050505',
    },
    mapContainer: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#d7d7d7',
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
        backgroundColor: '#24262f',
        borderWidth: 0.5,
        borderColor: '#111',
    },
    corridorTile: {
        backgroundColor: '#4e4e4e',
        borderWidth: 0.5,
        borderColor: '#2a2a2a',
    },
    turnTile: {
        backgroundColor: '#595959',
        borderWidth: 0.5,
        borderColor: '#333333',
    },
    threeWayTile: {
        backgroundColor: '#666666',
        borderWidth: 0.5,
        borderColor: '#3a3a3a',
    },
    fourWayTile: {
        backgroundColor: '#737373',
        borderWidth: 0.5,
        borderColor: '#444444',
    },
    doorTile: {
        backgroundColor: '#888888',
        borderWidth: 0.5,
        borderColor: '#555555',
    },
    stairsUpTile: {
        backgroundColor: '#9a9a9a',
        borderWidth: 0.5,
        borderColor: '#606060',
    },
    stairsDownTile: {
        backgroundColor: '#adadad',
        borderWidth: 0.5,
        borderColor: '#717171',
    },
    deadEndTile: {
        backgroundColor: '#7d7d7d',
        borderWidth: 0.5,
        borderColor: '#4e4e4e',
    },
    playerTile: {
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 1.5,
    },
    playerMarker: {
        color: '#000000',
        fontWeight: 'bold',
        fontFamily: RETRO_FONT,
    },
});

export default MiniMap;
