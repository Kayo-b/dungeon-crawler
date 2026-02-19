export const BAG_CAPACITY = 16;
export const CONSUMABLE_STASH_CAPACITY = 4;
export const STARTING_BAG_CAPACITY = 4;
export const STARTING_BELT_CAPACITY = 2;

export interface InventoryContainers {
  inventory: any[];
  consumableStash: any[];
}

export interface InventoryCapacities {
  bagCapacity: number;
  beltCapacity: number;
}

export interface CarryLoadSummary {
  used: number;
  max: number;
  remaining: number;
  overloaded: boolean;
}

const BASE_CARRY_BY_CLASS: Record<string, number> = {
  warrior: 200,
  caster: 100,
  mage: 100,
  ranger: 150,
  rogue: 150,
};

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const roundTo = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const asArray = (value: unknown): any[] => {
  return Array.isArray(value) ? [...value] : [];
};

const isConsumable = (item: any) => {
  return !!item && typeof item === 'object' && item.type === 'consumable';
};

const readSlotValue = (item: any, keys: string[]): number => {
  if (!item || typeof item !== 'object') return 0;
  const stats = item.stats && typeof item.stats === 'object' ? item.stats : {};
  for (const key of keys) {
    const raw = (item as any)?.[key] ?? (stats as any)?.[key];
    const parsed = readNumber(raw, 0);
    if (parsed > 0) return Math.floor(parsed);
  }
  return 0;
};

export const getInventoryCapacities = (equipment: any): InventoryCapacities => {
  const bagItem = equipment?.bag || null;
  const beltItem = equipment?.belt || null;

  const bagSlots = readSlotValue(bagItem, ['bagSlots', 'slots', 'storageSlots']);
  const beltBase = readSlotValue(beltItem, ['beltSlots', 'consumableSlots', 'slots']);
  const beltBonus = readSlotValue(beltItem, ['consumableSlotsBonus', 'beltSlotsBonus']);

  const bagCapacity = Math.max(
    STARTING_BAG_CAPACITY,
    Math.min(BAG_CAPACITY, bagSlots || STARTING_BAG_CAPACITY)
  );

  const effectiveBelt = beltBase > 0 ? beltBase : STARTING_BELT_CAPACITY + beltBonus;
  const beltCapacity = Math.max(
    STARTING_BELT_CAPACITY,
    Math.min(CONSUMABLE_STASH_CAPACITY, effectiveBelt)
  );

  return { bagCapacity, beltCapacity };
};

const resolveClassCarryBase = (classArchetype: unknown): number => {
  const normalized = String(classArchetype || 'warrior').toLowerCase();
  return BASE_CARRY_BY_CLASS[normalized] ?? BASE_CARRY_BY_CLASS.warrior;
};

const readItemStackAmount = (item: any): number => {
  return Math.max(1, Math.floor(readNumber(item?.amount, readNumber(item?.amout, 1))));
};

export const getItemWeight = (item: any): number => {
  if (!item || typeof item !== 'object') return 0;
  const explicit = readNumber(item.weight, NaN);
  const stackAmount = readItemStackAmount(item);
  if (Number.isFinite(explicit) && explicit > 0) {
    return roundTo(explicit * stackAmount, 2);
  }

  const type = String(item.type || '').toLowerCase();
  const stats = item.stats && typeof item.stats === 'object' ? item.stats : {};
  const defence = Math.max(
    0,
    readNumber(stats.defence, readNumber((item as any).defence, readNumber((item as any).Defense, 0)))
  );
  const damage = Math.max(
    0,
    readNumber(stats.damage, readNumber((item as any).damage, readNumber((item as any)['1H Damage'], 0)))
  );

  let unitWeight = 3;
  if (type === 'ring' || type === 'amulet') {
    unitWeight = 1;
  } else if (type === 'consumable') {
    unitWeight = 1;
  } else if (type === 'currency') {
    unitWeight = 0.05;
  } else if (type === 'weapon' || type === 'sword' || type === 'dagger') {
    unitWeight = Math.max(8, Math.min(42, 14 + damage * 2.4));
  } else if (type === 'armor' || type === 'armors') {
    unitWeight = Math.max(12, Math.min(65, 24 + defence * 2.8));
  } else if (type === 'offhand' || type === 'shield') {
    unitWeight = Math.max(5, Math.min(30, 9 + defence * 1.9));
  } else if (type === 'helmet' || type === 'helm' || type === 'helms') {
    unitWeight = Math.max(3, Math.min(20, 6 + defence * 1.35));
  } else if (type === 'boots' || type === 'gloves') {
    unitWeight = Math.max(2, Math.min(14, 4 + defence * 0.9));
  } else if (type === 'belt') {
    unitWeight = 4;
  } else if (type === 'bag' || type === 'bags' || type === 'backpack' || type === 'pouch') {
    unitWeight = 3;
  }

  return roundTo(unitWeight * stackAmount, 2);
};

