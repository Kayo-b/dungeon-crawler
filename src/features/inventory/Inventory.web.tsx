import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { restoreHealth, restoreMana, setCombatLog, setEquipment, setGold } from '../../features/player/playerSlice';
import { setAllInventory } from './inventorySlice';
import { ItemIcon } from '../../components/ItemIcon';
import {
  getCarryLoadSummary,
  STARTING_BAG_CAPACITY,
  STARTING_BELT_CAPACITY,
  getInventoryCapacities,
  normalizeInventoryContainers,
  readCurrencyGoldValue,
} from './inventoryUtils';

interface EquipmentSlot {
  key: string;
  label: string;
  type: string;
  item: any;
  x: number;
  y: number;
  w: number;
  h: number;
  thin?: boolean;
}

type NavGroup = 'bag' | 'belt' | 'equipment';

const RETRO_FONT = '"Press Start 2P", "Courier New", monospace';
const BAG_COLUMNS = 4;
const BELT_COLUMNS = 4;
const EQUIPMENT_COLUMNS = 3;
const FLOOR_DROP_EVENT = 'dungeon:drop-items-to-floor';

const normalizeToSlot = (itemType: string) => {
  if (itemType === 'shield') return 'offhand';
  if (itemType === 'sword' || itemType === 'dagger') return 'weapon';
  if (itemType === 'armors') return 'armor';
  if (itemType === 'helm' || itemType === 'helms') return 'helmet';
  if (itemType === 'bags' || itemType === 'backpack' || itemType === 'pouch') return 'bag';
  return itemType;
};

const slotAcceptsItem = (slotType: string, itemType: string) => {
  if (slotType === 'offhand') {
    return itemType === 'offhand' || itemType === 'shield';
  }
  if (slotType === 'weapon') {
    return itemType === 'weapon' || itemType === 'sword' || itemType === 'dagger';
  }
  if (slotType === 'armor') {
    return itemType === 'armor' || itemType === 'armors';
  }
  if (slotType === 'helmet') {
    return itemType === 'helmet' || itemType === 'helm' || itemType === 'helms';
  }
  if (slotType === 'bag') {
    return itemType === 'bag' || itemType === 'bags' || itemType === 'backpack' || itemType === 'pouch';
  }
  return slotType === itemType;
};

const ensureStarterContainers = (equipmentState: Record<string, any>) => {
  const next = { ...(equipmentState || {}) };
  if (!next.bag?.name) {
    next.bag = { name: 'Small Pouch', type: 'bag', stats: { bagSlots: STARTING_BAG_CAPACITY } };
  }
  if (!next.belt?.name) {
    next.belt = { name: 'Starter Belt', type: 'belt', stats: { consumableSlots: STARTING_BELT_CAPACITY } };
  }
  return next;
};

const defaultEquipmentForSlot = (slotKey: string) => {
  if (slotKey === 'bag') {
    return { name: 'Small Pouch', type: 'bag', stats: { bagSlots: STARTING_BAG_CAPACITY } };
  }
  if (slotKey === 'belt') {
    return { name: 'Starter Belt', type: 'belt', stats: { consumableSlots: STARTING_BELT_CAPACITY } };
  }
  return { name: '', type: slotKey, stats: {} };
};

const buildItemDetails = (item: any) => {
  if (!item) return [];

  if (item.type === 'consumable') {
    const hpAmount = item.stats?.amount ?? 0;
    const manaAmount = item.stats?.mana ?? 0;
    const lines: string[] = [];
    if (hpAmount > 0) {
      lines.push(`Use: Restore ${hpAmount} HP`);
    }
    if (manaAmount > 0) {
      lines.push(`Use: Restore ${manaAmount} Mana`);
    }
    return lines.length > 0 ? lines : ['Use: Consumable'];
  }

  if (item.type === 'currency') {
    return [`Currency value: ${item.value ?? 0}`];
  }

  const lines: string[] = [];
  if (item.stats) {
    Object.entries(item.stats).forEach(([key, value]) => {
      lines.push(`${key}: ${String(value)}`);
    });
  }
  if (Array.isArray(item.mods)) {
    item.mods.forEach((mod: string) => lines.push(mod));
  }
  return lines.length > 0 ? lines : ['No special stats'];
};

