import { useEffect, useState, useRef } from 'react';
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
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    
    const startCombat = () => {
        combatRef.current = true;
        playerLoop();
    }

    const playerLoop = () => {
        console.log("Player loop", playerCombatIntRef.current)
        let tempEnemyHealth = enemyHealth;
        let tempPlayerHealth = playerHealth;
        if(playerCombatIntRef.current === null) {
            console.log("Player loop started")
            playerCombatIntRef.current = setInterval(() => { 
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    dispatch(dmgTaken(1))
                    tempEnemyHealth -= 1;
                    console.log("Player attack", enemyHealth)
                } else {
                    // setCombat(false);
                    clearInterval(playerCombatIntRef.current);
                    playerCombatIntRef.current = null;
                    combatRef.current = false;
                    setCombat(false);
                }
            }, 2000)
        }
   }
    // const enemyLoop = () => {
    //    const enemyInt = setInterval(() => {
    //     if(enemyHealth > 0 && playerHealth > 0 && combat) {
    //         dispatch(dmg2Player(1))
    //         console.log("Enemy attack", playerHealth)
    //     } else {
    //         // setCombat(false);
    //         clearInterval(enemyInt);
    //     } 
    //   }, 2000)
    //   setCombat(false)
    // }

    // const attack = () => {
    //     if(playerTurn) {
    //         const playerDmg = 1 + Math.floor(Math.random() * 2);
    //         setTimeout(() => dispatch(dmgTaken(playerDmg)), 500)
    //         setPlayerTurn(false);
    //     } else if(enemyHealth > 0 && !playerTurn) {
    //         setTimeout(() => dispatch(dmg2Player(enemyDmg)), 500);   
    //         setPlayerTurn(true);
    //         console.log("Enemy attack", playerHealth)
    //     } else {
    //         // setCombat(false);
    //         combatRef.current = false;
    //         console.log("Combat ended")
    //     }
    // };
     
    useEffect(() => {
        return () => {
            if(playerCombatIntRef.current) clearInterval(playerCombatIntRef.current);
        };
     },[combat]);

   
    
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

    return { startCombat };
};