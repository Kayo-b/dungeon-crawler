import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { restoreHealth, restoreMana, setCombatLog, setEquipment } from '../../features/player/playerSlice';
import { setAllInventory } from './inventorySlice';
import { ItemIcon } from '../../components/ItemIcon';
import { BAG_CAPACITY, CONSUMABLE_STASH_CAPACITY, normalizeInventoryContainers } from './inventoryUtils';

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

  const [equipmentOpen, setEquipmentOpen] = useState(true);
  const [bagOpen, setBagOpen] = useState(true);
  const [selectedBagIndex, setSelectedBagIndex] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);

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

  const equipItem = async (item: any, index: number, forcedSlot?: string) => {
    try {
      const dataChar = await AsyncStorage.getItem('characters');
      const objChar = dataChar ? JSON.parse(dataChar) : {};
      if (!objChar?.character) return;

      const normalized = normalizeInventoryContainers(
        objChar.character.inventory,
        objChar.character.consumableStash
      );
      const bag = [...normalized.inventory];
      const stash = [...normalized.consumableStash];
      const selectedBagItem = bag[index];
      const activeItem = selectedBagItem || item;
      if (!activeItem || index < 0 || index >= bag.length) return;

      const itemType = activeItem.type;

      if (itemType === 'currency') {
        return;
      }

      if (itemType === 'consumable') {
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
        objChar.character.inventory = bag;
        objChar.character.consumableStash = stash;
        dispatch(setAllInventory({ inventory: bag, consumableStash: stash }));
        await AsyncStorage.setItem('characters', JSON.stringify(objChar));
        setSelectedBagIndex(null);
        return;
      }

      const slotType = forcedSlot || normalizeToSlot(itemType);
      const currentEquippedItem = objChar.character.equipment[slotType];

      if (!objChar.character.equipment[slotType]) {
        objChar.character.equipment[slotType] = { name: '', type: slotType, stats: {} };
      }

      if (currentEquippedItem?.name) {
        bag.push(currentEquippedItem);
      }

      bag.splice(index, 1);
      objChar.character.equipment[slotType] = activeItem;

      const nextBag = bag.slice(0, BAG_CAPACITY);
      const nextStash = stash.slice(0, CONSUMABLE_STASH_CAPACITY);
      objChar.character.inventory = nextBag;
      objChar.character.consumableStash = nextStash;
      dispatch(setAllInventory({ inventory: nextBag, consumableStash: nextStash }));
      dispatch(setEquipment({ ...objChar.character.equipment }));

      await AsyncStorage.setItem('characters', JSON.stringify(objChar));
      setSelectedBagIndex(null);
    } catch (error) {
      console.error('Error equipping item:', error);
    }
  };

  const handleSlotTap = (slot: EquipmentSlot) => {
    if (selectedBagIndex === null) return;
    const selectedItem = inventory[selectedBagIndex];
    if (!selectedItem) return;

    if (!slotAcceptsItem(slot.type, selectedItem.type)) {
      return;
    }

    equipItem(selectedItem, selectedBagIndex, slot.key);
    setSelectedBagIndex(null);
  };

  return (
    <View style={styles.root}>
      {hoveredItem && (
        <View style={styles.tooltipOverlay} pointerEvents="none">
          <Text style={styles.tooltipTitle}>{hoveredItem.name || 'Unknown Item'}</Text>
          {buildItemDetails(hoveredItem).map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.tooltipLine}>{line}</Text>
          ))}
        </View>
      )}
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
                  style={styles.slotBox}
                  onPress={() => handleSlotTap(slot)}
                  onHoverIn={() => slot.item?.name && setHoveredItem(slot.item)}
                  onHoverOut={() => setHoveredItem(null)}
                >
                  <ItemIcon type={slot.item?.type || slot.type} size={28} />
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  <Text numberOfLines={1} style={styles.slotItemName}>{itemName || 'Empty'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setBagOpen((prev) => !prev)}>
          <Text style={styles.sectionTitle}>
            Bag ({Math.min(inventory.length, BAG_CAPACITY)}/{BAG_CAPACITY})
          </Text>
          <Text style={styles.toggleText}>{bagOpen ? 'Close' : 'Open'}</Text>
        </TouchableOpacity>
        <Text style={styles.stashMeta}>
          Consumable Stash: {Math.min(consumableStash.length, CONSUMABLE_STASH_CAPACITY)}/
          {CONSUMABLE_STASH_CAPACITY}
        </Text>

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
                      selectedBagIndex === index && !!item && styles.bagCellSelected,
                      !item && styles.bagCellEmpty,
                    ]}
                    onPress={() => {
                      if (!item) return;
                      equipItem(item, index);
                    }}
                    onLongPress={() => item && setSelectedBagIndex(index)}
                    onHoverIn={() => item && setHoveredItem(item)}
                    onHoverOut={() => setHoveredItem(null)}
                  >
                    {item ? <ItemIcon type={item.type} size={20} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
        <Text style={styles.helperText}>
          Bag has fixed 16 slots. Stash is separate and auto-fills with consumables first.
        </Text>
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
    padding: 8,
    gap: 8,
  },
  section: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
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
    fontSize: 12,
  },
  toggleText: {
    color: '#93c5fd',
    fontSize: 11,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotBox: {
    width: 78,
    height: 78,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  slotLabel: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  slotItemName: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'center',
    maxWidth: 72,
  },
  bagScroll: {
    maxHeight: 70,
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  bagCell: {
    width: 28,
    height: 28,
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
    fontSize: 10,
    marginBottom: 4,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 9,
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