export const Inventory = () => {
  const dispatch = useAppDispatch();
  const inventory = useAppSelector((state) => state.inventory.inventory as any[]);
  const consumableStash = useAppSelector((state) => state.inventory.consumableStash as any[]);
  const equipment = useAppSelector((state) => state.player.equipment as Record<string, any>);
  const currentMapId = useAppSelector((state) => state.room.currentMapId);
  const playerPosX = useAppSelector((state) => state.room.posX);
  const playerPosY = useAppSelector((state) => state.room.posY);
  const classArchetype = useAppSelector((state) => state.player.classArchetype || 'warrior');
  const playerStats = useAppSelector((state) => state.player.stats as Record<string, any>);
  const playerHealth = useAppSelector((state) => state.player.health);
  const gold = useAppSelector((state) => state.player.gold || 0);

  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const isShiftDownRef = useRef(false);
  const bagShiftIntentRef = useRef<Record<number, boolean>>({});
  const beltShiftIntentRef = useRef<Record<number, boolean>>({});
  const bagButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const beltButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const equipmentButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeNav, setActiveNav] = useState<{ group: NavGroup; index: number } | null>(null);

  const capacities = useMemo(() => getInventoryCapacities(equipment), [equipment]);
  const loadSummary = useMemo(
    () =>
      getCarryLoadSummary({
        classArchetype,
        stats: playerStats,
        inventory,
        consumableStash,
        equipment,
      }),
    [classArchetype, playerStats, inventory, consumableStash, equipment]
  );

  const equipmentSlots: EquipmentSlot[] = useMemo(() => {
    return [
      { key: 'amulet', label: 'AMULET', type: 'amulet', item: equipment?.amulet, x: 4, y: 32, w: 38, h: 38 },
      { key: 'weapon', label: 'WEAPON', type: 'weapon', item: equipment?.weapon, x: 4, y: 74, w: 38, h: 38 },
      { key: 'ring', label: 'RING', type: 'ring', item: equipment?.ring, x: 4, y: 116, w: 38, h: 38 },
      { key: 'helmet', label: 'HEAD', type: 'helmet', item: equipment?.helmet, x: 46, y: 4, w: 38, h: 38 },
      { key: 'armor', label: 'CHEST', type: 'armor', item: equipment?.armor, x: 46, y: 46, w: 38, h: 38 },
      { key: 'boots', label: 'BOOTS', type: 'boots', item: equipment?.boots, x: 46, y: 130, w: 38, h: 38 },
      { key: 'bag', label: 'BAG', type: 'bag', item: equipment?.bag, x: 88, y: 4, w: 38, h: 38 },
      { key: 'offhand', label: 'OFF', type: 'offhand', item: equipment?.offhand, x: 88, y: 46, w: 38, h: 38 },
      { key: 'belt', label: 'BELT', type: 'belt', item: equipment?.belt, x: 88, y: 88, w: 38, h: 14, thin: true },
    ];
  }, [equipment]);

  const focusNavTarget = (group: NavGroup, nextIndex: number) => {
    const refs =
      group === 'bag'
        ? bagButtonRefs.current
        : group === 'belt'
          ? beltButtonRefs.current
          : equipmentButtonRefs.current;
    const total = refs.length;
    if (total <= 0) return;
    const wrapped = ((nextIndex % total) + total) % total;
    setActiveNav({ group, index: wrapped });
    const node = refs[wrapped];
    if (node?.focus) {
      node.focus();
    }
  };

  const moveNavByKey = (key: string) => {
    if (!activeNav) return false;

    const { group, index } = activeNav;
    const refs =
      group === 'bag'
        ? bagButtonRefs.current
        : group === 'belt'
          ? beltButtonRefs.current
          : equipmentButtonRefs.current;
    const total = refs.length;
    if (total <= 0) return false;

    const columns = group === 'bag' ? BAG_COLUMNS : group === 'belt' ? BELT_COLUMNS : EQUIPMENT_COLUMNS;
    let nextIndex = index;

    if (key === 'ArrowRight') nextIndex += 1;
    else if (key === 'ArrowLeft') nextIndex -= 1;
    else if (key === 'ArrowDown') nextIndex += columns;
    else if (key === 'ArrowUp') nextIndex -= columns;
    else return false;

    focusNavTarget(group, nextIndex);
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftDownRef.current = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftDownRef.current = false;
      }
    };
    const onBlur = () => {
      isShiftDownRef.current = false;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocusBag = () => {
      setTimeout(() => focusNavTarget('bag', 0), 0);
    };

    window.addEventListener('dungeon:focus-bag', onFocusBag as EventListener);
    return () => window.removeEventListener('dungeon:focus-bag', onFocusBag as EventListener);
  }, []);

  const isShiftAction = (event: MouseEvent<HTMLButtonElement>) => {
    return !!(event.shiftKey || event.nativeEvent?.shiftKey || isShiftDownRef.current);
  };

  const isDeleteAction = (event: MouseEvent<HTMLButtonElement>) => {
    return !!(event.ctrlKey && (event.shiftKey || event.nativeEvent?.shiftKey || isShiftDownRef.current));
  };

  const isFloorDropAction = (event: MouseEvent<HTMLButtonElement>) => {
    const ctrlHeld = !!(event.ctrlKey || event.nativeEvent?.ctrlKey);
    const shiftHeld = !!(event.shiftKey || event.nativeEvent?.shiftKey || isShiftDownRef.current);
    return ctrlHeld && !shiftHeld;
  };

  const emitFloorDropItems = (items: any[]) => {
    const payload = Array.isArray(items) ? items.filter(Boolean) : [];
    if (payload.length <= 0) return;
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(
      new CustomEvent(FLOOR_DROP_EVENT, {
        detail: {
          items: payload,
          mapId: String(currentMapId || ''),
          x: playerPosX,
          y: playerPosY,
        },
      })
    );
  };

  const confirmPermanentDrop = (itemName: string) => {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    return window.confirm(`Drop ${itemName} on the floor? It will be deleted permanently.`);
  };

  const loadCharacterState = async () => {
    const dataChar = await AsyncStorage.getItem('characters');
    const objChar = dataChar ? JSON.parse(dataChar) : {};
    if (!objChar?.character) return null;

    const equipmentState = ensureStarterContainers(objChar.character.equipment || {});
    const normalized = normalizeInventoryContainers(
      objChar.character.inventory,
      objChar.character.consumableStash,
      getInventoryCapacities(equipmentState)
    );

    return {
      objChar,
      bag: [...normalized.inventory],
      stash: [...normalized.consumableStash],
      equipmentState,
    };
  };

  const persistCharacterState = async (
    objChar: any,
    bag: any[],
    stash: any[],
    equipmentState: Record<string, any>
  ) => {
    const normalized = normalizeInventoryContainers(
      bag,
      stash,
      getInventoryCapacities(equipmentState)
    );

    objChar.character.inventory = normalized.inventory;
    objChar.character.consumableStash = normalized.consumableStash;
    objChar.character.equipment = equipmentState;

    dispatch(setAllInventory({ inventory: normalized.inventory, consumableStash: normalized.consumableStash }));
    dispatch(setEquipment({ ...equipmentState }));
    await AsyncStorage.setItem('characters', JSON.stringify(objChar));
  };

  const deleteBagItem = async (bagIndex: number) => {
    const loaded = await loadCharacterState();
    if (!loaded) return;
    const { objChar, bag, stash, equipmentState } = loaded;
    const target = bag[bagIndex];
    if (!target) return;
    const itemName = target.name || 'item';
    if (!confirmPermanentDrop(itemName)) return;
    bag.splice(bagIndex, 1);
    await persistCharacterState(objChar, bag, stash, equipmentState);
    dispatch(setCombatLog(`Dropped ${itemName}. Item deleted.`));
  };

  const dropBagItemToFloor = async (bagIndex: number) => {
    const loaded = await loadCharacterState();
    if (!loaded) return;
    const { objChar, bag, stash, equipmentState } = loaded;
    const target = bag[bagIndex];
    if (!target) return;
    const itemName = target.name || 'item';
    const droppedItem = { ...target };
    bag.splice(bagIndex, 1);
    await persistCharacterState(objChar, bag, stash, equipmentState);
    emitFloorDropItems([droppedItem]);
    dispatch(setCombatLog(`Dropped ${itemName} on the floor.`));
  };

  const deleteBeltItem = async (stashIndex: number) => {
    const loaded = await loadCharacterState();
    if (!loaded) return;
    const { objChar, bag, stash, equipmentState } = loaded;
    const target = stash[stashIndex];
    if (!target) return;
    const itemName = target.name || 'item';
    if (!confirmPermanentDrop(itemName)) return;
    stash.splice(stashIndex, 1);
    await persistCharacterState(objChar, bag, stash, equipmentState);
    dispatch(setCombatLog(`Dropped ${itemName}. Item deleted.`));
  };

  const deleteEquippedItem = async (slotKey: string) => {
    const loaded = await loadCharacterState();
    if (!loaded) return;
    const { objChar, bag, stash, equipmentState } = loaded;
    const equippedItem = equipmentState?.[slotKey];
    if (!equippedItem?.name) return;
    const itemName = equippedItem.name || 'item';
    if (!confirmPermanentDrop(itemName)) return;

    const nextEquipment = { ...equipmentState };
    if (slotKey === 'bag' || slotKey === 'belt') {
      nextEquipment[slotKey] = defaultEquipmentForSlot(slotKey);
    } else {
      nextEquipment[slotKey] = { name: '', type: slotKey, stats: {} };
    }

    await persistCharacterState(objChar, bag, stash, nextEquipment);
    dispatch(setCombatLog(`Dropped ${itemName}. Item deleted.`));
  };

  const useOrEquipBagItem = async (index: number) => {
    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;
      const activeItem = bag[index];
      if (!activeItem) return;

      if (activeItem.type === 'currency') {
        const gainedGold = readCurrencyGoldValue(activeItem);
        if (gainedGold > 0) {
          const nextGold = Number((Math.max(0, Number(objChar.character.gold || 0)) + gainedGold).toFixed(2));
          bag.splice(index, 1);
          objChar.character.gold = nextGold;
          dispatch(setGold(nextGold));
          dispatch(setCombatLog(`Collected ${gainedGold} gold.`));
          await persistCharacterState(objChar, bag, stash, equipmentState);
        }
        return;
      }

      if (activeItem.type === 'consumable') {
        const hpAmount = activeItem.stats?.amount || 0;
        const manaAmount = activeItem.stats?.mana || 0;
        const effectSegments: string[] = [];

        if (hpAmount > 0) {
          dispatch(restoreHealth(hpAmount));
          objChar.character.stats.health = playerHealth + hpAmount;
          effectSegments.push(`+${hpAmount} HP`);
        }
        if (manaAmount > 0) {
          dispatch(restoreMana(manaAmount));
          effectSegments.push(`+${manaAmount} Mana`);
        }

        const effectText = effectSegments.length > 0 ? effectSegments.join(', ') : 'No effect';
        dispatch(setCombatLog(`Used ${activeItem.name || 'Consumable'} (${effectText}).`));
        bag.splice(index, 1);
        await persistCharacterState(objChar, bag, stash, equipmentState);
        return;
      }

      const slotType = normalizeToSlot(activeItem.type);
      if (!slotAcceptsItem(slotType, activeItem.type)) return;

      const nextEquipmentState = { ...equipmentState };
      const nextBag = [...bag];
      const nextStash = [...stash];
      const currentEquippedItem = nextEquipmentState[slotType];

      if (!nextEquipmentState[slotType]) {
        nextEquipmentState[slotType] = { name: '', type: slotType, stats: {} };
      }

      nextBag.splice(index, 1);
      if (currentEquippedItem?.name) {
        nextBag.push(currentEquippedItem);
      }
      nextEquipmentState[slotType] = activeItem;

      const nextCapacities = getInventoryCapacities(nextEquipmentState);
      if (nextBag.length > nextCapacities.bagCapacity) {
        dispatch(setCombatLog('Not enough space for that equipment swap.'));
        return;
      }
      if (nextStash.length > nextCapacities.beltCapacity) {
        dispatch(setCombatLog('New belt cannot hold your current consumables.'));
        return;
      }

      await persistCharacterState(objChar, nextBag, nextStash, nextEquipmentState);
    } catch (error) {
      console.error('Error using/equipping bag item:', error);
    }
  };

  const moveBagConsumableToBelt = async (bagIndex: number) => {
    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;
      const selectedItem = bag[bagIndex];

      if (!selectedItem) return;
      if (selectedItem.type !== 'consumable') {
        dispatch(setCombatLog('Only consumables can be moved to belt.'));
        return;
      }

      const caps = getInventoryCapacities(equipmentState);
      if (stash.length >= caps.beltCapacity) {
        dispatch(setCombatLog('Belt is full.'));
        return;
      }

      bag.splice(bagIndex, 1);
      stash.push(selectedItem);
      await persistCharacterState(objChar, bag, stash, equipmentState);
      dispatch(setCombatLog(`Moved ${selectedItem.name || 'Consumable'} to belt.`));
    } catch (error) {
      console.error('Error moving item to belt:', error);
    }
  };

  const moveStashItemToBag = async (stashIndex: number) => {
    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;
      const item = stash[stashIndex];
      if (!item) return;

      const caps = getInventoryCapacities(equipmentState);
      if (bag.length >= caps.bagCapacity) {
        dispatch(setCombatLog('Bag is full.'));
        return;
      }

      stash.splice(stashIndex, 1);
      bag.push(item);
      await persistCharacterState(objChar, bag, stash, equipmentState);
      dispatch(setCombatLog(`Moved ${item.name || 'Consumable'} to bag.`));
    } catch (error) {
      console.error('Error moving item to bag:', error);
    }
  };

  const moveEquipmentItemToBag = async (slotKey: string) => {
    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;
      const item = equipmentState?.[slotKey];
      if (!item?.name) return;

      if (slotKey === 'bag' && bag.length + 1 > STARTING_BAG_CAPACITY) {
        dispatch(setCombatLog('Cannot unequip bag while carrying too many items.'));
        return;
      }
      if (slotKey === 'belt' && stash.length > STARTING_BELT_CAPACITY) {
        dispatch(setCombatLog('Cannot unequip belt while belt slots are occupied.'));
        return;
      }

      const caps = getInventoryCapacities(equipmentState);
      if (bag.length >= caps.bagCapacity) {
        dispatch(setCombatLog('Bag is full.'));
        return;
      }

      const nextEquipment = { ...equipmentState };
      bag.push(item);
      nextEquipment[slotKey] = defaultEquipmentForSlot(slotKey);

      await persistCharacterState(objChar, bag, stash, nextEquipment);
      dispatch(setCombatLog(`Moved ${item.name || 'Item'} to bag.`));
    } catch (error) {
      console.error('Error moving equipped item to bag:', error);
    }
  };

  const bagSize = Math.min(inventory.length, capacities.bagCapacity);
  const beltSize = Math.min(consumableStash.length, capacities.beltCapacity);
  const equippedBagName = equipment?.bag?.name || 'Small Pouch';
  const formatLoadValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

  return (
    <div
      style={styles.root}
      data-nav-scope="ui"
      onKeyDownCapture={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (moveNavByKey(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {hoveredItem && (
        <div style={styles.tooltipOverlay}>
          <div style={styles.tooltipTitle}>{hoveredItem.name || 'Unknown Item'}</div>
          {buildItemDetails(hoveredItem).map((line, index) => (
            <div key={`${line}-${index}`} style={styles.tooltipLine}>
              {line}
            </div>
          ))}
        </div>
      )}

      <div style={styles.windowFrame}>
        <div style={styles.windowHeaderRow}>
          <span style={styles.windowHeader}>Inventory</span>
          <span style={styles.windowHeaderRight}>EQ</span>
        </div>
        <div style={styles.equipmentBoard}>
          {equipmentSlots.map((slot, index) => {
            const item = slot.item?.name ? slot.item : null;
            return (
              <button
                key={slot.key}
                type="button"
                ref={(node) => {
                  equipmentButtonRefs.current[index] = node;
                }}
                style={{
                  ...styles.equipSlot,
                  left: slot.x,
                  top: slot.y,
                  width: slot.w,
                  height: slot.h,
                  ...(slot.thin ? styles.equipSlotThin : null),
                }}
                tabIndex={0}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (item?.name && isDeleteAction(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteEquippedItem(slot.key);
                    return;
                  }
                  if (item?.name) {
                    void moveEquipmentItemToBag(slot.key);
                  }
                }}
                onFocus={() => setActiveNav({ group: 'equipment', index })}
                onMouseEnter={() => item && setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {item ? (
                  <ItemIcon type={item.type || slot.type} size={slot.thin ? 10 : 15} itemName={item.name} itemStats={item.stats} />
                ) : null}
                <span style={styles.slotHint}>{slot.label}</span>
              </button>
            );
          })}

          <div style={styles.statusRow}>
            <div style={styles.statusCard}>
              <span style={styles.statusLabel}>Belt</span>
              <span style={styles.statusValue}>{beltSize}/{capacities.beltCapacity}</span>
            </div>
            <div style={styles.statusCard}>
              <span style={styles.statusLabel}>Bag</span>
              <span style={styles.statusValue}>{bagSize}/{capacities.bagCapacity}</span>
            </div>
          </div>
          <div style={{ ...styles.loadLine, ...(loadSummary.overloaded ? styles.loadLineWarn : null) }}>
            Load {formatLoadValue(loadSummary.used)}/{formatLoadValue(loadSummary.max)}
          </div>
        </div>
      </div>

      <div style={styles.windowFrame}>
        <div style={styles.windowHeaderRow}>
          <span style={styles.windowHeader}>{equippedBagName}</span>
          <span style={styles.windowHeaderRight}>Gold {gold}</span>
        </div>

        <div style={styles.beltStripTitle}>Belt Slots</div>
        <div style={styles.beltGrid}>
          {Array.from({ length: capacities.beltCapacity }).map((_, slotIndex) => {
            const item = consumableStash[slotIndex];
            return (
              <button
                key={`stash-slot-${slotIndex}`}
                type="button"
                ref={(node) => {
                  beltButtonRefs.current[slotIndex] = node;
                }}
                style={{ ...styles.beltCell, ...(!item ? styles.beltCellEmpty : null) }}
                tabIndex={0}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (!item) return;
                  if (isDeleteAction(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteBeltItem(slotIndex);
                    return;
                  }
                  const shiftIntent = isShiftAction(event) || !!beltShiftIntentRef.current[slotIndex];
                  beltShiftIntentRef.current[slotIndex] = false;
                  if (!shiftIntent) {
                    dispatch(setCombatLog('Use Shift + Left Click to move from belt to bag.'));
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  void moveStashItemToBag(slotIndex);
                }}
                onFocus={() => setActiveNav({ group: 'belt', index: slotIndex })}
                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                  beltShiftIntentRef.current[slotIndex] = isShiftAction(event);
                }}
                onMouseEnter={() => item && setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {item ? <ItemIcon type={item.type} size={14} itemName={item.name} itemStats={item.stats} /> : null}
              </button>
            );
          })}
        </div>

        <div style={styles.bagGridWrap}>
          <div style={styles.bagGrid}>
            {Array.from({ length: capacities.bagCapacity }).map((_, index) => {
              const item = inventory[index];
              return (
                <button
                  key={`bag-slot-${index}`}
                  type="button"
                  ref={(node) => {
                    bagButtonRefs.current[index] = node;
                  }}
                  style={{ ...styles.bagCell, ...(!item ? styles.bagCellEmpty : null) }}
                  tabIndex={0}
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    if (!item) return;
                    if (isDeleteAction(event)) {
                      event.preventDefault();
                      event.stopPropagation();
                      void deleteBagItem(index);
                      return;
                    }
                    if (isFloorDropAction(event)) {
                      event.preventDefault();
                      event.stopPropagation();
                      void dropBagItemToFloor(index);
                      return;
                    }
                    const shiftIntent = isShiftAction(event) || !!bagShiftIntentRef.current[index];
                    bagShiftIntentRef.current[index] = false;
                    if (item.type === 'consumable' && shiftIntent) {
                      event.preventDefault();
                      event.stopPropagation();
                      void moveBagConsumableToBelt(index);
                      return;
                    }
                    void useOrEquipBagItem(index);
                  }}
                  onFocus={() => setActiveNav({ group: 'bag', index })}
                  onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                    bagShiftIntentRef.current[index] = isShiftAction(event);
                  }}
                  onMouseEnter={() => item && setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {item ? <ItemIcon type={item.type} size={18} itemName={item.name} itemStats={item.stats} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <span style={styles.helperText}>
          Shift + Left Click moves consumables. Ctrl + Left Click drops to floor. Ctrl + Shift + Left Click deletes item.
        </span>
      </div>
    </div>
  );
};

const panelFrame: CSSProperties = {
  background: 'linear-gradient(135deg, #2f3338 0%, #22262a 100%)',
  border: '2px solid #8c9095',
  boxShadow: 'inset 0 0 0 1px #121417, inset 0 0 0 2px #3a3e44',
  padding: 4,
};

const slotBase: CSSProperties = {
  border: '2px solid #535861',
  background: 'linear-gradient(135deg, #2a2e33 0%, #1f2327 100%)',
  boxShadow: 'inset 0 0 0 1px #15181b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  cursor: 'pointer',
  outline: 'none',
};

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    position: 'relative',
    fontFamily: RETRO_FONT,
    width: 136,
    pointerEvents: 'auto',
  },
  windowFrame: {
    ...panelFrame,
  },
  windowHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 2,
    borderBottom: '1px solid #5a5f66',
  },
  windowHeader: {
    color: '#f1f4f7',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  windowHeaderRight: {
    color: '#c7ccd2',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  equipmentBoard: {
    position: 'relative',
    width: 130,
    height: 196,
    border: '2px solid #656a72',
    background: 'linear-gradient(145deg, #2b3036 0%, #22262b 100%)',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  equipSlot: {
    ...slotBase,
    position: 'absolute',
    padding: 2,
  },
  equipSlotThin: {
    padding: 1,
  },
  slotHint: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    fontSize: 5,
    color: '#959ca5',
    textTransform: 'uppercase',
    letterSpacing: 0,
    pointerEvents: 'none',
  },
  statusRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
  },
  statusCard: {
    border: '2px solid #6d7279',
    background: '#171a1d',
    padding: '2px 2px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statusLabel: {
    color: '#b7bdc5',
    fontSize: 6,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#f7fafb',
    fontSize: 7,
    textTransform: 'uppercase',
  },
  loadLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 32,
    textAlign: 'center',
    color: '#cfd4da',
    fontSize: 6,
    textTransform: 'uppercase',
  },
  loadLineWarn: {
    color: '#ff8b8b',
  },
  beltStripTitle: {
    color: '#d9dde2',
    fontSize: 6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  beltGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 2,
    marginBottom: 3,
    minHeight: 20,
  },
  beltCell: {
    width: 16,
    height: 14,
    border: '1px solid #6a6f77',
    background: '#22262b',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
    padding: 1,
  },
  beltCellEmpty: {
    opacity: 0.55,
    cursor: 'default',
  },
  bagGridWrap: {
    maxHeight: 142,
    overflowY: 'auto',
    border: '1px solid #4f545c',
    background: '#171b1f',
    padding: 4,
  },
  bagGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 2,
  },
  bagCell: {
    width: 28,
    height: 28,
    border: '1px solid #6a6f77',
    background: 'linear-gradient(145deg, #2a2f34 0%, #1f2328 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
    outline: 'none',
  },
  bagCellEmpty: {
    opacity: 0.52,
    cursor: 'default',
  },
  helperText: {
    color: '#9ea5ad',
    fontSize: 5,
    marginTop: 4,
    display: 'block',
    textTransform: 'uppercase',
    lineHeight: 1.5,
  },
  tooltipOverlay: {
    position: 'absolute',
    right: 138,
    top: 0,
    maxWidth: 220,
    background: '#13171b',
    border: '2px solid #7a8088',
    boxShadow: 'inset 0 0 0 1px #20252b',
    padding: 8,
    zIndex: 20,
    pointerEvents: 'none',
  },
  tooltipTitle: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tooltipLine: {
    color: '#d6dbe0',
    fontSize: 7,
    lineHeight: 1.5,
  },
};
