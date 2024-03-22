import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;

interface EnemyState {
    currentEnemyIndex: number;
    health: number;
    dmgLog: number[];
    damage: number;
    atkSpeed: number;

}

const enemyInitialState: EnemyState = {
    currentEnemyIndex: 1,
    health: data.enemies[1].stats.health,
    dmgLog: [],
    damage: data.enemies[1].stats.attack,
    atkSpeed: data.enemies[1].stats.atkSpeed,
}

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        dmg2Enemy(state, action: PayloadAction<number>) {
           state.health -= action.payload; 
           state.dmgLog.push(action.payload * -1);
        },
        changeEnemy(state, action: PayloadAction<number>) {
            state.currentEnemyIndex = action.payload;
            state.health = data.enemies[action.payload].stats.health;   
            state.damage = data.enemies[action.payload].stats.attack;
        }
    }
})

export const { dmg2Enemy, changeEnemy } = enemySlice.actions;
export default enemySlice.reducer;
