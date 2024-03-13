// What to do: Create an combat event. 
// Steps: 
// Take current player and enemy stats
// Create simple turn based combat system: 
// 1. start with player turn
// 2. give turn to enemy 

import { useEffect, useState } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmgTaken } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player } from './../features/player/playerSlice'

export const useCombat = () => {
    const enemyHealth = useAppSelector(state => state.enemyhealth.health);
    const enemyDmg = useAppSelector(state => state.enemyhealth.enemyDmg);
    const dispatch = useAppDispatch();
    const [playerTurn, setPlayerTurn] = useState(true);
    //  Simple turn based system
    
    useEffect(() => {
        if(enemyHealth > 0 && !playerTurn) {
            //const enemyDmg = 1 + Math.floor(Math.random() * 2);
            setTimeout(() => dispatch(dmg2Player(enemyDmg)), 500);   
            setPlayerTurn(true);
        }
    },[enemyHealth])

    const attack = () => {
        if(playerTurn) {
            const playerDmg = 1 + Math.floor(Math.random() * 2);
            dispatch(dmgTaken(playerDmg));
            setPlayerTurn(false);
        }
    };
    
    // const counterAttack = () => {
    //     console.log(enemyHealth,"Enemy health")
    //     if(enemyHealth > 0) {
    //         const enemyDmg = 1 + Math.floor(Math.random() * 2);
    //         setTimeout(() => dispatch(dmg2Player(enemyDmg)), 500);   
    //     }

    // }

    // const usePotion = () => {
    //     const healAmount = 5; // Example value
    //     dispatch(heal(healAmount));
    // };

    // const castMagic = () => {
    //     const spellDamage = 3; // Example value
    //     dispatch(castSpell(spellDamage));
    // };

    return { attack };
};