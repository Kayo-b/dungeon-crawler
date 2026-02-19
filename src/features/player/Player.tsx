import { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import data from '../../data/characters.json';
import itemData from '../../data/items.json';
import {
  fetchEquipment,
  setGold,
  setClassMeta,
  setCombatLog,
  setEquipment,
  setHealth,
  setLevel,
  setStats,
  setUnspentStatPoints,
  setXP,
} from './playerSlice';
import { setAllInventory } from '../inventory/inventorySlice';
import {
  extractCurrencyFromBag,
  getInventoryCapacities,
  normalizeInventoryContainers,
} from '../inventory/inventoryUtils';

interface PlayerProps {
  classLabel: string;
}
const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

export const Player: React.FC<PlayerProps> = ({ classLabel }) => {
  const dispatch = useAppDispatch();
  const combatLogScrollRef = useRef<ScrollView | null>(null);

  const playerLevel = useAppSelector((state) => state.player.level);
  const combatLog = useAppSelector((state) => state.player.combatLog);
  const currentEnemy = useAppSelector((state) => state.enemy.currentEnemyId);
  const enemiesObj = useAppSelector((state) => state.enemy.enemies);
  const dmgTakenLog = useAppSelector((state) => state.player.dmgLog);

  const currentEnemyData = enemiesObj[currentEnemy];
  const dmgDoneObj = currentEnemyData?.dmgLog || [];
  const enemyInfo = currentEnemyData?.info || { name: 'Enemy' };

  const initializeData = async () => {
    const storedData = await AsyncStorage.getItem('characters');
    let obj = storedData ? JSON.parse(storedData) : {};

    if (!storedData) {
      await AsyncStorage.setItem('characters', JSON.stringify(data));
      await AsyncStorage.setItem('items', JSON.stringify(itemData));
      const seeded = await AsyncStorage.getItem('characters');
      obj = seeded ? JSON.parse(seeded) : {};
    }

    let health = obj.character.stats.health;
    if (!health || health <= 0) {
      health = data.character.stats.health;
      obj.character.stats.health = health;
      await AsyncStorage.setItem('characters', JSON.stringify(obj));
    }

    const experience = Number(obj.character.experience || 0);
    const level = Number(obj.character.level || 1);
    const baseStats = obj.character.stats;
    const unspentStatPoints = Math.max(0, Number(obj.character.unspentStatPoints || 0));
    obj.character.unspentStatPoints = unspentStatPoints;
    const baseGold = Math.max(0, Number(obj.character.gold || 0));

    const equipmentState = obj.character.equipment || {};
    if (!equipmentState.bag?.name) {
      equipmentState.bag = { name: 'Small Pouch', type: 'bag', stats: { bagSlots: 4 } };
    }
    if (!equipmentState.belt?.name) {
      equipmentState.belt = { name: 'Starter Belt', type: 'belt', stats: { consumableSlots: 2 } };
    }

    const capacities = getInventoryCapacities(equipmentState);
    const normalizedInventory = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash,
      capacities
    );
    const legacyCurrencySplit = extractCurrencyFromBag(normalizedInventory.inventory);
    const inv = legacyCurrencySplit.inventoryWithoutCurrency;
    const consumableStash = normalizedInventory.consumableStash;
    const totalGold = Number((baseGold + legacyCurrencySplit.goldFromCurrency).toFixed(2));
    obj.character.inventory = inv;
    obj.character.consumableStash = consumableStash;
    obj.character.gold = totalGold;
    const equipped = equipmentState;

    dispatch(setEquipment(equipped));
    dispatch(setStats(baseStats));
    dispatch(setHealth(health));
    dispatch(setXP(experience));
    dispatch(setLevel(level));
    dispatch(setUnspentStatPoints(unspentStatPoints));
    dispatch(setGold(totalGold));
    dispatch(setAllInventory({ inventory: inv, consumableStash }));
    dispatch(fetchEquipment());
    dispatch(
      setClassMeta({
        classArchetype: obj.character.classArchetype || 'warrior',
        classLabel: obj.character.classLabel || 'Warrior',
        specialName: obj.character.specialName || 'Crushing Blow',
      })
    );

    await AsyncStorage.setItem('characters', JSON.stringify(obj));
  };

  useEffect(() => {
    initializeData();
  }, [playerLevel]);

  useEffect(() => {
    if (dmgTakenLog.length === 0) return;
    const last = dmgTakenLog[dmgTakenLog.length - 1];
    const enemyName = last.enemy || enemyInfo.name || 'Enemy';
    if (last.dmg === 0) {
      dispatch(setCombatLog(`${enemyName} missed.`));
    } else if (last.crit) {
      dispatch(setCombatLog(`You took ${last.dmg} critical damage from ${enemyName}.`));
    } else {
      dispatch(setCombatLog(`You took ${last.dmg} damage from ${enemyName}.`));
    }
  }, [dmgTakenLog.length]);

  useEffect(() => {
    if (!Array.isArray(dmgDoneObj) || dmgDoneObj.length === 0) return;
    const last = dmgDoneObj[dmgDoneObj.length - 1];
    const enemyName = enemyInfo.name || 'Enemy';
    if (last.dmg === 0) {
      dispatch(setCombatLog(`Attack missed ${enemyName}.`));
    } else if (last.crit) {
      dispatch(setCombatLog(`${enemyName} took ${last.dmg} critical damage.`));
    } else {
      dispatch(setCombatLog(`${enemyName} took ${last.dmg} damage.`));
    }
  }, [Array.isArray(dmgDoneObj) ? dmgDoneObj.length : 0]);

  useEffect(() => {
    combatLogScrollRef.current?.scrollToEnd({ animated: true });
  }, [combatLog.length]);

  return (
    <View style={styles.playerContainer}>
      <View style={styles.logPanelInline}>
        <Text style={styles.panelTitle}>Combat Log</Text>
        <ScrollView
          ref={combatLogScrollRef}
          style={styles.logView}
          onContentSizeChange={() => combatLogScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {combatLog.map((entry: string, index: number) => (
            <Text key={`${entry}-${index}`} style={styles.logText}>
              {entry}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  playerContainer: {
    width: 800,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: '#000000',
  },
  logPanelInline: {
    width: 320,
    borderWidth: 2,
    borderColor: '#d7d7d7',
    backgroundColor: '#080808',
    padding: 6,
  },
  panelTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: RETRO_FONT,
    marginBottom: 2,
  },
  logView: {
    height: 168,
  },
  logText: {
    color: '#d8d8d8',
    fontSize: 10,
    marginBottom: 1,
    fontFamily: RETRO_FONT,
  },
});
