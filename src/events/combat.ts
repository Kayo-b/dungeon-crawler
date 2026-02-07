import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { store } from './../app/store';
import { dmg2Enemy, setCurrentEnemy } from './../features/enemy/enemySlice';
import { dmg2Player, XP, levelUp, emptyCombatLog } from './../features/player/playerSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAddToInv } from '../features/inventory/inventorySlice';
import { setEnemyCount, setInCombat } from './combatSlice';

interface Item {
    ID: number;
    type: string;
    Durability: number;
    dropChance: number;
}

interface LootObject {
    dropChance: number;
}

export const useCombat = () => {
    const dispatch = useAppDispatch();

    // Get state from Redux
    const enemies = useAppSelector(state => state.enemy.enemies);
    const playerHealth = useAppSelector(state => state.player.health);
    const playerAtkSpeed = useAppSelector(state => state.player.atkSpeed);
    const playerLVL = useAppSelector(state => state.player.level);
    const playerAR = useAppSelector(state => state.player.attackRating);
    const playerDR = useAppSelector(state => state.player.defenceRating);
    const playerDmg = useAppSelector(state => state.player.playerDmg);
    const baseCrit = useAppSelector(state => state.player.critChance);

    // Refs for combat intervals and state
    const combatRef = useRef(false);
    const playerCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const enemyCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const secEnemyIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

    // Ref to track current enemy health during combat (avoids stale closure issues)
    const enemyHealthRef = useRef<{[key: number]: number}>({});
    const playerHealthRef = useRef(playerHealth);

    // Track loot item for saving
    let lootItem: Item;

    // Convert enemies object to array
    const enemiesArr = Object.values(enemies);

    // Use ref to always have latest enemies (avoids stale closure in startCombat)
    const enemiesRef = useRef(enemiesArr);
    useEffect(() => {
        enemiesRef.current = Object.values(enemies);
        console.log("enemiesRef updated:", enemiesRef.current.length, "enemies");
    }, [enemies]);

    // Update playerHealthRef when playerHealth changes
    useEffect(() => {
        playerHealthRef.current = playerHealth;
    }, [playerHealth]);

    // Initialize enemy health tracking when enemies change
    useEffect(() => {
        const newHealthMap: {[key: number]: number} = {};
        enemiesArr.forEach((enemy, index) => {
            if (enemy && enemy.health !== undefined) {
                newHealthMap[index] = enemy.health;
            }
        });
        enemyHealthRef.current = newHealthMap;
    }, [enemies]);

    // Clear all combat intervals
    const clearAllIntervals = () => {
        if (playerCombatIntRef.current) {
            clearInterval(playerCombatIntRef.current);
            playerCombatIntRef.current = null;
        }
        if (enemyCombatIntRef.current) {
            clearInterval(enemyCombatIntRef.current);
            enemyCombatIntRef.current = null;
        }
        secEnemyIntervalsRef.current.forEach(interval => {
            if (interval) clearInterval(interval);
        });
        secEnemyIntervalsRef.current = [];
    };

    const startCombat = (id: number) => {
        // Use ref to get latest enemies (avoids stale closure)
        const currentEnemies = enemiesRef.current;

        console.log("=== COMBAT.TS startCombat called ===");
        console.log("Target ID:", id);
        console.log("currentEnemies:", currentEnemies);
        console.log("currentEnemies.length:", currentEnemies.length);
        console.log("currentEnemies[id]:", currentEnemies[id]);

        // Guard: Don't start combat if no enemies or invalid target
        if (currentEnemies.length === 0 || !currentEnemies[id]) {
            console.log("Cannot start combat - no enemies or invalid target");
            console.log("Reason: length=", currentEnemies.length, "target exists=", !!currentEnemies[id]);
            return;
        }

        dispatch(setInCombat(true));
        dispatch(setCurrentEnemy(id));
        dispatch(setEnemyCount(currentEnemies.length));

        // Initialize health tracking
        const newHealthMap: {[key: number]: number} = {};
        currentEnemies.forEach((enemy, index) => {
            if (enemy && enemy.health !== undefined) {
                newHealthMap[index] = enemy.health;
            }
        });
        enemyHealthRef.current = newHealthMap;
        playerHealthRef.current = playerHealth;

        // Get player health directly from store to avoid stale closure
        const storeState = store.getState();
        let currentPlayerHealth = storeState.player.health;

        // If health is 0 or undefined, use default (player might need to be reset)
        if (!currentPlayerHealth || currentPlayerHealth <= 0) {
            console.log("Player health is 0 - using default 90 for combat");
            currentPlayerHealth = 90; // Default health from characters.json
        }
        playerHealthRef.current = currentPlayerHealth;

        console.log("START COMBAT - Enemies:", currentEnemies.length, "Primary target:", id);
        console.log("playerHealth from store:", storeState.player.health, "using:", currentPlayerHealth);

        if (currentPlayerHealth > 0 && currentEnemies.length > 0) {
            combatRef.current = true;

            // Clear any existing intervals before starting new combat
            clearAllIntervals();

            // Start player attack loop against primary enemy
            playerLoop(id);

            // Start primary enemy attack loop
            enemyLoop(id);

            // Start secondary enemy attack loops if more than 1 enemy
            if (currentEnemies.length > 1) {
                startSecondaryEnemyLoops(id);
            }
        } else {
            console.log("No combat conditions met");
        }
    };
    
    // Attacker Attack Rating, Defender Defence Rating, Attacker Level, Defender Level
    const hitRate = (AAR: number, DDR: number, ALVL: number, DLVL: number) => {
        return 2 * (AAR / (AAR + DDR)) * (ALVL / (ALVL + DLVL));
    };

    // Find next living enemy
    const findNextLivingEnemy = (currentId: number): number | null => {
        const enemyIds = Object.keys(enemyHealthRef.current).map(Number);
        for (const id of enemyIds) {
            if (id !== currentId && enemyHealthRef.current[id] > 0) {
                return id;
            }
        }
        return null;
    };

    // Calculate loot drops
    const calculateLoot = (loot: LootObject[]) => {
        const random = Math.random();
        loot.forEach((val: any) => {
            if (random <= val.dropChance) {
                console.log(val, "LOOT DROPPED!");
                lootItem = val;
            }
        });
    };

    // End combat and save data
    const endCombat = async (enemyXP: number) => {
        combatRef.current = false;
        clearAllIntervals();

        // Save data
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        const itemsData = await AsyncStorage.getItem('items');
        const itemsObj = itemsData ? JSON.parse(itemsData) : {};

        if (lootItem !== undefined && lootItem !== null) {
            const itemType = lootItem.type;
            const itemID = lootItem.ID;
            console.log(lootItem, "LOOT ITEM");
            if (itemsObj.items?.[itemType]?.[`${itemID}`]) {
                obj.character.inventory.push(itemsObj.items[itemType][`${itemID}`]);
                dispatch(setAddToInv(itemsObj.items[itemType][`${itemID}`]));
            }
        }

        obj.character.stats.health = playerHealthRef.current;
        obj.character.experience += enemyXP;

        if (obj.character.experience >= obj.character.xptolvlup) {
            obj.character.level += 1;
            obj.character.xptolvlup *= 2;
            obj.character.stats.health += 5;
            obj.character.stats.strength += 1;
            obj.character.stats.vitality += 1;
            obj.character.stats.agility += 1;
            obj.character.stats.dexterity += 1;
            dispatch(levelUp());
        }

        await AsyncStorage.setItem('characters', JSON.stringify(obj));

        dispatch(emptyCombatLog());
        dispatch(setInCombat(false));
        console.log("COMBAT ENDED");
    };
    
    // Player attack loop - attacks the target enemy
    const playerLoop = (targetId: number) => {
        const currentEnemies = enemiesRef.current;
        if (!currentEnemies[targetId]) {
            console.log("Invalid target enemy");
            return;
        }

        const targetEnemy = currentEnemies[targetId];
        const enemyDR = targetEnemy.defence;
        const enemyLVL = targetEnemy.level;
        const enemyXP = targetEnemy.xp;
        const loot = targetEnemy.loot;
        const playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);

        console.log("Player loop started - Target:", targetId, "HR:", playerHR);

        playerCombatIntRef.current = setInterval(() => {
            // Check if combat should continue
            if (!combatRef.current || playerHealthRef.current <= 0) {
                endCombat(0);
                return;
            }

            const currentEnemyHealth = enemyHealthRef.current[targetId];

            // Check if target enemy is dead
            if (currentEnemyHealth <= 0) {
                console.log("Target enemy defeated! ID:", targetId);
                dispatch(XP(enemyXP));
                calculateLoot(loot as LootObject[]);

                // Check if there are more enemies alive
                const nextEnemy = findNextLivingEnemy(targetId);
                if (nextEnemy !== null) {
                    console.log("Switching to next enemy:", nextEnemy);
                    dispatch(setCurrentEnemy(nextEnemy));
                    clearInterval(playerCombatIntRef.current!);
                    playerCombatIntRef.current = null;
                    // Start new loop against next enemy
                    playerLoop(nextEnemy);
                } else {
                    // All enemies dead, end combat
                    endCombat(enemyXP);
                }
                return;
            }

            // Attack logic
            const randomVal = Math.random();
            const randomAddDmg = Math.floor(Math.random() * 2);
            const randomCritVal = Math.random();

            if (randomVal <= playerHR) {
                let dmg = playerDmg + randomAddDmg;
                const isCrit = randomCritVal <= baseCrit;

                if (isCrit) {
                    dmg *= 2;
                }

                dispatch(dmg2Enemy({ id: targetId, damage: { dmg, crit: isCrit } }));
                enemyHealthRef.current[targetId] -= dmg;
                console.log(`Player hit enemy ${targetId} for ${dmg}${isCrit ? ' CRIT!' : ''}`);
            } else {
                dispatch(dmg2Enemy({ id: targetId, damage: { dmg: 0, crit: false } }));
                console.log("Player missed!");
            }
        }, 1000 / playerAtkSpeed);
    };

    // Start attack loops for secondary enemies (those not being targeted by player)
    const startSecondaryEnemyLoops = (primaryTargetId: number) => {
        // Clear any existing secondary intervals
        secEnemyIntervalsRef.current.forEach(interval => clearInterval(interval));
        secEnemyIntervalsRef.current = [];

        // Find all enemies that are not the primary target
        const currentEnemies = enemiesRef.current;
        currentEnemies.forEach((enemy, index) => {
            if (index === primaryTargetId) return; // Skip primary target
            if (enemy.health <= 0) return; // Skip dead enemies

            const enemyDmg = enemy.damage;
            const enemyName = enemy.info.name;
            const enemyAtkSpeed = enemy.atkSpeed || 1;
            const enemyAR = enemy.atkRating || 10;
            const enemyLVL = enemy.level || 1;
            const enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);

            console.log(`Starting secondary enemy loop for ${enemyName} (ID: ${index})`);

            // Stagger attack speeds slightly for each secondary enemy
            const attackDelay = 1000 / enemyAtkSpeed + (index * 200);

            const interval = setInterval(() => {
                // Check if combat should continue
                if (!combatRef.current || playerHealthRef.current <= 0) {
                    return;
                }

                // Check if this enemy is still alive
                if (enemyHealthRef.current[index] <= 0) {
                    // This enemy is dead, clear its interval
                    clearInterval(interval);
                    return;
                }

                // Attack logic
                const randomVal = Math.random();
                const randomAddDmg = Math.floor(Math.random() * 2);
                const randomCritVal = Math.random();

                if (randomVal <= enemyHR) {
                    let dmg = enemyDmg + randomAddDmg;
                    const isCrit = randomCritVal <= 0.1; // 10% crit chance for enemies

                    if (isCrit) {
                        dmg *= 2;
                    }

                    dispatch(dmg2Player({ dmg, crit: isCrit, enemy: `${enemyName} (${index + 1})` }));
                    playerHealthRef.current -= dmg;
                    console.log(`Secondary enemy ${enemyName} hit player for ${dmg}${isCrit ? ' CRIT!' : ''}`);
                } else {
                    dispatch(dmg2Player({ dmg: 0, crit: false, enemy: `${enemyName} (${index + 1})` }));
                }
            }, attackDelay);

            secEnemyIntervalsRef.current.push(interval);
        });
    };

    // Primary enemy attack loop - attacks the player
    const enemyLoop = (id: number) => {
        const currentEnemies = enemiesRef.current;
        if (!currentEnemies[id]) {
            console.log("Invalid enemy for enemyLoop");
            return;
        }

        const enemy = currentEnemies[id];
        const enemyDmg = enemy.damage;
        const enemyName = enemy.info.name;
        const enemyAtkSpeed = enemy.atkSpeed || 1;
        const enemyAR = enemy.atkRating || 10;
        const enemyLVL = enemy.level || 1;
        const enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);

        console.log("Enemy loop started - ID:", id, "HR:", enemyHR);

        enemyCombatIntRef.current = setInterval(() => {
            // Check if combat should continue
            if (!combatRef.current || playerHealthRef.current <= 0) {
                return;
            }

            // Check if this enemy is still alive
            if (enemyHealthRef.current[id] <= 0) {
                // This enemy is dead, check if there's a next enemy
                const nextEnemy = findNextLivingEnemy(id);
                if (nextEnemy !== null) {
                    console.log("Primary enemy dead, switching to:", nextEnemy);
                    clearInterval(enemyCombatIntRef.current!);
                    enemyCombatIntRef.current = null;
                    // Start attacking from new primary enemy
                    enemyLoop(nextEnemy);
                }
                return;
            }

            // Attack logic
            const randomVal = Math.random();
            const randomAddDmg = Math.floor(Math.random() * 2);
            const randomCritVal = Math.random();

            if (randomVal <= enemyHR) {
                let dmg = enemyDmg + randomAddDmg;
                const isCrit = randomCritVal <= 0.1; // 10% crit chance for enemies

                if (isCrit) {
                    dmg *= 2;
                }

                dispatch(dmg2Player({ dmg, crit: isCrit, enemy: enemyName }));
                playerHealthRef.current -= dmg;
                console.log(`Primary enemy ${enemyName} hit player for ${dmg}${isCrit ? ' CRIT!' : ''}`);
            } else {
                dispatch(dmg2Player({ dmg: 0, crit: false, enemy: enemyName }));
                console.log(`Primary enemy ${enemyName} missed!`);
            }
        }, 1000 / enemyAtkSpeed);
    };

    return { startCombat };
};