import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';

const playerHealth = data.character.stats.health;

interface CounterState {
    value: number;
    dmgLog: number[];
}

const initialState: CounterState = {
    value: playerHealth,
    dmgLog: [],
}

const playerSlice = createSlice({
    name: 'playerhealth',
    initialState,
    reducers: {
        // increment
        dmgPlayer(state) {
            // adding immutable code using immer so we can use mutable syntax and 
            // immer makes it immutable (aka copy add value to copy...) 
            state.value--;
        },
        dmg2Player(state, action: PayloadAction<number>) {
            state.value -= action.payload; 
            state.dmgLog.push(action.payload);
        }  
    },

})

export const { dmgPlayer, dmg2Player } = playerSlice.actions
export default playerSlice.reducer;
   