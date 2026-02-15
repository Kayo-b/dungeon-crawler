import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { store } from './../app/store';
import { dmg2Enemy, setCurrentEnemy } from './../features/enemy/enemySlice';
import { isEnemyCombatReachable, isEnemyOccludedByCloserEnemy } from './../features/enemy/enemyPerception';
import {
  addComboPoint,
  consumeAllComboPoints,
  dmg2Player,
  gainRage,
  levelUp,
  resetComboPoints,
  setCombatLog,
  spendEnergy,
  spendMana,
  spendRage,
  XP,
} from './../features/player/playerSlice';
import { setAddToInv } from '../features/inventory/inventorySlice';
import { Direction } from '../types/map';
import {
  registerEnemyAttack,
  registerPlayerHit,
  setEnemyCount,
  setInCombat,
  setSpecialCooldown,
  tickSpecialCooldown,
} from './combatSlice';

interface Item {
  ID: number;
  type: string;
  Durability: number;
  dropChance: number;
}

interface LootObject {
  dropChance: number;
  type: string;
  ID: number;
}

type HitVariant = 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate';

const SKILL_GCD_FRAMES = 8;
const WARRIOR_RAGE_ON_HIT = 12;

const CLASS_AUTO_TUNING = {
  warrior: { splash: 0.35, hitFx: 'slash' as HitVariant },
  caster: { splash: 0.2, hitFx: 'pow' as HitVariant },
  ranger: { splash: 0, hitFx: 'slash' as HitVariant },
};

