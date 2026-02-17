import { TileType } from '../../types/map';

export type ItemRarity = 'common' | 'uncommon' | 'magic' | 'rare' | 'unique';

export interface EconomyItem extends Record<string, any> {
  rarity: ItemRarity;
  quality: number;
  levelRequirement: number;
  affixes: string[];
  baseValue: number;
}

export interface MerchantStockEntry {
  id: string;
  item: EconomyItem;
  stock: number;
  buyPrice: number;
}

export interface MerchantPosition {
  x: number;
  y: number;
}

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.35,
  magic: 1.8,
  rare: 2.8,
  unique: 5,
};

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
};

const seededShuffle = <T>(source: T[], seed: number): T[] => {
  const arr = [...source];
  let state = seed >>> 0;
  const nextRand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const inferRarity = (item: any, affixCount: number): ItemRarity => {
  const explicit = String(item?.rarity || '').toLowerCase();
  if (explicit === 'common' || explicit === 'uncommon' || explicit === 'magic' || explicit === 'rare' || explicit === 'unique') {
    return explicit;
  }

  if (item?.unique || /unique/i.test(String(item?.name || ''))) return 'unique';
  if (affixCount >= 4) return 'rare';
  if (affixCount >= 2) return 'magic';
  if (affixCount >= 1) return 'uncommon';
  return 'common';
};

const inferQuality = (item: any): number => {
  const explicit = readNumber(item?.quality, NaN);
  if (Number.isFinite(explicit)) {
    return clamp(Math.floor(explicit), 1, 100);
  }

  const qualityLevel = readNumber(item?.['Quality Level'], NaN);
  if (Number.isFinite(qualityLevel)) {
    return clamp(Math.floor(qualityLevel), 1, 100);
  }

  const levelReq = readNumber(item?.['Level Requirement'], readNumber(item?.levelRequirement, 1));
  return clamp(Math.max(1, Math.floor(levelReq * 1.5)), 1, 100);
};

const inferLevelRequirement = (item: any): number => {
  const explicit = readNumber(item?.levelRequirement, NaN);
  if (Number.isFinite(explicit)) return clamp(Math.floor(explicit), 1, 99);

  const fromKey = readNumber(item?.['Level Requirement'], NaN);
  if (Number.isFinite(fromKey)) return clamp(Math.floor(fromKey), 1, 99);

  const qualityLevel = readNumber(item?.['Quality Level'], NaN);
  if (Number.isFinite(qualityLevel)) {
    return clamp(Math.floor(qualityLevel * 0.7), 1, 99);
  }

  return 1;
};

const inferAffixes = (item: any): string[] => {
  if (Array.isArray(item?.affixes) && item.affixes.length > 0) {
    return item.affixes.filter((entry: unknown) => typeof entry === 'string') as string[];
  }
  if (Array.isArray(item?.mods) && item.mods.length > 0) {
    return item.mods.filter((entry: unknown) => typeof entry === 'string') as string[];
  }
  return [];
};

const inferTypeBaseValue = (item: any): number => {
  const type = String(item?.type || '').toLowerCase();
  if (type === 'consumable') {
    const hp = readNumber(item?.stats?.amount, 0);
    const mana = readNumber(item?.stats?.mana, 0);
    return 20 + hp * 3 + mana * 3.5;
  }
  if (type === 'ring' || type === 'amulet') return 160;
  if (type === 'weapon' || type === 'sword' || type === 'dagger') return 120;
  if (type === 'armor' || type === 'armors' || type === 'helmet' || type === 'helm' || type === 'boots') return 110;
  if (type === 'offhand' || type === 'shield') return 95;
  return 80;
};

export const enrichItemEconomyStats = (rawItem: any): EconomyItem => {
  const item = { ...(rawItem || {}) };
  const affixes = inferAffixes(item);
  const quality = inferQuality(item);
  const levelRequirement = inferLevelRequirement(item);
  const rarity = inferRarity(item, affixes.length);

  const statsScore = item?.stats && typeof item.stats === 'object'
    ? Object.values(item.stats as Record<string, unknown>).reduce<number>(
        (sum, val) => sum + Math.max(0, readNumber(val, 0)),
        0
      )
    : 0;

  const baseRaw =
    inferTypeBaseValue(item) +
    quality * 2.5 +
    levelRequirement * 9 +
    affixes.length * 35 +
    statsScore * 2.2;

  const baseValue = Math.max(4, Math.round(baseRaw * RARITY_MULTIPLIER[rarity]));

  return {
    ...item,
    rarity,
    quality,
    levelRequirement,
    affixes,
    baseValue,
  };
};

export const computeMerchantBuyPrice = (item: any): number => {
  const enriched = enrichItemEconomyStats(item);
  return Math.max(6, Math.round(enriched.baseValue * 1.35));
};

export const computeMerchantSellPrice = (item: any): number => {
  const enriched = enrichItemEconomyStats(item);
  return Math.max(2, Math.round(enriched.baseValue * 0.45));
};

const stockEntry = (rawItem: any, stock: number, seed: number): MerchantStockEntry => {
  const enriched = enrichItemEconomyStats(rawItem);
  return {
    id: `${String(enriched?.name || 'item').replace(/\s+/g, '-').toLowerCase()}-${seed}`,
    item: enriched,
    stock: Math.max(1, Math.floor(stock)),
    buyPrice: computeMerchantBuyPrice(enriched),
  };
};

const flattenMerchantSellables = (itemsObj: any): any[] => {
  const src = itemsObj?.items || {};
  const pool: any[] = [];

  Object.keys(src).forEach((key) => {
    const category = src?.[key];
    if (!category || typeof category !== 'object') return;
    Object.values(category).forEach((entry: any) => {
      if (!entry || typeof entry !== 'object') return;
      const type = String(entry?.type || '').toLowerCase();
      if (!type) return;
      if (type === 'currency' || type === 'consumable') return;
      pool.push({ ...entry });
    });
  });

  return pool;
};

export const buildMerchantStock = (itemsObj: any, mapId: string, depth: number): MerchantStockEntry[] => {
  const source = itemsObj?.items || {};
  const consumables = source?.consumable || {};
  const healPotion = consumables?.['1'] ? { ...consumables['1'] } : null;
  const manaPotion = consumables?.['2'] ? { ...consumables['2'] } : null;

  const seed = hashString(`${mapId}:${depth}`);
  const entries: MerchantStockEntry[] = [];

  if (healPotion) {
    entries.push(stockEntry(healPotion, 2 + (seed % 3), seed + 1));
  }
  if (manaPotion) {
    entries.push(stockEntry(manaPotion, 2 + ((seed >> 2) % 3), seed + 2));
  }

  const basePool = flattenMerchantSellables(itemsObj);
  const tierCap = 10 + depth * 12;
  const eligibleByDepth = basePool.filter((entry) => {
    const enriched = enrichItemEconomyStats(entry);
    return enriched.levelRequirement <= tierCap;
  });
  const sourcePool = eligibleByDepth.length > 0 ? eligibleByDepth : basePool;
  const shuffledPool = seededShuffle(sourcePool, seed + 11);
  const itemCount = clamp(8 + depth * 2, 8, 18);
  const picked = shuffledPool.slice(0, itemCount);

  picked.forEach((entry, index) => {
    entries.push(
      stockEntry(
        { ...entry },
        1,
        seed + 100 + index
      )
    );
  });

  return entries;
};

const isWalkable = (tiles: TileType[][], x: number, y: number): boolean => {
  if (y < 0 || x < 0 || y >= tiles.length || x >= (tiles[0]?.length || 0)) return false;
  return tiles[y][x] > 0;
};

export const carveMerchantDent = (
  tilesInput: TileType[][],
  start: { x: number; y: number }
): { tiles: TileType[][]; merchantPosition: MerchantPosition | null } => {
  const tiles = tilesInput.map((row) => [...row]) as TileType[][];
  const height = tiles.length;
  const width = tiles[0]?.length || 0;
  const candidates: Array<{ x: number; y: number; distance: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tiles[y][x] !== 0) continue;
      const neighbors = [
        isWalkable(tiles, x + 1, y),
        isWalkable(tiles, x - 1, y),
        isWalkable(tiles, x, y + 1),
        isWalkable(tiles, x, y - 1),
      ].filter(Boolean).length;

      if (neighbors !== 1) continue;

      const distance = Math.abs(x - start.x) + Math.abs(y - start.y);
      if (distance < 3) continue;
      candidates.push({ x, y, distance });
    }
  }

  if (candidates.length <= 0) {
    let fallback: MerchantPosition | null = null;
    let bestDistance = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isWalkable(tiles, x, y)) continue;
        const distance = Math.abs(x - start.x) + Math.abs(y - start.y);
        if (distance > bestDistance) {
          bestDistance = distance;
          fallback = { x, y };
        }
      }
    }
    return { tiles, merchantPosition: fallback };
  }

  candidates.sort((a, b) => b.distance - a.distance);
  const selected = candidates[0];
  tiles[selected.y][selected.x] = 8;

  return {
    tiles,
    merchantPosition: { x: selected.x, y: selected.y },
  };
};
