import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeDerivedPlayerStats } from './playerStats';

let health = data.character.stats.health;
let experience = data.character.experience;
let level = data.character.level;
let stats = data.character.stats;
let equipment = data.character.equipment;
let unspentStatPoints = Number((data.character as any).unspentStatPoints || 0);
let gold = Number((data.character as any).gold || 0);
let combatLog: string[] = [];

async function saveData(nextHealth: number) {
  const storedData = await AsyncStorage.getItem('characters');
  const obj = storedData ? JSON.parse(storedData) : {};
  if (!obj.character) return;
  obj.character.stats.health = nextHealth;
  await AsyncStorage.setItem('characters', JSON.stringify(obj));
}

interface CounterState {
  health: number;
  playerDmg: number;
  dmgLog: any[];
  atkSpeed: number;
  experience: number;
  level: number;
  stats: Record<string, any>;
  attackRating: number;
  defenceRating: number;
  equipment: Record<string, any>;
  critChance: number;
  dodgeChance: number;
  unspentStatPoints: number;
  combatLog: string[];
  classArchetype: string;
  classLabel: string;
  specialName: string;
  rage: number;
  maxRage: number;
  mana: number;
  maxMana: number;
  manaRegenPerTile: number;
  energy: number;
  maxEnergy: number;
  energyRegenPerTile: number;
  comboPoints: number;
  maxComboPoints: number;
  gold: number;
}

interface DmgPayload {
  dmg: number;
  crit: boolean;
  enemy: string;
}

const clampResource = (value: number, max: number) => {
  const safeMax = Math.max(0, max);
  return Math.max(0, Math.min(value, safeMax));
};

