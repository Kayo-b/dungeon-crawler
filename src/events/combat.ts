import { useEffect, useState, useRef } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmg2Enemy } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player } from './../features/player/playerSlice'

export const useCombat = () => {
    const enemyHealth = useAppSelector(state => state.enemy.health);
    const playerHealth = useAppSelector(state => state.player.health);
    const enemyDmg = useAppSelector(state => state.enemy.enemyDmg);
    const playerDmg = useAppSelector(state => state.player.playerDmg)
    const dispatch = useAppDispatch();
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    const enemyCombatIntRef: any = useRef<number | null>(null)
    let tempEnemyHealth = enemyHealth;
    let tempPlayerHealth = playerHealth;
    
    const startCombat = () => {
        combatRef.current = true;
        // setCombat(true);
        playerLoop();
        enemyLoop();
    }

    const playerLoop = () => {
        console.log("Player loop", playerCombatIntRef.current)
        if(playerCombatIntRef.current === null) {
            console.log("Player loop started")
            playerCombatIntRef.current = setInterval(() => {
                console.log("Temp Player Health:", tempPlayerHealth) 
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    dispatch(dmg2Enemy(playerDmg))
                    tempEnemyHealth -= playerDmg;
                    console.log("Player attack", enemyHealth)
                } else {
                    // setCombat(false);
                    clearInterval(playerCombatIntRef.current);
                    playerCombatIntRef.current = null;
                    combatRef.current = false;
                    setCombat(false);
                }
            }, 1000)
        }
    }

    const enemyLoop = () => {
        if(enemyCombatIntRef.current === null) {
            enemyCombatIntRef.current = setInterval(() => {
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    dispatch(dmg2Player(enemyDmg))
                    tempPlayerHealth -= enemyDmg;
                    console.log("Enemy attack", playerHealth)
                } else {
                    // setCombat(false);
                    clearInterval(enemyCombatIntRef.current);
                    enemyCombatIntRef.current = null;
                    combatRef.current = false;
                    setCombat(false);
                } 
            }, 1000)
        }
    }

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
            if(enemyCombatIntRef.current) clearInterval(enemyCombatIntRef.current);
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