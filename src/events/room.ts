import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addEnemy, fetchEnemies, setCurrentEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';
import { emptyCombatLog } from '../features/player/playerSlice'
import { emptyDmgLog, clearEnemies, } from '../features/enemy/enemySlice'
import { setEnemyCount, setEnemyPack } from './combatSlice';
import data from '../data/characters.json';

// Valid spawn positions for enemies (walkable tiles, not start position)
// These are positions where enemies can spawn on level1
const VALID_SPAWN_POSITIONS = [
    { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 },
    { x: 3, y: 1 }, { x: 7, y: 1 },
    { x: 3, y: 2 }, { x: 7, y: 2 },
    { x: 3, y: 3 }, { x: 7, y: 3 },
    { x: 3, y: 4 }, { x: 7, y: 4 },
    { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 7, y: 5 },
    { x: 0, y: 6 }, { x: 7, y: 6 },
    { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
];

export const useRoom = () => {
    const dispatch = useAppDispatch();
    let n = Math.floor(Math.random() * 3)

    const addRandomEnemies = (n:number) => {
        // Shuffle spawn positions and pick n+1 unique positions
        const shuffledPositions = [...VALID_SPAWN_POSITIONS].sort(() => Math.random() - 0.5);

        for(let x = 0; x <= n; x++ ) {
            let z = Math.floor(Math.random() * 2); // Random enemy type
            const pos = shuffledPositions[x] || { x: 3, y: 3 }; // Fallback position
            dispatch(addEnemy({
                index: x,
                id: z,
                positionX: pos.x,
                positionY: pos.y
            }));
            console.log(`Enemy ${x} spawned at (${pos.x}, ${pos.y})`);
        }
    } 
    
    const changeLvl = () => {
        dispatch(clearEnemies());
        addRandomEnemies(n)
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
        dispatch(emptyCombatLog());
        dispatch(emptyDmgLog(0));
        dispatch(setCurrentEnemy(0));
    }        

    const getEnemies = () => {
        // dispatch(fetchEnemies());
        // dispatch(addEnemy(1));
    }
    
    return { changeLvl, getEnemies};
}

