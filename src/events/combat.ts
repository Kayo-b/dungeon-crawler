import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { store } from './../app/store';
import { dmg2Enemy, setCurrentEnemy } from './../features/enemy/enemySlice';
import { isEnemyCombatReachable, isEnemyOccludedByCloserEnemy } from './../features/enemy/enemyPerception';
import {
  addComboPoint,
  consumeAllComboPoints,
  dmg2Player,
  resetComboPoints,
  setCombatLog,
  setHealth,
  setLevel,
  setStats,
  setUnspentStatPoints,
  restoreMana,
  spendMana,
  XP,
} from './../features/player/playerSlice';
import { Direction } from '../types/map';
import {
  registerEnemyAttack,
  registerPlayerHit,
  setEnemyCount,
  setInCombat,
  setSpecialCooldown,
  tickSpecialCooldown,
} from './combatSlice';
import { computeDerivedPlayerStats, getClassProgressionProfile } from '../features/player/playerStats';
import itemData from '../data/items.json';
import {
  SkillId,
  SKILLS,
  doesMeetSkillRequirements,
  getSkillLevel,
  getSkillRequirementSummary,
} from '../features/skills/skillCatalog';

interface LootObject {
  dropChance?: number;
  type: string;
  ID: number;
  amount?: number;
  amout?: number;
}

export interface FloorLootBag {
  id: string;
  mapId: string;
  x: number;
  y: number;
  items: any[];
}

type HitVariant = 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate';

const SKILL_GCD_FRAMES = 8;
const WEAPON_CLEAVE_AFFIX = 'great';
const WEAPON_CLEAVE_MULTIPLIER = 0.35;
const STAT_POINTS_PER_LEVEL = 5;

const formatPassiveGain = (value: number): string => {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
};

const CLASS_HIT_FX = {
  warrior: 'slash' as HitVariant,
  caster: 'pow' as HitVariant,
  ranger: 'slash' as HitVariant,
};

const readWeaponAffixes = (weapon: any): string[] => {
  if (!weapon || typeof weapon !== 'object' || !Array.isArray(weapon.affixes)) {
    return [];
  }

  return weapon.affixes
    .map((entry: unknown) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry: string) => entry.length > 0);
};

