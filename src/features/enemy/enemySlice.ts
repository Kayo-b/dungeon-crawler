import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
const enemyHealth = data.enemies[0].stats.health;

interface EnemyState {
    value: number;
    dmgLog: number[];
}

const enemyInitialState: EnemyState = {
    value: enemyHealth,
    dmgLog: [],
}

const enemySlice = createSlice({
    name: 'enemyhealth',
    initialState: enemyInitialState,
    reducers: {
        dmg(state) {
            state.value--;
        },
        dmg2(state, action: PayloadAction<number>) {
           state.value -= action.payload; 
           state.dmgLog.push(action.payload * -1);
        }
    }
})

export const { dmg, dmg2 } = enemySlice.actions;
export default enemySlice.reducer;
