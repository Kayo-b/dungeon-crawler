import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addEnemy, fetchEnemies, setCurrentEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';
import { emptyCombatLog } from '../features/player/playerSlice'
import { emptyDmgLog, clearEnemies, } from '../features/enemy/enemySlice'
import { setEnemyCount, setEnemyPack } from './combatSlice';
import data from '../data/characters.json';


export const useRoom = () => {
    const dispatch = useAppDispatch();
    
    const changeLvl = () => {
        dispatch(addEnemy({ index:2, id:1 }));
        dispatch(addEnemy({ index:1, id:0 }));
        dispatch(addEnemy({ index:0, id:0 }));
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
        dispatch(emptyCombatLog());
        dispatch(emptyDmgLog(0));
        dispatch(setCurrentEnemy(0));
        // setEnemyPack(false);
    }        

    const getEnemies = () => {
        // dispatch(fetchEnemies());
        // dispatch(addEnemy(1));
    }
    
    return { changeLvl, getEnemies};
}