export const useCombat = () => {
  const dispatch = useAppDispatch();

  const enemies = useAppSelector((state) => state.enemy.enemies);
  const playerHealth = useAppSelector((state) => state.player.health);
  const playerAtkSpeed = useAppSelector((state) => state.player.atkSpeed);
  const playerLVL = useAppSelector((state) => state.player.level);
  const playerAR = useAppSelector((state) => state.player.attackRating);
  const playerDR = useAppSelector((state) => state.player.defenceRating);
  const playerDmg = useAppSelector((state) => state.player.playerDmg);
  const playerStats = useAppSelector((state) => state.player.stats as any);
  const baseCrit = useAppSelector((state) => state.player.critChance);
  const playerPosX = useAppSelector((state) => state.room.posX);
  const playerPosY = useAppSelector((state) => state.room.posY);
  const playerFacing = useAppSelector((state) => state.room.direction as Direction);
  const specialCooldownFrames = useAppSelector((state) => state.combat.specialCooldownFrames);
  const inCombat = useAppSelector((state) => state.combat.inCombat);
  const playerClass = useAppSelector((state) => state.player.classArchetype || 'warrior');

  const rage = useAppSelector((state) => state.player.rage);
  const mana = useAppSelector((state) => state.player.mana);
  const energy = useAppSelector((state) => state.player.energy);
  const comboPoints = useAppSelector((state) => state.player.comboPoints);

  const combatRef = useRef(false);
  const playerCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enemyCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secEnemyIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const cooldownTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enemyHealthRef = useRef<{ [key: number]: number }>({});
  const playerHealthRef = useRef(playerHealth);
  const playerAttackArmedRef = useRef(false);
  const combatViewRef = useRef({
    x: playerPosX,
    y: playerPosY,
    facing: playerFacing,
    playerClass,
  });

  let lootItem: Item | undefined;

  const enemiesArr = Object.values(enemies);
  const enemiesRef = useRef(enemiesArr);
  enemiesRef.current = enemiesArr;
  combatViewRef.current = {
    x: playerPosX,
    y: playerPosY,
    facing: playerFacing,
    playerClass,
  };

  useEffect(() => {
    playerHealthRef.current = playerHealth;
  }, [playerHealth]);

  useEffect(() => {
    const map: { [key: number]: number } = {};
    enemiesArr.forEach((enemy, index) => {
      if (enemy && enemy.health !== undefined) {
        map[index] = enemy.health;
      }
    });
    enemyHealthRef.current = map;
  }, [enemies]);

  const clearAllIntervals = () => {
    if (playerCombatIntRef.current) {
      clearInterval(playerCombatIntRef.current);
      playerCombatIntRef.current = null;
    }
    if (enemyCombatIntRef.current) {
      clearInterval(enemyCombatIntRef.current);
      enemyCombatIntRef.current = null;
    }
    if (cooldownTickRef.current) {
      clearInterval(cooldownTickRef.current);
      cooldownTickRef.current = null;
    }
    secEnemyIntervalsRef.current.forEach((interval) => clearInterval(interval));
    secEnemyIntervalsRef.current = [];
  };

  const startCooldownTicker = () => {
    if (cooldownTickRef.current) {
      clearInterval(cooldownTickRef.current);
    }
    cooldownTickRef.current = setInterval(() => {
      dispatch(tickSpecialCooldown());
    }, 120);
  };

  const hitRate = (AAR: number, DDR: number, ALVL: number, DLVL: number) => {
    return 2 * (AAR / (AAR + DDR)) * (ALVL / (ALVL + DLVL));
  };

  const isHostileEnemy = (enemy: any): boolean => {
    return (enemy?.disposition || 'hostile') === 'hostile';
  };

  const isEnemyReachableNow = (enemyId: number): boolean => {
    const enemy = enemiesRef.current[enemyId];
    if (!enemy || enemy.health <= 0) return false;
    if (!isHostileEnemy(enemy)) return false;

    const { x, y, facing, playerClass: currentClass } = combatViewRef.current;
    const enemiesForLane = enemiesRef.current.map((entry, index) => {
      if (!entry) return entry;
      const syncedHealth = enemyHealthRef.current[index];
      return { ...entry, health: syncedHealth !== undefined ? syncedHealth : entry.health };
    });

    if (isEnemyOccludedByCloserEnemy(enemyId, enemiesForLane as any[], x, y, facing)) {
      return false;
    }

    const syncedEnemy = {
      ...enemy,
      health: enemyHealthRef.current[enemyId] !== undefined ? enemyHealthRef.current[enemyId] : enemy.health,
    };

    return isEnemyCombatReachable(syncedEnemy as any, x, y, facing, currentClass);
  };

  const findNextLivingEnemy = (currentId: number): number | null => {
    const enemyIds = Object.keys(enemyHealthRef.current).map(Number);
    for (const id of enemyIds) {
      if (id !== currentId && enemyHealthRef.current[id] > 0 && isEnemyReachableNow(id)) {
        return id;
      }
    }
    return null;
  };

  const aliveEnemyIds = (reachableOnly: boolean = false) => {
    return Object.keys(enemyHealthRef.current)
      .map(Number)
      .filter((id) => enemyHealthRef.current[id] > 0)
      .filter((id) => isHostileEnemy(enemiesRef.current[id]))
      .filter((id) => (reachableOnly ? isEnemyReachableNow(id) : true));
  };

  const calculateLoot = (loot: LootObject[]) => {
    const random = Math.random();
    loot.forEach((val: LootObject) => {
      if (random <= val.dropChance) {
        lootItem = val as Item;
      }
    });
  };

  const getClassAutoTuning = () => {
    if (playerClass === 'caster') return CLASS_AUTO_TUNING.caster;
    if (playerClass === 'ranger') return CLASS_AUTO_TUNING.ranger;
    return CLASS_AUTO_TUNING.warrior;
  };

  const applyDamageToEnemy = (enemyId: number, dmg: number, crit: boolean, hitType: HitVariant) => {
    dispatch(dmg2Enemy({ id: enemyId, damage: { dmg, crit } }));
    enemyHealthRef.current[enemyId] = (enemyHealthRef.current[enemyId] ?? 0) - dmg;
    dispatch(registerPlayerHit({ enemyId, hitType }));
  };

  const applyClassCleave = (targetId: number, baseDamage: number) => {
    const splashMultiplier = getClassAutoTuning().splash;
    if (splashMultiplier <= 0) return;

    const others = aliveEnemyIds(true).filter((id) => id !== targetId);
    if (others.length === 0) return;

    const splashDamage = Math.max(1, Math.floor(baseDamage * splashMultiplier));
    const hitType = getClassAutoTuning().hitFx;

    others.forEach((id) => {
      applyDamageToEnemy(id, splashDamage, false, hitType);
    });

    dispatch(setCombatLog(`Splash damage hit ${others.length} nearby enemy${others.length > 1 ? 'ies' : ''}.`));
  };

  const applyEnemyAttackToPlayer = (enemyId: number, enemyLabel?: string) => {
    const enemy = enemiesRef.current[enemyId];
    if (!enemy || enemy.health <= 0) return;
    if (!isHostileEnemy(enemy)) return;
    if (playerHealthRef.current <= 0) return;

    const enemyAR = enemy.atkRating || 10;
    const enemyLVL = enemy.level || 1;
    const enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);
    const randomVal = Math.random();
    const randomAddDmg = Math.floor(Math.random() * 2);
    const randomCritVal = Math.random();

    dispatch(registerEnemyAttack(enemyId));

    if (randomVal <= enemyHR) {
      let dmg = (enemy.damage || 1) + randomAddDmg;
      const isCrit = randomCritVal <= 0.1;
      if (isCrit) {
        dmg *= 2;
      }
      dispatch(dmg2Player({ dmg, crit: isCrit, enemy: enemyLabel || enemy.info.name }));
      playerHealthRef.current -= dmg;
    } else {
      dispatch(dmg2Player({ dmg: 0, crit: false, enemy: enemyLabel || enemy.info.name }));
    }
  };

  const endCombat = async (enemyXP: number) => {
    combatRef.current = false;
    playerAttackArmedRef.current = false;
    clearAllIntervals();

    dispatch(resetComboPoints());

    const data = await AsyncStorage.getItem('characters');
    const obj = data ? JSON.parse(data) : {};
    const itemsData = await AsyncStorage.getItem('items');
    const itemsObj = itemsData ? JSON.parse(itemsData) : {};

    if (lootItem !== undefined && lootItem !== null) {
      const itemType = lootItem.type;
      const itemID = lootItem.ID;
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

    dispatch(setInCombat(false));
    dispatch(setSpecialCooldown(0));
    dispatch(setCombatLog('Combat ended.'));
  };

  const getPrimaryTarget = (): number | null => {
    const preferred = store.getState().enemy.currentEnemyId;
    if (preferred !== undefined && preferred !== null && isEnemyReachableNow(preferred)) {
      if ((enemyHealthRef.current[preferred] ?? 0) > 0) {
        return preferred;
      }
    }

    const reachable = aliveEnemyIds(true);
    return reachable.length > 0 ? reachable[0] : null;
  };

  const canUseSkillNow = () => {
    if (!combatRef.current || !inCombat) return false;
    if (specialCooldownFrames > 0) return false;
    return true;
  };

  const beginPlayerAttackIfNeeded = (targetId: number) => {
    if (playerAttackArmedRef.current) {
      return;
    }

    playerAttackArmedRef.current = true;
    dispatch(setCurrentEnemy(targetId));

    if (playerCombatIntRef.current) {
      clearInterval(playerCombatIntRef.current);
      playerCombatIntRef.current = null;
    }

    playerLoop(targetId);
    dispatch(setCombatLog('You counterattack with a skill.'));
  };

  const performPrimarySkill = () => {
    if (!canUseSkillNow()) return;

    const targetId = getPrimaryTarget();
    if (targetId === null) return;

    if (playerClass === 'warrior') {
      const rageCost = 50;
      if (rage < rageCost) {
        dispatch(setCombatLog(`Need ${rageCost} rage for Crushing Blow.`));
        return;
      }

      beginPlayerAttackIfNeeded(targetId);
      dispatch(spendRage(rageCost));
      const damage = Math.max(4, Math.floor(playerDmg * 2.2 + (playerStats?.strength || 0) * 0.35));
      applyDamageToEnemy(targetId, damage, false, 'crush');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog('Crushing Blow lands a heavy hit.'));
      return;
    }

    if (playerClass === 'caster') {
      const manaCost = 18;
      if (mana < manaCost) {
        dispatch(setCombatLog(`Need ${manaCost} mana for Arcane Bolt.`));
        return;
      }

      beginPlayerAttackIfNeeded(targetId);
      dispatch(spendMana(manaCost));
      const damage = Math.max(4, Math.floor(playerDmg * 1.6 + (playerStats?.intelligence || 0) * 0.9));
      applyDamageToEnemy(targetId, damage, false, 'fire');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog('Arcane Bolt burns the target.'));
      return;
    }

    const energyCost = 20;
    if (energy < energyCost) {
      dispatch(setCombatLog(`Need ${energyCost} energy for Quick Stab.`));
      return;
    }

    beginPlayerAttackIfNeeded(targetId);
    dispatch(spendEnergy(energyCost));
    dispatch(addComboPoint(1));
    const damage = Math.max(2, Math.floor(playerDmg * 0.78 + (playerStats?.dexterity || 0) * 0.2));
    applyDamageToEnemy(targetId, damage, false, 'slash');
    dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
    dispatch(setCombatLog('Quick Stab builds 1 combo point.'));
  };

  const performSecondarySkill = () => {
    if (!canUseSkillNow()) return;

    if (playerClass === 'warrior') {
      const rageCost = 100;
      if (rage < rageCost) {
        dispatch(setCombatLog(`Need ${rageCost} rage for Whirlwind.`));
        return;
      }

      const targets = aliveEnemyIds(true);
      if (targets.length === 0) return;

      beginPlayerAttackIfNeeded(targets[0]);
      dispatch(spendRage(rageCost));
      const damage = Math.max(3, Math.floor(playerDmg * 1.35 + (playerStats?.strength || 0) * 0.22));
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'slash'));
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Whirlwind hits ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}.`));
      return;
    }

    if (playerClass === 'caster') {
      const manaCost = 32;
      if (mana < manaCost) {
        dispatch(setCombatLog(`Need ${manaCost} mana for Fire Blast.`));
        return;
      }

      const targets = aliveEnemyIds(true);
      if (targets.length === 0) return;

      beginPlayerAttackIfNeeded(targets[0]);
      dispatch(spendMana(manaCost));
      const damage = Math.max(3, Math.floor(playerDmg * 1.2 + (playerStats?.intelligence || 0) * 0.65));
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'fire'));
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Fire Blast scorches ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}.`));
      return;
    }

    const energyCost = 15;
    if (energy < energyCost) {
      dispatch(setCombatLog(`Need ${energyCost} energy for Eviscerate.`));
      return;
    }
    if (comboPoints <= 0) {
      dispatch(setCombatLog('Eviscerate requires combo points.'));
      return;
    }

    const targetId = getPrimaryTarget();
    if (targetId === null) return;

    const spentCombo = comboPoints;
    beginPlayerAttackIfNeeded(targetId);
    dispatch(spendEnergy(energyCost));
    dispatch(consumeAllComboPoints());

    const comboMultiplier = 1.1 + spentCombo * 0.6;
    const damage = Math.max(
      5,
      Math.floor(playerDmg * comboMultiplier + (playerStats?.dexterity || 0) * 0.35 * spentCombo)
    );

    applyDamageToEnemy(targetId, damage, false, 'mutilate');
    dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
    dispatch(setCombatLog(`Eviscerate consumes ${spentCombo} combo point${spentCombo > 1 ? 's' : ''}.`));
  };

  const playerLoop = (targetId: number) => {
    const currentEnemies = enemiesRef.current;
    if (!currentEnemies[targetId]) {
      return;
    }

    const targetEnemy = currentEnemies[targetId];
    const enemyDR = targetEnemy.defence;
    const enemyLVL = targetEnemy.level;
    const enemyXP = targetEnemy.xp;
    const loot = targetEnemy.loot;
    const playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);

    playerCombatIntRef.current = setInterval(() => {
      if (!combatRef.current || playerHealthRef.current <= 0) {
        endCombat(0);
        return;
      }

      const currentEnemyHealth = enemyHealthRef.current[targetId];

      if (currentEnemyHealth <= 0) {
        dispatch(XP(enemyXP));
        calculateLoot(loot as LootObject[]);

        const nextEnemy = findNextLivingEnemy(targetId);
        if (nextEnemy !== null) {
          dispatch(setCurrentEnemy(nextEnemy));
          clearInterval(playerCombatIntRef.current!);
          playerCombatIntRef.current = null;
          playerLoop(nextEnemy);
        } else {
          endCombat(enemyXP);
        }
        return;
      }

      if (!isEnemyReachableNow(targetId)) {
        const nextEnemy = findNextLivingEnemy(targetId);
        if (nextEnemy !== null) {
          dispatch(setCurrentEnemy(nextEnemy));
          clearInterval(playerCombatIntRef.current!);
          playerCombatIntRef.current = null;
          playerLoop(nextEnemy);
        } else {
          endCombat(0);
        }
        return;
      }

      const randomVal = Math.random();
      const randomAddDmg = Math.floor(Math.random() * 2);
      const randomCritVal = Math.random();

      if (randomVal <= playerHR) {
        let dmg = playerDmg + randomAddDmg;
        const isCrit = randomCritVal <= baseCrit;

        if (isCrit) {
          dmg *= 2;
        }

        const hitType = getClassAutoTuning().hitFx;
        applyDamageToEnemy(targetId, dmg, isCrit, hitType);
        applyClassCleave(targetId, dmg);

        if (playerClass === 'warrior') {
          dispatch(gainRage(WARRIOR_RAGE_ON_HIT));
        }
      } else {
        dispatch(dmg2Enemy({ id: targetId, damage: { dmg: 0, crit: false } }));
      }
    }, 1000 / Math.max(playerAtkSpeed, 0.2));
  };

  const startSecondaryEnemyLoops = (primaryTargetId: number) => {
    secEnemyIntervalsRef.current.forEach((interval) => clearInterval(interval));
    secEnemyIntervalsRef.current = [];

    const currentEnemies = enemiesRef.current;
    currentEnemies.forEach((enemy, index) => {
      if (index === primaryTargetId || enemy.health <= 0) return;
      if (!isHostileEnemy(enemy)) return;
      if (!isEnemyReachableNow(index)) return;

      const enemyDmg = enemy.damage;
      const enemyName = enemy.info.name;
      const enemyAtkSpeed = enemy.atkSpeed || 1;
      const enemyAR = enemy.atkRating || 10;
      const enemyLVL = enemy.level || 1;
      const enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);

      const attackDelay = 1000 / enemyAtkSpeed + index * 200;

      const interval = setInterval(() => {
        if (!combatRef.current || playerHealthRef.current <= 0) {
          return;
        }

        if (enemyHealthRef.current[index] <= 0) {
          clearInterval(interval);
          return;
        }

        if (!isEnemyReachableNow(index)) {
          return;
        }

        const randomVal = Math.random();
        const randomAddDmg = Math.floor(Math.random() * 2);
        const randomCritVal = Math.random();

        dispatch(registerEnemyAttack(index));

        if (randomVal <= enemyHR) {
          let dmg = enemyDmg + randomAddDmg;
          const isCrit = randomCritVal <= 0.1;

          if (isCrit) {
            dmg *= 2;
          }

          dispatch(dmg2Player({ dmg, crit: isCrit, enemy: `${enemyName} (${index + 1})` }));
          playerHealthRef.current -= dmg;
        } else {
          dispatch(dmg2Player({ dmg: 0, crit: false, enemy: `${enemyName} (${index + 1})` }));
        }
      }, attackDelay);

      secEnemyIntervalsRef.current.push(interval);
    });
  };

  const enemyLoop = (id: number) => {
    const currentEnemies = enemiesRef.current;
    if (!currentEnemies[id]) {
      return;
    }
    if (!isHostileEnemy(currentEnemies[id])) {
      return;
    }
    if (!isEnemyReachableNow(id)) {
      return;
    }

    const enemy = currentEnemies[id];
    const enemyDmg = enemy.damage;
    const enemyName = enemy.info.name;
    const enemyAtkSpeed = enemy.atkSpeed || 1;
    const enemyAR = enemy.atkRating || 10;
    const enemyLVL = enemy.level || 1;
    const enemyHR = hitRate(enemyAR, playerDR, enemyLVL, playerLVL);

    enemyCombatIntRef.current = setInterval(() => {
      if (!combatRef.current || playerHealthRef.current <= 0) {
        return;
      }

      if (enemyHealthRef.current[id] <= 0) {
        const nextEnemy = findNextLivingEnemy(id);
        if (nextEnemy !== null) {
          clearInterval(enemyCombatIntRef.current!);
          enemyCombatIntRef.current = null;
          enemyLoop(nextEnemy);
        } else if (enemyCombatIntRef.current) {
          clearInterval(enemyCombatIntRef.current);
          enemyCombatIntRef.current = null;
        }
        return;
      }

      if (!isEnemyReachableNow(id)) {
        const nextEnemy = findNextLivingEnemy(id);
        if (nextEnemy !== null) {
          clearInterval(enemyCombatIntRef.current!);
          enemyCombatIntRef.current = null;
          enemyLoop(nextEnemy);
        } else if (enemyCombatIntRef.current) {
          clearInterval(enemyCombatIntRef.current);
          enemyCombatIntRef.current = null;
        }
        return;
      }

      const randomVal = Math.random();
      const randomAddDmg = Math.floor(Math.random() * 2);
      const randomCritVal = Math.random();

      dispatch(registerEnemyAttack(id));

      if (randomVal <= enemyHR) {
        let dmg = enemyDmg + randomAddDmg;
        const isCrit = randomCritVal <= 0.1;

        if (isCrit) {
          dmg *= 2;
        }

        dispatch(dmg2Player({ dmg, crit: isCrit, enemy: enemyName }));
        playerHealthRef.current -= dmg;
      } else {
        dispatch(dmg2Player({ dmg: 0, crit: false, enemy: enemyName }));
      }
    }, 1000 / enemyAtkSpeed);
  };

  const startCombat = (id: number) => {
    const currentEnemies = enemiesRef.current;

    if (combatRef.current || inCombat) {
      return;
    }

    if (currentEnemies.length === 0 || !currentEnemies[id]) {
      return;
    }
    if (!isHostileEnemy(currentEnemies[id])) {
      return;
    }

    if (!isEnemyReachableNow(id)) {
      return;
    }

    const reachableEnemyCount = currentEnemies.filter((enemy, index) => {
      return enemy && enemy.health > 0 && isHostileEnemy(enemy) && isEnemyReachableNow(index);
    }).length;

    dispatch(setInCombat(true));
    dispatch(setCurrentEnemy(id));
    dispatch(setEnemyCount(reachableEnemyCount));

    const healthMap: { [key: number]: number } = {};
    currentEnemies.forEach((enemy, index) => {
      if (enemy && enemy.health !== undefined) {
        healthMap[index] = enemy.health;
      }
    });

    enemyHealthRef.current = healthMap;

    const storeState = store.getState();
    let currentPlayerHealth = storeState.player.health;

    if (!currentPlayerHealth || currentPlayerHealth <= 0) {
      currentPlayerHealth = 90;
    }

    playerHealthRef.current = currentPlayerHealth;

    if (currentPlayerHealth > 0 && currentEnemies.length > 0) {
      combatRef.current = true;
      playerAttackArmedRef.current = false;
      clearAllIntervals();
      startCooldownTicker();

      if (currentEnemies[id]?.firstStrike) {
        const firstStrikerName = currentEnemies[id]?.info?.name || 'Ranged enemy';
        applyEnemyAttackToPlayer(id, `${firstStrikerName} (opening shot)`);
        if (playerHealthRef.current <= 0) {
          endCombat(0);
          return;
        }
      }

      enemyLoop(id);

      if (aliveEnemyIds(true).length > 1) {
        startSecondaryEnemyLoops(id);
      }

      dispatch(setCombatLog('Enemy engages first. Click an enemy to start attacking.'));
    }
  };

  const engagePlayerAttack = (id: number) => {
    if (!combatRef.current) {
      return;
    }

    if (!isEnemyReachableNow(id)) {
      return;
    }

    playerAttackArmedRef.current = true;
    dispatch(setCurrentEnemy(id));

    if (playerCombatIntRef.current) {
      clearInterval(playerCombatIntRef.current);
      playerCombatIntRef.current = null;
    }

    playerLoop(id);
  };

  return {
    startCombat,
    engagePlayerAttack,
    performPrimarySkill,
    performSecondarySkill,
    specialCooldownFrames,
    inCombat,
  };
};
