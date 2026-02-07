import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Dimensions } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Room } from '../room/Room'
import { Player } from '../player/Player'
import { fetchEnemies, addEnemy, clearEnemies, setCurrentEnemy } from '../enemy/enemySlice';
import { setCurrentPos } from '../room/roomSlice';
import { setEnemyCount } from '../../events/combatSlice';

export const MainScreen = () => {
    const dispatch = useAppDispatch();
    const [initialized, setInitialized] = useState(false);

    // Get map data for spawning
    const mapTiles = useAppSelector(state => state.room.mapTiles);
    const mapWidth = useAppSelector(state => state.room.mapWidth);
    const mapHeight = useAppSelector(state => state.room.mapHeight);

    // Initialize enemies when map is ready
    useEffect(() => {
        if (initialized || !mapTiles || mapTiles.length === 0) return;

        dispatch(fetchEnemies());
        dispatch(clearEnemies());

        // Player starts at bottom-right corner facing North
        const playerStartX = 7;
        const playerStartY = 7;

        // Set player position first
        dispatch(setCurrentPos([playerStartX, playerStartY]));

        // Get walkable tiles in player's line of sight (same column, going North)
        // and other walkable tiles for variety
        const spawnPositions: { x: number; y: number }[] = [];

        // First, add positions directly in front of player (same column x=7, going north)
        for (let y = playerStartY - 1; y >= 0; y--) {
            if (mapTiles[y] && mapTiles[y][playerStartX] > 0) {
                spawnPositions.push({ x: playerStartX, y });
            }
        }

        // Then add other walkable tiles (for enemies not immediately visible)
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                if (mapTiles[y] && mapTiles[y][x] > 0) {
                    // Skip player position and positions already added
                    if (x === playerStartX && y === playerStartY) continue;
                    if (x === playerStartX && y < playerStartY) continue; // Already added above
                    spawnPositions.push({ x, y });
                }
            }
        }

        console.log('Available spawn positions:', spawnPositions.length);
        console.log('Positions in line of sight:', spawnPositions.filter(p => p.x === playerStartX).length);

        // Spawn 2-3 enemies as a pack at distance 1 (all attackable together)
        const totalEnemies = Math.floor(Math.random() * 2) + 2; // 2-3 enemies
        let spawned = 0;

        // All enemies spawn at distance 1 (next tile in front of player)
        // Player is at (7, 7) facing North, so distance 1 = (7, 6)
        const nextTileY = playerStartY - 1;
        const nextTileIsWalkable = mapTiles[nextTileY] && mapTiles[nextTileY][playerStartX] > 0;

        if (nextTileIsWalkable) {
            // Spawn all enemies at the same position (enemy pack)
            for (let i = 0; i < totalEnemies; i++) {
                const enemyType = Math.floor(Math.random() * 2); // 0 = rat, 1 = skeleton
                dispatch(addEnemy({
                    index: spawned,
                    id: enemyType,
                    positionX: playerStartX,
                    positionY: nextTileY
                }));
                console.log(`Spawned enemy ${spawned} (type ${enemyType}) at (${playerStartX}, ${nextTileY}) - PACK at DISTANCE 1`);
                spawned++;
            }
        } else {
            // Fallback: spawn at first available position in line of sight
            for (const pos of spawnPositions) {
                if (pos.x === playerStartX && spawned < totalEnemies) {
                    const enemyType = Math.floor(Math.random() * 2);
                    dispatch(addEnemy({
                        index: spawned,
                        id: enemyType,
                        positionX: pos.x,
                        positionY: pos.y
                    }));
                    console.log(`Spawned enemy ${spawned} (type ${enemyType}) at (${pos.x}, ${pos.y})`);
                    spawned++;
                }
            }
        }

        dispatch(setEnemyCount(spawned));
        dispatch(setCurrentEnemy(0));

        console.log(`Total enemies spawned: ${spawned}`);
        setInitialized(true);
    }, [dispatch, initialized, mapTiles, mapHeight, mapWidth]);

    return (
        <View style={styles.mainScreen}>
            <Room/>
            <Player/>
        </View>
    );
};

const styles = StyleSheet.create({
   mainScreen: {
    width: 800,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 150, 
  }, 
});

