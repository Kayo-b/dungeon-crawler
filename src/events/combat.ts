import { useEffect, useState, useRef } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmg2Enemy } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player, XP, levelUp } from './../features/player/playerSlice'
import AsyncStorage from '@react-native-async-storage/async-storage';


export const useCombat = () => {
    const playerHealth = useAppSelector(state => state.player.health);
    const playerAtkSpeed = useAppSelector(state => state.player.atkSpeed);
    const playerXP = useAppSelector(state => state.player.experience);
    const playerLVL = useAppSelector(state => state.player.level);
    const playerAR = useAppSelector(state => state.player.attackRating);
    const playerDR = useAppSelector(state => state.player.defenceRating);
    const enemyHealth = useAppSelector(state => state.enemy.health);
    const enemyDmg = useAppSelector(state => state.enemy.damage);
    const enemyAtkSpeed = useAppSelector(state => state.enemy.atkSpeed);
    const enemyDR = useAppSelector(state => state.enemy.defence);
    const enemyXP = useAppSelector(state => state.enemy.xp);
    const enemyLVL = useAppSelector(state => state.enemy.level);
    const dispatch = useAppDispatch();
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    const enemyCombatIntRef: any = useRef<number | null>(null)
    let playerDmg = useAppSelector(state => state.player.playerDmg)
    let tempEnemyHealth = enemyHealth;
    let tempPlayerHealth = playerHealth;
    let playerHR: number;
    // let experience = data.character.experience;


    
    const startCombat = () => {
        combatRef.current = true;
        console.log(playerDmg, "Player dmg Combat component")
        playerHR = hitRating(playerAR, enemyDR, playerLVL, enemyLVL)
        // enemyHR = hitRating(enemyAR, )
        console.log(playerLVL, "player level")
        console.log(enemyLVL, "enemy level")
        console.log(enemyDR,"Enemy DR")
        // setCombat(true);
        playerLoop();
        enemyLoop();// Default player initiative, make change so it becomes random or depends on stats.
    }

    // Attacker Defence Rating, Defender Defence Rating, Attacker Level, Defender Level
    const hitRating = (AAR: number, DDR: number, ALVL: number, DLVL: number) => {
        return 2 * (AAR / (AAR + DDR)) * (ALVL / (ALVL + DLVL));
    }

    async function saveData() {
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        
        obj.character.stats.health = tempPlayerHealth;
        obj.character.experience += enemyXP;
        
        console.log(obj.character.stats.health, "<< health");
        console.log(obj.character.experience, "<< EXP");
        if(obj.character.experience >= obj.character.xptolvlup) {
            obj.character.level = obj.character.level + 1; 
            obj.character.xptolvlup = obj.character.xptolvlup * 2;
            obj.character.stats.health = obj.character.stats.health + 5;
            obj.character.stats.strength = obj.character.stats.strength + 2.5;
            obj.character.stats.vitality = obj.character.stats.vitality + 1;
            obj.character.stats.agility = obj.character.stats.agility + 1;
 
            dispatch(levelUp())

        }
        console.log(obj.character.stats.strength, "OI")
        await AsyncStorage.setItem('characters',JSON.stringify(obj));
    }


    const playerLoop = () => {
        console.log(playerDmg, "Player dmg")
        console.log(playerAtkSpeed, "Player atk speed")
        console.log(playerHR,"Hit rate")
        if(playerCombatIntRef.current === null) {
            playerCombatIntRef.current = setInterval(() => {
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(randomVal * 2)
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    console.log(randomVal, playerHR, "will it hit?", randomVal <= playerHR)
                    if(randomVal <= playerHR) {
                        dispatch(dmg2Enemy(playerDmg + randomAddDmg)); 
                        tempEnemyHealth -= playerDmg + randomAddDmg;
                    } else {
                        dispatch(dmg2Enemy(0));
                    }
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
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(randomVal * 2)
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    if(randomVal <= playerHR) {
                        dispatch(dmg2Player(enemyDmg + randomAddDmg))
                        tempPlayerHealth -= enemyDmg + randomAddDmg;    
                    } else {
                        dispatch(dmg2Player("Miss"))
                    }
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