import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { restoreHealth, restoreMana, setCombatLog, setEquipment, setGold, setSkillLevels } from '../../features/player/playerSlice';
import { setAllInventory } from './inventorySlice';
import { ItemIcon } from '../../components/ItemIcon';
import {
  getSkillLevel,
  readSkillLevelsFromCharacter,
  readSkillTrainingFromItem,
} from '../../features/skills/skillCatalog';
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

interface HeldItem {
  source: 'bag' | 'stash' | 'equipment';
  item: any;
  bagIndex?: number;
  stashIndex?: number;
  slotKey?: string;
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
  const [heldItem, setHeldItem] = useState<HeldItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const skipNextPressRef = useRef(false);

  const clearHeldItem = () => {
    setHeldItem(null);
  };

  const startHolding = (item: HeldItem) => {
    setHeldItem(item);
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

    if (item.type === 'tome') {
      const requirements = item.requirements && typeof item.requirements === 'object'
        ? Object.entries(item.requirements as Record<string, unknown>)
            .map(([key, value]) => `${String(key).slice(0, 3).toUpperCase()} ${String(value)}`)
        : [];
      const taughtSkill = item.skillName || item.teachesSkill || 'Unknown Skill';
      const lines: string[] = [`Teaches: ${taughtSkill}`];
      const tomeLevel = Number(item.tomeLevel || item.level || item.levelRequirement || item['Level Requirement'] || 1);
      if (Number.isFinite(tomeLevel) && tomeLevel > 0) {
        lines.push(`Tome Level: ${Math.floor(tomeLevel)}`);
      }
      if (item.manaCost) {
        lines.push(`Mana Cost: ${item.manaCost}`);
      }
      if (requirements.length > 0) {
        lines.push(`Requires: ${requirements.join(', ')}`);
      }
      return lines;
    }

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

      if (activeItem.type === 'tome') {
        const training = readSkillTrainingFromItem(activeItem);
        if (!training) {
          dispatch(setCombatLog(`${activeItem.name || 'Tome'} cannot be used.`));
          return;
        }
        const currentLevels = readSkillLevelsFromCharacter(objChar.character.skills);
        const currentLevel = getSkillLevel(currentLevels, training.skillId);
        if (training.tomeLevel <= currentLevel) {
          dispatch(
            setCombatLog(
              `${activeItem.name || 'Tome'} needs to be higher than current ${training.skillId} level (${currentLevel}).`
            )
          );
          return;
        }

        const nextLevels = {
          ...currentLevels,
          [training.skillId]: training.tomeLevel,
        };
        objChar.character.skills = nextLevels;
        bag.splice(index, 1);
        dispatch(setSkillLevels(nextLevels));
        dispatch(setCombatLog(`Learned ${activeItem.skillName || training.skillId} Lv.${training.tomeLevel}.`));
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

  const moveBagItemToStash = async (bagIndex: number, stashSlotIndex: number) => {
    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;
      const selectedItem = bag[bagIndex];
      if (!selectedItem) return;
      if (selectedItem.type !== 'consumable') {
        dispatch(setCombatLog('Only consumables can be placed into stash.'));
        return;
      }
      if (stash.length >= CONSUMABLE_STASH_CAPACITY) {
        dispatch(setCombatLog('Stash is full.'));
        return;
      }
      if (stashSlotIndex < stash.length) {
        dispatch(setCombatLog('Target stash slot is occupied.'));
        return;
      }

      bag.splice(bagIndex, 1);
      stash.push(selectedItem);
      await persistCharacterState(objChar, bag, stash, equipmentState);
      dispatch(setCombatLog(`Moved ${selectedItem.name || 'Consumable'} to stash.`));
      clearHeldItem();
    } catch (error) {
      console.error('Error moving item to stash:', error);
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
      clearHeldItem();
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
      clearHeldItem();
    } catch (error) {
      console.error('Error moving equipped item to bag:', error);
    }
  };

  const dropHeldToEquipmentSlot = async (slot: EquipmentSlot) => {
    if (!heldItem) return;
    if (heldItem.source === 'stash') {
      dispatch(setCombatLog('Consumables from stash cannot be equipped.'));
      return;
    }

    try {
      const loaded = await loadCharacterState();
      if (!loaded) return;
      const { objChar, bag, stash, equipmentState } = loaded;

      let movingItem: any = null;
      if (heldItem.source === 'bag') {
        const idx = Number(heldItem.bagIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= bag.length) return;
        movingItem = bag[idx];
      } else if (heldItem.source === 'equipment') {
        movingItem = equipmentState?.[heldItem.slotKey || ''];
      }
      if (!movingItem?.type) return;
      if (!slotAcceptsItem(slot.type, movingItem.type)) return;

      if (heldItem.source === 'bag') {
        bag.splice(Number(heldItem.bagIndex), 1);
      } else if (heldItem.source === 'equipment') {
        const fromKey = heldItem.slotKey || '';
        if (fromKey === slot.key) {
          clearHeldItem();
          return;
        }
        equipmentState[fromKey] = { name: '', type: fromKey, stats: {} };
      }

      const replaced = equipmentState[slot.key];
      if (replaced?.name) {
        if (bag.length >= BAG_CAPACITY) {
          dispatch(setCombatLog('Bag is full.'));
          return;
        }
        bag.push(replaced);
      }

      equipmentState[slot.key] = movingItem;
      await persistCharacterState(objChar, bag, stash, equipmentState);
      clearHeldItem();
    } catch (error) {
      console.error('Error dropping to equipment slot:', error);
    }
  };

  const dropHeldToBag = async () => {
    if (!heldItem) return;
    if (heldItem.source === 'bag') return;

    if (heldItem.source === 'stash' && Number.isInteger(heldItem.stashIndex)) {
      await moveStashItemToBag(Number(heldItem.stashIndex));
      return;
    }
    if (heldItem.source === 'equipment' && heldItem.slotKey) {
      await moveEquipmentItemToBag(heldItem.slotKey);
    }
  };

  return (
    <View style={styles.root}>
      {heldItem?.item ? (
        <View style={styles.holdBanner}>
          <Text style={styles.holdBannerText}>Holding: {heldItem.item.name || 'Item'} (drop on target slot)</Text>
        </View>
      ) : null}
      {hoveredItem && (
        <View style={styles.tooltipOverlay} pointerEvents="none">
          <Text style={styles.tooltipTitle}>{hoveredItem.name || 'Unknown Item'}</Text>
          {buildItemDetails(hoveredItem).map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.tooltipLine}>{line}</Text>
          ))}
        </View>
      )}
      <View style={[styles.section, styles.bagSection]}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setBagOpen((prev) => !prev)}>
          <Text style={styles.sectionTitle}>
            Bag ({Math.min(inventory.length, BAG_CAPACITY)}/{BAG_CAPACITY})
          </Text>
          <Text style={styles.toggleText}>{bagOpen ? 'Close' : 'Open'}</Text>
        </TouchableOpacity>
        <Text style={styles.goldText}>Gold: {gold}</Text>
        <Text style={styles.stashMeta}>
          Consumable Stash: {Math.min(consumableStash.length, CONSUMABLE_STASH_CAPACITY)}/
          {CONSUMABLE_STASH_CAPACITY}
        </Text>
        <View style={styles.stashGrid}>
          {Array.from({ length: CONSUMABLE_STASH_CAPACITY }).map((_, slotIndex) => {
            const item = consumableStash[slotIndex];
            return (
              <Pressable
                key={`stash-slot-${slotIndex}`}
                style={[
                  styles.stashCell,
                  !item && styles.stashCellEmpty,
                  heldItem?.source === 'stash' && heldItem.stashIndex === slotIndex && styles.stashCellHeld,
                ]}
                onPress={async () => {
                  if (skipNextPressRef.current) {
                    skipNextPressRef.current = false;
                    return;
                  }
                  if (heldItem?.source === 'bag' && Number.isInteger(heldItem.bagIndex)) {
                    await moveBagItemToStash(Number(heldItem.bagIndex), slotIndex);
                    return;
                  }
                  if (heldItem?.source === 'stash') {
                    if (heldItem.stashIndex === slotIndex) {
                      clearHeldItem();
                      return;
                    }
                    dispatch(setCombatLog('Drop stash item on bag slots to move it.'));
                    return;
                  }
                  if (heldItem?.source === 'equipment') {
                    dispatch(setCombatLog('Equipment cannot be moved directly into stash.'));
                    return;
                  }
                  if (item) {
                    await moveStashItemToBag(slotIndex);
                  }
                }}
                onLongPress={() => {
                  if (!item) return;
                  skipNextPressRef.current = true;
                  startHolding({ source: 'stash', stashIndex: slotIndex, item });
                }}
                onHoverIn={() => item && setHoveredItem(item)}
                onHoverOut={() => setHoveredItem(null)}
              >
                {item ? <ItemIcon type={item.type} size={20} itemName={item.name} itemStats={item.stats} /> : null}
              </Pressable>
            );
          })}
        </View>

        {bagOpen && (
          <ScrollView style={styles.bagScroll}>
            <View style={styles.bagGrid}>
              {Array.from({ length: BAG_CAPACITY }).map((_, index) => {
                const item = inventory[index];
                return (
                  <Pressable
                    key={`bag-slot-${index}`}
                    style={[
                      styles.bagCell,
                      heldItem?.source === 'bag' && heldItem.bagIndex === index && !!item && styles.bagCellSelected,
                      !item && styles.bagCellEmpty,
                    ]}
                    onPress={async () => {
                      if (skipNextPressRef.current) {
                        skipNextPressRef.current = false;
                        return;
                      }
                      if (heldItem) {
                        if (heldItem.source !== 'bag') {
                          await dropHeldToBag();
                          return;
                        }
                        if (heldItem.bagIndex === index) {
                          clearHeldItem();
                          return;
                        }
                        if (item) {
                          setHeldItem({ source: 'bag', bagIndex: index, item });
                        }
                        return;
                      }
                      if (!item) return;
                      await useOrEquipBagItem(index);
                    }}
                    onLongPress={() => {
                      if (!item) return;
                      skipNextPressRef.current = true;
                      startHolding({ source: 'bag', bagIndex: index, item });
                    }}
                    onHoverIn={() => item && setHoveredItem(item)}
                    onHoverOut={() => setHoveredItem(null)}
                  >
                    {item ? <ItemIcon type={item.type} size={20} itemName={item.name} itemStats={item.stats} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
        <Text style={styles.helperText}>
          Long-press an item to pick it up, then tap target slots to drop (equipment, stash, or bag).
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setEquipmentOpen((prev) => !prev)}>
          <Text style={styles.sectionTitle}>Equipped</Text>
          <Text style={styles.toggleText}>{equipmentOpen ? 'Close' : 'Open'}</Text>
        </TouchableOpacity>

        {equipmentOpen && (
          <View style={styles.equipmentGrid}>
            {slots.map((slot) => {
              const itemName = slot.item?.name || '';
              return (
                <Pressable
                  key={slot.key}
                  style={[
                    styles.slotBox,
                    heldItem?.source === 'equipment' && heldItem.slotKey === slot.key && styles.slotBoxHeld,
                  ]}
                  onPress={async () => {
                    if (skipNextPressRef.current) {
                      skipNextPressRef.current = false;
                      return;
                    }
                    if (heldItem) {
                      await dropHeldToEquipmentSlot(slot);
                    }
                  }}
                  onLongPress={() => {
                    if (!slot.item?.name) return;
                    skipNextPressRef.current = true;
                    startHolding({ source: 'equipment', slotKey: slot.key, item: slot.item });
                  }}
                  onHoverIn={() => slot.item?.name && setHoveredItem(slot.item)}
                  onHoverOut={() => setHoveredItem(null)}
                >
                  <ItemIcon
                    type={slot.item?.type || slot.type}
                    size={26}
                    itemName={slot.item?.name}
                    itemStats={slot.item?.stats}
                  />
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  <Text numberOfLines={1} style={styles.slotItemName}>{itemName || 'Empty'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 7,
    gap: 7,
  },
  holdBanner: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 6,
    backgroundColor: '#3f2f14',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  holdBannerText: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 5,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  bagSection: {
    position: 'relative',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 11,
  },
  toggleText: {
    color: '#93c5fd',
    fontSize: 10,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotBox: {
    width: 70,
    height: 70,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  slotBoxHeld: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  slotLabel: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '700',
  },
  slotItemName: {
    color: '#94a3b8',
    fontSize: 8,
    textAlign: 'center',
    maxWidth: 64,
  },
  bagScroll: {
    maxHeight: 116,
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  bagCell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagCellEmpty: {
    opacity: 0.45,
  },
  bagCellSelected: {
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  stashMeta: {
    color: '#94a3b8',
    fontSize: 9,
    marginBottom: 4,
  },
  stashGrid: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  stashCell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stashCellEmpty: {
    opacity: 0.5,
  },
  stashCellHeld: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  goldText: {
    position: 'absolute',
    top: 20,
    right: 6,
    color: '#facc15',
    fontSize: 10,
    fontWeight: '700',
    zIndex: 2,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 8,
    marginTop: 4,
  },
  tooltipOverlay: {
    position: 'absolute',
    right: 8,
    top: -8,
    maxWidth: 210,
    backgroundColor: 'rgba(2, 6, 23, 0.94)',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    zIndex: 20,
  },
  tooltipTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 4,
  },
  tooltipLine: {
    color: '#cbd5e1',
    fontSize: 10,
  },
});
