import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addEnemy, setCurrentEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';
import { emptyCombatLog } from '../features/player/playerSlice'
import { emptyDmgLog } from '../features/enemy/enemySlice'
import data from '../data/characters.json';


export const useRoom = () => {
    const dispatch = useAppDispatch();
    
    const changeLvl = () => {
        dispatch(addEnemy(0));
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
        dispatch(emptyCombatLog());
        dispatch(emptyDmgLog(0));
    }        

    return { changeLvl };
}

