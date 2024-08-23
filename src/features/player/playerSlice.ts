import { createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit';
import { useEffect } from 'react';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch } from '../../app/hooks';

let health = data.character.stats.health;
let experience = data.character.experience;
let vitality = data.character.stats.vitality;
let strength = data.character.stats.strength;
let agility = data.character.stats.dexterity;
let damage = data.character.equipment.weapon.stats.damage;
let atkSpeed = data.character.equipment.weapon.stats.atkSpeed;
let level = data.character.level;
let stats = data.character.stats;
let equipment = data.character.equipment;
let critChance = data.character.stats.crit;
let combatLog: any = [0]

//Save in storage
async function saveData(health: number) {
    const data = await AsyncStorage.getItem('characters');
    const obj = data ? JSON.parse(data) : {};
    obj.character.stats.health = health;
    await AsyncStorage.setItem('characters', JSON.stringify(obj));
}

// Get data from storage and set it to state
async function getData() {
    const data = await AsyncStorage.getItem('characters');
    const obj = data ? JSON.parse(data) : {};
    equipment = obj.character.equipment;
    stats = obj.character.stats;
    // await AsyncStorage.setItem('characters',JSON.stringify(obj));
    console.log("SETDATA player slice", equipment);
    return equipment;
}

// async function getData() {
//     const data = await AsyncStorage.getItem('characters');
//     const obj = data ? JSON.parse(data) : {};
//     stats = obj.character.stats; 
//     await AsyncStorage.setItem('characters',JSON.stringify(obj));
// }
// All the stats calculations and how each primary stats affect the secondary stats 
// has to be reworked at some point, agility for example doesn't give atk speed in most
// rpgs, maybe its not a good idea. But at the same time some kind of atk speed afix 
// has to be implemented because the cooldown based combat, who attacks first is important. 
// const calculateStats = () => {
//     console.log(stats.strength, "STR in calculateStats")
//     health = health + (Math.floor(vitality/10 * 4));
//     damage = damage + (Math.floor(stats.strength/10 * 3)); // improve 
//     // console.log(strength, "STR")
//     console.log(damage, "DMG")
//     atkSpeed = atkSpeed + (agility/200); //1 agility = +0.5% atkSpeed
//     console.log(stats, "< Stats")
// }
// getData();
// calculateStats();

interface Equipment {
    name: string,
    key: string,
}

interface CounterState {
    health: number;
    playerDmg: number;
    dmgLog: any[];
    atkSpeed: number;
    experience: number;
    level: number;
    stats: Object;
    attackRating: number;
    defenceRating: number;
    equipment: Object;
    critChance: number;
    combatLog: any;
}
interface DmgPayload {
    dmg: number;
    crit: boolean;
}

const initialState: CounterState = {
    health: health,
    playerDmg: damage,
    dmgLog: [],
    atkSpeed: atkSpeed,
    experience: experience,
    level: level,
    stats: stats,
    attackRating: 0,
    defenceRating: 1,
    equipment: equipment,
    critChance: critChance,
    combatLog: combatLog,
}

export const fetchEquipment = createAsyncThunk('counter/fetchEquipment', async () => {
    const data = await AsyncStorage.getItem('characters');
    const obj = data ? JSON.parse(data) : {};
    return obj.character.equipment || [];
});

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
        dmg2Player(state, action: PayloadAction<DmgPayload>) {
            state.health -= action.payload.dmg as number;
            console.log(action.payload.dmg, "PAYLOAD player");
            state.dmgLog.push(action.payload);
            console.log("DMG HELOOOOO", action.payload.dmg)
            console.log("DMG HELOOOOO", action.payload)
            console.log("DMG HELOOOOO", state.dmgLog[state.dmgLog.length -1]);
            saveData(state.health);
        },
        setPlayerDmg(state, action: PayloadAction<number>) {
            state.playerDmg = action.payload;
        },
        XP(state, action: PayloadAction<number>) {
            console.log(action.payload, "action")
            state.experience += action.payload;
        },
        setHealth(state, action: PayloadAction<number>) {
            state.health = action.payload;
        },
        setXP(state, action: PayloadAction<number>) {
            state.experience = action.payload;
        },
        levelUp(state) {
            state.level++;
        },
        setLevel(state, action: PayloadAction<number>) {
            state.level = action.payload;
        },
        setStats(state, action: PayloadAction<Object>) {
            state.stats = action.payload;
            // state.stats.vitality = action.payload;
            // state.stats.agility = action.payload;
        },
        setAttackRating(state, action: PayloadAction<number>) {
            state.attackRating = action.payload;
        },
        setDefenceRating(state, action: PayloadAction<number>) {
            state.defenceRating = action.payload;
        },
        setEquipment(state, action: PayloadAction<Object>) {
            state.equipment = action.payload;
        },
        setCrit(state, action: PayloadAction<number>) {
            state.critChance = action.payload;
        },
        setCombatLog(state, action: PayloadAction<any>) {
            state.combatLog.push(action.payload);
        },
        emptyCombatLog(state) {
            state.combatLog = [];
        }
        
    },
    extraReducers: (builder) => {
        builder.addCase(fetchEquipment.fulfilled, (state, action) => {
            state.equipment = action.payload;
        });
    },
})

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
    emptyCombatLog
} = playerSlice.actions;

export default playerSlice.reducer;


