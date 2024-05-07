import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;

interface EnemyState {
    currentEnemyIndex: number;
    health: number;
    dmgLog: any;
    damage: number;
    atkSpeed: number;
    defence: number;
    level: number;
    xp: number;

}

const enemyInitialState: EnemyState = {
    currentEnemyIndex: 1,
    health: data.enemies[1].stats.health,
    dmgLog: [],
    damage: data.enemies[1].stats.attack,
    atkSpeed: data.enemies[1].stats.atkSpeed,
    defence: data.enemies[1].stats.defence,
    level: data.enemies[1].info.level,
    xp: data.enemies[1].info.xp
}

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        dmg2Enemy(state, action: PayloadAction<number>) {
           state.health -= action.payload; 
           state.dmgLog.push(action.payload > 0 ? action.payload * -1 : "Miss");
           console.log(action.payload,"DMG LOG")
        },
        changeEnemy(state, action: PayloadAction<number>) {
            state.currentEnemyIndex = action.payload;
            state.health = data.enemies[action.payload].stats.health;   
            state.damage = data.enemies[action.payload].stats.attack;
            state.atkSpeed = data.enemies[action.payload].stats.atkSpeed;
            state.xp = data.enemies[action.payload].info.xp;
            state.defence = data.enemies[action.payload].stats.defence;
            state.level = data.enemies[action.payload].info.level;
        }
    }
})

export const { dmg2Enemy, changeEnemy } = enemySlice.actions;
export default enemySlice.reducer;
