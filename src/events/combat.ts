import { useEffect, useState, useRef } from 'react';
import data from '../data/characters.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmg2Enemy } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player, XP, levelUp } from './../features/player/playerSlice'
import AsyncStorage from '@react-native-async-storage/async-storage';
interface LootObject {
    dropChance: number;
    // include other properties of the object here
  }

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
    const enemyAR = useAppSelector(state => state.enemy.atkRating);
    const loot = useAppSelector(state => state.enemy.loot);
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
    let enemyHR: number;
    // let experience = data.character.experience;


    
    const startCombat = () => {
        combatRef.current = true;
        console.log(playerDmg, "Player dmg Combat component");
        playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);
        enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);
        console.log(playerAR, enemyDR, playerLVL, enemyLVL, "STATS P")
        console.log(enemyAR, playerDR, enemyLVL, playerLVL, "STATS E")
        // enemyHR = hitRating(enemyAR, )
        console.log(playerLVL, "player level");
        console.log(enemyLVL, "enemy level");
        console.log(enemyDR,"Enemy DR");
        // setCombat(true);
        playerLoop();
        enemyLoop();// Default player initiative, make change so it becomes random or depends on stats.
    }

    // Attacker Defence Rating, Defender Defence Rating, Attacker Level, Defender Level
    const hitRate = (AAR: number, DDR: number, ALVL: number, DLVL: number) => {
        return 2 * (AAR / (AAR + DDR)) * (ALVL / (ALVL + DLVL) );
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
            obj.character.stats.dexterity = obj.character.stats.dexterity + 3;
 
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
                console.log(playerHR, "STATS Player hit rate")
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    // console.log(randomVal, playerHR, "will it hit?", randomVal <= playerHR)
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
                    setCombat(false);
                    console.log(loot, "LOOT")
                    //dropcalc sketch
                    const dropCalc = () => {
                        const random = (Math.random());
                        (loot as LootObject[]).forEach((val: LootObject) => {
                            console.log(val, "LOOT 2")
                            console.log(random,"LOOT3")
                            if(random >= val.dropChance) {
                                console.log(val, "LOOT3")
                            }
                        })
                    }
                    dropCalc();
                }
            }, 1000 / playerAtkSpeed)
        }
    }

    const enemyLoop = () => {
        if(enemyCombatIntRef.current === null) {
            enemyCombatIntRef.current = setInterval(() => {
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(randomVal * 2)
                console.log(enemyHR, " STATS Enemy hit rate")
                if(tempEnemyHealth > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    if(randomVal <= enemyHR) { // FIX HIT RATE FOR ENEMY HITTINH PLAYER
                        dispatch(dmg2Player(enemyDmg + randomAddDmg))
                        tempPlayerHealth -= enemyDmg + randomAddDmg;    
                    } else {
                        dispatch(dmg2Player(0))
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