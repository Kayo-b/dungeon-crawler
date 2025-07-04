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
    let n = Math.floor(Math.random() * 3)
    const addRandomEnemies = (n:number) => {
        for(let x = 0; x <= n; x++ ) {
            let z = Math.floor(Math.random() * 2)
            dispatch(addEnemy({ index:x, id:z }));
        }
    } 

    const encounterEvent = () =>  {
            let event = Math.floor(Math.random() * 5) === 0 ? true : false; 
            console.log(event, 'event', Math.floor(Math.random() * 5)) 
        if(event) {
            addRandomEnemies(1)
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
        dispatch(fetchEnemies());
        dispatch(addEnemy({index:0, id: 2}));
    }
    
    return { changeLvl, getEnemies, encounterEvent};
}

