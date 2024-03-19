import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;

interface EnemyState {
    currentEnemyIndex: number;
    health: number;
    dmgLog: number[];
    enemyDmg: number;

}

const enemyInitialState: EnemyState = {
    currentEnemyIndex: 0,
    health: data.enemies[0].stats.health,
    dmgLog: [],
    enemyDmg: data.enemies[0].stats.attack
}

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        dmgTaken(state, action: PayloadAction<number>) {
           state.health -= action.payload; 
           state.dmgLog.push(action.payload * -1);
        },
        changeEnemy(state, action: PayloadAction<number>) {
            state.currentEnemyIndex = action.payload;
            state.health = data.enemies[action.payload].stats.health;   
            state.enemyDmg = data.enemies[action.payload].stats.attack;
        }
    }
})

export const { dmgTaken, changeEnemy } = enemySlice.actions;
export default enemySlice.reducer;
