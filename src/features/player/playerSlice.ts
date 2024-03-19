import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';

const playerHealth = data.character.stats.health;

interface CounterState {
    health: number;
    dmgLog: number[];
}

const initialState: CounterState = {
    health: playerHealth,
    dmgLog: [],
}

const playerSlice = createSlice({
    name: 'player',
    initialState,
    reducers: {
        // increment
        dmgPlayer(state) {
            // adding immutable code using immer so we can use mutable syntax and 
            // immer makes it immutable (aka copy add value to copy...) 
            state.health--;
        },
        dmg2Player(state, action: PayloadAction<number>) {
            state.health -= action.payload; 
            state.dmgLog.push(action.payload);
        }  
    },

})

export const { dmgPlayer, dmg2Player } = playerSlice.actions
export default playerSlice.reducer;
   