const sumItemsWeight = (items: unknown): number => {
  return asArray(items).reduce((sum, entry) => sum + getItemWeight(entry), 0);
};

export const getCarryCapacity = (classArchetype: unknown, stats: Record<string, any> | null | undefined): number => {
  const base = resolveClassCarryBase(classArchetype);
  const strength = Math.max(0, readNumber(stats?.strength, 0));
  return Math.max(10, roundTo(base + strength * 2, 2));
};

export const getCurrentCarryWeight = (
  inventoryInput: unknown,
  stashInput: unknown,
  equipmentInput: unknown
): number => {
  const inventoryWeight = sumItemsWeight(inventoryInput);
  const stashWeight = sumItemsWeight(stashInput);
  const equippedItems = Object.values((equipmentInput as Record<string, any>) || {}).filter((entry: any) => {
    return !!entry && typeof entry === 'object' && !!entry.name;
  });
  const equippedWeight = sumItemsWeight(equippedItems);
  return roundTo(inventoryWeight + stashWeight + equippedWeight, 2);
};

export const getCarryLoadSummary = (params: {
  classArchetype?: unknown;
  stats?: Record<string, any> | null;
  inventory?: unknown;
  consumableStash?: unknown;
  equipment?: unknown;
}): CarryLoadSummary => {
  const max = getCarryCapacity(params.classArchetype, params.stats || {});
  const used = getCurrentCarryWeight(params.inventory, params.consumableStash, params.equipment);
  const remaining = roundTo(max - used, 2);
  return {
    used,
    max,
    remaining,
    overloaded: remaining < 0,
  };
};

export const isCurrencyItem = (item: any) => {
  return !!item && typeof item === 'object' && item.type === 'currency';
};

export const readCurrencyGoldValue = (item: any): number => {
  if (!isCurrencyItem(item)) return 0;
  const unitValue = readNumber(item.value, 0);
  const quantity = Math.max(1, Math.floor(readNumber(item.amount, readNumber(item.amout, 1))));
  return roundTo(unitValue * quantity, 2);
};

export const extractCurrencyFromBag = (
  inventoryInput: unknown
): { inventoryWithoutCurrency: any[]; goldFromCurrency: number } => {
  const inventory = asArray(inventoryInput);
  let goldFromCurrency = 0;
  const inventoryWithoutCurrency: any[] = [];

  inventory.forEach((item) => {
    if (isCurrencyItem(item)) {
      goldFromCurrency = roundTo(goldFromCurrency + readCurrencyGoldValue(item), 2);
      return;
    }
    inventoryWithoutCurrency.push(item);
  });

  return { inventoryWithoutCurrency, goldFromCurrency };
};

export const normalizeInventoryContainers = (
  inventoryInput: unknown,
  stashInput: unknown,
  capacities?: Partial<InventoryCapacities>
): InventoryContainers => {
  const rawInventory = asArray(inventoryInput);
  const rawStash = asArray(stashInput);
  const bagCapacity = Math.max(1, Math.min(BAG_CAPACITY, Math.floor(capacities?.bagCapacity ?? BAG_CAPACITY)));
  const beltCapacity = Math.max(
    1,
    Math.min(CONSUMABLE_STASH_CAPACITY, Math.floor(capacities?.beltCapacity ?? CONSUMABLE_STASH_CAPACITY))
  );

  // Stash is manual-only: we keep only what is explicitly in stash.
  const nextStash = rawStash.filter(isConsumable).slice(0, beltCapacity);
  const nextBag = rawInventory.slice(0, bagCapacity);

  return {
    inventory: nextBag,
    consumableStash: nextStash,
  };
};

export const tryStoreItem = (
  containers: InventoryContainers,
  item: any,
  capacities?: Partial<InventoryCapacities>
): { next: InventoryContainers; storedIn: 'stash' | 'bag' | null } => {
  const bagCapacity = Math.max(1, Math.min(BAG_CAPACITY, Math.floor(capacities?.bagCapacity ?? BAG_CAPACITY)));
  const normalized = normalizeInventoryContainers(containers.inventory, containers.consumableStash, capacities);
  const nextBag = [...normalized.inventory];
  const nextStash = [...normalized.consumableStash];

  if (nextBag.length < bagCapacity) {
    nextBag.push(item);
    return {
      next: { inventory: nextBag, consumableStash: nextStash },
      storedIn: 'bag',
    };
  }

  return {
    next: { inventory: nextBag, consumableStash: nextStash },
    storedIn: null,
  };
};
