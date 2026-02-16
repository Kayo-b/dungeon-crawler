import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ItemIcon } from '../../components/ItemIcon';
import { restoreHealth, restoreMana, setCombatLog } from '../player/playerSlice';
import { setAllInventory } from './inventorySlice';
import { CONSUMABLE_STASH_CAPACITY, normalizeInventoryContainers } from './inventoryUtils';

export const ConsumableBelt = () => {
  const dispatch = useAppDispatch();
  const consumableStash = useAppSelector((state) => state.inventory.consumableStash as any[]);
  const playerHealth = useAppSelector((state) => state.player.health);

  const slotCount = CONSUMABLE_STASH_CAPACITY;

  const beltEntries = useMemo(() => {
    return (consumableStash || []).slice(0, slotCount);
  }, [consumableStash, slotCount]);

  const useConsumable = async (stashIndex: number) => {
    const target = beltEntries?.[stashIndex];
    if (!target || target.type !== 'consumable') return;

    const hpAmount = Number(target.stats?.amount || 0);
    const manaAmount = Number(target.stats?.mana || 0);
    const effectSegments: string[] = [];

    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    if (!obj?.character) return;

    const normalized = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash
    );

    if (hpAmount > 0) {
      dispatch(restoreHealth(hpAmount));
      obj.character.stats.health = playerHealth + hpAmount;
      effectSegments.push(`+${hpAmount} HP`);
    }

    if (manaAmount > 0) {
      dispatch(restoreMana(manaAmount));
      effectSegments.push(`+${manaAmount} Mana`);
    }

    const effectText = effectSegments.length > 0 ? effectSegments.join(', ') : 'No effect';
    dispatch(setCombatLog(`Used ${target.name || 'Consumable'} (${effectText}).`));

    if (stashIndex < 0 || stashIndex >= normalized.consumableStash.length) return;
    normalized.consumableStash.splice(stashIndex, 1);
    obj.character.inventory = normalized.inventory;
    obj.character.consumableStash = normalized.consumableStash;
    dispatch(setAllInventory({ inventory: normalized.inventory, consumableStash: normalized.consumableStash }));
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
  };

  return (
    <View testID="consumable-belt-overlay" style={styles.grid}>
      {Array.from({ length: slotCount }).map((_, slotIndex) => {
        const entry = beltEntries[slotIndex] || null;
        return (
          <Pressable
            key={`belt-slot-${slotIndex}`}
            testID={`belt-slot-${slotIndex}`}
            style={[styles.slot, !entry && styles.slotEmpty]}
            onPress={() => entry && useConsumable(slotIndex)}
          >
            {entry ? <ItemIcon type={entry.type} size={20} /> : null}
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
