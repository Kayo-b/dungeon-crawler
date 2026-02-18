import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { restoreHealth, restoreMana, setCombatLog, setEquipment, setGold } from '../../features/player/playerSlice';
import { setAllInventory } from './inventorySlice';
import { ItemIcon } from '../../components/ItemIcon';
import {
  BAG_CAPACITY,
  CONSUMABLE_STASH_CAPACITY,
  normalizeInventoryContainers,
  readCurrencyGoldValue,
} from './inventoryUtils';

interface EquipmentSlot {
  key: string;
  label: string;
  type: string;
  item: any;
}

export const Inventory = () => {
  const dispatch = useAppDispatch();
  const inventory = useAppSelector((state) => state.inventory.inventory as any[]);
  const consumableStash = useAppSelector((state) => state.inventory.consumableStash as any[]);
  const equipment = useAppSelector((state) => state.player.equipment as Record<string, any>);
  const playerHealth = useAppSelector((state) => state.player.health);
  const gold = useAppSelector((state) => state.player.gold || 0);

  const [equipmentOpen, setEquipmentOpen] = useState(true);
  const [bagOpen, setBagOpen] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const isShiftDownRef = useRef(false);
  const bagShiftIntentRef = useRef<Record<number, boolean>>({});
  const stashShiftIntentRef = useRef<Record<number, boolean>>({});
  const bagButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stashButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const equipmentButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeNav, setActiveNav] = useState<{ group: 'bag' | 'stash' | 'equipment'; index: number } | null>(null);

  const BAG_COLUMNS = 4;
  const STASH_COLUMNS = 4;
  const EQUIPMENT_COLUMNS = 4;

  const focusNavTarget = (group: 'bag' | 'stash' | 'equipment', nextIndex: number) => {
    const refs =
      group === 'bag' ? bagButtonRefs.current : group === 'stash' ? stashButtonRefs.current : equipmentButtonRefs.current;
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
      group === 'bag' ? bagButtonRefs.current : group === 'stash' ? stashButtonRefs.current : equipmentButtonRefs.current;
    const total = refs.length;
    if (total <= 0) return false;

    const columns = group === 'bag' ? BAG_COLUMNS : group === 'stash' ? STASH_COLUMNS : EQUIPMENT_COLUMNS;
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
      setBagOpen(true);
      setTimeout(() => focusNavTarget('bag', 0), 0);
    };

    window.addEventListener('dungeon:focus-bag', onFocusBag as EventListener);
    return () => window.removeEventListener('dungeon:focus-bag', onFocusBag as EventListener);
  }, []);

  const isShiftAction = (event: MouseEvent<HTMLButtonElement>) => {
    return !!(event.shiftKey || event.nativeEvent?.shiftKey || isShiftDownRef.current);
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
    return slotType === itemType;
  };

  const normalizeToSlot = (itemType: string) => {
    if (itemType === 'shield') return 'offhand';
    if (itemType === 'sword' || itemType === 'dagger') return 'weapon';
    if (itemType === 'armors') return 'armor';
    if (itemType === 'helm' || itemType === 'helms') return 'helmet';
    return itemType;
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

  const slots: EquipmentSlot[] = useMemo(() => {
    return [
      { key: 'weapon', label: 'Hand', type: 'weapon', item: equipment?.weapon },
      { key: 'offhand', label: 'Offhand', type: 'offhand', item: equipment?.offhand },
      { key: 'helmet', label: 'Head', type: 'helmet', item: equipment?.helmet },
      { key: 'armor', label: 'Chest', type: 'armor', item: equipment?.armor },
      { key: 'belt', label: 'Belt', type: 'belt', item: equipment?.belt },
      { key: 'ring', label: 'Ring', type: 'ring', item: equipment?.ring },
      { key: 'boots', label: 'Boots', type: 'boots', item: equipment?.boots },
    ];
  }, [equipment]);

  const loadCharacterState = async () => {
    const dataChar = await AsyncStorage.getItem('characters');
    const objChar = dataChar ? JSON.parse(dataChar) : {};
    if (!objChar?.character) return null;
    const normalized = normalizeInventoryContainers(
      objChar.character.inventory,
      objChar.character.consumableStash
    );
    return {
      objChar,
      bag: [...normalized.inventory],
      stash: [...normalized.consumableStash],
      equipmentState: { ...(objChar.character.equipment || {}) },
    };
  };

  const persistCharacterState = async (
    objChar: any,
    bag: any[],
    stash: any[],
    equipmentState: Record<string, any>
  ) => {
    const nextBag = bag.slice(0, BAG_CAPACITY);
    const nextStash = stash.slice(0, CONSUMABLE_STASH_CAPACITY);
    objChar.character.inventory = nextBag;
    objChar.character.consumableStash = nextStash;
    objChar.character.equipment = equipmentState;
    dispatch(setAllInventory({ inventory: nextBag, consumableStash: nextStash }));
    dispatch(setEquipment({ ...equipmentState }));
    await AsyncStorage.setItem('characters', JSON.stringify(objChar));
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

      const currentEquippedItem = equipmentState[slotType];
      if (!equipmentState[slotType]) {
        equipmentState[slotType] = { name: '', type: slotType, stats: {} };
      }

      if (currentEquippedItem?.name) {
        bag.push(currentEquippedItem);
      }

      bag.splice(index, 1);
      equipmentState[slotType] = activeItem;
      await persistCharacterState(objChar, bag, stash, equipmentState);
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
      if (stash.length >= CONSUMABLE_STASH_CAPACITY) {
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
      if (bag.length >= BAG_CAPACITY) {
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
      if (bag.length >= BAG_CAPACITY) {
        dispatch(setCombatLog('Bag is full.'));
        return;
      }

      bag.push(item);
      equipmentState[slotKey] = { name: '', type: slotKey, stats: {} };
      await persistCharacterState(objChar, bag, stash, equipmentState);
      dispatch(setCombatLog(`Moved ${item.name || 'Item'} to bag.`));
    } catch (error) {
      console.error('Error moving equipped item to bag:', error);
    }
  };

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

      <div style={{ ...styles.section, ...styles.bagSection }}>
        <button type="button" style={styles.sectionHeader} onClick={() => setBagOpen((prev) => !prev)}>
          <span style={styles.sectionTitle}>
            Bag ({Math.min(inventory.length, BAG_CAPACITY)}/{BAG_CAPACITY})
          </span>
          <span style={styles.toggleText}>{bagOpen ? 'Close' : 'Open'}</span>
        </button>

        <span style={styles.goldText}>Gold: {gold}</span>
        <span style={styles.stashMeta}>
          Consumable Belt: {Math.min(consumableStash.length, CONSUMABLE_STASH_CAPACITY)}/{CONSUMABLE_STASH_CAPACITY}
        </span>

        <div style={styles.stashGrid}>
          {Array.from({ length: CONSUMABLE_STASH_CAPACITY }).map((_, slotIndex) => {
            const item = consumableStash[slotIndex];
            return (
              <button
                key={`stash-slot-${slotIndex}`}
                type="button"
                ref={(node) => {
                  stashButtonRefs.current[slotIndex] = node;
                }}
                style={{
                  ...styles.stashCell,
                  ...(!item ? styles.stashCellEmpty : null),
                }}
                tabIndex={0}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (item) {
                    const shiftIntent = isShiftAction(event) || !!stashShiftIntentRef.current[slotIndex];
                    stashShiftIntentRef.current[slotIndex] = false;
                    if (!shiftIntent) {
                      dispatch(setCombatLog('Use Shift + Left Click to move from belt to bag.'));
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    void moveStashItemToBag(slotIndex);
                  }
                }}
                onFocus={() => setActiveNav({ group: 'stash', index: slotIndex })}
                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                  stashShiftIntentRef.current[slotIndex] = isShiftAction(event);
                }}
                onMouseEnter={() => item && setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {item ? <ItemIcon type={item.type} size={20} itemName={item.name} itemStats={item.stats} /> : null}
              </button>
            );
          })}
        </div>

        {bagOpen && (
          <div style={styles.bagScroll}>
            <div style={styles.bagGrid}>
              {Array.from({ length: BAG_CAPACITY }).map((_, index) => {
                const item = inventory[index];
                return (
                  <button
                    key={`bag-slot-${index}`}
                    type="button"
                    ref={(node) => {
                      bagButtonRefs.current[index] = node;
                    }}
                    style={{
                      ...styles.bagCell,
                      ...(!item ? styles.bagCellEmpty : null),
                    }}
                    tabIndex={0}
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      if (!item) return;
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
                    {item ? <ItemIcon type={item.type} size={20} itemName={item.name} itemStats={item.stats} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <span style={styles.helperText}>
          Shift + Left Click moves potions between bag and belt (both directions).
        </span>
      </div>

      <div style={styles.section}>
        <button type="button" style={styles.sectionHeader} onClick={() => setEquipmentOpen((prev) => !prev)}>
          <span style={styles.sectionTitle}>Equipped</span>
          <span style={styles.toggleText}>{equipmentOpen ? 'Close' : 'Open'}</span>
        </button>

        {equipmentOpen && (
          <div style={styles.equipmentGrid}>
            {slots.map((slot, index) => {
              const itemName = slot.item?.name || '';
              return (
                <button
                  key={slot.key}
                  type="button"
                  ref={(node) => {
                    equipmentButtonRefs.current[index] = node;
                  }}
                  style={styles.slotBoxButton}
                  tabIndex={0}
                  onClick={() => {
                    if (slot.item?.name) {
                      void moveEquipmentItemToBag(slot.key);
                    }
                  }}
                  onFocus={() => setActiveNav({ group: 'equipment', index })}
                  onMouseEnter={() => slot.item?.name && setHoveredItem(slot.item)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={styles.slotBox}>
                    <ItemIcon
                      type={slot.item?.type || slot.type}
                      size={26}
                      itemName={slot.item?.name}
                      itemStats={slot.item?.stats}
                    />
                    <span style={styles.slotLabel}>{slot.label}</span>
                    <span style={styles.slotItemName}>{itemName || 'Empty'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: {
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: 7,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    position: 'relative',
  },
  section: {
    background: '#0f172a',
    borderRadius: 6,
    padding: 5,
    border: '1px solid #1e293b',
    position: 'relative',
  },
  bagSection: {
    position: 'relative',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    background: 'transparent',
    border: 0,
    padding: 0,
    width: '100%',
    cursor: 'pointer',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 11,
  },
  toggleText: {
    color: '#93c5fd',
    fontSize: 10,
  },
  equipmentGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotBoxButton: {
    border: 0,
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
  },
  slotBox: {
    width: 70,
    height: 70,
    background: '#1e293b',
    borderRadius: 6,
    border: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 2px',
    boxSizing: 'border-box',
  },
  slotLabel: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 700,
  },
  slotItemName: {
    color: '#94a3b8',
    fontSize: 8,
    textAlign: 'center',
    maxWidth: 64,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  bagScroll: {
    maxHeight: 116,
    overflowY: 'auto',
  },
  bagGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  bagCell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    border: '1px solid #334155',
    background: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  bagCellEmpty: {
    opacity: 0.45,
    cursor: 'default',
  },
  stashMeta: {
    color: '#94a3b8',
    fontSize: 9,
    marginBottom: 4,
    display: 'block',
  },
  stashGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  stashCell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    border: '1px solid #7c3aed',
    background: '#312e81',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  stashCellEmpty: {
    opacity: 0.5,
    cursor: 'default',
  },
  goldText: {
    position: 'absolute',
    top: 20,
    right: 6,
    color: '#facc15',
    fontSize: 10,
    fontWeight: 700,
    zIndex: 2,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 8,
    marginTop: 4,
    display: 'block',
  },
  tooltipOverlay: {
    position: 'absolute',
    right: 8,
    top: -8,
    maxWidth: 210,
    background: 'rgba(2, 6, 23, 0.94)',
    border: '1px solid #475569',
    borderRadius: 8,
    padding: 8,
    zIndex: 20,
    pointerEvents: 'none',
  },
  tooltipTitle: {
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 4,
  },
  tooltipLine: {
    color: '#cbd5e1',
    fontSize: 10,
  },
};
