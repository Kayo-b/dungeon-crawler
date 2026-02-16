import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import data from '../../data/characters.json';
import itemData from '../../data/items.json';
import { Inventory } from '../inventory/Inventory';
import { MiniMap } from '../room/MiniMap';
import {
  fetchEquipment,
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
import { computeDerivedPlayerStats } from './playerStats';
import { normalizeInventoryContainers } from '../inventory/inventoryUtils';

interface PlayerProps {
  classLabel: string;
}

export const Player: React.FC<PlayerProps> = ({ classLabel }) => {
  const dispatch = useAppDispatch();
  const screenWidth = Dimensions.get('window').width;
  const combatLogScrollRef = useRef<ScrollView | null>(null);

  const playerHealth = useAppSelector((state) => state.player.health);
  const playerXP = useAppSelector((state) => state.player.experience);
  const playerLevel = useAppSelector((state) => state.player.level);
  const stats = useAppSelector((state) => state.player.stats as any);
  const combatLog = useAppSelector((state) => state.player.combatLog);
  const currentEnemy = useAppSelector((state) => state.enemy.currentEnemyId);
  const enemiesObj = useAppSelector((state) => state.enemy.enemies);
  const dmgTakenLog = useAppSelector((state) => state.player.dmgLog);
  const classArchetype = useAppSelector((state) => state.player.classArchetype || 'warrior');
  const equipment = useAppSelector((state) => state.player.equipment as Record<string, any>);

  const mana = useAppSelector((state) => state.player.mana);
  const maxMana = useAppSelector((state) => state.player.maxMana);

  const currentEnemyData = enemiesObj[currentEnemy];
  const dmgDoneObj = currentEnemyData?.dmgLog || [];
  const enemyInfo = currentEnemyData?.info || { name: 'Enemy' };

  const lastTaken = dmgTakenLog.length > 0 ? dmgTakenLog[dmgTakenLog.length - 1] : { dmg: 0 };
  const fadeAnimDmg = useRef(new Animated.Value(1)).current;

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

    const normalizedInventory = normalizeInventoryContainers(
      obj.character.inventory,
      obj.character.consumableStash
    );
    const inv = normalizedInventory.inventory;
    const consumableStash = normalizedInventory.consumableStash;
    obj.character.inventory = inv;
    obj.character.consumableStash = consumableStash;
    const equipped = obj.character.equipment;

    dispatch(setEquipment(equipped));
    dispatch(setStats(baseStats));
    dispatch(setHealth(health));
    dispatch(setXP(experience));
    dispatch(setLevel(level));
    dispatch(setUnspentStatPoints(unspentStatPoints));
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
    fadeAnimDmg.setValue(1);
    Animated.timing(fadeAnimDmg, {
      toValue: 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [playerHealth]);

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

  const hpMax = useMemo(() => {
    const derived = computeDerivedPlayerStats(stats || {}, equipment || {}, {
      classArchetype,
      level: playerLevel,
    });
    return Math.max(derived.maxHealth, playerHealth, 1);
  }, [stats, equipment, classArchetype, playerLevel, playerHealth]);

  const hpPct = Math.max(0, Math.min(1, playerHealth / hpMax));

  const xpToLevel = Math.max(16, Math.floor(16 * Math.pow(2, Math.max(0, playerLevel - 1))));
  const xpIntoLevel = ((playerXP % xpToLevel) + xpToLevel) % xpToLevel;
  const xpPct = Math.max(0, Math.min(1, xpIntoLevel / xpToLevel));

  const resourceMeta = useMemo(() => {
    return {
      label: 'MN',
      value: mana,
      max: maxMana,
      color: '#0ea5e9',
    };
  }, [mana, maxMana]);

  const resourcePct = Math.max(0, Math.min(1, resourceMeta.value / Math.max(resourceMeta.max, 1)));

  const renderThinBar = (
    shortLabel: string,
    pct: number,
    color: string,
    valueText: string
  ) => (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{shortLabel}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{valueText}</Text>
    </View>
  );

  return (
    <View style={[styles.playerContainer, { width: screenWidth }]}> 
      <View style={styles.hudPanel}>
        <View style={styles.hudTopRow}>
          <View style={styles.barsColumn}>
            <Text style={styles.classText}>{classLabel} Lv {playerLevel}</Text>
            {renderThinBar('HP', hpPct, '#dc2626', `${playerHealth}/${hpMax}`)}
            {renderThinBar('XP', xpPct, '#2563eb', `${xpIntoLevel}/${xpToLevel}`)}
            {renderThinBar(resourceMeta.label, resourcePct, resourceMeta.color, `${resourceMeta.value}/${resourceMeta.max}`)}
          </View>

          <ImageBackground source={require('../../resources/portrait.png')} style={styles.portrait}>
            <Animated.Text style={[styles.dmgTxt, { opacity: fadeAnimDmg }]}>{lastTaken.dmg}</Animated.Text>
          </ImageBackground>
        </View>

        <View style={styles.logPanelInline}>
          <Text style={styles.panelTitle}>Combat Log</Text>
          <ScrollView
            ref={combatLogScrollRef}
            style={styles.logView}
            onContentSizeChange={() => combatLogScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {combatLog.map((entry: string, index: number) => (
              <Text key={`${entry}-${index}`} style={styles.logText}>{entry}</Text>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.inventoryPanel}>
        <Inventory />
      </View>

      <View style={styles.miniMapContainer}>
        <MiniMap size={18} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  playerContainer: {
    position: 'absolute',
    top: 625,
    left: 0,
    width: '100%',
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  hudPanel: {
    width: 250,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 6,
    gap: 6,
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  barsColumn: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  classText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  barLabel: {
    width: 16,
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '700',
  },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  barValue: {
    width: 58,
    color: '#e2e8f0',
    fontSize: 8,
    textAlign: 'right',
  },
  portrait: {
    width: 66,
    height: 66,
  },
  dmgTxt: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '700',
  },
  logPanelInline: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    backgroundColor: '#0f172a',
    padding: 5,
  },
  panelTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 10,
    marginBottom: 3,
  },
  logView: {
    maxHeight: 70,
  },
  logText: {
    color: '#cbd5e1',
    fontSize: 10,
  },
  inventoryPanel: {
    width: 270,
  },
  miniMapContainer: {
    marginLeft: 4,
    justifyContent: 'flex-start',
  },
});
