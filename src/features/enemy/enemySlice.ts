import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnemyAttackStyle, EnemyDisposition, EnemyVisibilityMode, getEnemyBehaviorForType } from './enemyPerception';

const enemyHealth = data.enemies[0].stats.health;
const enemyDmg = data.enemies[0].stats.attack;
const stats = data.enemies[1].stats;
const loot = data.enemies[1].loot;
const info = data.enemies[1].info;
// Get data from storage and set it to state
interface EnemyStats {
  health: number;
  attack: number;
  strength: number;
  dexterity: number;
  stamina: number;
  vitality: number;
  intelligence: number;
  defence: number;
  atkSpeed: number;
  crit: number;
  dodge: number;
}
interface LootItem {
  name: string;
  type: string;
  ID: number;
  dropChance: number;
  amount?: number;
}
interface EnemyInfo {
  name: string;
  level: number;
  xp: number;
}
interface Enemy {
  stats: EnemyStats;
  loot: LootItem[];
  info: EnemyInfo;
}
interface infoObj {
    name: String
}
interface enemies {
    stats: Number;
    loot: string;
}
interface EnemyState {
    enemies: {
        [key: number]: {
            id: number
            health: number;
            dmgLog: DmgPayload[];
            damage: number;
            atkRating: number;
            atkSpeed: number;
            defence: number;
            level: number;
            xp: number;
            stats: EnemyStats;
            loot: LootItem[];
            info: EnemyInfo;
            // Position on the map
            positionX: number;
            positionY: number;
            visibilityMode: EnemyVisibilityMode;
            visibilityRange: number;
            attackStyle: EnemyAttackStyle;
            attackRange: number;
            playerEngageRange: number;
            firstStrike: boolean;
            disposition: EnemyDisposition;
        }
    };
    
    enemiesStorage: {
        [key: number]: {
            id: number;
            health: number;
            dmgLog: DmgPayload[];
            damage: number;
            atkRating: number;
            atkSpeed: number;
            defence: number;
            level: number;
            xp: number;
            stats: EnemyStats;
            loot: LootItem[];
            info: EnemyInfo;
            // Position on the map
            positionX: number;
            positionY: number;
            visibilityMode: EnemyVisibilityMode;
            visibilityRange: number;
            attackStyle: EnemyAttackStyle;
            attackRange: number;
            playerEngageRange: number;
            firstStrike: boolean;
            disposition: EnemyDisposition;
        }
    };
    currentEnemyId: number;
}
interface DmgPayload {
 dmg: number;
 crit: boolean;
}
// const enemyInitialState: EnemyState = {
//     currentEnemyIndex: 1,
//     enemies: data.enemies,
//     health: data.enemies[1].stats.health,
//     dmgLog: [],
//     damage: data.enemies[1].stats.attack,
//     atkRating: 0,
//     atkSpeed: data.enemies[1].stats.atkSpeed,
//     defence: data.enemies[1].stats.defence,
//     level: data.enemies[1].info.level,
//     xp: data.enemies[1].info.xp,
//     stats: stats,
//     loot: loot,
//     info: info
// }
const enemyInitialState: EnemyState = {
    // enemies: {},
    enemies: {
        // 0: {
        //     id: 0,
        //     health: 0,//data.enemies[0].stats.health,
        //     dmgLog: [],
        //     damage: 0,//data.enemies[0].stats.attack,
        //     atkRating: 0,
        //     atkSpeed: 0,//data.enemies[0].stats.atkSpeed,
        //     defence: 0,//data.enemies[0].stats.defence,
        //     level: 0,//data.enemies[0].info.level,
        //     xp: 0,//data.enemies[0].info.xp,
        //     stats: {},//stats,
        //     loot: {},//loot,
        //     info: {},//info,
        // },
        // 1: {
        //     health: data.enemies[1].stats.health,
        //     dmgLog: [],
        //     damage: data.enemies[1].stats.attack,
        //     atkRating: 0,
        //     atkSpeed: data.enemies[1].stats.atkSpeed,
        //     defence: data.enemies[1].stats.defence,
        //     level: data.enemies[1].info.level,
        //     xp: data.enemies[1].info.xp,
        //     stats: stats,
        //     loot: loot,
        //     info: info,
        // }
    },
    enemiesStorage: {
        // 0:{
        //     id: 0,
        //     health: 0,//data.enemies[0].stats.health,
        //     dmgLog: [],
        //     damage: 0,//data.enemies[0].stats.attack,
        //     atkRating: 0,
        //     atkSpeed: 0,//data.enemies[0].stats.atkSpeed,
        //     defence: 0,//data.enemies[0].stats.defence,
        //     level: 0,//data.enemies[0].info.level,
        //     xp: 0,//data.enemies[0].info.xp,
        //     stats: {},//stats,
        //     loot: {},//loot,
        //     info: {},//info,
        // }

    },
    currentEnemyId: 0
}

export const fetchEnemies = createAsyncThunk('enemies/fetchEnemies', async () => {
    const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
    return obj.enemies || [];
});

