import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';

let health = data.character.stats.health;
let vitality = data.character.stats.vitality;
let strength = data.character.stats.strength;
let agility = data.character.stats.agility; 
let damage = data.character.stats.baseDmg;
let atkSpeed = data.character.stats.atkSpeed;

// All the stats calculations and how each primary stats affect the secondary stats 
// has to be reworked at some point, agility for example doesn't give atk speed in most
// rpgs, maybe its not a good idea. But at the same time some kind of atk speed afix 
// has to be implemented because the cooldown based combat, who attacks first is important. 
const calculateStats = () => {
    health = health + (Math.floor(vitality/10 * 4));
    damage = damage + (Math.floor(strength/10 * 3)); // improve 
    atkSpeed = atkSpeed + (agility/200); //1 agility = +0.5% atkSpeed
}

calculateStats();

interface CounterState {
    health: number;
    playerDmg: number;
    dmgLog: number[];
    atkSpeed: number;
}

const initialState: CounterState = {
    health: health,
    playerDmg: damage,
    dmgLog: [],
    atkSpeed: atkSpeed
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
   