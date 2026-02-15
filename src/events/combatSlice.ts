import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CombatInfo {
    enemyPack: boolean;
    enemyCount: number;
    inCombat: boolean;
    specialCooldownFrames: number;
    enemyAttackPulse: number;
    lastEnemyAttackId: number | null;
    playerHitPulse: number;
    lastPlayerHitId: number | null;
    lastPlayerHitType: 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate';
}

const initialState: CombatInfo = {
    enemyPack: false,
    enemyCount: 1,
    inCombat: false,
    specialCooldownFrames: 0,
    enemyAttackPulse: 0,
    lastEnemyAttackId: null,
    playerHitPulse: 0,
    lastPlayerHitId: null,
    lastPlayerHitType: 'pow',
};

const combatSlice = createSlice({
    name: 'combat',
    initialState,
    reducers: {
        setInCombat(state, action: PayloadAction<boolean>) {
            state.inCombat = action.payload;
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

    }
});

export const {
    setEnemyCount,
    // setEnemyPack,
    setInCombat,
    setSpecialCooldown,
    tickSpecialCooldown,
    registerEnemyAttack,
    registerPlayerHit,
} = combatSlice.actions;

export default combatSlice.reducer