const enemySlice = createSlice({
    name: 'enemy',
    initialState: enemyInitialState,
    reducers: {
        addEnemy(state, action: PayloadAction<{index: number, id: number, positionX?: number, positionY?: number, strengthScale?: number, rewardScale?: number}>) {
            // clearEnemies();
            const {index, id, positionX = 0, positionY = 0, strengthScale = 1, rewardScale} = action.payload;
            const behavior = getEnemyBehaviorForType(id);
            const combatScale = Math.max(1, strengthScale);
            const lootAndXpScale = Math.max(1, rewardScale ?? combatScale);
            const baseEnemy = data.enemies[id];
            const baseStats = baseEnemy.stats;
            const baseInfo = baseEnemy.info;
            const scaledStats = {
                ...baseStats,
                health: Math.max(1, Math.floor(baseStats.health * (1 + (combatScale - 1) * 0.55))),
                attack: Math.max(1, Math.floor(baseStats.attack * (1 + (combatScale - 1) * 0.40))),
                strength: Math.max(1, Math.floor(baseStats.strength * (1 + (combatScale - 1) * 0.20))),
                dexterity: Math.max(1, Math.floor(baseStats.dexterity * (1 + (combatScale - 1) * 0.16))),
                stamina: Math.max(1, Math.floor(baseStats.stamina * (1 + (combatScale - 1) * 0.20))),
                vitality: Math.max(1, Math.floor(baseStats.vitality * (1 + (combatScale - 1) * 0.20))),
                intelligence: Math.max(1, Math.floor(baseStats.intelligence * (1 + (combatScale - 1) * 0.12))),
                defence: Math.max(1, Math.floor(baseStats.defence * (1 + (combatScale - 1) * 0.30))),
            };
            const scaledLevel = baseInfo.level + Math.max(0, Math.floor(combatScale - 1));
            const scaledXp = Math.max(1, Math.floor(baseInfo.xp * lootAndXpScale));
            const scaledLoot = (baseEnemy.loot || []).map((lootItem: LootItem) => ({
                ...lootItem,
                dropChance: Math.min(1.95, Math.max(0.01, lootItem.dropChance * lootAndXpScale)),
                amount:
                    typeof lootItem.amount === 'number'
                        ? Math.max(1, Math.floor(lootItem.amount * lootAndXpScale))
                        : lootItem.amount,
            }));
            console.log(index, id, positionX, positionY, "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<,,")
            state.enemies[index] = {
                id: id,
                health: scaledStats.health,
                dmgLog: [],
                damage: scaledStats.attack,
                atkRating: 0,
                atkSpeed: scaledStats.atkSpeed,
                defence: scaledStats.defence,
                level: scaledLevel,
                xp: scaledXp,
                stats: scaledStats,
                loot: scaledLoot,
                info: {
                    ...baseInfo,
                    level: scaledLevel,
                    xp: scaledXp,
                },
                positionX: positionX,
                positionY: positionY,
                visibilityMode: behavior.visibilityMode,
                visibilityRange: behavior.visibilityRange,
                attackStyle: behavior.attackStyle,
                attackRange: behavior.attackRange,
                playerEngageRange: behavior.playerEngageRange,
                firstStrike: behavior.firstStrike,
                disposition: behavior.disposition,
            };
            state.enemiesStorage = state.enemies;
            console.log("ENEMY ADDED!!!")
        },
        dmg2Enemy(state, action: PayloadAction<{ id: number, damage: DmgPayload }>) {
            const { id, damage } = action.payload;
            state.enemies[id].health -= damage.dmg;
            state.enemies[id].dmgLog.push(damage);
            console.log(state.enemies[id], "STATE ENEMIES")
            console.log(damage.dmg, "DMG  STATE ")
        },
        setCurrentEnemy(state, action: PayloadAction<number>) {
            state.currentEnemyId = action.payload;
        },
        setAttackRating(state, action: PayloadAction<{ id: number, rating: number }>) {
            state.enemies[action.payload.id].atkRating = action.payload.rating;
        },
        emptyDmgLog(state, action: PayloadAction<number>) {
            state.enemies[action.payload].dmgLog = [];
        },
        removeEnemy(state, action: PayloadAction<number>) {
            const idToRemove = action.payload;
            delete state.enemies[idToRemove];
            state.currentEnemyId = 1;
            state.enemies
            console.log("ENEMY REMOVED!!!", Object.values(state.enemies), state.currentEnemyId)
        },
        clearEnemies(state) {
            state.enemies = {};
        }
    },
    extraReducers: (builder) => {        builder.addCase(fetchEnemies.fulfilled, (state, action) => {
            action.payload.forEach((enemy: Enemy, index: number) => {
                const behavior = getEnemyBehaviorForType(index);
                state.enemiesStorage[index] = {
                    id: index,
                    health: enemy.stats.health,
                    dmgLog: [],
                    damage: enemy.stats.attack,
                    atkRating: 0,
                    atkSpeed: enemy.stats.atkSpeed,
                    defence: enemy.stats.defence,
                    level: enemy.info.level,
                    xp: enemy.info.xp,
                    stats: enemy.stats,
                    loot: enemy.loot,
                    info: enemy.info,
                    positionX: 0,
                    positionY: 0,
                    visibilityMode: behavior.visibilityMode,
                    visibilityRange: behavior.visibilityRange,
                    attackStyle: behavior.attackStyle,
                    attackRange: behavior.attackRange,
                    playerEngageRange: behavior.playerEngageRange,
                    firstStrike: behavior.firstStrike,
                    disposition: behavior.disposition,
                };
            });
        })
    }
})

export const { dmg2Enemy, addEnemy, setAttackRating, removeEnemy, emptyDmgLog, setCurrentEnemy, clearEnemies } = enemySlice.actions;
export default enemySlice.reducer;
