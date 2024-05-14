import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;
let stats = data.enemies[1].stats;
// Get data from storage and set it to state

interface EnemyState {
    currentEnemyIndex: number;
    health: number;
    dmgLog: any;
    damage: number;
    atkRating: number;
    atkSpeed: number;
    defence: number;
    level: number;
    xp: number;
    stats: Object;

}

const enemyInitialState: EnemyState = {
    currentEnemyIndex: 1,
    health: data.enemies[1].stats.health,
    dmgLog: [],
    damage: data.enemies[1].stats.attack,
    atkRating: 0,
    atkSpeed: data.enemies[1].stats.atkSpeed,
    defence: data.enemies[1].stats.defence,
    level: data.enemies[1].info.level,
    xp: data.enemies[1].info.xp,
    stats: stats
}

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        dmg2Enemy(state, action: PayloadAction<number | string>) {
           state.health -= action.payload as number; 
           state.dmgLog.push(action.payload as number > 0 ? action.payload as number * -1 : "Miss");
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
        },
        setAttackRating(state, action: PayloadAction<number>) {
            state.atkRating = action.payload;
        },
        setStats(state, action: PayloadAction<Object>) {
            state.stats = action.payload;
        }

    }
})

export const { dmg2Enemy, changeEnemy, setAttackRating, setStats } = enemySlice.actions;
export default enemySlice.reducer;