const readRegenFromMods = (mods: unknown, resourceName: 'mana' | 'energy') => {
  if (!Array.isArray(mods)) return 0;

  return mods.reduce((total, mod) => {
    if (typeof mod !== 'string') return total;

    const normalized = mod.toLowerCase();
    if (!normalized.includes(resourceName) || !normalized.includes('reg')) return total;

    const match = normalized.match(/([+-]?\d+)/);
    if (!match) return total;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
};

const calculateRegenPerTile = (equipmentState: Record<string, any>, resourceName: 'mana' | 'energy') => {
  if (!equipmentState || typeof equipmentState !== 'object') {
    return 0;
  }

  const keyCandidates =
    resourceName === 'mana'
      ? ['manaRegenPerTile', 'manaRegen', 'mana_regen_per_tile']
      : ['energyRegenPerTile', 'energyRegen', 'energy_regen_per_tile'];

  const itemValues = Object.values(equipmentState).reduce((sum, item) => {
    if (!item || typeof item !== 'object') return sum;

    const statsObj = (item as any).stats;
    const statBonus = keyCandidates.reduce((bonus, key) => {
      const val = statsObj?.[key];
      if (typeof val === 'number' && Number.isFinite(val)) {
        return bonus + val;
      }
      return bonus;
    }, 0);

    const modBonus = readRegenFromMods((item as any).mods, resourceName);
    return sum + statBonus + modBonus;
  }, 0);

  return Math.max(0, Math.floor(itemValues));
};

const syncClassResources = (state: CounterState, refill: boolean) => {
  const derived = computeDerivedPlayerStats(state.stats, state.equipment, {
    classArchetype: state.classArchetype,
    level: state.level,
  });

  state.maxRage = 0;
  state.maxMana = derived.maxMana;
  state.maxEnergy = 0;
  state.maxComboPoints = 5;

  state.manaRegenPerTile = Math.max(1, 1 + calculateRegenPerTile(state.equipment, 'mana'));
  state.energyRegenPerTile = 0;

  if (refill) {
    state.rage = 0;
    state.mana = state.maxMana;
    state.energy = 0;
    state.comboPoints = 0;
    return;
  }

  state.rage = 0;
  state.mana = clampResource(state.mana, state.maxMana);
  state.energy = 0;
  state.comboPoints = clampResource(state.comboPoints, state.maxComboPoints);
};

const syncDerivedCombatState = (state: CounterState) => {
  const derived = computeDerivedPlayerStats(state.stats, state.equipment, {
    classArchetype: state.classArchetype,
    level: state.level,
  });
  state.playerDmg = derived.playerDmg;
  state.attackRating = derived.attackRating;
  state.defenceRating = derived.defenceRating;
  state.atkSpeed = derived.atkSpeed;
  state.critChance = derived.critChance;
  state.dodgeChance = derived.dodgeChance;
};

const initialDerived = computeDerivedPlayerStats(stats, equipment, {
  classArchetype: 'warrior',
  level,
});

const initialState: CounterState = {
  health,
  playerDmg: initialDerived.playerDmg,
  dmgLog: [],
  atkSpeed: initialDerived.atkSpeed,
  experience,
  level,
  stats,
  attackRating: initialDerived.attackRating,
  defenceRating: initialDerived.defenceRating,
  equipment,
  critChance: initialDerived.critChance,
  dodgeChance: initialDerived.dodgeChance,
  unspentStatPoints,
  combatLog,
  classArchetype: 'warrior',
  classLabel: 'Warrior',
  specialName: 'Crushing Blow',
  rage: 0,
  maxRage: 0,
  mana: initialDerived.maxMana,
  maxMana: initialDerived.maxMana,
  manaRegenPerTile: Math.max(1, 1 + calculateRegenPerTile(equipment as Record<string, any>, 'mana')),
  energy: 0,
  maxEnergy: 0,
  energyRegenPerTile: 0,
  comboPoints: 0,
  maxComboPoints: 5,
  gold: Math.max(0, gold),
};

export const fetchEquipment = createAsyncThunk('counter/fetchEquipment', async () => {
  const storedData = await AsyncStorage.getItem('characters');
  const obj = storedData ? JSON.parse(storedData) : {};
  return obj.character.equipment || [];
});

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    dmgPlayer(state) {
      state.health -= 1;
    },
    dmg2Player(state, action: PayloadAction<DmgPayload>) {
      state.health -= action.payload.dmg;
      state.dmgLog.push(action.payload);

      saveData(state.health);
    },
    restoreHealth(state, action: PayloadAction<number>) {
      state.health += action.payload;
    },
    setPlayerDmg(state, action: PayloadAction<number>) {
      state.playerDmg = action.payload;
    },
    XP(state, action: PayloadAction<number>) {
      state.experience += action.payload;
    },
    setHealth(state, action: PayloadAction<number>) {
      state.health = action.payload;
    },
    setXP(state, action: PayloadAction<number>) {
      state.experience = action.payload;
    },
    levelUp(state) {
      state.level += 1;
    },
    setLevel(state, action: PayloadAction<number>) {
      state.level = action.payload;
      syncDerivedCombatState(state);
      syncClassResources(state, false);
    },
    setStats(state, action: PayloadAction<Record<string, any>>) {
      state.stats = action.payload;
      syncDerivedCombatState(state);
      syncClassResources(state, false);
    },
    setAttackRating(state, action: PayloadAction<number>) {
      state.attackRating = action.payload;
    },
    setDefenceRating(state, action: PayloadAction<number>) {
      state.defenceRating = action.payload;
    },
    setEquipment(state, action: PayloadAction<Record<string, any>>) {
      state.equipment = action.payload;
      syncDerivedCombatState(state);
      syncClassResources(state, false);
    },
    setAtkSpeed(state, action: PayloadAction<number>) {
      state.atkSpeed = Math.max(0.25, action.payload);
    },
    setCrit(state, action: PayloadAction<number>) {
      state.critChance = action.payload;
    },
    setDodge(state, action: PayloadAction<number>) {
      state.dodgeChance = Math.max(0, Math.min(0.9, action.payload));
    },
    setUnspentStatPoints(state, action: PayloadAction<number>) {
      state.unspentStatPoints = Math.max(0, Math.floor(action.payload));
    },
    setCombatLog(state, action: PayloadAction<string>) {
      state.combatLog.push(action.payload);
    },
    emptyCombatLog(state) {
      state.combatLog = [];
    },
    setClassMeta(state, action: PayloadAction<{ classArchetype: string; classLabel: string; specialName: string }>) {
      state.classArchetype = action.payload.classArchetype;
      state.classLabel = action.payload.classLabel;
      state.specialName = action.payload.specialName;
      syncDerivedCombatState(state);
      syncClassResources(state, true);
    },
    setGold(state, action: PayloadAction<number>) {
      state.gold = Math.max(0, Number(action.payload || 0));
    },
    addGold(state, action: PayloadAction<number>) {
      const increment = Math.max(0, Number(action.payload || 0));
      state.gold = Math.max(0, Number((state.gold + increment).toFixed(2)));
    },
    gainRage(state, action: PayloadAction<number>) {
      if (state.classArchetype !== 'warrior') return;
      state.rage = clampResource(state.rage + action.payload, state.maxRage);
    },
    spendRage(state, action: PayloadAction<number>) {
      if (state.classArchetype !== 'warrior') return;
      state.rage = clampResource(state.rage - action.payload, state.maxRage);
    },
    restoreMana(state, action: PayloadAction<number>) {
      state.mana = clampResource(state.mana + action.payload, state.maxMana);
    },
    spendMana(state, action: PayloadAction<number>) {
      state.mana = clampResource(state.mana - action.payload, state.maxMana);
    },
    restoreEnergy(state, action: PayloadAction<number>) {
      state.energy = clampResource(state.energy + action.payload, state.maxEnergy);
    },
    spendEnergy(state, action: PayloadAction<number>) {
      state.energy = clampResource(state.energy - action.payload, state.maxEnergy);
    },
    addComboPoint(state, action: PayloadAction<number>) {
      state.comboPoints = clampResource(state.comboPoints + action.payload, state.maxComboPoints);
    },
    resetComboPoints(state) {
      state.comboPoints = 0;
    },
    consumeAllComboPoints(state) {
      state.comboPoints = 0;
    },
    regenResourcesOnTile(state) {
      if (state.manaRegenPerTile > 0) {
        state.mana = clampResource(state.mana + state.manaRegenPerTile, state.maxMana);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchEquipment.fulfilled, (state, action) => {
      state.equipment = action.payload;
      syncDerivedCombatState(state);
      syncClassResources(state, false);
    });
  },
});

export const {
  dmgPlayer,
  dmg2Player,
  XP,
  setHealth,
  setXP,
  setLevel,
  levelUp,
  setStats,
  setPlayerDmg,
  setAttackRating,
  setDefenceRating,
  setEquipment,
  setAtkSpeed,
  setCrit,
  setDodge,
  setUnspentStatPoints,
  setCombatLog,
  emptyCombatLog,
  restoreHealth,
  setClassMeta,
  setGold,
  addGold,
  gainRage,
  spendRage,
  restoreMana,
  spendMana,
  restoreEnergy,
  spendEnergy,
  addComboPoint,
  resetComboPoints,
  consumeAllComboPoints,
  regenResourcesOnTile,
} = playerSlice.actions;

export default playerSlice.reducer;
