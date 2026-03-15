import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from './../app/hooks';
import { store } from './../app/store';
import { dmg2Enemy, setCurrentEnemy } from './../features/enemy/enemySlice';
import { isEnemyCombatReachable, isEnemyOccludedByCloserEnemy, getEnemySizeCategory } from './../features/enemy/enemyPerception';
import {
  addComboPoint,
  consumeAllComboPoints,
  dmg2Player,
  resetComboPoints,
  setCombatLog,
  setHealth,
  setLevel,
  setStats,
  // setUnspentStatPoints, // stats system commented out — level up grants skills instead
  restoreMana,
  spendMana,
  XP,
  addArmorBuffer,
  clearArmorBuffer,
  setPendingLevelUpSkills,
  addGold,
} from './../features/player/playerSlice';
import { Direction } from '../types/map';
import {
  registerEnemyAttack,
  registerPlayerHit,
  setEnemyCount,
  setInCombat,
  setCombatPhase,
  setSpecialCooldown,
  tickSpecialCooldown,
  setEnemyLayers,
  advanceFrontLayerRedux,
  clearJustAdvanced,
  clearEnemyLayers,
  initScrollDeck,
  drawScrolls,
  useScrollCard,
  discardHand,
  refillCardMana,
  clearScrollSystem,
  knockbackEnemy,
  triggerGoldLootEffect,
} from './combatSlice';
import { computeDerivedPlayerStats, getClassProgressionProfile } from '../features/player/playerStats';
import itemData from '../data/items.json';
import {
  SkillId,
  SKILLS,
  getSkillLevel,
  getLevelUpSkillOptions,
  getAllLearnedSkills,
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
  const cardMana = useAppSelector((state) => (state.combat as any).cardMana ?? 2);

  /** Build a shuffled deck: 3 copies of every learned skill. */
  const buildScrollDeck = (levels: Record<string, number>): string[] => {
    const learned = getAllLearnedSkills(levels);
    const deck: string[] = [];
    learned.forEach((skillDef) => {
      deck.push(skillDef.id, skillDef.id, skillDef.id);
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  const combatRef = useRef(false);
  const combatEndingRef = useRef(false);
  const cooldownTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enemyTurnTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const combatPhaseRef = useRef<'idle' | 'player_turn' | 'enemy_turn'>('idle');

  const enemyHealthRef = useRef<{ [key: number]: number }>({});
  const processedEnemyIdsRef = useRef<Set<number>>(new Set());
  const pendingEnemyLootRef = useRef<Array<{ mapId: string; x: number; y: number; item: any }>>([]);
  const pendingGoldRef = useRef(0);
  const playerHealthRef = useRef(playerHealth);
  const combatViewRef = useRef({
    x: playerPosX,
    y: playerPosY,
    facing: playerFacing,
    playerClass,
    mapId: currentMapId,
  });

  // Wave layer refs — source of truth during live combat (Redux is synced for UI)
  const frontLayerRef = useRef<number[]>([]);
  const midLayerRef = useRef<number[]>([]);
  const backLayerRef = useRef<number[]>([]);
  const justAdvancedIdsRef = useRef<Set<number>>(new Set());
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
    if (cooldownTickRef.current) {
      clearInterval(cooldownTickRef.current);
      cooldownTickRef.current = null;
    }
    enemyTurnTimeoutsRef.current.forEach((t) => clearTimeout(t));
    enemyTurnTimeoutsRef.current = [];
  };

  // When a front-layer enemy dies, advance one enemy from mid → front and one from back → mid.
  // The newly-fronted enemy is recorded in justAdvancedIds and cannot attack this same round.
  const advanceLayersAfterDeath = (deadEnemyId: number) => {
    frontLayerRef.current = frontLayerRef.current.filter((id) => id !== deadEnemyId);

    // Purge any dead enemies from mid/back (e.g. killed by cleave) before advancing
    midLayerRef.current = midLayerRef.current.filter((id) => (enemyHealthRef.current[id] ?? 0) > 0);
    backLayerRef.current = backLayerRef.current.filter((id) => (enemyHealthRef.current[id] ?? 0) > 0);

    if (midLayerRef.current.length > 0) {
      const [advancing, ...restMid] = midLayerRef.current;
      frontLayerRef.current.push(advancing);
      justAdvancedIdsRef.current.add(advancing);
      midLayerRef.current = restMid;

      if (backLayerRef.current.length > 0) {
        const [advancingBack, ...restBack] = backLayerRef.current;
        midLayerRef.current.push(advancingBack);
        backLayerRef.current = restBack;
      }

      dispatch(
        advanceFrontLayerRedux({
          front: frontLayerRef.current,
          mid: midLayerRef.current,
          back: backLayerRef.current,
          justAdvancedIds: [...justAdvancedIdsRef.current],
        })
      );

      const advancedEnemy = enemiesRef.current[advancing];
      const name = advancedEnemy?.info?.name || 'An enemy';
      dispatch(setCombatLog(`${name} advances from the ranks!`));
    }
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

    // Only front-layer enemies can be attacked or attack the player
    if (frontLayerRef.current.length > 0 && !frontLayerRef.current.includes(enemyId)) {
      return false;
    }

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

  /** True when every enemy in the current encounter's wave layers is dead. */
  const allEncounterEnemiesDead = (): boolean => {
    const encounterIds = [
      ...frontLayerRef.current,
      ...midLayerRef.current,
      ...backLayerRef.current,
    ];
    if (encounterIds.length === 0) return true;
    return encounterIds.every((id) => (enemyHealthRef.current[id] ?? 0) <= 0);
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

  // Scroll (tomes) drops are removed — skills are granted only through level-up.
  // Potion (consumable) drops are commented out.
  // Currency is auto-looted directly, not dropped as floor loot.
  const FILTERED_DROP_TYPES = new Set(['tomes', 'consumable', 'currency']);

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
    // Filter out tomes and consumables from guaranteed drops
    const guaranteedLootItems = guaranteedLootEntries
      .filter((entry: LootObject) => !FILTERED_DROP_TYPES.has(entry.type))
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

    // Filter out tomes and consumables from random drops
    const filteredLootTable = lootTable.filter((entry) => !FILTERED_DROP_TYPES.has(entry.type));
    const droppedItem = resolveSingleLootDrop(filteredLootTable);
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
        // Auto-loot gold: each enemy drops 1 or 2 whole gold — accumulated until combat ends
        pendingGoldRef.current += Math.floor(Math.random() * 2) + 1;

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
      return { ok: false, reason: 'No skill trained for this slot.' };
    }
    if (getTrainedSkillLevel(skill.id) <= 0) {
      return { ok: false, reason: `${skill.name} is not trained yet.` };
    }
    // Card system: each scroll costs 1 cardMana
    if (cardMana < 1) {
      return { ok: false, reason: `Not enough energy. (${cardMana}/1 needed)` };
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
    const newHealth = (enemyHealthRef.current[enemyId] ?? 0) - dmg;
    enemyHealthRef.current[enemyId] = newHealth;
    dispatch(registerPlayerHit({ enemyId, hitType }));

    // If a front-layer enemy just died, advance the next wave rank immediately
    if (newHealth <= 0 && frontLayerRef.current.includes(enemyId)) {
      advanceLayersAfterDeath(enemyId);
    }
  };

  /**
   * Knock a living front-layer enemy back to the mid layer.
   * The enemy can no longer attack until it advances back to the front.
   */
  const applyKnockback = (enemyId: number) => {
    if ((enemyHealthRef.current[enemyId] ?? 0) <= 0) return; // dead enemies don't get knocked back
    const frontIdx = frontLayerRef.current.indexOf(enemyId);
    if (frontIdx === -1) return; // not in front layer
    frontLayerRef.current.splice(frontIdx, 1);
    midLayerRef.current.unshift(enemyId);
    dispatch(knockbackEnemy(enemyId));
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
      combatPhaseRef.current = 'idle';
      clearAllIntervals();

      // Clear wave layer state
      frontLayerRef.current = [];
      midLayerRef.current = [];
      backLayerRef.current = [];
      justAdvancedIdsRef.current.clear();
      dispatch(clearEnemyLayers());

      dispatch(resetComboPoints());

      // Clear armor buffer at end of combat
      dispatch(clearArmorBuffer());
      // Reset card scroll system
      dispatch(clearScrollSystem());

      // Dispatch UI state synchronously before any async work so the UI
      // always exits combat even if the async save throws.
      if (pendingGoldRef.current > 0) {
        dispatch(addGold(pendingGoldRef.current));
        dispatch(triggerGoldLootEffect(pendingGoldRef.current));
        pendingGoldRef.current = 0;
      }
      dispatch(setInCombat(false));
      dispatch(setSpecialCooldown(0));
      dispatch(setCombatLog('Combat ended.'));

      const data = await AsyncStorage.getItem('characters');
      const obj = data ? JSON.parse(data) : {};
      if (!obj?.character) {
        pendingEnemyLootRef.current = [];
        pendingGoldRef.current = 0;
        processedEnemyIdsRef.current.clear();
        return;
      }

      obj.character.stats.health = playerHealthRef.current;
      obj.character.experience = Math.max(0, Number(store.getState().player.experience || obj.character.experience || 0));
      // Save auto-looted gold (always whole numbers)
      obj.character.gold = Math.round(Math.max(0, Number(store.getState().player.gold || obj.character.gold || 0)));
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

        // Stats system commented out — level up grants skill choices instead
        // obj.character.unspentStatPoints += levelsGained * STAT_POINTS_PER_LEVEL;
        dispatch(setLevel(obj.character.level));
        dispatch(setStats(obj.character.stats));
        dispatch(setHealth(obj.character.stats.health));
        dispatch(restoreMana(passiveManaGain));
        // dispatch(setUnspentStatPoints(obj.character.unspentStatPoints));
        dispatch(
          setCombatLog(
            `Level up! +${formatPassiveGain(passiveHpGain)} HP, +${formatPassiveGain(passiveManaGain)} Mana, +${formatPassiveGain(passiveStaminaGain)} Stamina. Choose a skill!`
          )
        );

        // Offer 3 random skill choices (one per level gained, capped at one popup)
        const currentSkillLevels = store.getState().player.skillLevels || {};
        const skillOptions = getLevelUpSkillOptions(currentSkillLevels, 3);
        if (skillOptions.length > 0) {
          dispatch(setPendingLevelUpSkills(skillOptions));
        }
      }

      await AsyncStorage.setItem('characters', JSON.stringify(obj));

      if (options?.flushLoot && playerHealthRef.current > 0) {
        flushQueuedEnemyLoot();
      } else {
        pendingEnemyLootRef.current = [];
      }
      processedEnemyIdsRef.current.clear();
    } catch (error) {
      console.warn('[endCombat] AsyncStorage save failed:', error);
      pendingEnemyLootRef.current = [];
      pendingGoldRef.current = 0;
      processedEnemyIdsRef.current.clear();
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
    if (combatPhaseRef.current !== 'player_turn') return false;
    if (specialCooldownFrames > 0) return false;
    return true;
  };

  const beginPlayerTurn = () => {
    if (!combatRef.current) return;
    combatPhaseRef.current = 'player_turn';
    dispatch(setCombatPhase('player_turn'));
    dispatch(setSpecialCooldown(0));
    // Clear the just-advanced block so promoted enemies can attack this coming enemy turn
    justAdvancedIdsRef.current.clear();
    dispatch(clearJustAdvanced());
    // Card system: refill energy, discard leftover hand, draw 3 new scrolls
    dispatch(refillCardMana());
    dispatch(discardHand());
    dispatch(drawScrolls(3));
    // Auto-end immediately if no scrolls could be drawn (empty deck with no learned skills)
    const { scrollHand: hand } = store.getState().combat as any;
    if (!hand || hand.length === 0) {
      setTimeout(() => beginEnemyTurn(), 100);
    }
  };

  const ENEMY_ATTACK_DELAY_MS = 750;

  const beginEnemyTurn = () => {
    if (!combatRef.current) return;

    combatPhaseRef.current = 'enemy_turn';
    dispatch(setCombatPhase('enemy_turn'));

    // Enemies that advanced this round are not ready to attack yet;
    // use the front layer directly so reachability filters don't exclude anyone.
    const attackingEnemies = frontLayerRef.current.filter(
      (id) => !justAdvancedIdsRef.current.has(id) && (enemyHealthRef.current[id] ?? 0) > 0
    );

    if (attackingEnemies.length === 0) {
      // No attackers this round, but there may still be live enemies (just advanced or knocked back)
      if (allEncounterEnemiesDead()) {
        endCombat({ flushLoot: true });
      } else {
        beginPlayerTurn();
        dispatch(setCombatLog('Your turn.'));
      }
      return;
    }

    attackingEnemies.forEach((enemyId, index) => {
      const t = setTimeout(() => {
        if (!combatRef.current) return;
        const currentHp = enemyHealthRef.current[enemyId] ?? 0;
        if (currentHp > 0) {
          applyEnemyAttackToPlayer(enemyId);
        }
      }, index * ENEMY_ATTACK_DELAY_MS);
      enemyTurnTimeoutsRef.current.push(t);
    });

    const returnToPlayerTurn = setTimeout(() => {
      if (!combatRef.current) return;
      if (playerHealthRef.current <= 0) {
        endCombat();
        return;
      }
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) {
        endCombat({ flushLoot: true });
        return;
      }
      beginPlayerTurn();
      dispatch(setCombatLog('Your turn.'));
    }, attackingEnemies.length * ENEMY_ATTACK_DELAY_MS + 300);
    enemyTurnTimeoutsRef.current.push(returnToPlayerTurn);
  };

  const performPlayerAttack = (targetId: number) => {
    if (!combatRef.current || combatPhaseRef.current !== 'player_turn') return;
    if (playerHealthRef.current <= 0) return;

    dispatch(setCurrentEnemy(targetId));

    queueAllDefeatedEnemyRewards();
    const currentEnemyHealth = enemyHealthRef.current[targetId] ?? 0;

    let actualTargetId = targetId;
    if (currentEnemyHealth <= 0) {
      const next = findNextLivingEnemy(targetId);
      if (next === null) {
        endCombat({ flushLoot: true });
        return;
      }
      actualTargetId = next;
      dispatch(setCurrentEnemy(actualTargetId));
    }

    if (!isEnemyReachableNow(actualTargetId)) {
      const next = findNextLivingEnemy(actualTargetId);
      if (next === null) {
        endCombat({ flushLoot: true });
        return;
      }
      actualTargetId = next;
      dispatch(setCurrentEnemy(actualTargetId));
    }

    const targetEnemy = enemiesRef.current[actualTargetId];
    if (!targetEnemy) return;

    const enemyDR = targetEnemy.defence;
    const enemyLVL = targetEnemy.level;
    const playerHR = hitRate(playerAR, enemyDR, playerLVL, enemyLVL);
    const randomVal = Math.random();
    const randomAddDmg = Math.floor(Math.random() * 2);
    const randomCritVal = Math.random();

    if (randomVal <= playerHR) {
      let dmg = playerDmg + randomAddDmg;
      const isCrit = randomCritVal <= baseCrit;
      if (isCrit) dmg *= 2;
      const hitType = getClassHitFx();
      applyDamageToEnemy(actualTargetId, dmg, isCrit, hitType);
      applyWeaponCleave(actualTargetId, dmg);
    } else {
      dispatch(dmg2Enemy({ id: actualTargetId, damage: { dmg: 0, crit: false } }));
    }

    queueAllDefeatedEnemyRewards();
    if (allEncounterEnemiesDead()) {
      endCombat({ flushLoot: true });
      return;
    }

    beginEnemyTurn();
  };

  /** After spending a card, check if the player's turn should auto-end. */
  const checkAutoEndTurn = () => {
    const { cardMana: cm, scrollHand: hand } = store.getState().combat as any;
    if (cm <= 0 || hand.length === 0) {
      beginEnemyTurn();
    }
  };

  const performSkill = (skillId: SkillId | null | undefined) => {
    if (!canUseSkillNow()) return;

    const skill = getSkillById(skillId);
    if (!skill) {
      dispatch(setCombatLog('No skill trained.'));
      return;
    }

    // Verify the scroll is actually in the hand
    const hand: string[] = (store.getState().combat as any).scrollHand ?? [];
    if (!hand.includes(skill.id)) {
      dispatch(setCombatLog(`${skill.name} scroll is not in your hand.`));
      return;
    }

    const availability = canUseSkillByRequirements(skill.id);
    if (!availability.ok) {
      dispatch(setCombatLog(availability.reason || `${skill.name} is unavailable.`));
      return;
    }
    const skillRank = Math.max(1, getTrainedSkillLevel(skill.id));
    const levelMultiplier = 1 + (skillRank - 1) * 0.24;

    // Spend the scroll card (removes from hand → discard, decrements cardMana)
    dispatch(useScrollCard(skill.id));

    if (skill.id === 'enforce-armor') {
      const bufferAmount = Math.floor((15 + (playerStats?.vitality || 0) * 1.2) * levelMultiplier);
      dispatch(addArmorBuffer(bufferAmount));
      dispatch(setCombatLog(`Enforce Armor Lv.${skillRank} adds ${bufferAmount} armor buffer.`));
      checkAutoEndTurn();
      return;
    }

    if (skill.id === 'whirlwind') {
      const targets = aliveEnemyIds(true);
      if (targets.length <= 0) return;

      const damage = Math.max(
        3,
        Math.floor((playerDmg * 1.35 + (playerStats?.strength || 0) * 0.22) * levelMultiplier)
      );
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'slash'));
      // Knock back all surviving front-layer enemies
      const survivingFront = [...frontLayerRef.current].filter((id) => (enemyHealthRef.current[id] ?? 0) > 0);
      survivingFront.forEach((id) => applyKnockback(id));
      const knockedCount = survivingFront.length;
      dispatch(setCombatLog(
        `Whirlwind Lv.${skillRank} hits ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}${knockedCount > 0 ? ` — ${knockedCount} knocked back!` : ''}.`
      ));
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
      return;
    }

    if (skill.id === 'fire-blast') {
      const targets = aliveEnemyIds(true);
      if (targets.length <= 0) return;

      const damage = Math.max(
        3,
        Math.floor((playerDmg * 1.2 + (playerStats?.intelligence || 0) * 0.65) * levelMultiplier)
      );
      targets.forEach((id) => applyDamageToEnemy(id, damage, false, 'fire'));
      dispatch(setCombatLog(`Fire Blast Lv.${skillRank} scorches ${targets.length} enemy${targets.length > 1 ? 'ies' : ''}.`));
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
      return;
    }

    const targetId = getPrimaryTarget();
    if (targetId === null) {
      // Card already spent — no valid target; still trigger auto-end check
      checkAutoEndTurn();
      return;
    }

    if (skill.id === 'crushing-blow') {
      const damage = Math.max(
        4,
        Math.floor((playerDmg * 2.2 + (playerStats?.strength || 0) * 0.35) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'crush');
      const wasKnockedBack = (enemyHealthRef.current[targetId] ?? 0) > 0;
      if (wasKnockedBack) applyKnockback(targetId);
      dispatch(setCombatLog(
        `Crushing Blow Lv.${skillRank} lands a heavy hit${wasKnockedBack ? ' — enemy knocked back!' : '.'}`
      ));
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
      return;
    }

    if (skill.id === 'arcane-bolt') {
      const damage = Math.max(
        4,
        Math.floor((playerDmg * 1.6 + (playerStats?.intelligence || 0) * 0.9) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'fire');
      dispatch(setCombatLog(`Arcane Bolt Lv.${skillRank} burns the target.`));
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
      return;
    }

    if (skill.id === 'quick-stab') {
      dispatch(addComboPoint(1 + Math.floor((skillRank - 1) / 2)));
      const damage = Math.max(
        2,
        Math.floor((playerDmg * 0.78 + (playerStats?.dexterity || 0) * 0.2) * levelMultiplier)
      );
      applyDamageToEnemy(targetId, damage, false, 'slash');
      dispatch(setCombatLog(`Quick Stab Lv.${skillRank} builds combo points.`));
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
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
      dispatch(
        setCombatLog(
          `Eviscerate Lv.${skillRank} consumes ${spentCombo} combo point${spentCombo > 1 ? 's' : ''}.`
        )
      );
      queueAllDefeatedEnemyRewards();
      if (allEncounterEnemiesDead()) { endCombat({ flushLoot: true }); return; }
      checkAutoEndTurn();
    }
  };

  const performPrimarySkill = (skillId?: SkillId | null) => {
    performSkill(skillId);
  };

  const performSecondarySkill = (skillId?: SkillId | null) => {
    performSkill(skillId);
  };

  /** Manual end-turn: discard remaining hand and trigger enemy turn. */
  const endPlayerTurnManually = () => {
    if (!combatRef.current || combatPhaseRef.current !== 'player_turn') return;
    dispatch(discardHand());
    beginEnemyTurn();
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

    // Assign all encounter enemies to wave layers.
    // Layer capacity is driven by enemy size: small = 5-6, medium = 3-4, large = 1-2.
    // Each layer holds `layerCapacity` enemies; one-for-one replacements happen as they die.
    // Only include enemies from the same pack as the triggered enemy (same spawn position).
    const triggerPosX = currentEnemies[id]?.positionX;
    const triggerPosY = currentEnemies[id]?.positionY;
    const allEncounterIds = Object.keys(healthMap)
      .map(Number)
      .filter((eId) => {
        const e = currentEnemies[eId];
        return (
          e && e.health > 0 && isHostileEnemy(e) &&
          e.positionX === triggerPosX && e.positionY === triggerPosY
        );
      })
      .sort((a, b) => a - b);

    const dominantSize = (() => {
      const counts = { small: 0, medium: 0, large: 0 };
      allEncounterIds.forEach((id) => {
        const size = getEnemySizeCategory(currentEnemies[id]?.id ?? 0);
        counts[size]++;
      });
      if (counts.small >= counts.medium && counts.small >= counts.large) return 'small';
      if (counts.large > counts.medium) return 'large';
      return 'medium';
    })();

    const layerCapacity =
      dominantSize === 'small' ? 5 + Math.floor(Math.random() * 2) :  // 5-6
      dominantSize === 'large' ? 1 + Math.floor(Math.random() * 2) :  // 1-2
      3 + Math.floor(Math.random() * 2);                              // 3-4 (medium)

    frontLayerRef.current = allEncounterIds.slice(0, layerCapacity);
    midLayerRef.current = allEncounterIds.slice(layerCapacity, layerCapacity * 2);
    backLayerRef.current = allEncounterIds.slice(layerCapacity * 2);
    justAdvancedIdsRef.current = new Set();

    dispatch(
      setEnemyLayers({
        front: frontLayerRef.current,
        mid: midLayerRef.current,
        back: backLayerRef.current,
      })
    );

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
      pendingGoldRef.current = 0;
      combatRef.current = true;
      clearAllIntervals();
      startCooldownTicker();

      const packSize = reachableEnemyCount > 1 ? ` (${reachableEnemyCount} enemies)` : '';
      dispatch(setCombatLog(`Combat started${packSize}. Your turn — play scrolls or end your turn.`));
      // Initialize scroll deck from learned skills (3 copies each)
      const currentSkillLevels = store.getState().player.skillLevels || {};
      const shuffledDeck = buildScrollDeck(currentSkillLevels);
      dispatch(initScrollDeck(shuffledDeck));
      beginPlayerTurn();
    }
  };

  const engagePlayerAttack = (id: number) => {
    if (!combatRef.current) {
      return;
    }

    if (combatPhaseRef.current !== 'player_turn') {
      return;
    }

    // If the requested target is dead or unreachable, fall through to auto-target
    const resolvedId = isEnemyReachableNow(id) ? id : (getPrimaryTarget() ?? id);

    if (!isEnemyReachableNow(resolvedId)) {
      return;
    }

    dispatch(setCurrentEnemy(resolvedId));
    performPlayerAttack(resolvedId);
  };

  // Convenience wrapper for the Attack button: finds the best living target via
  // internal refs so it never relies on stale React-state selectors in the UI.
  const attackCurrentTarget = () => {
    if (!combatRef.current || combatPhaseRef.current !== 'player_turn') return;
    const targetId = getPrimaryTarget();
    if (targetId === null) return;
    dispatch(setCurrentEnemy(targetId));
    performPlayerAttack(targetId);
  };

  return {
    startCombat,
    engagePlayerAttack,
    // attackCurrentTarget removed — combat is now skill-only
    performPlayerAttack,
    performSkill,
    performPrimarySkill,
    performSecondarySkill,
    endPlayerTurnManually,
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
