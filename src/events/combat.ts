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
        let enemiesStorage: Object;
        let enemyHR: number;
        let tempEnemyHealth1: number;
        let tempEnemyHealth2: number;
        let tempEnemyHealth3: number;
        let enemyPack: boolean;
        // let enemyHealth1: number;
        // let enemyHealth2: number;
        const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId);
        enemies = useAppSelector(state => state.enemy.enemies);
        enemiesStorage = useAppSelector(state => state.enemy.enemiesStorage);
    const processEnemies = () => {
        let enemyHealth1 = null;
        let enemyHealth2 = null;
        let enemyHealth3 = null;
    
        Object.entries(enemies).forEach(([key, entry], index) => {
            console.log(typeof index, "INDEX");
            console.log(index, "INDEX");
            console.log(key, "INDEX entry");
            setEnemyCount(enemyCount + 1);
            if (index === 0) {
                enemyHealth1 = entry.health; 
            } else if (index === 1) {
                enemyHealth2 = entry.health;
            } else if (index === 2) {
                enemyHealth3 = entry.health;
            }
    
            console.log(entry.health, "ENEMY HEALTH");
        });
    
        return { enemyHealth1, enemyHealth2, enemyHealth3 };
    };
    let healthArray = [];
    let remainingEnemy = false;
    const { enemyHealth1, enemyHealth2, enemyHealth3 } = processEnemies();
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
    tempEnemyHealth3 = enemyHealth3;
    if(tempEnemyHealth1 !== null) {
        healthArray.push(tempEnemyHealth1)
    }
    if(tempEnemyHealth2 !== null) {
        healthArray.push(tempEnemyHealth2)
    }
    if(tempEnemyHealth3 !== null) {
        healthArray.push(tempEnemyHealth3)
    }
    const playerHealth = useAppSelector(state => state.player.health);
    const playerAtkSpeed = useAppSelector(state => state.player.atkSpeed);
    const playerXP = useAppSelector(state => state.player.experience);
    const playerLVL = useAppSelector(state => state.player.level);
    const playerAR = useAppSelector(state => state.player.attackRating);
    const playerDR = useAppSelector(state => state.player.defenceRating);
    const enemyCount = useAppSelector(state => state.combat.enemyCount);
    console.log(playerDR, "Player DR")
    let inventory = [];
    const [playerTurn, setPlayerTurn] = useState(true);
    const [combat, setCombat] = useState(false);
    const combatRef = useRef(false);
    const playerCombatIntRef: any = useRef<number | null>(null)
    const enemyCombatIntRef: any = useRef<number | null>(null)
    const secEnemyCombatIntRef: any = useRef<number | null>(null)
    let itemsListObj;
    let lootItem: Item;
    let playerDmg = useAppSelector(state => state.player.playerDmg)
    let tempPlayerHealth = playerHealth;
    let playerHR: number;
    const baseCrit = useAppSelector(state => state.player.critChance)
    
    let enemiesArr = Object.values(enemies)
    let enemiesCount = enemiesArr.length;
    const [enemiesCountState, setEnemiesCountState] = useState(enemiesCount);

    console.log( "ENEMIES ARRAY LENGTH", enemiesCountState, enemiesCount, enemiesArr.length)
    useEffect(() => {
        // if(enemyPack) {
        //     playerCombatIntRef.current = null;
        //     startCombat();
        //     console.log("ENEMY ID OUTSIDE ", currentEnemy);
        // }
    },[currentEnemy])

    const startCombat = () => {
        // console.log(enemyId, "ENEMY ID !@#")
        // dispatch(setCurrentEnemy(id))
        console.log(enemyHealth,"START COMBAT INSIDE 2")
        if(enemyHealth > 0 && playerHealth > 0) {
            combatRef.current = true;
            console.log(combatRef.current, "AQUI OLHA 1")
            console.log(playerDmg, "Player dmg Combat component");
            playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);

            console.log(playerAR, enemyDR, playerLVL, enemyLVL, "STATS P")
            console.log(enemyAR, playerDR, enemyLVL, playerLVL, "STATS ENEMY HitRate", hitRate(enemyAR, playerDR, enemyLVL, playerLVL), currentEnemy)
            // enemyHR = hitRate(enemyAR, )
            enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL)
            console.log(playerLVL, "player level");
            console.log(enemyLVL, "enemy level");
            console.log(enemyStats, loot, "STATS ENEMY")
            console.log(enemyDR,"Enemy DR");
            // setCombat(true);
            playerLoop();
            // console.log("CURRENT", currentEnemy)
            enemyLoop();// Default player initiative, make change so it becomes random or depends on stats.
            if(currentEnemy !== 2) secEnemyLoop();
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
    
    console.log("DMG 1 ENEMYU ENEMIE OUTSIDE", enemies, currentEnemy, enemiesArr[0].id)
    const playerLoop = () => {
        console.log(playerCombatIntRef.current,"combat int ref")
        if(playerCombatIntRef.current === null) {
                playerCombatIntRef.current = setInterval(() => {
                    const randomVal = Math.random();
                    const randomAddDmg = Math.floor(randomVal * 2)
                    const randomCritVal = Math.random();
                    console.log(playerHR, "COMBAT REF", combatRef.current, healthArray, enemiesArr, currentEnemy)
                    if(healthArray[currentEnemy] > 0 && tempPlayerHealth > 0 && combatRef.current) {
                        console.log(randomVal, playerHR, "will it hit?", randomVal <= playerHR)
                        console.log("Crit Values Check", randomCritVal, baseCrit)
                        // console.log("DMG 1 ENEMYU RANDOM VAL", randomVal <= playerHR)
                        if(randomVal <= playerHR) {
                            let dmg = (playerDmg + randomAddDmg);
                            console.log("DMG 1 ENEMYU RANDOM CRIT VAL", randomCritVal <= baseCrit)
                            if(randomCritVal <= baseCrit) {
                                dmg *= 2;
                                dispatch(dmg2Enemy({id:currentEnemy, damage:{'dmg':dmg, 'crit': true}})); 
                                healthArray[0] -= dmg;
                                // if(healthArray[0] <= 0) clearInterval(playerCombatIntRef.current);
                                console.log("DMG 1 ENEMYU", dmg)
                            } else {
                                dispatch(dmg2Enemy({ id:currentEnemy, damage:{'dmg':dmg, 'crit': false} })); 
                            console.log("NO CRIT!", dmg);
                            healthArray[currentEnemy] -= dmg;
                                console.log("current enemy health", healthArray[currentEnemy])
                            console.log("DMG 1 ENEMYU NO CRIT", dmg)
                        }
                    } else {
                        dispatch(dmg2Enemy({ id:currentEnemy, damage:{'dmg':0, 'crit': false} }));
                        console.log("DMG 1 ENEMYU MISS")
                    }
                } else {
                    if(healthArray[0] <= 0) {
                        dispatch(XP(enemyXP));
                    }
                    clearInterval(playerCombatIntRef.current);
                    clearInterval(secEnemyCombatIntRef.current);
                    playerCombatIntRef.current = null;
                    const dropCalc = () => {
                        const random = Math.random(); (loot as LootObject[]).forEach((val: any) => { if(random <= val.dropChance) { console.log(val, "LOOT DROPPED !!!!!!!!")
                                lootItem = val
                            }
                        })
                    }
             
                        // dispatch(removeEnemy(currentEnemy));
                        console.log(enemiesStorage,"ENEMY COUNT 2", healthArray, currentEnemy)
                        const entries = Object.entries(enemies);
                        console.log(entries, "ENTRIES")//
                        // Checar se o proximo inimigo existe
                        if(healthArray.length - 1 > currentEnemy) dispatch(setCurrentEnemy(currentEnemy + 1)); 
                    console.log("AQUI OLHA 5")
                    dropCalc();
                    saveData();
                    setCombat(false);
                    emptyCombatLog();
                    console.log(loot, "LOOT")
                }
            }, 1000 / playerAtkSpeed)
        }
    }
    const secEnemyLoop = () => {
        let count = 0;
        secEnemyCombatIntRef.current = setInterval(() => {
            dispatch(dmg2Player({'dmg': enemiesArr[currentEnemy + 1].damage, 'crit':false, 'enemy':`${enemiesArr[currentEnemy + 1].info.name}+ *2*!`}))
            console.log(healthArray,healthArray[0], enemiesArr, currentEnemy, "@@@@ HEALTH ARRAY")
            count++
        }, 1500)       
    }
    const enemyLoop = () => {
        console.log("COMBAT REF ENEMYLOOP", enemyCombatIntRef.current, enemies)
        if(enemyCombatIntRef.current === null) {
            enemyCombatIntRef.current = setInterval(() => {
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(randomVal * 2);
                const randomCritVal = Math.random();
               console.log("COMBAT REF 2", combatRef.current, healthArray, enemiesArr, currentEnemy) 
                if(healthArray[currentEnemy] > 0 && tempPlayerHealth > 0 && combatRef.current) {
                    console.log(randomVal <= enemyHR, "Enemy hit rate check", enemyHR)
                    if(randomVal <= enemyHR) {
                        let dmg = enemiesArr[0].damage + randomAddDmg;
                        if(randomCritVal <= baseCrit) {
                            dmg *= 2;
                            dispatch(dmg2Player({'dmg':dmg, 'crit': true, 'enemy': enemiesArr[0].info.name}));
                            tempPlayerHealth -= dmg;
                        } else { dispatch(dmg2Player({'dmg':dmg, 'crit': false, 'enemy': enemiesArr[0].info.name}));
                            tempPlayerHealth -= dmg;
                        }
                    } else {
                        console.log("DMG %%% ELSE")
                        dispatch(dmg2Player({'dmg':0, 'crit': false, 'enemy': enemiesArr[0].info.name}));
                    }
                } else {
                    if(healthArray[currentEnemy] <= 0 && healthArray.length > 1) {
                        enemiesArr.splice(0, 1);
                        // healthArray.splice(0,1)
                        // dispatch(removeEnemy(currentEnemy));
                        // dispatch(setCurrentEnemy(currentEnemy + 1))
                        console.log(enemies,"ENEMIES REMOVED")
                    } 
                        setEnemyCount(enemyCount - 1);
                        setCombat(false);
                        clearInterval(enemyCombatIntRef.current);
                        enemyCombatIntRef.current = null;
                        dispatch(emptyCombatLog());       
                        // dispatch(removeEnemy(currentEnemy)); 
                        console.log(enemiesStorage,"ENEMY COUNT", healthArray, currentEnemy)
                        if(healthArray.length - 1 > currentEnemy) dispatch(setCurrentEnemy(currentEnemy + 1)); 
                    // if(enemyCount <= 1) {
                    //     combatRef.current = false;
                    //     dispatch(setCurrentEnemy(0));
                    //     dispatch(setEnemyPack(false));
                    // } else {
                    //     dispatch(setEnemyPack(true));
                    //     setCurrentEnemy(0);
                    // }

                    console.log(enemyCount, "ENEMIES LENGTH, 2")
                } 
            }, 1000 / enemyAtkSpeed)
        }
    }
    console.log(enemies, "ENEMIES END", currentEnemy)
    return { startCombat };
};