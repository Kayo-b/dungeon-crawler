import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addEnemy, fetchEnemies, setCurrentEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';
import { emptyCombatLog } from '../features/player/playerSlice'
import { emptyDmgLog, clearEnemies } from '../features/enemy/enemySlice'
import data from '../data/characters.json';


export const useRoom = () => {
    const dispatch = useAppDispatch();
    
    const changeLvl = () => {
        // dispatch(clearEnemies());
        dispatch(addEnemy(0));
        dispatch(addEnemy(1));
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
        dispatch(emptyCombatLog());
        dispatch(emptyDmgLog(0));
    }        

    const getEnemies = () => {
        // dispatch(fetchEnemies());
        // dispatch(addEnemy(1));
    }
    
    return { changeLvl, getEnemies};
}

