import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CombatPhase = 'idle' | 'player_turn' | 'enemy_turn';

interface CombatInfo {
    enemyPack: boolean;
    enemyCount: number;
    inCombat: boolean;
    combatPhase: CombatPhase;
    specialCooldownFrames: number;
    enemyAttackPulse: number;
    lastEnemyAttackId: number | null;
    playerHitPulse: number;
    lastPlayerHitId: number | null;
    lastPlayerHitType: 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate';
    // Wave layer system: enemies advance from back → mid → front as the front falls
    frontLayer: number[];       // enemy indices that can attack and be attacked
    midLayer: number[];         // waiting one layer back
    backLayer: number[];        // furthest back, advances when mid is depleted
    justAdvancedIds: number[];  // promoted this round — cannot attack until next round
}

const initialState: CombatInfo = {
    enemyPack: false,
    enemyCount: 1,
    inCombat: false,
    combatPhase: 'idle',
    specialCooldownFrames: 0,
    enemyAttackPulse: 0,
    lastEnemyAttackId: null,
    playerHitPulse: 0,
    lastPlayerHitId: null,
    lastPlayerHitType: 'pow',
    frontLayer: [],
    midLayer: [],
    backLayer: [],
    justAdvancedIds: [],
};

const combatSlice = createSlice({
    name: 'combat',
    initialState,
    reducers: {
        setInCombat(state, action: PayloadAction<boolean>) {
            state.inCombat = action.payload;
            if (!action.payload) {
                state.combatPhase = 'idle';
            }
        },
        setCombatPhase(state, action: PayloadAction<CombatPhase>) {
            state.combatPhase = action.payload;
        },
        // setEnemyPack(state, action: PayloadAction<boolean>) {
            // state.enemyPack = action.payload;
        // },
        setEnemyCount(state, action: PayloadAction<number>) {
            state.enemyCount = action.payload;
        },
        setSpecialCooldown(state, action: PayloadAction<number>) {
            state.specialCooldownFrames = Math.max(0, action.payload);
        },
        tickSpecialCooldown(state) {
            if (state.specialCooldownFrames > 0) {
                state.specialCooldownFrames -= 1;
            }
        },
        registerEnemyAttack(state, action: PayloadAction<number>) {
            state.lastEnemyAttackId = action.payload;
            state.enemyAttackPulse += 1;
        },
        registerPlayerHit(state, action: PayloadAction<{ enemyId: number; hitType: 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate' }>) {
            state.lastPlayerHitId = action.payload.enemyId;
            state.lastPlayerHitType = action.payload.hitType;
            state.playerHitPulse += 1;
        },
        setEnemyLayers(state, action: PayloadAction<{ front: number[]; mid: number[]; back: number[] }>) {
            state.frontLayer = action.payload.front;
            state.midLayer = action.payload.mid;
            state.backLayer = action.payload.back;
            state.justAdvancedIds = [];
        },
        // Sync Redux layer state after a front-layer kill (refs are mutated first in combat.ts)
        advanceFrontLayerRedux(state, action: PayloadAction<{ front: number[]; mid: number[]; back: number[]; justAdvancedIds: number[] }>) {
            state.frontLayer = action.payload.front;
            state.midLayer = action.payload.mid;
            state.backLayer = action.payload.back;
            state.justAdvancedIds = action.payload.justAdvancedIds;
        },
        clearJustAdvanced(state) {
            state.justAdvancedIds = [];
        },
        clearEnemyLayers(state) {
            state.frontLayer = [];
            state.midLayer = [];
            state.backLayer = [];
            state.justAdvancedIds = [];
        },

    }
});

export const {
    setEnemyCount,
    // setEnemyPack,
    setInCombat,
    setCombatPhase,
    setSpecialCooldown,
    tickSpecialCooldown,
    registerEnemyAttack,
    registerPlayerHit,
    setEnemyLayers,
    advanceFrontLayerRedux,
    clearJustAdvanced,
    clearEnemyLayers,
} = combatSlice.actions;

export default combatSlice.reducer
