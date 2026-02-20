import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addEnemy, clearEnemies, fetchEnemies, setCurrentEnemy } from '../enemy/enemySlice';
import { setEnemyCount, setInCombat, setSpecialCooldown } from '../../events/combatSlice';
import {
  emptyCombatLog,
  setGold,
  setAtkSpeed,
  setClassMeta,
  setCombatLog,
  setCrit,
  setDodge,
  setEquipment,
  setHealth,
  setLevel,
  setStats,
  setUnspentStatPoints,
  setXP,
} from '../player/playerSlice';
import { setAllInventory } from '../inventory/inventorySlice';
import { ConsumableBelt } from '../inventory/ConsumableBelt';
import { EnemyLootModal } from '../inventory/EnemyLootModal';
import { Inventory } from '../inventory/Inventory';
import { Player } from '../player/Player';
import { StatPointsWindow } from '../player/StatPointsWindow';
import { MerchantModal } from '../merchant/MerchantModal';
import { MiniMap } from '../room/MiniMap';
import { Room } from '../room/Room';
import { useCombat } from '../../events/combat';
import { ARCHETYPES, ArchetypeId, buildCharacterFromArchetype } from '../../data/archetypes';
import { getMapConfig } from '../../data/maps';
import itemData from '../../data/items.json';
import { pickSpawnEnemyTypeForDepth } from '../enemy/enemySpawn';
import { getEnemyBehaviorForType } from '../enemy/enemyPerception';
import { getMapDepth } from '../../data/maps/transitions';
import { computeDerivedPlayerStats } from '../player/playerStats';
import {
  getCarryLoadSummary,
  getInventoryCapacities,
  getItemWeight,
  isCurrencyItem,
  normalizeInventoryContainers,
  readCurrencyGoldValue,
  tryStoreItem,
} from '../inventory/inventoryUtils';
import {
  buildMerchantStock,
  computeMerchantBuyPrice,
  computeMerchantSellPrice,
  enrichItemEconomyStats,
  MerchantStockEntry,
} from '../merchant/merchantUtils';

const ENEMY_TYPE = {
  SKELETON: 0,
  RAT: 1,
  ARCHER: 2,
} as const;
const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';
const FLOOR_DROP_EVENT = 'dungeon:drop-items-to-floor';

type EnemyTypeId = (typeof ENEMY_TYPE)[keyof typeof ENEMY_TYPE];
type PackKind = 'rats' | 'skeletons' | 'mixed';
type StatAllocationMap = Record<'strength' | 'dexterity' | 'vitality' | 'intelligence', number>;
type SpawnAnchor = { x: number; y: number; corridorKey: string };
type CorridorPackCounts = { fixedPacks: number; ambushPacks: number };

