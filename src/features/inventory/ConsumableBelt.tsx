import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ItemIcon } from '../../components/ItemIcon';
import { restoreHealth, restoreMana } from '../player/playerSlice';
import { setInventory } from './inventorySlice';

const BASE_BELT_SLOTS = 4;
const MAX_BELT_BONUS = 4;

const clampBonus = (value: number) => Math.max(0, Math.min(MAX_BELT_BONUS, Math.floor(value)));

const readNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const getBeltBonus = (belt: any) => {
  if (!belt || typeof belt !== 'object') return 0;

  const stats = belt.stats && typeof belt.stats === 'object' ? belt.stats : {};

  const directBonus =
    readNumber(stats.consumableSlotsBonus) ||
    readNumber(stats.beltSlotsBonus) ||
    readNumber(stats.potionSlotsBonus) ||
    readNumber(belt.consumableSlotsBonus) ||
    readNumber(belt.beltSlotsBonus) ||
    readNumber(belt.potionSlotsBonus);

  if (directBonus > 0) {
    return clampBonus(directBonus);
  }

  const absoluteLegacySlots = readNumber(stats['Potion Slots']) || readNumber(belt['Potion Slots']);
  if (absoluteLegacySlots > 0) {
    return clampBonus(absoluteLegacySlots - BASE_BELT_SLOTS);
  }

  return 0;
};

export const ConsumableBelt = () => {
  const dispatch = useAppDispatch();
  const inventory = useAppSelector((state) => state.inventory.inventory as any[]);
  const equipment = useAppSelector((state) => state.player.equipment as Record<string, any>);
  const playerHealth = useAppSelector((state) => state.player.health);

  const beltBonus = getBeltBonus(equipment?.belt);
  const slotCount = BASE_BELT_SLOTS + beltBonus;

  const beltEntries = useMemo(() => {
    return (inventory || [])
      .map((item: any, index: number) => ({ item, index }))
      .filter((entry) => entry.item?.type === 'consumable')
      .slice(0, slotCount);
  }, [inventory, slotCount]);

  const useConsumable = async (inventoryIndex: number) => {
    const target = inventory?.[inventoryIndex];
    if (!target || target.type !== 'consumable') return;

    const hpAmount = Number(target.stats?.amount || 0);
    const manaAmount = Number(target.stats?.mana || 0);

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character || !Array.isArray(obj.character.inventory)) return;

    if (hpAmount > 0) {
      dispatch(restoreHealth(hpAmount));
      obj.character.stats.health = playerHealth + hpAmount;
    }

    if (manaAmount > 0) {
      dispatch(restoreMana(manaAmount));
    }

    obj.character.inventory.splice(inventoryIndex, 1);
    dispatch(setInventory([...obj.character.inventory]));
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
  };

  return (
    <View style={styles.grid}>
      {Array.from({ length: slotCount }).map((_, slotIndex) => {
        const entry = beltEntries[slotIndex];
        return (
          <Pressable
            key={`belt-slot-${slotIndex}`}
            style={[styles.slot, !entry && styles.slotEmpty]}
            onPress={() => entry && useConsumable(entry.index)}
          >
            {entry ? <ItemIcon type={entry.item.type} size={20} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    width: 60,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  slot: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
});