const weaponCanCleave = (weapon: any): boolean => {
  return readWeaponAffixes(weapon).includes(WEAPON_CLEAVE_AFFIX);
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
  const playerDodgeChance = useAppSelector((state) => state.player.dodgeChance || 0);
  const playerPosX = useAppSelector((state) => state.room.posX);
  const playerPosY = useAppSelector((state) => state.room.posY);
  const playerFacing = useAppSelector((state) => state.room.direction as Direction);
  const currentMapId = useAppSelector((state) => state.room.currentMapId);
  const specialCooldownFrames = useAppSelector((state) => state.combat.specialCooldownFrames);
  const inCombat = useAppSelector((state) => state.combat.inCombat);
  const playerClass = useAppSelector((state) => state.player.classArchetype || 'warrior');
  const skillLevels = useAppSelector((state) => state.player.skillLevels || {});

  const mana = useAppSelector((state) => state.player.mana);
  const comboPoints = useAppSelector((state) => state.player.comboPoints);

  const combatRef = useRef(false);
  const combatEndingRef = useRef(false);
  const playerCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enemyCombatIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secEnemyIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const cooldownTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enemyHealthRef = useRef<{ [key: number]: number }>({});
  const processedEnemyIdsRef = useRef<Set<number>>(new Set());
  const pendingEnemyLootRef = useRef<Array<{ mapId: string; x: number; y: number; item: any }>>([]);
  const playerHealthRef = useRef(playerHealth);
  const playerAttackArmedRef = useRef(false);
  const combatViewRef = useRef({
    x: playerPosX,
    y: playerPosY,
    facing: playerFacing,
    playerClass,
    mapId: currentMapId,
  });
  const [floorLootBags, setFloorLootBags] = useState<FloorLootBag[]>([]);
  const [activeLootBagId, setActiveLootBagId] = useState<string | null>(null);
  const pendingLootItems = useMemo(() => {
    if (!activeLootBagId) return [];
    return floorLootBags.find((bag) => bag.id === activeLootBagId)?.items || [];
  }, [floorLootBags, activeLootBagId]);

  useEffect(() => {
    if (!activeLootBagId) return;
    const bagStillExists = floorLootBags.some(
      (bag) => bag.id === activeLootBagId && Array.isArray(bag.items) && bag.items.length > 0
    );
    if (!bagStillExists) {
      setActiveLootBagId(null);
    }
  }, [activeLootBagId, floorLootBags]);

  const enemiesArr = Object.values(enemies);
  const enemiesRef = useRef(enemiesArr);
  enemiesRef.current = enemiesArr;
  combatViewRef.current = {
    x: playerPosX,
    y: playerPosY,
    facing: playerFacing,
    playerClass,
    mapId: currentMapId,
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

  const resolveLootEntry = (drop: LootObject): any | null => {
    const sourceItems = (itemData as any)?.items || {};
    const baseItem = sourceItems?.[drop.type]?.[`${drop.ID}`];
    if (!baseItem) return null;
    const quantity = Number(drop.amount ?? drop.amout ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 1) {
      return { ...baseItem };
    }
    return { ...baseItem, amount: Math.max(1, Math.floor(quantity)) };
  };

  const resolveSingleLootDrop = (loot: LootObject[]): any | null => {
    const candidates = (loot || [])
      .map((entry) => {
        const resolved = resolveLootEntry(entry);
        if (!resolved) return null;
        const chance = Math.max(0, Number(entry?.dropChance || 0));
        return { resolved, chance };
      })
      .filter((entry): entry is { resolved: any; chance: number } => !!entry);

    if (candidates.length <= 0) return null;

    const successfulRolls = candidates.filter((entry) => Math.random() <= entry.chance);
    if (successfulRolls.length > 0) {
      const rolled = successfulRolls[Math.floor(Math.random() * successfulRolls.length)];
      return rolled ? { ...rolled.resolved } : null;
    }

    const weightedTotal = candidates.reduce((sum, entry) => sum + Math.max(0.01, entry.chance), 0);
    if (!Number.isFinite(weightedTotal) || weightedTotal <= 0) {
      return { ...candidates[0].resolved };
    }

    let roll = Math.random() * weightedTotal;
    for (const entry of candidates) {
      roll -= Math.max(0.01, entry.chance);
      if (roll <= 0) {
        return { ...entry.resolved };
      }
    }

    return { ...candidates[candidates.length - 1].resolved };
  };

  const queueEnemyLootDrop = (enemyId: number, enemyState: any, lootTable: LootObject[]) => {
    if (processedEnemyIdsRef.current.has(enemyId)) return;
    processedEnemyIdsRef.current.add(enemyId);

    const dropXValue = Number(enemyState?.positionX);
    const dropYValue = Number(enemyState?.positionY);
    const dropX = Number.isFinite(dropXValue) ? dropXValue : combatViewRef.current.x;
    const dropY = Number.isFinite(dropYValue) ? dropYValue : combatViewRef.current.y;
    const mapId = String(combatViewRef.current.mapId || '');

    const guaranteedLootEntries: LootObject[] = Array.isArray(enemyState?.guaranteedLoot)
      ? enemyState.guaranteedLoot
      : [];
    const guaranteedLootItems = guaranteedLootEntries
      .map((entry: LootObject) => resolveLootEntry(entry))
      .filter((entry): entry is Record<string, any> => !!entry);

    if (guaranteedLootItems.length > 0) {
      guaranteedLootItems.forEach((item: Record<string, any>) => {
        pendingEnemyLootRef.current.push({
          x: dropX,
          y: dropY,
          mapId,
          item,
        });
      });
      return;
    }

    const droppedItem = resolveSingleLootDrop(lootTable);
    if (!droppedItem) return;

    pendingEnemyLootRef.current.push({
      x: dropX,
      y: dropY,
      mapId,
      item: droppedItem,
    });
  };

  const queueAllDefeatedEnemyRewards = () => {
    Object.keys(enemyHealthRef.current)
      .map(Number)
      .forEach((enemyId) => {
        if ((enemyHealthRef.current[enemyId] ?? 1) > 0) return;
        if (processedEnemyIdsRef.current.has(enemyId)) return;

        const defeatedEnemy = enemiesRef.current[enemyId];
        if (!defeatedEnemy || !isHostileEnemy(defeatedEnemy)) {
          processedEnemyIdsRef.current.add(enemyId);
          return;
        }

        dispatch(XP(Number(defeatedEnemy.xp || 0)));
        const lootTable = Array.isArray(defeatedEnemy.loot) ? defeatedEnemy.loot : [];
        queueEnemyLootDrop(enemyId, defeatedEnemy, lootTable as LootObject[]);
      });
  };

  const addFloorLootBag = useCallback((params: { x: number; y: number; mapId: string; items: any[] }) => {
    if (!params.items || params.items.length <= 0) return;

    setFloorLootBags((prev) => {
      const existingIndex = prev.findIndex(
        (bag) => bag.mapId === params.mapId && bag.x === params.x && bag.y === params.y
      );
      if (existingIndex >= 0) {
        const merged = [...prev];
        merged[existingIndex] = {
          ...merged[existingIndex],
          items: [...merged[existingIndex].items, ...params.items],
        };
        return merged;
      }

      return [
        ...prev,
        {
          id: `loot-${Date.now()}-${params.x}-${params.y}-${Math.floor(Math.random() * 9999)}`,
          mapId: params.mapId,
          x: params.x,
          y: params.y,
          items: [...params.items],
        },
      ];
    });
  }, []);

  const setActiveLootBagItems = useCallback((nextItems: any[] | ((prev: any[]) => any[])) => {
    const targetBagId = activeLootBagId;
    if (!targetBagId) return;

    setFloorLootBags((prev) => {
      return prev.flatMap((bag) => {
        if (bag.id !== targetBagId) {
          return [bag];
        }

        const computedItems =
          typeof nextItems === 'function' ? (nextItems as (prev: any[]) => any[])(bag.items || []) : nextItems;
        const normalizedItems = Array.isArray(computedItems) ? computedItems.filter(Boolean) : [];

        if (normalizedItems.length <= 0) {
          return [];
        }

        return [{ ...bag, items: normalizedItems }];
      });
    });
  }, [activeLootBagId]);

  const openLootBag = useCallback((bagId: string) => {
    setActiveLootBagId(bagId);
  }, []);

  const closeLootBag = useCallback(() => {
    setActiveLootBagId(null);
  }, []);

  const clearFloorLootBags = useCallback(() => {
    setFloorLootBags([]);
    setActiveLootBagId(null);
    pendingEnemyLootRef.current = [];
  }, []);

  const flushQueuedEnemyLoot = () => {
    const queuedLoot = [...pendingEnemyLootRef.current];
    pendingEnemyLootRef.current = [];
    if (queuedLoot.length <= 0) return;

    queuedLoot.forEach((entry) => {
      addFloorLootBag({
        x: entry.x,
        y: entry.y,
        mapId: entry.mapId,
        items: [entry.item],
      });
    });

    const names = queuedLoot.map((entry) => entry.item?.name || 'Unknown item');
    dispatch(
      setCombatLog(`Loot dropped: ${names.join(', ')}.`)
    );
  };

  const getSkillById = (skillId: SkillId | null | undefined) => {
    if (!skillId) return null;
    return SKILLS[skillId] || null;
  };

  const getTrainedSkillLevel = (skillId: SkillId | null | undefined) => {
    if (!skillId) return 0;
    return Math.max(0, getSkillLevel(skillLevels, skillId));
  };

  const canUseSkillByRequirements = (skillId: SkillId | null | undefined): { ok: boolean; reason?: string } => {
    const skill = getSkillById(skillId);
    if (!skill) {
      return { ok: false, reason: 'No skill equipped for this slot.' };
    }
    if (getTrainedSkillLevel(skill.id) <= 0) {
      return { ok: false, reason: `${skill.name} is not trained yet.` };
    }
    if (!doesMeetSkillRequirements(skill, playerStats)) {
      const requirementText = getSkillRequirementSummary(skill);
      return { ok: false, reason: `Need ${requirementText} for ${skill.name}.` };
    }
    if (mana < skill.manaCost) {
      return { ok: false, reason: `Need ${skill.manaCost} mana for ${skill.name}.` };
    }
    if (skill.requiresCombo && comboPoints <= 0) {
      return { ok: false, reason: `${skill.name} requires combo points.` };
    }
    return { ok: true };
  };

  const getClassHitFx = () => {
    if (playerClass === 'caster') return CLASS_HIT_FX.caster;
    if (playerClass === 'ranger') return CLASS_HIT_FX.ranger;
    return CLASS_HIT_FX.warrior;
  };

  const applyDamageToEnemy = (enemyId: number, dmg: number, crit: boolean, hitType: HitVariant) => {
    dispatch(dmg2Enemy({ id: enemyId, damage: { dmg, crit } }));
    enemyHealthRef.current[enemyId] = (enemyHealthRef.current[enemyId] ?? 0) - dmg;
    dispatch(registerPlayerHit({ enemyId, hitType }));
  };

  const applyWeaponCleave = (targetId: number, baseDamage: number) => {
    const equippedWeapon = store.getState().player.equipment?.weapon;
    if (!weaponCanCleave(equippedWeapon)) return;

    const others = aliveEnemyIds(true).filter((id) => id !== targetId);
    if (others.length === 0) return;

    const splashDamage = Math.max(1, Math.floor(baseDamage * WEAPON_CLEAVE_MULTIPLIER));

    others.forEach((id) => {
      applyDamageToEnemy(id, splashDamage, false, 'slash');
    });

    dispatch(setCombatLog(`Cleave hit ${others.length} nearby enemy${others.length > 1 ? 'ies' : ''}.`));
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
      const dodgeRoll = Math.random();
      if (dodgeRoll <= playerDodgeChance) {
        dispatch(dmg2Player({ dmg: 0, crit: false, enemy: enemyLabel || enemy.info.name }));
        return;
      }

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

  const endCombat = async (options?: { flushLoot?: boolean }) => {
    if (combatEndingRef.current) return;
    combatEndingRef.current = true;

    try {
      combatRef.current = false;
      playerAttackArmedRef.current = false;
      clearAllIntervals();

      dispatch(resetComboPoints());

      const data = await AsyncStorage.getItem('characters');
      const obj = data ? JSON.parse(data) : {};
      if (!obj?.character) {
        pendingEnemyLootRef.current = [];
        processedEnemyIdsRef.current.clear();
        dispatch(setInCombat(false));
        dispatch(setSpecialCooldown(0));
        dispatch(setCombatLog('Combat ended.'));
        return;
      }

      obj.character.stats.health = playerHealthRef.current;
      obj.character.experience = Math.max(0, Number(store.getState().player.experience || obj.character.experience || 0));
      obj.character.level = Math.max(1, Number(obj.character.level || 1));
      obj.character.xptolvlup = Math.max(16, Number(obj.character.xptolvlup || 16));
      obj.character.unspentStatPoints = Math.max(0, Number(obj.character.unspentStatPoints || 0));

      let levelsGained = 0;
      while (obj.character.experience >= obj.character.xptolvlup) {
        obj.character.level += 1;
        obj.character.xptolvlup *= 2;
        levelsGained += 1;
      }

      if (levelsGained > 0) {
        const classArchetype = obj.character.classArchetype || playerClass || 'warrior';
        const classProfile = getClassProgressionProfile(classArchetype);
        const passiveHpGain = levelsGained * classProfile.levelUpHp;
        const passiveManaGain = levelsGained * classProfile.levelUpMana;
        const passiveStaminaGain = levelsGained * classProfile.levelUpStamina;

        const derivedAfterLevel = computeDerivedPlayerStats(
          obj.character.stats,
          obj.character.equipment || store.getState().player.equipment || {},
          { classArchetype, level: obj.character.level }
        );

        obj.character.stats.health = Math.min(
          derivedAfterLevel.maxHealth,
          Number(obj.character.stats.health || 0) + passiveHpGain
        );

        obj.character.unspentStatPoints += levelsGained * STAT_POINTS_PER_LEVEL;
        dispatch(setLevel(obj.character.level));
        dispatch(setStats(obj.character.stats));
        dispatch(setHealth(obj.character.stats.health));
        dispatch(restoreMana(passiveManaGain));
        dispatch(setUnspentStatPoints(obj.character.unspentStatPoints));
        dispatch(
          setCombatLog(
            `Level up! +${levelsGained * STAT_POINTS_PER_LEVEL} stat points, +${formatPassiveGain(passiveHpGain)} HP, +${formatPassiveGain(passiveManaGain)} Mana, +${formatPassiveGain(passiveStaminaGain)} Stamina.`
          )
        );
      }

      await AsyncStorage.setItem('characters', JSON.stringify(obj));

      if (options?.flushLoot && playerHealthRef.current > 0) {
        flushQueuedEnemyLoot();
      } else {
        pendingEnemyLootRef.current = [];
      }
      processedEnemyIdsRef.current.clear();

      dispatch(setInCombat(false));
      dispatch(setSpecialCooldown(0));
      dispatch(setCombatLog('Combat ended.'));
    } finally {
      combatEndingRef.current = false;
    }
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

  const performSkill = (skillId: SkillId | null | undefined, slot: 'primary' | 'secondary') => {
    if (!canUseSkillNow()) return;

    const skill = getSkillById(skillId);
    if (!skill) {
      dispatch(setCombatLog(`No ${slot} skill trained.`));
      return;
    }

    const availability = canUseSkillByRequirements(skill.id);
    if (!availability.ok) {
      dispatch(setCombatLog(availability.reason || `${skill.name} is unavailable.`));
      return;
    }
    const skillRank = Math.max(1, getTrainedSkillLevel(skill.id));
    const levelMultiplier = 1 + (skillRank - 1) * 0.24;

    if (skill.id === 'whirlwind') {
      const targets = aliveEnemyIds(true);
      if (targets.length <= 0) return;

      beginPlayerAttackIfNeeded(targets[0]);
      dispatch(spendMana(skill.manaCost));
      const damage = Math.max(
        3,
        Math.floor((playerDmg * 1.35 + (playerStats?.strength || 0) * 0.22) * levelMultiplier)
      );
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'slash'));
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Whirlwind Lv.${skillRank} hits ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}.`));
      return;
    }

    if (skill.id === 'fire-blast') {
      const targets = aliveEnemyIds(true);
      if (targets.length <= 0) return;

      beginPlayerAttackIfNeeded(targets[0]);
      dispatch(spendMana(skill.manaCost));
      const damage = Math.max(
        3,
        Math.floor((playerDmg * 1.2 + (playerStats?.intelligence || 0) * 0.65) * levelMultiplier)
      );
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'fire'));
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Fire Blast Lv.${skillRank} scorches ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}.`));
      return;
    }

    const targetId = getPrimaryTarget();
    if (targetId === null) return;
    beginPlayerAttackIfNeeded(targetId);
    dispatch(spendMana(skill.manaCost));

    if (skill.id === 'crushing-blow') {
      const damage = Math.max(
        4,
        Math.floor((playerDmg * 2.2 + (playerStats?.strength || 0) * 0.35) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'crush');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Crushing Blow Lv.${skillRank} lands a heavy hit.`));
      return;
    }

    if (skill.id === 'arcane-bolt') {
      const damage = Math.max(
        4,
        Math.floor((playerDmg * 1.6 + (playerStats?.intelligence || 0) * 0.9) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'fire');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Arcane Bolt Lv.${skillRank} burns the target.`));
      return;
    }

    if (skill.id === 'quick-stab') {
      dispatch(addComboPoint(1 + Math.floor((skillRank - 1) / 2)));
      const damage = Math.max(
        2,
        Math.floor((playerDmg * 0.78 + (playerStats?.dexterity || 0) * 0.2) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'slash');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(setCombatLog(`Quick Stab Lv.${skillRank} builds combo points.`));
      return;
    }

    if (skill.id === 'eviscerate') {
      const spentCombo = comboPoints;
      dispatch(consumeAllComboPoints());
      const comboMultiplier = (1.1 + spentCombo * 0.6) * levelMultiplier;
      const damage = Math.max(
        5,
        Math.floor(playerDmg * comboMultiplier + (playerStats?.dexterity || 0) * 0.35 * spentCombo)
      );
      applyDamageToEnemy(targetId, damage, false, 'mutilate');
      dispatch(setSpecialCooldown(SKILL_GCD_FRAMES));
      dispatch(
        setCombatLog(
          `Eviscerate Lv.${skillRank} consumes ${spentCombo} combo point${spentCombo > 1 ? 's' : ''}.`
        )
      );
    }
  };

  const performPrimarySkill = (skillId?: SkillId | null) => {
    performSkill(skillId, 'primary');
  };

  const performSecondarySkill = (skillId?: SkillId | null) => {
    performSkill(skillId, 'secondary');
  };

  const playerLoop = (targetId: number) => {
    const currentEnemies = enemiesRef.current;
    if (!currentEnemies[targetId]) {
      return;
    }

    const targetEnemy = currentEnemies[targetId];
    const enemyDR = targetEnemy.defence;
    const enemyLVL = targetEnemy.level;
    const playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);

    playerCombatIntRef.current = setInterval(() => {
      if (!combatRef.current || playerHealthRef.current <= 0) {
        endCombat();
        return;
      }

      queueAllDefeatedEnemyRewards();
      const currentEnemyHealth = enemyHealthRef.current[targetId];

      if (currentEnemyHealth <= 0) {
        const nextEnemy = findNextLivingEnemy(targetId);
        if (nextEnemy !== null) {
          dispatch(setCurrentEnemy(nextEnemy));
          clearInterval(playerCombatIntRef.current!);
          playerCombatIntRef.current = null;
          playerLoop(nextEnemy);
        } else {
          endCombat({ flushLoot: true });
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
          endCombat({ flushLoot: true });
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

        const hitType = getClassHitFx();
        applyDamageToEnemy(targetId, dmg, isCrit, hitType);
        applyWeaponCleave(targetId, dmg);

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
          const dodgeRoll = Math.random();
          if (dodgeRoll <= playerDodgeChance) {
            dispatch(dmg2Player({ dmg: 0, crit: false, enemy: `${enemyName} (${index + 1})` }));
            return;
          }

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
        const dodgeRoll = Math.random();
        if (dodgeRoll <= playerDodgeChance) {
          dispatch(dmg2Player({ dmg: 0, crit: false, enemy: enemyName }));
          return;
        }

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
      combatEndingRef.current = false;
      processedEnemyIdsRef.current.clear();
      pendingEnemyLootRef.current = [];
      combatRef.current = true;
      playerAttackArmedRef.current = false;
      clearAllIntervals();
      startCooldownTicker();

      if (currentEnemies[id]?.firstStrike) {
        const firstStrikerName = currentEnemies[id]?.info?.name || 'Ranged enemy';
        applyEnemyAttackToPlayer(id, `${firstStrikerName} (opening shot)`);
        if (playerHealthRef.current <= 0) {
          endCombat();
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
    floorLootBags,
    activeLootBagId,
    openLootBag,
    closeLootBag,
    clearFloorLootBags,
    setActiveLootBagItems,
    addFloorLootBag,
    pendingLootItems,
  };
};
