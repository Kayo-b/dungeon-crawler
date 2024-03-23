import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';

let health = data.character.stats.health;
let vitality = data.character.stats.vitality;
let strength = data.character.stats.strength;
let damage = data.character.stats.baseDmg;

const calculateStats = () => {
    health = health + (Math.floor(vitality/10 * 4));
    damage = damage + (Math.floor(strength/10 * 3)); 
}

calculateStats();

interface CounterState {
    health: number;
    playerDmg: number;
    dmgLog: number[];
}

const initialState: CounterState = {
    health: health,
    playerDmg: damage,
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
   