export const BAG_CAPACITY = 16;
export const CONSUMABLE_STASH_CAPACITY = 4;

export interface InventoryContainers {
  inventory: any[];
  consumableStash: any[];
}

const asArray = (value: unknown): any[] => {
  return Array.isArray(value) ? [...value] : [];
};

const isConsumable = (item: any) => {
  return !!item && typeof item === 'object' && item.type === 'consumable';
};

export const normalizeInventoryContainers = (
  inventoryInput: unknown,
  stashInput: unknown
): InventoryContainers => {
  const rawInventory = asArray(inventoryInput);
  const rawStash = asArray(stashInput);

  // Preserve explicit stash entries first, capped by stash capacity.
  const normalizedStash = rawStash.filter(isConsumable).slice(0, CONSUMABLE_STASH_CAPACITY);

  // If legacy saves stored consumables in the main bag, migrate into stash first.
  const remainingStashSlots = Math.max(0, CONSUMABLE_STASH_CAPACITY - normalizedStash.length);
  const migratedFromBag: any[] = [];
  const bagWithoutMigratedConsumables: any[] = [];

  rawInventory.forEach((item) => {
    if (isConsumable(item) && migratedFromBag.length < remainingStashSlots) {
      migratedFromBag.push(item);
      return;
    }
    bagWithoutMigratedConsumables.push(item);
  });

  const nextStash = [...normalizedStash, ...migratedFromBag];
  const nextBag = bagWithoutMigratedConsumables.slice(0, BAG_CAPACITY);

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

  if (isConsumable(item) && nextStash.length < CONSUMABLE_STASH_CAPACITY) {
    nextStash.push(item);
    return {
      next: { inventory: nextBag, consumableStash: nextStash },
      storedIn: 'stash',
    };
  }

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
