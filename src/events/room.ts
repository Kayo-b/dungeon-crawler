import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addEnemy, setCurrentEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';
import { emptyCombatLog } from '../features/player/playerSlice';
import { emptyDmgLog, clearEnemies } from '../features/enemy/enemySlice';
import { setEnemyCount } from './combatSlice';
import { pickSpawnEnemyType } from '../features/enemy/enemySpawn';

export const useRoom = () => {
    const dispatch = useAppDispatch();

    // Get current map data from Redux
    const mapTiles = useAppSelector(state => state.room.mapTiles);
    const mapWidth = useAppSelector(state => state.room.mapWidth);
    const mapHeight = useAppSelector(state => state.room.mapHeight);
    const playerX = useAppSelector(state => state.room.posX);
    const playerY = useAppSelector(state => state.room.posY);
    const enemies = useAppSelector(state => state.enemy.enemies);

    // Track enemy index for spawning
    const enemyIndexRef = useRef(0);

    // Get walkable tiles from current map (tiles > 0 are walkable)
    const getWalkableTiles = (excludePlayerPos: boolean = true, minDistanceFromPlayer: number = 2) => {
        const walkable: { x: number; y: number }[] = [];

        if (!mapTiles || mapTiles.length === 0) return walkable;

        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                // Check if tile is walkable (not a wall - tile type > 0)
                if (mapTiles[y] && mapTiles[y][x] > 0) {
                    // Optionally exclude player position and tiles too close to player
                    if (excludePlayerPos) {
                        const distFromPlayer = Math.abs(x - playerX) + Math.abs(y - playerY);
                        if (distFromPlayer < minDistanceFromPlayer) continue;
                    }
                    walkable.push({ x, y });
                }
            }
        }

        return walkable;
    };

    // Get a random walkable position
    const getRandomSpawnPosition = (minDistanceFromPlayer: number = 2) => {
        const walkable = getWalkableTiles(true, minDistanceFromPlayer);
        if (walkable.length === 0) {
            return { x: 3, y: 3 }; // Fallback
        }
        return walkable[Math.floor(Math.random() * walkable.length)];
    };

    // Spawn enemies at the same position (enemy pack)
    const spawnEnemyPack = (count: number, position?: { x: number; y: number }) => {
        const spawnPos = position || getRandomSpawnPosition();
        const startIndex = Object.keys(enemies).length;

        for (let i = 0; i < count; i++) {
            const enemyType = pickSpawnEnemyType();
            dispatch(addEnemy({
                index: startIndex + i,
                id: enemyType,
                positionX: spawnPos.x,
                positionY: spawnPos.y
            }));
            console.log(`Enemy pack member ${i} (type ${enemyType}) spawned at (${spawnPos.x}, ${spawnPos.y})`);
        }

        dispatch(setEnemyCount(startIndex + count));
        return spawnPos;
    };

    // Spawn a single enemy at a random position
    const spawnEnemy = (position?: { x: number; y: number }) => {
        const spawnPos = position || getRandomSpawnPosition();
        const enemyIndex = Object.keys(enemies).length;
        const enemyType = pickSpawnEnemyType();

        dispatch(addEnemy({
            index: enemyIndex,
            id: enemyType,
            positionX: spawnPos.x,
            positionY: spawnPos.y
        }));

        console.log(`Enemy ${enemyIndex} (type ${enemyType}) spawned at (${spawnPos.x}, ${spawnPos.y})`);
        dispatch(setEnemyCount(enemyIndex + 1));
        return spawnPos;
    };

    // Spawn multiple enemy groups at random positions across the map
    const spawnRandomEnemies = (totalEnemies: number = 3, maxPackSize: number = 3) => {
        dispatch(clearEnemies());
        enemyIndexRef.current = 0;

        let spawned = 0;
        const usedPositions: { x: number; y: number }[] = [];

        while (spawned < totalEnemies) {
            // Decide pack size (1 to maxPackSize, but don't exceed remaining)
            const remaining = totalEnemies - spawned;
            const packSize = Math.min(
                Math.floor(Math.random() * maxPackSize) + 1,
                remaining
            );

            // Get a random spawn position (can reuse positions for enemy packs)
            const spawnPos = getRandomSpawnPosition();

            // Spawn the pack
            for (let i = 0; i < packSize; i++) {
                const enemyType = pickSpawnEnemyType();
                dispatch(addEnemy({
                    index: spawned + i,
                    id: enemyType,
                    positionX: spawnPos.x,
                    positionY: spawnPos.y
                }));
                console.log(`Enemy ${spawned + i} (type ${enemyType}) spawned at (${spawnPos.x}, ${spawnPos.y})`);
            }

            spawned += packSize;
            usedPositions.push(spawnPos);
        }

        dispatch(setEnemyCount(spawned));
        dispatch(setCurrentEnemy(0));
        console.log(`Spawned ${spawned} enemies in ${usedPositions.length} locations`);
    };

    // Legacy function - spawn enemies for level change
    const addRandomEnemies = (n: number) => {
        // Spawn 1 to n+1 enemies, potentially in packs
        const totalEnemies = Math.floor(Math.random() * 3) + 1; // 1-3 enemies
        spawnRandomEnemies(totalEnemies, 3);
    };

    const changeLvl = () => {
        dispatch(clearEnemies());
        const totalEnemies = Math.floor(Math.random() * 3) + 1; // 1-3 enemies
        spawnRandomEnemies(totalEnemies, 3);
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
        dispatch(emptyCombatLog());
        dispatch(emptyDmgLog(0));
        dispatch(setCurrentEnemy(0));
    };

    const getEnemies = () => {
        // Reserved for future use
    };

    return {
        changeLvl,
        getEnemies,
        spawnEnemy,
        spawnEnemyPack,
        spawnRandomEnemies,
        getRandomSpawnPosition,
        getWalkableTiles
    };
};
