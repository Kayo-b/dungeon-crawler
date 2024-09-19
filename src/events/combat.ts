import { useEffect, useState, useRef } from 'react';
import data from '../data/characters.json';
import itemsData from '../data/items.json';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { dmg2Enemy, setCurrentEnemy, removeEnemy } from './../features/enemy/enemySlice';
import { dmgPlayer, dmg2Player, XP, levelUp } from './../features/player/playerSlice'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setInventory, setAddToInv } from '../features/inventory/inventorySlice';
import  { emptyCombatLog } from '../features/player/playerSlice';
import { setEnemyCount, setEnemyPack } from './combatSlice';
import { current } from '@reduxjs/toolkit';

interface Item {
    ID: number;
    type: string;
    Durability: number;
    dropChance: number;
}
      
interface LootObject {
    dropChance: number;
}
interface EnemyProps {
    id: number,
}

export const useCombat = () => {
    const dispatch = useAppDispatch();
        let enemyHealth: number;
        let enemyDmg: number; 
        let enemyAtkSpeed: number;
        let enemyDR: number;
        let enemyXP: number;
        let enemyLVL: number;
        let enemyAR: number; 
        let enemyStats: Object;
        let loot: Object;
        let enemies: Object;
        let enemyHR: number;
        let tempEnemyHealth1: number;
        let tempEnemyHealth2: number;
        let enemyPack: boolean;
        // let enemyHealth1: number;
        // let enemyHealth2: number;
        const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId);
        enemies = useAppSelector(state => state.enemy.enemies);
    const processEnemies = () => {
        let enemyHealth1 = null;
        let enemyHealth2 = null;
    
        Object.entries(enemies).forEach(([key, entry], index) => {
            console.log(typeof index, "INDEX");
            console.log(index, "INDEX");
            console.log(key, "INDEX entry");
            
            if (index === 0) {
            enemyHealth1 = entry.health; 
            } else if (index === 1) {
            enemyHealth2 = entry.health;
            }
    
            console.log(entry.health, "ENEMY HEALTH");
        });
    
        return { enemyHealth1, enemyHealth2 };
    };
    let healthArray = [];
    let remainingEnemy = false;
    const { enemyHealth1, enemyHealth2 } = processEnemies();
    console.log(enemyHealth1, enemyHealth2, "ENEMY HEALTH 123")
    enemyPack = useAppSelector(state => state.combat.enemyPack);
    enemyHealth = useAppSelector(state => state.enemy.enemies[currentEnemy].health);
    enemyDmg = useAppSelector(state => state.enemy.enemies[currentEnemy].damage);
    enemyAtkSpeed = useAppSelector(state => state.enemy.enemies[currentEnemy].atkSpeed);
    enemyDR = useAppSelector(state => state.enemy.enemies[currentEnemy].defence);
    enemyXP = useAppSelector(state => state.enemy.enemies[currentEnemy].xp);
    enemyLVL = useAppSelector(state => state.enemy.enemies[currentEnemy].level);
    enemyAR = useAppSelector(state => state.enemy.enemies[currentEnemy].atkRating);
    enemyStats = useAppSelector(state => state.enemy.enemies[currentEnemy].stats);
    loot = useAppSelector(state => state.enemy.enemies[currentEnemy].loot);
    tempEnemyHealth1 = enemyHealth1;
    tempEnemyHealth2 = enemyHealth2;
    if(tempEnemyHealth1 !== null) {
        healthArray.push(tempEnemyHealth1)
    }
    if(tempEnemyHealth2 !== null) {
        healthArray.push(tempEnemyHealth2)
    }
    const playerHealth = useAppSelector(state => state.player.health);
    const playerAtkSpeed = useAppSelector(state => state.player.atkSpeed);
    const playerXP = useAppSelector(state => state.player.experience);
    const playerLVL = useAppSelector(state => state.player.level);
    const playerAR = useAppSelector(state => state.player.attackRating);
    const playerDR = useAppSelector(state => state.player.defenceRating);
    console.log(playerDR, "Player DR")
    let inventory = [];
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    const [rerender, setRerender] = useState(false);
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    const enemyCombatIntRef: any = useRef<number | null>(null)
    let itemsListObj;
    let lootItem: Item;
    let playerDmg = useAppSelector(state => state.player.playerDmg)
    let tempPlayerHealth = playerHealth;
    let playerHR: number;
    const baseCrit = useAppSelector(state => state.player.critChance)
    
    let enemiesArr = Object.values(enemies)
    // useEffect(() => {
    //     if(engage) {
    //         startCombat();
    //     }
    // },[Object.values(enemies).length])

    useEffect(() => {
        if(enemiesArr.length > 0 && enemyPack) {
            playerCombatIntRef.current = null;
            startCombat();
            console.log("ENEMY ID OUTSIDE ", currentEnemy);
        }
    },[currentEnemy, enemiesArr.length])

    const startCombat = () => {
        // console.log(enemyId, "ENEMY ID !@#")
        // dispatch(setCurrentEnemy(id))
        console.log(enemyHealth,"START COMBAT INSIDE 2")
        if(enemyHealth > 0 && playerHealth > 0) {
            combatRef.current = true;
            console.log(combatRef.current, "AQUI OLHA 1")
            console.log(playerDmg, "Player dmg Combat component");
            playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);
            enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);
            console.log(playerAR, enemyDR, playerLVL, enemyLVL, "STATS P")
            console.log(enemyAR, playerDR, enemyLVL, playerLVL, "STATS ENEMY HitRate", hitRate(enemyAR, playerDR, enemyLVL, playerLVL))
            // enemyHR = hitRating(enemyAR, )
            console.log(playerLVL, "player level");
            console.log(enemyLVL, "enemy level");
            console.log(enemyStats, loot, "STATS ENEMY")
            console.log(enemyDR,"Enemy DR");
            // setCombat(true);
            playerLoop();
            // console.log("CURRENT", currentEnemy)
            enemyLoop();// Default player initiative, make change so it becomes random or depends on stats.
            // enemyLoop(0);// Default player initiative, make change so it becomes random or depends on stats.
        } else {
            // dispatch(setCurrentEnemy(1))
            console.log("No combat conditions met")
        } 
    }
    
    // Attacker Defence Rating, Defender Defence Rating, Attacker Level, Defender Level
    const hitRate = (AAR: number, DDR: number, ALVL: number, DLVL: number) => {
        return 2 * (AAR / (AAR + DDR)) * (ALVL / (ALVL + DLVL) );
    }
    
    async function saveData() {
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        const itemsData = await AsyncStorage.getItem('items');
        const itemsObj = itemsData ? JSON.parse(itemsData) : {};
        if(lootItem !== undefined && lootItem !== null) {
            const itemType = lootItem.type;
            const itemID = lootItem.ID;
            console.log(lootItem, "LOOT ITEM");
            console.log(itemType,"ITEM TYPE")
            console.log(itemID,"ITEM DROP ID");
            console.log(itemsObj.items[itemType][`${itemID}`], "ITEMS FROM THE DROPPP !!!") 
            obj.character.inventory.push(itemsObj.items[itemType][`${itemID}`])
            // inventory.push(itemsObj.items[itemType][`${itemID}`])
            dispatch(setAddToInv(itemsObj.items[itemType][`${itemID}`]));
        }
        obj.character.stats.health = tempPlayerHealth;
        obj.character.experience += enemyXP;
        console.log(obj.character.stats.health, "<< health");
        console.log(obj.character.experience, "<< EXP");
        if(obj.character.experience >= obj.character.xptolvlup) {
            obj.character.level = obj.character.level + 1; 
            obj.character.xptolvlup = obj.character.xptolvlup * 2;
            obj.character.stats.health = obj.character.stats.health + 5;
            obj.character.stats.strength = obj.character.stats.strength + 1;
            obj.character.stats.vitality = obj.character.stats.vitality + 1;
            obj.character.stats.agility = obj.character.stats.agility + 1;
            obj.character.stats.dexterity = obj.character.stats.dexterity + 1;
             dispatch(levelUp())
        }
        console.log(obj.character.stats.strength, "OI")
        await AsyncStorage.setItem('characters',JSON.stringify(obj));
    }
    
    console.log("DMG 1 ENEMYU ENEMIE OUTSIDE", enemies, currentEnemy)
    const playerLoop = () => {
        console.log(playerDmg, "Player dmg")
        console.log(playerAtkSpeed, "Player atk speed")
        console.log(playerHR,"Hit rate")
        if(playerCombatIntRef.current === null) {
            // Object.values(enemies).forEach( (val, index) => {
                playerCombatIntRef.current = setInterval(() => {
                    const randomVal = Math.random();
                    const randomAddDmg = Math.floor(randomVal * 2)
                    const randomCritVal = Math.random();
                    console.log(playerHR, "STATS Player hit rate")
                    
                    console.log(healthArray, tempPlayerHealth, combatRef.current, "AQUI OLHA 2"
                    )
                    if(healthArray[0] > 0 && tempPlayerHealth > 0 && combatRef.current) {
                        console.log(randomVal, playerHR, "will it hit?", randomVal <= playerHR)
                        console.log("Crit Values Check", randomCritVal, baseCrit)
                        console.log("DMG 1 ENEMYU RANDOM VAL", randomVal <= playerHR)
                        if(randomVal <= playerHR) {
                            let dmg = (playerDmg + randomAddDmg);
                            console.log("DMG 1 ENEMYU RANDOM CRIT VAL", randomCritVal <= baseCrit)
                            if(randomCritVal <= baseCrit) {
                                dmg *= 2;
                                dispatch(dmg2Enemy({id:currentEnemy, damage:{'dmg':dmg, 'crit': true}})); 
                                healthArray[0] -= dmg;
                                if(healthArray[0] <= 0) clearInterval(playerCombatIntRef.current);
                                console.log("DMG 1 ENEMYU", dmg)
                            } else {
                                dispatch(dmg2Enemy({ id:currentEnemy, damage:{'dmg':dmg, 'crit': false} })); 
                            console.log("NO CRIT!", dmg);
                            healthArray[0] -= dmg;

                            if(healthArray[0] <= 0) {
                                clearInterval(playerCombatIntRef.current);
                                dispatch(XP(enemyXP));
                                // playerCombatIntRef.current = null;
                                // combatRef.current = false;
                                const dropCalc = () => {
                                    const random = Math.random();
                                    (loot as LootObject[]).forEach((val: any) => {
                                        if(random <= val.dropChance) {
                                            console.log(val, "LOOT DROPPED !!!!!!!!")
                                            lootItem = val
                                        }
                                    })
                                }
                                // Createa a separate "combat over" function to deal with all the combat ending things 
                                console.log("AQUI OLHA 5")
                                dropCalc();
                                saveData();
                                setCombat(false);
                                emptyCombatLog();
                                console.log(loot, "LOOT")
                            }
                            console.log("DMG 1 ENEMYU NO CRIT", dmg)
                        }
                    } else {
                        dispatch(dmg2Enemy({ id:currentEnemy, damage:{'dmg':0, 'crit': false} }));
                        console.log("DMG 1 ENEMYU MISS")
                    }
                } else {
                    // if(healthArray[0] <= 0) {
                    //     dispatch(XP(enemyXP));
                    // }
                    // clearInterval(playerCombatIntRef.current);
                    // playerCombatIntRef.current = null;
                    // combatRef.current = false;
                    // const dropCalc = () => {
                    //     const random = Math.random();
                    //     (loot as LootObject[]).forEach((val: any) => {
                    //         if(random <= val.dropChance) {
                    //             console.log(val, "LOOT DROPPED !!!!!!!!")
                    //             lootItem = val
                    //         }
                    //     })
                    // }
                    // // Createa a separate "combat over" function to deal with all the combat ending things 
                    // console.log("AQUI OLHA 5")
                    // dropCalc();
                    // saveData();
                    // setCombat(false);
                    // emptyCombatLog();
                    // console.log(loot, "LOOT")
                }
            }, 1000 / playerAtkSpeed)
            // })
            
        }
    }

    const enemyLoop = () => {
        console.log(enemies, "ENEMIES ARR OBJ")
        if(enemyCombatIntRef.current === null) {
            Object.values(enemies).forEach( (val, index) => {
            enemyCombatIntRef.current = setInterval(() => {
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(randomVal * 2);
                const randomCritVal = Math.random();

                // enemyHR = 1;
                if(!combatRef.current) return;
                console.log(healthArray[0], tempPlayerHealth, combatRef.current, "AQUI OLHA 3")
                console.log(currentEnemy, val, combatRef.current, "INDEXXXXXXX CURENT ENEMY &&&&&&")
                const totalHealth = healthArray.reduce((sum, health) => sum + health, 0);
                console.log(totalHealth, "!!! Total health", combatRef.current, healthArray[0])
                if(healthArray[0] > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    console.log(randomVal <= enemyHR, "Enemy hit rate check", enemyHR)
                    if(randomVal <= enemyHR) { // FIX HIT RATE FOR ENEMY HITTINH PLAYER
                        let dmg = val.damage + randomAddDmg;//(enemyDmg + randomAddDmg);
                        console.log("DMG ()()()()()()(",dmg)
                        console.log(randomCritVal, baseCrit, "CRIT ENEMY")
                        if(randomCritVal <= baseCrit) {
                            dmg *= 2;
                            dispatch(dmg2Player({'dmg':dmg, 'crit': true}));
                            tempPlayerHealth -= dmg;
                            console.log("DMG ()()() 2", dmg)
                        } else { 
                            dispatch(dmg2Player({'dmg':dmg, 'crit': false}));
                            tempPlayerHealth -= dmg;
                            
                            console.log("DMG ()()() 3", dmg)
                        }
                    } else {
                        console.log("DMG %%% ELSE")
                        dispatch(dmg2Player({'dmg':0, 'crit': false}));
                    }
                } else {
                    if(healthArray[0] <= 0 && healthArray.length > 1) {
                        enemiesArr.splice(currentEnemy, 1);
                        healthArray.splice(0,1)
                        dispatch(removeEnemy(currentEnemy));
                        dispatch(setCurrentEnemy(1))
                        console.log("++++++++++++++++++++++++++")

                    } 
                    combatRef.current = false;
                    console.log("AQUI OLHA 4")
                    setCombat(false);
                    clearInterval(enemyCombatIntRef.current);
                    enemyCombatIntRef.current = null;
                    dispatch(emptyCombatLog());        
                    if(enemiesArr.length === 0) {
                        dispatch(setCurrentEnemy(0));
                        dispatch(setEnemyPack(false));
                    } else {
                        dispatch(setEnemyPack(true));
                    }
                } 
            }, 1000 / enemyAtkSpeed)
        })
        }
    }
    return { startCombat };
};