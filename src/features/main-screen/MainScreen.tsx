import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCurrentPos } from '../room/roomSlice';
import { addEnemy, clearEnemies, fetchEnemies, setCurrentEnemy } from '../enemy/enemySlice';
import { setEnemyCount, setInCombat, setSpecialCooldown } from '../../events/combatSlice';
import {
  emptyCombatLog,
  setAttackRating,
  setClassMeta,
  setCrit,
  setDefenceRating,
  setEquipment,
  setHealth,
  setLevel,
  setPlayerDmg,
  setStats,
  setXP,
} from '../player/playerSlice';
import { setInventory } from '../inventory/inventorySlice';
import { ConsumableBelt } from '../inventory/ConsumableBelt';
import { Player } from '../player/Player';
import { Room } from '../room/Room';
import { useCombat } from '../../events/combat';
import { ARCHETYPES, ArchetypeId, buildCharacterFromArchetype } from '../../data/archetypes';
import itemData from '../../data/items.json';
import { pickSpawnEnemyType } from '../enemy/enemySpawn';

export const MainScreen = () => {
  const SMALL_MAP_MAX_TILES = 100;
  const RESPAWN_STEP_INTERVAL = 5;
  const MAX_DYNAMIC_ENEMIES = 8;

  const dispatch = useAppDispatch();
  const [initialized, setInitialized] = useState(false);
  const [menuMode, setMenuMode] = useState<'start' | 'create' | 'game'>('start');
  const [canContinue, setCanContinue] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId>('warrior');
  const [characterName, setCharacterName] = useState('');
  const [showDeathOverlay, setShowDeathOverlay] = useState(false);
  const [deathOpacity] = useState(new Animated.Value(0));
  const [sessionSeed, setSessionSeed] = useState(0);
  const [revivePending, setRevivePending] = useState(false);

  const mapTiles = useAppSelector((state) => state.room.mapTiles);
  const mapWidth = useAppSelector((state) => state.room.mapWidth);
  const mapHeight = useAppSelector((state) => state.room.mapHeight);
  const currentMapId = useAppSelector((state) => state.room.currentMapId);
  const posX = useAppSelector((state) => state.room.posX);
  const posY = useAppSelector((state) => state.room.posY);
  const direction = useAppSelector((state) => state.room.direction);
  const enemies = useAppSelector((state) => state.enemy.enemies);
  const classLabel = useAppSelector((state) => state.player.classLabel);
  const classArchetype = useAppSelector((state) => state.player.classArchetype || 'warrior');
  const playerHealth = useAppSelector((state) => state.player.health);
  const rage = useAppSelector((state) => state.player.rage);
  const mana = useAppSelector((state) => state.player.mana);
  const energy = useAppSelector((state) => state.player.energy);
  const comboPoints = useAppSelector((state) => state.player.comboPoints);
  const maxComboPoints = useAppSelector((state) => state.player.maxComboPoints);
  const [spawnPoints, setSpawnPoints] = useState<Array<{ x: number; y: number }>>([]);
  const stepCounterRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number; mapId: string } | null>(null);

  const {
    startCombat,
    engagePlayerAttack,
    performPrimarySkill,
    performSecondarySkill,
    specialCooldownFrames,
    inCombat,
  } = useCombat();

  useEffect(() => {
    const checkSave = async () => {
      const storedData = await AsyncStorage.getItem('characters');
      setCanContinue(!!storedData);
    };
    checkSave();
  }, []);

  const isSmallMap = mapWidth * mapHeight <= SMALL_MAP_MAX_TILES;
  const enemyValues = Object.values(enemies);
  const aliveEnemies = enemyValues.filter((enemy) => enemy.health > 0);

  const isInLineOfSight = (x: number, y: number) => {
    switch (direction) {
      case 'N':
        return x === posX && y < posY;
      case 'S':
        return x === posX && y > posY;
      case 'E':
        return y === posY && x > posX;
      case 'W':
        return y === posY && x < posX;
      default:
        return false;
    }
  };

  const isSpawnSafe = (x: number, y: number) => {
    if (!mapTiles[y] || mapTiles[y][x] <= 0) return false;
    if (x === posX && y === posY) return false;
    if (x === posX || y === posY) return false;
    if (isInLineOfSight(x, y)) return false;
    if (Math.abs(x - posX) + Math.abs(y - posY) < 4) return false;
    const occupied = aliveEnemies.some((enemy) => enemy.positionX === x && enemy.positionY === y);
    if (occupied) return false;
    return true;
  };

  const buildSpawnAnchors = () => {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (isSpawnSafe(x, y)) {
          candidates.push({ x, y });
        }
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };

  const spawnEnemies = () => {
    dispatch(fetchEnemies());
    dispatch(clearEnemies());

    const playerStartX = 7;
    const playerStartY = 7;
    dispatch(setCurrentPos([playerStartX, playerStartY]));

    let spawned = 0;

    if (isSmallMap) {
      const anchors = buildSpawnAnchors();
      setSpawnPoints(anchors);
      anchors.forEach((point, index) => {
        dispatch(
          addEnemy({
            index,
            id: pickSpawnEnemyType(),
            positionX: point.x,
            positionY: point.y,
          })
        );
        spawned += 1;
      });
    } else {
      const totalEnemies = Math.floor(Math.random() * 2) + 2;
      const nextTileY = playerStartY - 1;
      const nextTileIsWalkable = mapTiles[nextTileY] && mapTiles[nextTileY][playerStartX] > 0;

      if (nextTileIsWalkable) {
        for (let i = 0; i < totalEnemies; i++) {
          const enemyType = pickSpawnEnemyType();
          dispatch(
            addEnemy({
              index: spawned,
              id: enemyType,
              positionX: playerStartX,
              positionY: nextTileY,
            })
          );
          spawned += 1;
        }
      }
    }

    dispatch(setEnemyCount(spawned));
    dispatch(setCurrentEnemy(0));
  };

  useEffect(() => {
    if (menuMode !== 'game') {
      setInitialized(false);
      return;
    }

    if (initialized || !mapTiles || mapTiles.length === 0) return;
    spawnEnemies();
    setInitialized(true);
  }, [menuMode, initialized, mapTiles, mapHeight, mapWidth]);

  useEffect(() => {
    if (menuMode !== 'game' || !initialized || !isSmallMap || !mapTiles || mapTiles.length === 0) return;
    const anchors = buildSpawnAnchors();
    if (anchors.length > 0) {
      setSpawnPoints(anchors);
    }
  }, [menuMode, initialized, currentMapId, posX, posY, direction]);

  useEffect(() => {
    if (menuMode !== 'game' || !initialized || !isSmallMap) return;
    if (showDeathOverlay || revivePending) return;

    const current = { x: posX, y: posY, mapId: currentMapId };
    const prev = lastPosRef.current;

    if (!prev || prev.mapId !== current.mapId) {
      lastPosRef.current = current;
      stepCounterRef.current = 0;
      return;
    }

    const moved = prev.x !== current.x || prev.y !== current.y;
    if (!moved) return;

    lastPosRef.current = current;
    stepCounterRef.current += 1;

    if (stepCounterRef.current % RESPAWN_STEP_INTERVAL !== 0) return;
    if (aliveEnemies.length >= MAX_DYNAMIC_ENEMIES) return;

    const validPoints = spawnPoints.filter((point) => isSpawnSafe(point.x, point.y));
    if (validPoints.length === 0) return;

    const chosenPoint = validPoints[Math.floor(Math.random() * validPoints.length)];
    const nextIndex =
      Object.keys(enemies).length > 0 ? Math.max(...Object.keys(enemies).map(Number)) + 1 : 0;

    dispatch(
      addEnemy({
        index: nextIndex,
        id: pickSpawnEnemyType(),
        positionX: chosenPoint.x,
        positionY: chosenPoint.y,
      })
    );
    dispatch(setEnemyCount(aliveEnemies.length + 1));
  }, [
    menuMode,
    initialized,
    isSmallMap,
    posX,
    posY,
    currentMapId,
    showDeathOverlay,
    revivePending,
    spawnPoints,
    aliveEnemies.length,
    direction,
    enemies,
  ]);

  const continueGame = () => {
    setMenuMode('game');
  };

  const createNewGame = async () => {
    const saveData = buildCharacterFromArchetype(selectedArchetype, characterName.trim());
    await AsyncStorage.setItem('characters', JSON.stringify(saveData));
    await AsyncStorage.setItem('items', JSON.stringify(itemData));
    dispatch(emptyCombatLog());
    setCanContinue(true);
    setInitialized(false);
    setMenuMode('game');
  };

  useEffect(() => {
    if (revivePending) {
      return;
    }

    if (menuMode !== 'game') {
      setShowDeathOverlay(false);
      deathOpacity.setValue(0);
      return;
    }

    if (playerHealth > 0) {
      if (showDeathOverlay) {
        Animated.timing(deathOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setShowDeathOverlay(false));
      }
      return;
    }

    setShowDeathOverlay(true);
    Animated.timing(deathOpacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [menuMode, playerHealth, showDeathOverlay, deathOpacity, revivePending]);

  const skillHud = useMemo(() => {
    if (classArchetype === 'caster') {
      return {
        primaryLabel: `Arcane Bolt [18]`,
        secondaryLabel: `Fire Blast [32]`,
        primaryDisabled: mana < 18,
        secondaryDisabled: mana < 32,
      };
    }

    if (classArchetype === 'ranger') {
      return {
        primaryLabel: `Quick Stab [20]`,
        secondaryLabel: `Eviscerate [15]`,
        primaryDisabled: energy < 20,
        secondaryDisabled: energy < 15 || comboPoints <= 0,
      };
    }

    return {
      primaryLabel: `Crushing Blow [50]`,
      secondaryLabel: `Whirlwind [100]`,
      primaryDisabled: rage < 50,
      secondaryDisabled: rage < 100,
    };
  }, [classArchetype, rage, mana, energy, comboPoints, maxComboPoints]);

  const skillButtonsLocked = !inCombat || specialCooldownFrames > 0;
  const primaryResourceLocked = skillHud.primaryDisabled;
  const secondaryResourceLocked = skillHud.secondaryDisabled;
  const primaryDisabled = skillButtonsLocked || primaryResourceLocked;
  const secondaryDisabled = skillButtonsLocked || secondaryResourceLocked;
  const primaryText =
    specialCooldownFrames > 0 ? `${skillHud.primaryLabel} (${specialCooldownFrames})` : skillHud.primaryLabel;
  const secondaryText =
    specialCooldownFrames > 0 ? `${skillHud.secondaryLabel} (${specialCooldownFrames})` : skillHud.secondaryLabel;

  const restartAfterDeath = async () => {
    const storedData = await AsyncStorage.getItem('characters');
    const obj = storedData ? JSON.parse(storedData) : null;
    const currentClass = (obj?.character?.classArchetype || 'warrior') as ArchetypeId;
    const currentName = obj?.character?.name || 'Adventurer';

    const saveData = buildCharacterFromArchetype(currentClass, currentName);
    await AsyncStorage.setItem('characters', JSON.stringify(saveData));
    await AsyncStorage.setItem('items', JSON.stringify(itemData));

    const stats = saveData.character.stats;
    const weapon = saveData.character.equipment.weapon;
    const baseDef =
      (saveData.character.equipment.armor?.stats?.defence || 0) +
      (saveData.character.equipment.ring?.stats?.defence || 0) +
      (saveData.character.equipment.offhand?.stats?.defence || 0);
    const crit = (stats.crit || 0) + (weapon.stats.critMod || 0);
    const playerDmg = Math.floor(weapon.stats.damage + (stats.strength / 10) * 3);
    const playerAR = (weapon.stats.atkSpeed + stats.dexterity * 1) * 2;
    const playerDR = baseDef * (1 + stats.dexterity * 0.1);

    dispatch(setStats(stats));
    dispatch(setHealth(saveData.character.stats.health));
    dispatch(setXP(saveData.character.experience));
    dispatch(setLevel(saveData.character.level));
    dispatch(setPlayerDmg(playerDmg));
    dispatch(setAttackRating(playerAR));
    dispatch(setDefenceRating(playerDR));
    dispatch(setCrit(crit));
    dispatch(setEquipment(saveData.character.equipment));
    dispatch(setInventory(saveData.character.inventory));
    dispatch(
      setClassMeta({
        classArchetype: saveData.character.classArchetype || 'warrior',
        classLabel: saveData.character.classLabel || 'Warrior',
        specialName: saveData.character.specialName || 'Crushing Blow',
      })
    );

    dispatch(emptyCombatLog());
    dispatch(clearEnemies());
    dispatch(setInCombat(false));
    dispatch(setSpecialCooldown(0));

    setRevivePending(true);
    setInitialized(false);
    setShowDeathOverlay(false);
    deathOpacity.setValue(0);
    setSessionSeed((prev) => prev + 1);
    setMenuMode('game');
    setTimeout(() => setRevivePending(false), 900);
  };

  if (menuMode === 'start') {
    return (
      <View style={styles.menuRoot}>
        <View style={styles.menuCard}>
          <Text style={styles.title}>Dungeon Crawler</Text>
          <Text style={styles.subtitle}>Delve deeper. Survive longer.</Text>

          <TouchableOpacity
            style={[styles.menuButton, !canContinue && styles.menuButtonDisabled]}
            disabled={!canContinue}
            onPress={continueGame}
          >
            <Text style={styles.menuButtonText}>{canContinue ? 'Continue Game' : 'No Save Found'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuMode('create')}>
            <Text style={styles.menuButtonText}>New Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (menuMode === 'create') {
    return (
      <View style={styles.menuRoot}>
        <View style={styles.menuCard}>
          <Text style={styles.title}>Create Character</Text>
          <TextInput
            style={styles.input}
            placeholder="Character name"
            placeholderTextColor="#9ca3af"
            value={characterName}
            onChangeText={setCharacterName}
          />

          {ARCHETYPES.map((archetype) => (
            <TouchableOpacity
              key={archetype.id}
              style={[
                styles.archetypeCard,
                selectedArchetype === archetype.id && styles.archetypeCardSelected,
              ]}
              onPress={() => setSelectedArchetype(archetype.id)}
            >
              <Text style={styles.archetypeName}>{archetype.name}</Text>
              <Text style={styles.archetypeDesc}>{archetype.description}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.createButtonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMenuMode('start')}>
              <Text style={styles.menuButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={createNewGame}>
              <Text style={styles.menuButtonText}>Start Adventure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainScreen}>
      <Room
        key={`room-${sessionSeed}`}
        startCombat={startCombat}
        engagePlayerAttack={engagePlayerAttack}
        skillOverlay={
          <View style={styles.skillBar}>
            <TouchableOpacity
              style={[
                styles.skillButton,
                primaryDisabled && styles.skillButtonDisabled,
                primaryResourceLocked && styles.skillButtonFaded,
              ]}
              onPress={performPrimarySkill}
              disabled={primaryDisabled}
            >
              <Text style={styles.skillButtonText}>{primaryText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.skillButtonSecondary,
                secondaryDisabled && styles.skillButtonDisabled,
                secondaryResourceLocked && styles.skillButtonFaded,
              ]}
              onPress={performSecondarySkill}
              disabled={secondaryDisabled}
            >
              <Text style={styles.skillButtonText}>{secondaryText}</Text>
            </TouchableOpacity>
          </View>
        }
        rightOverlay={<ConsumableBelt />}
      />
      <Player
        key={`player-${sessionSeed}`}
        classLabel={classLabel}
      />
      {showDeathOverlay && (
        <Animated.View style={[styles.deathOverlay, { opacity: deathOpacity }]}>
          <Text style={styles.deathTitle}>YOU DIED</Text>
          <TouchableOpacity style={styles.restartButton} onPress={restartAfterDeath}>
            <Text style={styles.restartButtonText}>Restart</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainScreen: {
    width: 800,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 150,
  },
  menuRoot: {
    width: 800,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#05070d',
  },
  menuCard: {
    width: 540,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 20,
    gap: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 6,
  },
  menuButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  menuButtonDisabled: {
    backgroundColor: '#334155',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#f8fafc',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  archetypeCard: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#0f172a',
  },
  archetypeCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#052e1a',
  },
  archetypeName: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
  },
  archetypeDesc: {
    color: '#94a3b8',
    fontSize: 12,
  },
  createButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  deathOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  deathTitle: {
    color: '#f8fafc',
    fontSize: 58,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  restartButton: {
    backgroundColor: '#b91c1c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  restartButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },
  skillBar: {
    width: 210,
    gap: 6,
  },
  skillButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  skillButtonSecondary: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  skillButtonDisabled: {
    opacity: 0.65,
  },
  skillButtonFaded: {
    opacity: 0.38,
  },
  skillButtonText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
