import { useEffect, useState } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmgTaken } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player } from './../features/player/playerSlice'

export const useCombat = () => {
    const enemyHealth = useAppSelector(state => state.enemy.health);
    const playerHealth = useAppSelector(state => state.player.health);
    const enemyDmg = useAppSelector(state => state.enemy.enemyDmg);
    const dispatch = useAppDispatch();
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    //  Simple turn based system

    const timer = () => {
        return setTimeout(() => console.log("2sec"), 2000)
    }
    const startCombat = () => {
        // setPlayerTurn(true);
        setCombat(true);
        // cdCombat();
    }
    const playerLoop = () => {
        const playerInt = setInterval(() => { 
        if(playerHealth > 0 && enemyHealth > 0 && combat) {
            dispatch(dmgTaken(1))
            console.log("Player attack", enemyHealth)
        } else {
            // setCombat(false);
            clearInterval(playerInt);
        }
      }, 2000)
      setCombat(false);
    }
    const enemyLoop = () => {
       const enemyInt = setInterval(() => {
        if(enemyHealth > 0 && playerHealth > 0 && combat) {
            dispatch(dmg2Player(1))
            console.log("Enemy attack", playerHealth)
        } else {
            // setCombat(false);
            clearInterval(enemyInt);
        } 
      }, 2000)
      setCombat(false)
    }
    const cdCombat = () => {    
        playerLoop();
        // enemyLoop();

        // enemyLoop();
        // const playerDmg = 1 + Math.floor(Math.random() * 2);
        // if(playerHealth > 0 || enemyHealth > 0) {
        //     setTimeout(() => dispatch(dmgTaken(playerDmg)), 1500);
        //     setTimeout(() => dispatch(dmg2Player(enemyDmg)), 1500);
        // } else {
        //     setCombat(false);
        // }  
           
    }

    const attack = () => {
        if(playerTurn) {
            const playerDmg = 1 + Math.floor(Math.random() * 2);
            setTimeout(() => dispatch(dmgTaken(playerDmg)), 500)
            setPlayerTurn(false);
        } else if(enemyHealth > 0 && !playerTurn) {
            setTimeout(() => dispatch(dmg2Player(enemyDmg)), 500);   
            setPlayerTurn(true);
            console.log("Enemy attack", playerHealth)
        } else {
            setCombat(false);
            console.log("Combat ended")
        }
    };
     
    useEffect(() => {
        console.log(combat, "Combat")
        if(combat) playerLoop();//attack();
    },[combat, playerHealth, enemyHealth])

   
    
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

    return { attack, startCombat };
};