const randInt = (min: number, max: number): number => {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

interface DepthSpawnProfile {
  targetEnemiesSmall: [number, number];
  targetEnemiesLarge: [number, number];
  packCountSmall: [number, number];
  packCountLarge: [number, number];
  composition: {
    rats: number;
    skeletons: number;
    mixed: number;
  };
  mixedArcherBias: number;
  respawnPackCapSmall: number;
  respawnPackCapLarge: number;
}

const DEPTH_SPAWN_PROFILES: Record<number, DepthSpawnProfile> = {
  1: {
    targetEnemiesSmall: [4, 6],
    targetEnemiesLarge: [7, 9],
    packCountSmall: [2, 3],
    packCountLarge: [3, 4],
    composition: { rats: 55, skeletons: 35, mixed: 10 },
    mixedArcherBias: 0.35,
    respawnPackCapSmall: 2,
    respawnPackCapLarge: 3,
  },
  2: {
    targetEnemiesSmall: [5, 8],
    targetEnemiesLarge: [8, 11],
    packCountSmall: [2, 4],
    packCountLarge: [3, 5],
    composition: { rats: 35, skeletons: 35, mixed: 30 },
    mixedArcherBias: 0.45,
    respawnPackCapSmall: 2,
    respawnPackCapLarge: 3,
  },
  3: {
    targetEnemiesSmall: [7, 10],
    targetEnemiesLarge: [10, 13],
    packCountSmall: [3, 5],
    packCountLarge: [4, 6],
    composition: { rats: 20, skeletons: 30, mixed: 50 },
    mixedArcherBias: 0.55,
    respawnPackCapSmall: 3,
    respawnPackCapLarge: 3,
  },
  4: {
    targetEnemiesSmall: [8, 11],
    targetEnemiesLarge: [11, 14],
    packCountSmall: [3, 5],
    packCountLarge: [4, 6],
    composition: { rats: 10, skeletons: 25, mixed: 65 },
    mixedArcherBias: 0.65,
    respawnPackCapSmall: 3,
    respawnPackCapLarge: 4,
  },
};

const getDepthTier = (depth: number): number => Math.max(1, Math.min(4, Math.floor(depth || 1)));

const getDepthSpawnProfile = (depth: number): DepthSpawnProfile => {
  return DEPTH_SPAWN_PROFILES[getDepthTier(depth)];
};

export const MainScreen = () => {
  const SMALL_MAP_MAX_TILES = 100;
  const RESPAWN_STEP_INTERVAL = 5;
  const MAX_DYNAMIC_ENEMIES = 14;
  const MAX_PACK_ANCHORS = 6;
  const MAX_FIXED_PACKS_PER_CORRIDOR = 1;
  const MAX_AMBUSH_PACKS_PER_CORRIDOR = 2;

  const dispatch = useAppDispatch();
  const [initialized, setInitialized] = useState(false);
  const [menuMode, setMenuMode] = useState<'start' | 'create' | 'game'>('start');
  const [canContinue, setCanContinue] = useState(false);
  const [startMenuFocusIndex, setStartMenuFocusIndex] = useState(0);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId>('warrior');
  const [characterName, setCharacterName] = useState('');
  const [showDeathOverlay, setShowDeathOverlay] = useState(false);
  const [deathOpacity] = useState(new Animated.Value(0));
  const [sessionSeed, setSessionSeed] = useState(0);
  const [revivePending, setRevivePending] = useState(false);
  const [showStatPointsWindow, setShowStatPointsWindow] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [merchantMode, setMerchantMode] = useState<'menu' | 'trade'>('menu');
  const [merchantStock, setMerchantStock] = useState<MerchantStockEntry[]>([]);
  const [showLootModal, setShowLootModal] = useState(false);

  const mapTiles = useAppSelector((state) => state.room.mapTiles);
  const mapWidth = useAppSelector((state) => state.room.mapWidth);
  const mapHeight = useAppSelector((state) => state.room.mapHeight);
  const currentMapId = useAppSelector((state) => state.room.currentMapId);
  const merchantPosition = useAppSelector((state: any) => state.room.merchantPosition as { x: number; y: number } | null);
  const posX = useAppSelector((state) => state.room.posX);
  const posY = useAppSelector((state) => state.room.posY);
  const direction = useAppSelector((state) => state.room.direction);
  const enemies = useAppSelector((state) => state.enemy.enemies);
  const currentEnemyId = useAppSelector((state) => state.enemy.currentEnemyId);
  const classLabel = useAppSelector((state) => state.player.classLabel);
  const classArchetype = useAppSelector((state) => state.player.classArchetype || 'warrior');
  const playerHealth = useAppSelector((state) => state.player.health);
  const playerLevel = useAppSelector((state) => state.player.level);
  const playerXP = useAppSelector((state) => state.player.experience);
  const playerStats = useAppSelector((state) => state.player.stats as Record<string, any>);
  const playerEquipment = useAppSelector((state) => state.player.equipment as Record<string, any>);
  const unspentStatPoints = useAppSelector((state) => state.player.unspentStatPoints);
  const playerGold = useAppSelector((state) => state.player.gold || 0);
  const bagInventory = useAppSelector((state) => state.inventory.inventory as any[]);
  const consumableStash = useAppSelector((state) => state.inventory.consumableStash as any[]);
  const mana = useAppSelector((state) => state.player.mana);
  const comboPoints = useAppSelector((state) => state.player.comboPoints);
  const inventoryCapacities = useMemo(() => getInventoryCapacities(playerEquipment), [playerEquipment]);
  const [spawnPoints, setSpawnPoints] = useState<SpawnAnchor[]>([]);
  const stepCounterRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number; mapId: string } | null>(null);
  const lastSpawnedMapRef = useRef<string | null>(null);
  const previousUnspentPointsRef = useRef(0);
  const merchantStockByMapRef = useRef<Record<string, MerchantStockEntry[]>>({});

  const {
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
  } = useCombat();

  useEffect(() => {
    const checkSave = async () => {
      const storedData = await AsyncStorage.getItem('characters');
      setCanContinue(!!storedData);
    };
    checkSave();
  }, []);

  useEffect(() => {
    if (menuMode !== 'start') return;
    setStartMenuFocusIndex(canContinue ? 0 : 1);
  }, [menuMode, canContinue]);

  useEffect(() => {
    if (menuMode !== 'game') {
      setShowStatPointsWindow(false);
      setShowLootModal(false);
      clearFloorLootBags();
      previousUnspentPointsRef.current = unspentStatPoints;
      return;
    }

    const previousPoints = previousUnspentPointsRef.current;
    if (unspentStatPoints > 0 && unspentStatPoints > previousPoints) {
      setShowStatPointsWindow(true);
    }
    previousUnspentPointsRef.current = unspentStatPoints;
  }, [menuMode, unspentStatPoints, clearFloorLootBags]);

  useEffect(() => {
    if (!pendingLootItems || pendingLootItems.length <= 0) {
      setShowLootModal(false);
    }
  }, [pendingLootItems]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onDropItemsToFloor = (event: Event) => {
      const customEvent = event as CustomEvent<{ items?: any[]; mapId?: string; x?: number; y?: number }>;
      const droppedItems = Array.isArray(customEvent.detail?.items)
        ? customEvent.detail.items.filter(Boolean)
        : [];
      if (droppedItems.length <= 0) return;
      const dropX = Number.isFinite(customEvent.detail?.x) ? Number(customEvent.detail?.x) : posX;
      const dropY = Number.isFinite(customEvent.detail?.y) ? Number(customEvent.detail?.y) : posY;
      const dropMapId =
        typeof customEvent.detail?.mapId === 'string' && customEvent.detail.mapId.length > 0
          ? customEvent.detail.mapId
          : String(currentMapId || '');
      addFloorLootBag({
        x: dropX,
        y: dropY,
        mapId: dropMapId,
        items: droppedItems,
      });
    };

    window.addEventListener(FLOOR_DROP_EVENT, onDropItemsToFloor as EventListener);
    return () => {
      window.removeEventListener(FLOOR_DROP_EVENT, onDropItemsToFloor as EventListener);
    };
  }, [addFloorLootBag, posX, posY, currentMapId]);

  const isSmallMap = mapWidth * mapHeight <= SMALL_MAP_MAX_TILES;
  const dungeonDepth = getMapDepth(currentMapId);
  const nextLevelXp = Math.max(16, Math.floor(16 * Math.pow(2, Math.max(0, playerLevel - 1))));
  const enemyStrengthScale = 1 + Math.max(0, dungeonDepth - 1) * 0.5;
  const rewardScale = 1 + Math.max(0, dungeonDepth - 1) * 0.6;
  const enemyValues = Object.values(enemies);
  const aliveEnemies = enemyValues.filter((enemy) => enemy.health > 0);
  const roomEntryPosition = useMemo(() => {
    const mapConfig = getMapConfig(currentMapId);
    return mapConfig?.startPosition || { x: posX, y: posY };
  }, [currentMapId, posX, posY]);
  const merchantInteractable = useMemo(() => {
    if (!merchantPosition) return false;
    const dx = merchantPosition.x - posX;
    const dy = merchantPosition.y - posY;
    if (dx === 0 && dy === 0) return true;
    if (direction === 'N') return dx === 0 && dy === -1;
    if (direction === 'S') return dx === 0 && dy === 1;
    if (direction === 'E') return dx === 1 && dy === 0;
    if (direction === 'W') return dx === -1 && dy === 0;
    return false;
  }, [merchantPosition, posX, posY, direction]);

  useEffect(() => {
    if (menuMode !== 'game') {
      setShowMerchantModal(false);
      setMerchantMode('menu');
      return;
    }
    setShowMerchantModal(false);
    setMerchantMode('menu');
    if (!currentMapId) return;
    if (!merchantStockByMapRef.current[currentMapId]) {
      merchantStockByMapRef.current[currentMapId] = buildMerchantStock(itemData, currentMapId, dungeonDepth);
    }
    setMerchantStock(merchantStockByMapRef.current[currentMapId]);
  }, [menuMode, currentMapId, dungeonDepth]);

  const updateMerchantStockForMap = (nextStock: MerchantStockEntry[]) => {
    merchantStockByMapRef.current[currentMapId] = nextStock;
    setMerchantStock(nextStock);
  };

  const openMerchantMenu = () => {
    if (!merchantInteractable) return;
    if (inCombat) return;
    if (showStatPointsWindow) return;
    setMerchantMode('menu');
    setShowMerchantModal(true);
  };

  const closeMerchantModal = () => {
    setShowMerchantModal(false);
    setMerchantMode('menu');
  };

  const applyStatPointAllocations = async (allocations: StatAllocationMap) => {
    const spentPoints = Object.values(allocations).reduce((sum, value) => sum + value, 0);
    if (spentPoints <= 0) return;

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character) return;

    const storageUnspent = Math.max(0, Number(obj.character.unspentStatPoints ?? unspentStatPoints));
    if (spentPoints > storageUnspent) {
      dispatch(setCombatLog('Not enough stat points available.'));
      return;
    }

    const nextStats: Record<string, any> = { ...(obj.character.stats || {}) };
    (Object.keys(allocations) as Array<keyof StatAllocationMap>).forEach((key) => {
      const amount = allocations[key];
      if (amount <= 0) return;
      const currentValue = Number(nextStats[key] || 0);
      nextStats[key] = currentValue + amount;
    });

    const nextUnspent = Math.max(0, storageUnspent - spentPoints);
    obj.character.stats = nextStats;
    obj.character.unspentStatPoints = nextUnspent;

    const updatedEquipment = obj.character.equipment || playerEquipment || {};
    const derived = computeDerivedPlayerStats(nextStats, updatedEquipment, {
      classArchetype,
      level: playerLevel,
    });

    await AsyncStorage.setItem('characters', JSON.stringify(obj));

    dispatch(setEquipment(updatedEquipment));
    dispatch(setStats(nextStats));
    dispatch(setAtkSpeed(derived.atkSpeed));
    dispatch(setCrit(derived.critChance));
    dispatch(setDodge(derived.dodgeChance));
    dispatch(setUnspentStatPoints(nextUnspent));
    dispatch(setCombatLog(`Allocated ${spentPoints} stat point${spentPoints > 1 ? 's' : ''}.`));

    if (nextUnspent <= 0) {
      setShowStatPointsWindow(false);
    }
  };

  const applyLootSelection = async (selectedItems: any[]) => {
    if (!selectedItems || selectedItems.length <= 0) {
      return { pickedItems: 0, skippedItems: [] as any[] };
    }

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character) {
      return { pickedItems: 0, skippedItems: selectedItems };
    }

    let containers = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash,
      getInventoryCapacities(obj.character.equipment || playerEquipment || {})
    );
    let nextGold = Math.max(0, Number(obj.character.gold || 0));

    let bagAdded = 0;
    let goldAdded = 0;
    let skipped = 0;
    let pickedItems = 0;
    const skippedItems: any[] = [];

    selectedItems.forEach((item) => {
      if (isCurrencyItem(item)) {
        const gainedGold = readCurrencyGoldValue(item);
        if (gainedGold > 0) {
          nextGold = Number((nextGold + gainedGold).toFixed(2));
          goldAdded = Number((goldAdded + gainedGold).toFixed(2));
          pickedItems += 1;
          return;
        }
      }

      const carrySummary = getCarryLoadSummary({
        classArchetype: obj.character.classArchetype || classArchetype,
        stats: obj.character.stats || playerStats || {},
        inventory: containers.inventory,
        consumableStash: containers.consumableStash,
        equipment: obj.character.equipment || playerEquipment || {},
      });
      const projectedWeight = Number((carrySummary.used + getItemWeight(item)).toFixed(2));
      if (projectedWeight > carrySummary.max) {
        skipped += 1;
        skippedItems.push(item);
        return;
      }

      const result = tryStoreItem(
        containers,
        item,
        getInventoryCapacities(obj.character.equipment || playerEquipment || {})
      );
      containers = result.next;
      if (result.storedIn === 'bag') {
        bagAdded += 1;
        pickedItems += 1;
      } else {
        skipped += 1;
        skippedItems.push(item);
      }
    });

    obj.character.inventory = containers.inventory;
    obj.character.consumableStash = containers.consumableStash;
    obj.character.gold = nextGold;
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
    dispatch(setAllInventory(containers));
    dispatch(setGold(nextGold));

    if (bagAdded > 0) {
      dispatch(
        setCombatLog(
          `Looted ${bagAdded} item${bagAdded > 1 ? 's' : ''} into bag.`
        )
      );
    }
    if (goldAdded > 0) {
      dispatch(setCombatLog(`Collected ${goldAdded} gold.`));
    }
    if (skipped > 0) {
      dispatch(setCombatLog(`${skipped} item${skipped > 1 ? 's' : ''} left behind (inventory/load full).`));
    }

    return { pickedItems, skippedItems };
  };

  const handleLootAll = async () => {
    if (!pendingLootItems || pendingLootItems.length <= 0) return;
    const result = await applyLootSelection(pendingLootItems);
    setActiveLootBagItems(result.skippedItems);
    setShowLootModal(result.skippedItems.length > 0);
  };

  const handleDontLoot = () => {
    const count = pendingLootItems.length;
    if (count > 0) {
      dispatch(setCombatLog(`Left ${count} dropped item${count > 1 ? 's' : ''} on the floor.`));
    }
    setShowLootModal(false);
    closeLootBag();
  };

  const handleLootSingle = async (index: number) => {
    const item = pendingLootItems[index];
    if (!item) return;
    const result = await applyLootSelection([item]);
    if (result.pickedItems > 0) {
      setActiveLootBagItems((prev) => {
        const next = prev.filter((_, lootIndex) => lootIndex !== index);
        if (next.length <= 0) {
          setShowLootModal(false);
        }
        return next;
      });
    }
  };

  const handleFloorLootBagPress = (bagId: string) => {
    openLootBag(bagId);
    setShowLootModal(true);
  };

  const handleMerchantTalk = () => {
    dispatch(setCombatLog('Merchant: "The deeper you go, the pricier survival becomes."'));
    closeMerchantModal();
  };

  const handleMerchantBuy = async (merchantIndex: number) => {
    const offer = merchantStock[merchantIndex];
    if (!offer) return;

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character) return;

    const containers = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash,
      getInventoryCapacities(obj.character.equipment || playerEquipment || {})
    );
    const nextBag = [...containers.inventory];
    const nextStash = [...containers.consumableStash];
    const currentGold = Math.max(0, Number(obj.character.gold || 0));
    const buyPrice = Math.max(1, Number(offer.buyPrice || computeMerchantBuyPrice(offer.item)));

    const bagCapacity = getInventoryCapacities(obj.character.equipment || playerEquipment || {}).bagCapacity;
    if (nextBag.length >= bagCapacity) {
      dispatch(setCombatLog('Bag is full. Cannot buy item.'));
      return;
    }
    if (currentGold < buyPrice) {
      dispatch(setCombatLog('Not enough gold.'));
      return;
    }

    const purchasedItem = enrichItemEconomyStats(offer.item);
    const carrySummary = getCarryLoadSummary({
      classArchetype: obj.character.classArchetype || classArchetype,
      stats: obj.character.stats || playerStats || {},
      inventory: nextBag,
      consumableStash: nextStash,
      equipment: obj.character.equipment || playerEquipment || {},
    });
    const projectedWeight = Number((carrySummary.used + getItemWeight(purchasedItem)).toFixed(2));
    if (projectedWeight > carrySummary.max) {
      dispatch(setCombatLog('You are over your carry limit.'));
      return;
    }
    nextBag.push({ ...purchasedItem });
    const nextGold = Number((currentGold - buyPrice).toFixed(2));

    const nextStock = [...merchantStock];
    const target = nextStock[merchantIndex];
    if (target) {
      target.stock = Math.max(0, target.stock - 1);
    }
    const filteredStock = nextStock.filter((entry) => entry.stock > 0);

    obj.character.inventory = nextBag;
    obj.character.consumableStash = nextStash;
    obj.character.gold = nextGold;
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
    dispatch(setAllInventory({ inventory: nextBag, consumableStash: nextStash }));
    dispatch(setGold(nextGold));
    dispatch(setCombatLog(`Bought ${purchasedItem.name || 'item'} for ${buyPrice} gold.`));
    updateMerchantStockForMap(filteredStock);
  };

  const handleMerchantSell = async (bagIndex: number) => {
    const item = bagInventory[bagIndex];
    if (!item) return;
    if (isCurrencyItem(item)) {
      dispatch(setCombatLog('Currency cannot be sold to merchant.'));
      return;
    }

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character) return;

    const containers = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash,
      getInventoryCapacities(obj.character.equipment || playerEquipment || {})
    );
    const nextBag = [...containers.inventory];
    const nextStash = [...containers.consumableStash];
    const selected = nextBag[bagIndex];
    if (!selected) return;

    const enrichedItem = enrichItemEconomyStats(selected);
    const sellPrice = Math.max(1, computeMerchantSellPrice(enrichedItem));
    const nextGold = Number((Math.max(0, Number(obj.character.gold || 0)) + sellPrice).toFixed(2));

    nextBag.splice(bagIndex, 1);

    const soldEntry: MerchantStockEntry = {
      id: `player-sold-${Date.now()}-${bagIndex}`,
      item: enrichedItem,
      stock: 1,
      buyPrice: Math.max(1, computeMerchantBuyPrice(enrichedItem)),
    };

    const nextStock = [soldEntry, ...merchantStock].slice(0, 28);

    obj.character.inventory = nextBag;
    obj.character.consumableStash = nextStash;
    obj.character.gold = nextGold;
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
    dispatch(setAllInventory({ inventory: nextBag, consumableStash: nextStash }));
    dispatch(setGold(nextGold));
    dispatch(setCombatLog(`Sold ${enrichedItem.name || 'item'} for ${sellPrice} gold.`));
    updateMerchantStockForMap(nextStock);
  };

  const isInLineOfSight = (x: number, y: number) => {
    switch (direction) {
      case 'N':
        return x === posX && y < posY;
      case 'S':
        return x === posX && y > posY;
      case 'E':
        return y === posY && x > posX;
      case 'W':
        return y === posY && x < posX;
      default:
        return false;
    }
  };

  const isWalkableTile = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
    return !!mapTiles[y] && mapTiles[y][x] > 0;
  };

  const isSpawnBlockedTile = (x: number, y: number): boolean => {
    const tile = mapTiles?.[y]?.[x] ?? 0;
    if (tile === 5 || tile === 6 || tile === 7) return true;
    if (merchantPosition && merchantPosition.x === x && merchantPosition.y === y) return true;
    return false;
  };

  const getCorridorKey = (x: number, y: number): string => {
    if (!isWalkableTile(x, y)) return `invalid:${x},${y}`;

    let left = x;
    let right = x;
    let top = y;
    let bottom = y;

    while (isWalkableTile(left - 1, y)) left -= 1;
    while (isWalkableTile(right + 1, y)) right += 1;
    while (isWalkableTile(x, top - 1)) top -= 1;
    while (isWalkableTile(x, bottom + 1)) bottom += 1;

    const horizontalLen = right - left + 1;
    const verticalLen = bottom - top + 1;
    const horizontalNeighbors = Number(isWalkableTile(x - 1, y)) + Number(isWalkableTile(x + 1, y));
    const verticalNeighbors = Number(isWalkableTile(x, y - 1)) + Number(isWalkableTile(x, y + 1));

    const useHorizontal =
      horizontalNeighbors > verticalNeighbors ||
      (horizontalNeighbors === verticalNeighbors && horizontalLen >= verticalLen);

    return useHorizontal ? `h:${y}:${left}-${right}` : `v:${x}:${top}-${bottom}`;
  };

  const isEnemyTypeAmbush = (enemyTypeId: EnemyTypeId): boolean => {
    return getEnemyBehaviorForType(enemyTypeId).visibilityMode === 'ambush';
  };

  const isAmbushPackFromTypes = (members: EnemyTypeId[]): boolean => {
    return members.length > 0 && members.every((memberId) => isEnemyTypeAmbush(memberId));
  };

  const cloneCorridorPackCounts = (
    source: Record<string, CorridorPackCounts>
  ): Record<string, CorridorPackCounts> => {
    return Object.entries(source).reduce<Record<string, CorridorPackCounts>>((acc, [key, value]) => {
      acc[key] = { fixedPacks: value.fixedPacks, ambushPacks: value.ambushPacks };
      return acc;
    }, {});
  };

  const canPlacePackOnCorridor = (
    counts: Record<string, CorridorPackCounts>,
    corridorKey: string,
    isAmbushPack: boolean
  ): boolean => {
    const current = counts[corridorKey] || { fixedPacks: 0, ambushPacks: 0 };
    if (isAmbushPack) {
      return current.ambushPacks < MAX_AMBUSH_PACKS_PER_CORRIDOR;
    }
    return current.fixedPacks < MAX_FIXED_PACKS_PER_CORRIDOR;
  };

  const reservePackOnCorridor = (
    counts: Record<string, CorridorPackCounts>,
    corridorKey: string,
    isAmbushPack: boolean
  ) => {
    if (!counts[corridorKey]) {
      counts[corridorKey] = { fixedPacks: 0, ambushPacks: 0 };
    }
    if (isAmbushPack) {
      counts[corridorKey].ambushPacks += 1;
    } else {
      counts[corridorKey].fixedPacks += 1;
    }
  };

  const isSpawnSafe = (x: number, y: number, ignoreAliveEnemyCheck: boolean = false) => {
    if (!mapTiles[y] || mapTiles[y][x] <= 0) return false;
    if (isSpawnBlockedTile(x, y)) return false;
    if (x === posX && y === posY) return false;
    if (x === roomEntryPosition.x && y === roomEntryPosition.y) return false;
    if (x === posX || y === posY) return false;
    if (isInLineOfSight(x, y)) return false;
    if (Math.abs(x - posX) + Math.abs(y - posY) < 4) return false;
    if (!ignoreAliveEnemyCheck) {
      const occupied = aliveEnemies.some((enemy) => enemy.positionX === x && enemy.positionY === y);
      if (occupied) return false;
    }
    return true;
  };

  const buildSpawnAnchors = (ignoreAliveEnemyCheck: boolean = false, maxAnchors: number = MAX_PACK_ANCHORS) => {
    const candidates: SpawnAnchor[] = [];
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (isSpawnSafe(x, y, ignoreAliveEnemyCheck)) {
          candidates.push({ x, y, corridorKey: getCorridorKey(x, y) });
        }
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.max(1, maxAnchors));
  };

  const findEmergencySpawnAnchor = (): SpawnAnchor | null => {
    const candidates: SpawnAnchor[] = [];
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (!isWalkableTile(x, y)) continue;
        if (isSpawnBlockedTile(x, y)) continue;
        if (x === posX && y === posY) continue;
        if (x === roomEntryPosition.x && y === roomEntryPosition.y) continue;
        const occupied = aliveEnemies.some((enemy) => enemy.positionX === x && enemy.positionY === y);
        if (occupied) continue;
        candidates.push({ x, y, corridorKey: getCorridorKey(x, y) });
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const activeCorridorPackCounts = useMemo<Record<string, CorridorPackCounts>>(() => {
    const packsByPosition: Record<string, { x: number; y: number; allAmbush: boolean }> = {};

    aliveEnemies.forEach((enemy) => {
      const x = enemy.positionX ?? 0;
      const y = enemy.positionY ?? 0;
      if (!isWalkableTile(x, y)) return;

      const key = `${x},${y}`;
      const isAmbushEnemy = (enemy.visibilityMode || 'distance') === 'ambush';
      if (!packsByPosition[key]) {
        packsByPosition[key] = { x, y, allAmbush: isAmbushEnemy };
        return;
      }
      packsByPosition[key].allAmbush = packsByPosition[key].allAmbush && isAmbushEnemy;
    });

    return Object.values(packsByPosition).reduce<Record<string, CorridorPackCounts>>((acc, pack) => {
      const corridorKey = getCorridorKey(pack.x, pack.y);
      if (!acc[corridorKey]) {
        acc[corridorKey] = { fixedPacks: 0, ambushPacks: 0 };
      }
      if (pack.allAmbush) {
        acc[corridorKey].ambushPacks += 1;
      } else {
        acc[corridorKey].fixedPacks += 1;
      }
      return acc;
    }, {});
  }, [aliveEnemies, mapTiles, mapWidth, mapHeight]);

  const choosePackKind = (depth: number): PackKind => {
    const profile = getDepthSpawnProfile(depth);
    const roll = Math.random() * 100;
    const ratCutoff = profile.composition.rats;
    const skeletonCutoff = ratCutoff + profile.composition.skeletons;
    if (roll < ratCutoff) return 'rats';
    if (roll < skeletonCutoff) return 'skeletons';
    return 'mixed';
  };

  const buildPackMembers = (depth: number, maxMembers: number, forceMixed: boolean = false): EnemyTypeId[] => {
    const profile = getDepthSpawnProfile(depth);
    const cap = Math.max(1, maxMembers);
    const kind = forceMixed ? 'mixed' : choosePackKind(depth);

    if (kind === 'rats') {
      const ratCount = cap === 1 ? 1 : randInt(2, Math.min(4, cap));
      return Array.from({ length: ratCount }, () => ENEMY_TYPE.RAT);
    }

    if (kind === 'skeletons') {
      const skeletonCount = randInt(1, Math.min(2, cap));
      const remaining = Math.max(0, cap - skeletonCount);
      const archerCap = Math.min(1, remaining);
      const archerChance = Math.max(0, profile.composition.mixed - 20) / 100;
      const archerCount = archerCap > 0 && Math.random() < archerChance ? 1 : 0;
      return [
        ...Array.from({ length: skeletonCount }, () => ENEMY_TYPE.SKELETON),
        ...Array.from({ length: archerCount }, () => ENEMY_TYPE.ARCHER),
      ];
    }

    if (cap === 1) {
      return [ENEMY_TYPE.SKELETON];
    }

    const desiredArchers = Math.max(1, Math.min(2, Math.round(cap * profile.mixedArcherBias)));
    const archerCount = Math.max(1, Math.min(2, Math.min(desiredArchers, cap - 1)));
    const skeletonCount = Math.max(1, Math.min(2, cap - archerCount));
    return [
      ...Array.from({ length: skeletonCount }, () => ENEMY_TYPE.SKELETON),
      ...Array.from({ length: archerCount }, () => ENEMY_TYPE.ARCHER),
    ];
  };

  const spawnEnemies = () => {
    dispatch(fetchEnemies());
    dispatch(clearEnemies());

    const anchors = buildSpawnAnchors(true, isSmallMap ? 5 : MAX_PACK_ANCHORS);
    const fallbackAnchor = anchors.length === 0 ? findEmergencySpawnAnchor() : null;
    const safeAnchors = anchors.length > 0 ? anchors : fallbackAnchor ? [fallbackAnchor] : [];
    setSpawnPoints(safeAnchors);

    if (safeAnchors.length === 0) {
      dispatch(setEnemyCount(0));
      dispatch(setCurrentEnemy(0));
      lastSpawnedMapRef.current = currentMapId;
      return;
    }

    const profile = getDepthSpawnProfile(dungeonDepth);
    let spawned = 0;
    const targetEnemyRange = isSmallMap ? profile.targetEnemiesSmall : profile.targetEnemiesLarge;
    const targetEnemies = Math.min(MAX_DYNAMIC_ENEMIES, randInt(targetEnemyRange[0], targetEnemyRange[1]));
    const packCountRange = isSmallMap ? profile.packCountSmall : profile.packCountLarge;
    const targetPacks = randInt(packCountRange[0], packCountRange[1]);
    const packCount = Math.max(1, Math.min(targetPacks, targetEnemies));
    let availableAnchors = [...safeAnchors];
    const corridorPackCounts: Record<string, CorridorPackCounts> = {};

    for (let packIndex = 0; packIndex < packCount && spawned < targetEnemies; packIndex++) {
      const remainingEnemies = targetEnemies - spawned;
      const remainingPacks = packCount - packIndex;
      const minReservedForRemainingPacks = Math.max(0, remainingPacks - 1);
      const maxMembersForThisPack = Math.max(1, remainingEnemies - minReservedForRemainingPacks);
      const packMembers = buildPackMembers(dungeonDepth, maxMembersForThisPack, false);
      const finalMembers = packMembers.length > 0 ? packMembers : [pickSpawnEnemyTypeForDepth(dungeonDepth) as EnemyTypeId];
      const isAmbushPack = isAmbushPackFromTypes(finalMembers);

      const eligibleAnchors = availableAnchors.filter((anchor) =>
        canPlacePackOnCorridor(corridorPackCounts, anchor.corridorKey, isAmbushPack)
      );
      const fallbackEligibleAnchors = safeAnchors.filter((anchor) =>
        canPlacePackOnCorridor(corridorPackCounts, anchor.corridorKey, isAmbushPack)
      );
      const candidateAnchors = eligibleAnchors.length > 0 ? eligibleAnchors : fallbackEligibleAnchors;
      if (candidateAnchors.length === 0) continue;

      const point = candidateAnchors[Math.floor(Math.random() * candidateAnchors.length)];
      availableAnchors = availableAnchors.filter((anchor) => !(anchor.x === point.x && anchor.y === point.y));

      finalMembers.forEach((typeId) => {
        dispatch(
          addEnemy({
            index: spawned,
            id: typeId,
            positionX: point.x,
            positionY: point.y,
            strengthScale: enemyStrengthScale,
            rewardScale,
          })
        );
        spawned += 1;
      });
      reservePackOnCorridor(corridorPackCounts, point.corridorKey, isAmbushPack);
    }

    dispatch(setEnemyCount(spawned));
    dispatch(setCurrentEnemy(0));
    lastSpawnedMapRef.current = currentMapId;
  };

  useEffect(() => {
    if (menuMode !== 'game') {
      setInitialized(false);
      lastSpawnedMapRef.current = null;
      return;
    }

    if (initialized || !mapTiles || mapTiles.length === 0) return;
    spawnEnemies();
    setInitialized(true);
  }, [menuMode, initialized, mapTiles, mapHeight, mapWidth, posX, posY, currentMapId, dungeonDepth]);

  useEffect(() => {
    if (menuMode !== 'game' || !initialized || !mapTiles || mapTiles.length === 0) return;
    if (lastSpawnedMapRef.current === currentMapId) return;
    stepCounterRef.current = 0;
    spawnEnemies();
  }, [menuMode, initialized, currentMapId, mapTiles, posX, posY, dungeonDepth]);

  useEffect(() => {
    if (menuMode !== 'game' || !initialized || !isSmallMap || !mapTiles || mapTiles.length === 0) return;
    const anchors = buildSpawnAnchors();
    if (anchors.length > 0) {
      setSpawnPoints(anchors);
    }
  }, [menuMode, initialized, currentMapId, posX, posY, direction]);

  useEffect(() => {
    if (menuMode !== 'game' || !initialized || !isSmallMap) return;
    if (showDeathOverlay || revivePending) return;

    const current = { x: posX, y: posY, mapId: currentMapId };
    const prev = lastPosRef.current;

    if (!prev || prev.mapId !== current.mapId) {
      lastPosRef.current = current;
      stepCounterRef.current = 0;
      return;
    }

    const moved = prev.x !== current.x || prev.y !== current.y;
    if (!moved) return;

    lastPosRef.current = current;
    stepCounterRef.current += 1;

    if (stepCounterRef.current % RESPAWN_STEP_INTERVAL !== 0) return;
    if (aliveEnemies.length >= MAX_DYNAMIC_ENEMIES) return;

    const nextIndex =
      Object.keys(enemies).length > 0 ? Math.max(...Object.keys(enemies).map(Number)) + 1 : 0;
    const profile = getDepthSpawnProfile(dungeonDepth);
    const openSlots = Math.max(1, MAX_DYNAMIC_ENEMIES - aliveEnemies.length);
    const respawnPackCap = Math.min(openSlots, isSmallMap ? profile.respawnPackCapSmall : profile.respawnPackCapLarge);
    const respawnPack = buildPackMembers(dungeonDepth, respawnPackCap, Math.random() < 0.45);
    const respawnMembers = respawnPack.length > 0 ? respawnPack : [pickSpawnEnemyTypeForDepth(dungeonDepth) as EnemyTypeId];
    const isAmbushPack = isAmbushPackFromTypes(respawnMembers);
    const validPoints = spawnPoints.filter((point) => isSpawnSafe(point.x, point.y));
    const corridorPackCounts = cloneCorridorPackCounts(activeCorridorPackCounts);
    const corridorEligiblePoints = validPoints.filter((point) =>
      canPlacePackOnCorridor(corridorPackCounts, point.corridorKey, isAmbushPack)
    );
    if (corridorEligiblePoints.length === 0) return;

    const chosenPoint = corridorEligiblePoints[Math.floor(Math.random() * corridorEligiblePoints.length)];
    let spawnedNow = 0;

    respawnMembers.forEach((typeId, idx) => {
      if (idx >= openSlots) return;
      dispatch(
        addEnemy({
          index: nextIndex + idx,
          id: typeId,
          positionX: chosenPoint.x,
          positionY: chosenPoint.y,
          strengthScale: enemyStrengthScale,
          rewardScale,
        })
      );
      spawnedNow += 1;
    });
    dispatch(setEnemyCount(aliveEnemies.length + spawnedNow));
  }, [
    menuMode,
    initialized,
    isSmallMap,
    posX,
    posY,
    currentMapId,
    showDeathOverlay,
    revivePending,
    spawnPoints,
    aliveEnemies.length,
    direction,
    enemies,
    activeCorridorPackCounts,
    dungeonDepth,
    enemyStrengthScale,
    rewardScale,
  ]);

  const continueGame = () => {
    merchantStockByMapRef.current = {};
    setMerchantStock([]);
    setShowMerchantModal(false);
    setMerchantMode('menu');
    setMenuMode('game');
  };

  const createNewGame = async () => {
    const saveData = buildCharacterFromArchetype(selectedArchetype, characterName.trim());
    await AsyncStorage.setItem('characters', JSON.stringify(saveData));
    await AsyncStorage.setItem('items', JSON.stringify(itemData));
    dispatch(emptyCombatLog());
    dispatch(setGold(Math.max(0, Number(saveData.character.gold || 0))));
    clearFloorLootBags();
    setShowStatPointsWindow(false);
    merchantStockByMapRef.current = {};
    setMerchantStock([]);
    setShowMerchantModal(false);
    setMerchantMode('menu');
    setCanContinue(true);
    setInitialized(false);
    setMenuMode('game');
  };

  useEffect(() => {
    if (revivePending) {
      return;
    }

    if (menuMode !== 'game') {
      setShowDeathOverlay(false);
      deathOpacity.setValue(0);
      return;
    }

    if (playerHealth > 0) {
      if (showDeathOverlay) {
        Animated.timing(deathOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setShowDeathOverlay(false));
      }
      return;
    }

    setShowDeathOverlay(true);
    Animated.timing(deathOpacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [menuMode, playerHealth, showDeathOverlay, deathOpacity, revivePending]);

  const skillHud = useMemo(() => {
    if (classArchetype === 'caster') {
      return {
        primaryLabel: `Arcane Bolt [18]`,
        secondaryLabel: `Fire Blast [32]`,
        primaryDisabled: mana < 18,
        secondaryDisabled: mana < 32,
      };
    }

    if (classArchetype === 'ranger') {
      return {
        primaryLabel: `Quick Stab [16]`,
        secondaryLabel: `Eviscerate [24]`,
        primaryDisabled: mana < 16,
        secondaryDisabled: mana < 24 || comboPoints <= 0,
      };
    }

    return {
      primaryLabel: `Crushing Blow [20]`,
      secondaryLabel: `Whirlwind [35]`,
      primaryDisabled: mana < 20,
      secondaryDisabled: mana < 35,
    };
  }, [classArchetype, mana, comboPoints]);

  const skillButtonsLocked = !inCombat || specialCooldownFrames > 0;
  const primaryResourceLocked = skillHud.primaryDisabled;
  const secondaryResourceLocked = skillHud.secondaryDisabled;
  const primaryDisabled = skillButtonsLocked || primaryResourceLocked;
  const secondaryDisabled = skillButtonsLocked || secondaryResourceLocked;
  const primaryText =
    specialCooldownFrames > 0 ? `${skillHud.primaryLabel} (${specialCooldownFrames})` : skillHud.primaryLabel;
  const secondaryText =
    specialCooldownFrames > 0 ? `${skillHud.secondaryLabel} (${specialCooldownFrames})` : skillHud.secondaryLabel;

  useEffect(() => {
    if (Platform.OS !== 'web' || menuMode !== 'game') return;

    const handleCombatHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = !!target?.isContentEditable || tag === 'input' || tag === 'textarea';
      if (isEditable) return;
      if (event.repeat) return;

      const key = event.key.toLowerCase();

      if (key === 'c') {
        event.preventDefault();
        setShowStatPointsWindow((prev) => !prev);
        return;
      }

      if (key === 'i') {
        if (showMerchantModal || showStatPointsWindow) {
          return;
        }
        event.preventDefault();
        window.dispatchEvent(new Event('dungeon:focus-bag'));
        return;
      }

      if (showMerchantModal) {
        return;
      }

      if (showStatPointsWindow) {
        return;
      }

      if (key === 'q') {
        event.preventDefault();
        performPrimarySkill();
        return;
      }

      if (key === 'e') {
        event.preventDefault();
        performSecondarySkill();
        return;
      }

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        if (merchantInteractable) {
          openMerchantMenu();
          return;
        }
        const aliveEnemyIds = Object.entries(enemies)
          .filter(([, enemy]) => !!enemy && enemy.health > 0)
          .map(([id]) => Number(id))
          .sort((a, b) => a - b);

        if (aliveEnemyIds.length <= 0) return;
        const preferred = Number(currentEnemyId);
        const targetId = aliveEnemyIds.includes(preferred) ? preferred : aliveEnemyIds[0];

        if (!inCombat) {
          startCombat(targetId);
        }
        engagePlayerAttack(targetId);
      }
    };

    document.addEventListener('keydown', handleCombatHotkeys);
    return () => document.removeEventListener('keydown', handleCombatHotkeys);
  }, [
    menuMode,
    enemies,
    currentEnemyId,
    inCombat,
    merchantInteractable,
    showMerchantModal,
    showStatPointsWindow,
    openMerchantMenu,
    startCombat,
    engagePlayerAttack,
    performPrimarySkill,
    performSecondarySkill,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web' || menuMode !== 'start') return;

    const enabledIndexes = canContinue ? [0, 1] : [1];
    if (enabledIndexes.length <= 0) return;

    const handleStartMenuKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = !!target?.isContentEditable || tag === 'input' || tag === 'textarea';
      if (isEditable) return;

      const key = event.key;
      if (
        key !== 'ArrowUp' &&
        key !== 'ArrowDown' &&
        key !== 'ArrowLeft' &&
        key !== 'ArrowRight' &&
        key !== 'Enter' &&
        key !== ' '
      ) {
        return;
      }

      event.preventDefault();

      if (key === 'Enter' || key === ' ') {
        if (startMenuFocusIndex === 0 && canContinue) {
          continueGame();
          return;
        }
        if (startMenuFocusIndex === 1) {
          setMenuMode('create');
        }
        return;
      }

      const currentPos = enabledIndexes.indexOf(startMenuFocusIndex);
      const safePos = currentPos >= 0 ? currentPos : 0;
      const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
      const nextPos = (safePos + direction + enabledIndexes.length) % enabledIndexes.length;
      setStartMenuFocusIndex(enabledIndexes[nextPos]);
    };

    document.addEventListener('keydown', handleStartMenuKeys, true);
    return () => document.removeEventListener('keydown', handleStartMenuKeys, true);
  }, [menuMode, canContinue, startMenuFocusIndex]);

  const restartAfterDeath = async () => {
    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    const currentClass = (obj?.character?.classArchetype || 'warrior') as ArchetypeId;
    const currentName = obj?.character?.name || 'Adventurer';

    const saveData = buildCharacterFromArchetype(currentClass, currentName);
    await AsyncStorage.setItem('characters', JSON.stringify(saveData));
    await AsyncStorage.setItem('items', JSON.stringify(itemData));

    const stats = saveData.character.stats;
    const equipment = saveData.character.equipment;
    const normalizedInventory = normalizeInventoryContainers(
      saveData.character.inventory,
      saveData.character.consumableStash,
      getInventoryCapacities(saveData.character.equipment)
    );
    saveData.character.inventory = normalizedInventory.inventory;
    saveData.character.consumableStash = normalizedInventory.consumableStash;
    const derived = computeDerivedPlayerStats(stats, equipment, {
      classArchetype: saveData.character.classArchetype || 'warrior',
      level: saveData.character.level,
    });
    const unspentPoints = Math.max(0, Number(saveData.character.unspentStatPoints || 0));

    dispatch(setEquipment(equipment));
    dispatch(setStats(stats));
    dispatch(setHealth(saveData.character.stats.health));
    dispatch(setXP(saveData.character.experience));
    dispatch(setLevel(saveData.character.level));
    dispatch(setAtkSpeed(derived.atkSpeed));
    dispatch(setCrit(derived.critChance));
    dispatch(setDodge(derived.dodgeChance));
    dispatch(setUnspentStatPoints(unspentPoints));
    dispatch(setGold(Math.max(0, Number(saveData.character.gold || 0))));
    dispatch(setAllInventory(normalizedInventory));
    dispatch(
      setClassMeta({
        classArchetype: saveData.character.classArchetype || 'warrior',
        classLabel: saveData.character.classLabel || 'Warrior',
        specialName: saveData.character.specialName || 'Crushing Blow',
      })
    );

    dispatch(emptyCombatLog());
    dispatch(clearEnemies());
    dispatch(setInCombat(false));
    dispatch(setSpecialCooldown(0));
    clearFloorLootBags();

    setRevivePending(true);
    setInitialized(false);
    setShowDeathOverlay(false);
    setShowStatPointsWindow(false);
    merchantStockByMapRef.current = {};
    setMerchantStock([]);
    setShowMerchantModal(false);
    setMerchantMode('menu');
    deathOpacity.setValue(0);
    setSessionSeed((prev) => prev + 1);
    setMenuMode('game');
    setTimeout(() => setRevivePending(false), 900);
  };

  if (menuMode === 'start') {
    return (
      <View style={styles.menuRoot}>
        <View style={styles.menuCard}>
          <Text style={styles.title}>Dungeon Crawler</Text>
          <Text style={styles.subtitle}>Delve deeper. Survive longer.</Text>

          <TouchableOpacity
            style={[
              styles.menuButton,
              !canContinue && styles.menuButtonDisabled,
              startMenuFocusIndex === 0 && styles.menuButtonFocused,
            ]}
            disabled={!canContinue}
            onPress={continueGame}
            onFocus={() => setStartMenuFocusIndex(0)}
          >
            <Text style={styles.menuButtonText}>{canContinue ? 'Continue Game' : 'No Save Found'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuButton, startMenuFocusIndex === 1 && styles.menuButtonFocused]}
            onPress={() => setMenuMode('create')}
            onFocus={() => setStartMenuFocusIndex(1)}
          >
            <Text style={styles.menuButtonText}>New Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (menuMode === 'create') {
    return (
      <View style={styles.menuRoot}>
        <View style={styles.menuCard}>
          <Text style={styles.title}>Create Character</Text>
          <TextInput
            style={styles.input}
            placeholder="Character name"
            placeholderTextColor="#9c9c9c"
            value={characterName}
            onChangeText={setCharacterName}
          />

          {ARCHETYPES.map((archetype) => (
            <TouchableOpacity
              key={archetype.id}
              style={[
                styles.archetypeCard,
                selectedArchetype === archetype.id && styles.archetypeCardSelected,
              ]}
              onPress={() => setSelectedArchetype(archetype.id)}
            >
              <Text style={styles.archetypeName}>{archetype.name}</Text>
              <Text style={styles.archetypeDesc}>{archetype.description}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.createButtonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMenuMode('start')}>
              <Text style={styles.menuButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={createNewGame}>
              <Text style={styles.menuButtonText}>Start Adventure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainScreen}>
      <View style={styles.roomFrame}>
        <Room
          key={`room-${sessionSeed}`}
          startCombat={startCombat}
          engagePlayerAttack={engagePlayerAttack}
          onMerchantInteract={openMerchantMenu}
          floorLootBags={floorLootBags}
          onLootBagPress={handleFloorLootBagPress}
          skillOverlay={
            <View style={styles.leftHud}>
              <View style={styles.skillBar}>
                <TouchableOpacity
                  testID="skill-primary-button"
                  style={[
                    styles.skillButton,
                    primaryDisabled && styles.skillButtonDisabled,
                    primaryResourceLocked && styles.skillButtonFaded,
                  ]}
                  onPress={performPrimarySkill}
                  disabled={primaryDisabled}
                >
                  <Text style={styles.skillButtonText}>{primaryText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="skill-secondary-button"
                  style={[
                    styles.skillButtonSecondary,
                    secondaryDisabled && styles.skillButtonDisabled,
                    secondaryResourceLocked && styles.skillButtonFaded,
                  ]}
                  onPress={performSecondarySkill}
                  disabled={secondaryDisabled}
                >
                  <Text style={styles.skillButtonText}>{secondaryText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="skill-stats-button"
                  style={[styles.skillButtonMeta, unspentStatPoints > 0 && styles.skillButtonMetaReady]}
                  onPress={() => setShowStatPointsWindow((prev) => !prev)}
                >
                  <Text style={styles.skillButtonText}>
                    Stats {unspentStatPoints > 0 ? `[${unspentStatPoints}]` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          rightOverlay={
            <View style={styles.roomRightHud}>
              <View style={styles.roomRightTop}>
                <MiniMap size={8} />
                <ConsumableBelt />
              </View>
              <Inventory />
            </View>
          }
        />
      </View>
      <Player
        key={`player-${sessionSeed}`}
        classLabel={classLabel}
      />
      <StatPointsWindow
        visible={showStatPointsWindow}
        classArchetype={classArchetype}
        level={playerLevel}
        experience={playerXP}
        nextLevelXp={nextLevelXp}
        stats={playerStats}
        equipment={playerEquipment}
        unspentStatPoints={unspentStatPoints}
        onClose={() => setShowStatPointsWindow(false)}
        onApplyAllocations={applyStatPointAllocations}
      />
      <EnemyLootModal
        visible={showLootModal && !!activeLootBagId && pendingLootItems.length > 0}
        lootItems={pendingLootItems}
        bagCount={Math.min(bagInventory.length, inventoryCapacities.bagCapacity)}
        bagCapacity={inventoryCapacities.bagCapacity}
        stashCount={Math.min(consumableStash.length, inventoryCapacities.beltCapacity)}
        stashCapacity={inventoryCapacities.beltCapacity}
        onLootAll={handleLootAll}
        onDontLoot={handleDontLoot}
        onLootSingle={handleLootSingle}
      />
      <MerchantModal
        visible={showMerchantModal}
        mode={merchantMode}
        gold={playerGold}
        merchantStock={merchantStock}
        playerBag={bagInventory}
        bagCapacity={inventoryCapacities.bagCapacity}
        onClose={closeMerchantModal}
        onTalk={handleMerchantTalk}
        onTrade={() => setMerchantMode('trade')}
        onBuy={handleMerchantBuy}
        onSell={handleMerchantSell}
      />
      {showDeathOverlay && (
        <Animated.View style={[styles.deathOverlay, { opacity: deathOpacity }]}>
          <Text style={styles.deathTitle}>YOU DIED</Text>
          <TouchableOpacity style={styles.restartButton} onPress={restartAfterDeath}>
            <Text style={styles.restartButtonText}>Restart</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainScreen: {
    width: 800,
    height: 768,
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#000000',
  },
  roomFrame: {
    width: '100%',
    maxWidth: 800,
    aspectRatio: 4 / 3,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#d7d7d7',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  menuRoot: {
    width: 800,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  menuCard: {
    width: 560,
    backgroundColor: '#080808',
    borderWidth: 4,
    borderColor: '#d7d7d7',
    padding: 16,
    gap: 8,
    shadowColor: '#050505',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  subtitle: {
    color: '#d0d0d0',
    fontSize: 13,
    fontFamily: RETRO_FONT,
    marginBottom: 6,
  },
  menuButton: {
    backgroundColor: '#121212',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d7d7d7',
  },
  menuButtonFocused: {
    borderColor: '#ffffff',
    backgroundColor: '#222222',
  },
  menuButtonDisabled: {
    backgroundColor: '#191919',
    borderColor: '#696969',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d7d7d7',
  },
  menuButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  input: {
    borderWidth: 2,
    borderColor: '#d7d7d7',
    color: '#ffffff',
    backgroundColor: '#101010',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
  archetypeCard: {
    borderWidth: 2,
    borderColor: '#808080',
    padding: 10,
    backgroundColor: '#121212',
  },
  archetypeCardSelected: {
    borderColor: '#ffffff',
    backgroundColor: '#232323',
  },
  archetypeName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  archetypeDesc: {
    color: '#d0d0d0',
    fontSize: 11,
    fontFamily: RETRO_FONT,
  },
  createButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  deathOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  deathTitle: {
    color: '#ffffff',
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
    marginBottom: 20,
  },
  restartButton: {
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#d7d7d7',
  },
  restartButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  leftHud: {
    gap: 4,
    alignItems: 'flex-start',
  },
  skillBar: {
    opacity:0 ,
    width: 192,
    gap: 4,
    padding: 5,
    borderWidth: 2,
    borderColor: '#d7d7d7',
    backgroundColor: '#050505',
  },
  skillButton: {
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skillButtonSecondary: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skillButtonMeta: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skillButtonMetaReady: {
    backgroundColor: '#3a3a3a',
  },
  skillButtonDisabled: {
    opacity: 0.65,
  },
  skillButtonFaded: {
    opacity: 0.38,
  },
  skillButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
    textAlign: 'center',
  },
  roomRightHud: {
    width: 140,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 2,
  },
  roomRightTop: {
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 2,
  },
});
