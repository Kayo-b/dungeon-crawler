import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;
const stats = data.enemies[1].stats;
const loot = data.enemies[1].loot;
const info = data.enemies[1].info;
// Get data from storage and set it to state
interface EnemyStats {
  health: number;
  attack: number;
  strength: number;
  dexterity: number;
  stamina: number;
  vitality: number;
  intelligence: number;
  defence: number;
  atkSpeed: number;
  crit: number;
  dodge: number;
}
interface LootItem {
  name: string;
  type: string;
  ID: number;
  dropChance: number;
  amount?: number;
}
interface EnemyInfo {
  name: string;
  level: number;
  xp: number;
}
interface Enemy {
  stats: EnemyStats;
  loot: LootItem[];
  info: EnemyInfo;
}
interface infoObj {
    name: String
}
interface enemies {
    stats: Number;
    loot: string;
}
interface EnemyState {
    currentEnemyIndex: number;
    enemies:Enemy[]; 
    health: number;
    dmgLog: any;
    damage: number;
    atkRating: number;
    atkSpeed: number;
    defence: number;
    level: number;
    xp: number;
    stats: Object;
    loot: Object[];
    info: infoObj;
}
interface DmgPayload {
 dmg: number;
 crit: boolean;
}
const enemyInitialState: EnemyState = {
    currentEnemyIndex: 1,
    enemies: data.enemies,
    health: data.enemies[1].stats.health,
    dmgLog: [],
    damage: data.enemies[1].stats.attack,
    atkRating: 0,
    atkSpeed: data.enemies[1].stats.atkSpeed,
    defence: data.enemies[1].stats.defence,
    level: data.enemies[1].info.level,
    xp: data.enemies[1].info.xp,
    stats: stats,
    loot: loot,
    info: info
}

export const fetchEnemies = createAsyncThunk('enemies/fetchEnemies', async () => {
    const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
    return obj.enemies || [];
});

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        dmg2Enemy(state, action: PayloadAction<DmgPayload>) {
           state.health -= action.payload.dmg as number; 
           console.log(action.payload.crit, "PAYLOAD")
           console.log(action.payload.dmg, "PAYLOAD")
        //    state.dmgLog.push(action.payload.dmg as number > 0 ?
        //     action.payload.dmg : "Miss");     
            state.dmgLog.push(action.payload)
        },
        changeEnemy(state, action: PayloadAction<number>) {
            state.currentEnemyIndex = action.payload;
            state.health = data.enemies[action.payload].stats.health;   
            state.damage = data.enemies[action.payload].stats.attack;
            state.atkSpeed = data.enemies[action.payload].stats.atkSpeed;
            state.xp = data.enemies[action.payload].info.xp;
            state.defence = data.enemies[action.payload].stats.defence;
            state.level = data.enemies[action.payload].info.level;
            state.stats = data.enemies[action.payload].stats;
            console.log(data.enemies[action.payload].loot, "ACTION!")
            state.loot = data.enemies[action.payload].loot;
            state.info = data.enemies[action.payload].info;
        },
        setAttackRating(state, action: PayloadAction<number>) {
            state.atkRating = action.payload;
        },
        setStats(state, action: PayloadAction<Object>) {
            state.stats = action.payload;
        },
        emptyDmgLog(state) {
            state.dmgLog = [];
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchEnemies.fulfilled, (state, action) => {
            state.enemies = action.payload
        })
    }
})

export const { dmg2Enemy, changeEnemy, setAttackRating, setStats, emptyDmgLog } = enemySlice.actions;
export default enemySlice.reducer;
