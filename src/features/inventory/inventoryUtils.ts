export const BAG_CAPACITY = 16;
export const CONSUMABLE_STASH_CAPACITY = 4;

export interface InventoryContainers {
  inventory: any[];
  consumableStash: any[];
}

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
  stashInput: unknown
): InventoryContainers => {
  const rawInventory = asArray(inventoryInput);
  const rawStash = asArray(stashInput);

  // Stash is manual-only: we keep only what is explicitly in stash.
  const nextStash = rawStash.filter(isConsumable).slice(0, CONSUMABLE_STASH_CAPACITY);
  const nextBag = rawInventory.slice(0, BAG_CAPACITY);

  return {
    inventory: nextBag,
    consumableStash: nextStash,
  };
};

export const tryStoreItem = (
  containers: InventoryContainers,
  item: any
): { next: InventoryContainers; storedIn: 'stash' | 'bag' | null } => {
  const normalized = normalizeInventoryContainers(containers.inventory, containers.consumableStash);
  const nextBag = [...normalized.inventory];
  const nextStash = [...normalized.consumableStash];

  if (nextBag.length < BAG_CAPACITY) {
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
