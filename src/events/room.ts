import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { changeEnemy } from '../features/enemy/enemySlice';
import { changeRoom } from '../features/room/roomSlice';


export const useRoom = () => {
    const dispatch = useAppDispatch();

    const changeLvl = () => {
        dispatch(changeEnemy(Math.floor(Math.random() * 2)));
        dispatch(changeRoom(Math.floor(Math.random() * 2)));
    }        

    return { changeLvl };
}

