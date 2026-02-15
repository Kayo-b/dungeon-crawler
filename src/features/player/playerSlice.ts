import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

let health = data.character.stats.health;
let experience = data.character.experience;
let damage = data.character.equipment.weapon.stats.damage;
let atkSpeed = data.character.equipment.weapon.stats.atkSpeed;
let level = data.character.level;
let stats = data.character.stats;
let equipment = data.character.equipment;
let critChance = data.character.stats.crit;
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
}

interface DmgPayload {
  dmg: number;
  crit: boolean;
  enemy: string;
}

const clampResource = (value: number, max: number) => {
  const safeMax = Math.max(0, Math.floor(max));
  return Math.max(0, Math.min(Math.floor(value), safeMax));
};

const getMaxMana = (playerStats: Record<string, any>) => {
  return Math.max(25, Math.floor(20 + (playerStats?.intelligence || 0) * 3));
};

const getMaxEnergy = (playerStats: Record<string, any>) => {
  return Math.max(60, Math.floor(60 + (playerStats?.dexterity || 0) * 1.5));
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
  state.maxRage = 100;
  state.maxMana = getMaxMana(state.stats);
  state.maxEnergy = getMaxEnergy(state.stats);
  state.maxComboPoints = 5;

  state.manaRegenPerTile = calculateRegenPerTile(state.equipment, 'mana');
  state.energyRegenPerTile = Math.max(1, 1 + calculateRegenPerTile(state.equipment, 'energy'));

  if (refill) {
    state.rage = 0;
    state.mana = state.maxMana;
    state.energy = state.maxEnergy;
    state.comboPoints = 0;
    return;
  }

  state.rage = clampResource(state.rage, state.maxRage);
  state.mana = clampResource(state.mana, state.maxMana);
  state.energy = clampResource(state.energy, state.maxEnergy);
  state.comboPoints = clampResource(state.comboPoints, state.maxComboPoints);
};

const initialState: CounterState = {
  health,
  playerDmg: damage,
  dmgLog: [],
  atkSpeed,
  experience,
  level,
  stats,
  attackRating: 0,
  defenceRating: 1,
  equipment,
  critChance,
  combatLog,
  classArchetype: 'warrior',
  classLabel: 'Warrior',
  specialName: 'Crushing Blow',
  rage: 0,
  maxRage: 100,
  mana: getMaxMana(stats),
  maxMana: getMaxMana(stats),
  manaRegenPerTile: calculateRegenPerTile(equipment as Record<string, any>, 'mana'),
  energy: getMaxEnergy(stats),
  maxEnergy: getMaxEnergy(stats),
  energyRegenPerTile: Math.max(1, 1 + calculateRegenPerTile(equipment as Record<string, any>, 'energy')),
  comboPoints: 0,
  maxComboPoints: 5,
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

      if (state.classArchetype === 'warrior' && action.payload.dmg > 0) {
        state.rage = clampResource(state.rage + 8, state.maxRage);
      }

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
    },
    setStats(state, action: PayloadAction<Record<string, any>>) {
      state.stats = action.payload;
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
      syncClassResources(state, false);
    },
    setCrit(state, action: PayloadAction<number>) {
      state.critChance = action.payload;
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
      syncClassResources(state, true);
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
      if (state.classArchetype === 'warrior') {
        state.rage = clampResource(state.rage - 10, state.maxRage);
      }

      if (state.classArchetype === 'ranger') {
        state.energy = clampResource(state.energy + state.energyRegenPerTile, state.maxEnergy);
      }

      if (state.classArchetype === 'caster' && state.manaRegenPerTile > 0) {
        state.mana = clampResource(state.mana + state.manaRegenPerTile, state.maxMana);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchEquipment.fulfilled, (state, action) => {
      state.equipment = action.payload;
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
  setCrit,
  setCombatLog,
  emptyCombatLog,
  restoreHealth,
  setClassMeta,
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
