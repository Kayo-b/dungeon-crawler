import { useEffect, useState, useRef } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmg2Enemy } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player, XP } from './../features/player/playerSlice'
import AsyncStorage from '@react-native-async-storage/async-storage';


export const useCombat = () => {
    const playerHealth = useAppSelector(state => state.player.health);
    const playerAtkSpeed = useAppSelector(state => state.player.atkSpeed);
    const playerXP = useAppSelector(state => state.player.experience);
    const enemyHealth = useAppSelector(state => state.enemy.health);
    const enemyDmg = useAppSelector(state => state.enemy.damage);
    const enemyAtkSpeed = useAppSelector(state => state.enemy.atkSpeed);
    const enemyXP = useAppSelector(state => state.enemy.xp);
    const dispatch = useAppDispatch();
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    const enemyCombatIntRef: any = useRef<number | null>(null)
    let playerDmg = useAppSelector(state => state.player.playerDmg)
    let tempEnemyHealth = enemyHealth;
    let tempPlayerHealth = playerHealth;
    // let experience = data.character.experience;

    
    const startCombat = () => {
        combatRef.current = true;
        // setCombat(true);
        playerLoop();
        enemyLoop();// Default player initiative, make change so it becomes random or depends on stats.
    }


    async function saveData() {
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        
        obj.character.stats.health = tempPlayerHealth;
        obj.character.experience += enemyXP;
        console.log(obj.character.stats.health, "<< health");
        console.log(obj.character.experience, "<< EXP");
        await AsyncStorage.setItem('characters',JSON.stringify(obj));
    }


    const playerLoop = () => {
        console.log(playerAtkSpeed, "Player atk speed")
        if(playerCombatIntRef.current === null) {
            playerCombatIntRef.current = setInterval(() => {
                const randomVal = Math.floor(Math.random() * 2);
                console.log(tempEnemyHealth, tempPlayerHealth, combatRef.current, "!!!!!!!!!!!!!!!")
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    dispatch(dmg2Enemy(playerDmg + randomVal)); 
                    tempEnemyHealth -= playerDmg + randomVal; 
                } else {
                    if(tempEnemyHealth <= 0) {
                        dispatch(XP(enemyXP));
                    }
                    clearInterval(playerCombatIntRef.current);
                    playerCombatIntRef.current = null;
                    combatRef.current = false;
                    saveData();
                    console.log(playerXP,"XP")
                    setCombat(false);
                }
            }, 1000 / playerAtkSpeed)
        }
    }

    const enemyLoop = () => {
        if(enemyCombatIntRef.current === null) {
            enemyCombatIntRef.current = setInterval(() => {
                const randomVal = Math.floor(Math.random() * 2);
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    dispatch(dmg2Player(enemyDmg + randomVal))
                    tempPlayerHealth -= enemyDmg + randomVal;
                } else {
                     if(tempEnemyHealth <= 0) {
                    }                  
                    clearInterval(enemyCombatIntRef.current);
                    enemyCombatIntRef.current = null;
                    combatRef.current = false;
                    setCombat(false);
                    
                } 
            }, 1000 / enemyAtkSpeed)
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
     
    // useEffect(() => {
    //     return () => {
    //         if(playerCombatIntRef.current) clearInterval(playerCombatIntRef.current);
    //         if(enemyCombatIntRef.current) clearInterval(enemyCombatIntRef.current);
    //     };
    //  },[combat]);

    
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