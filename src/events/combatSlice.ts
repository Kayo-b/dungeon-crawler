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
    // Card-game scroll system
    scrollDeck: string[];       // remaining undrawn cards (shuffled)
    scrollHand: string[];       // current hand (drawn this turn)
    scrollDiscard: string[];    // used/spent cards this combat
    cardMana: number;           // energy available this turn
    maxCardMana: number;        // max energy per turn (always 2)
    // Auto-loot gold effect
    goldLootEffect: { amount: number; pulse: number };
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
    scrollDeck: [],
    scrollHand: [],
    scrollDiscard: [],
    cardMana: 2,
    maxCardMana: 2,
    goldLootEffect: { amount: 0, pulse: 0 },
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

        // --- Card-game scroll system ---
        initScrollDeck(state, action: PayloadAction<string[]>) {
            // Receives a pre-shuffled deck; resets hand/discard/mana
            state.scrollDeck = action.payload;
            state.scrollHand = [];
            state.scrollDiscard = [];
            state.cardMana = state.maxCardMana;
        },
        drawScrolls(state, action: PayloadAction<number>) {
            const count = action.payload;
            for (let i = 0; i < count; i++) {
                if (state.scrollDeck.length === 0) {
                    if (state.scrollDiscard.length === 0) break;
                    // Reshuffle discard back into deck
                    const reshuffled = [...state.scrollDiscard].sort(() => Math.random() - 0.5);
                    state.scrollDeck = reshuffled;
                    state.scrollDiscard = [];
                }
                const card = state.scrollDeck.pop()!;
                state.scrollHand.push(card);
            }
        },
        useScrollCard(state, action: PayloadAction<string>) {
            const idx = state.scrollHand.indexOf(action.payload);
            if (idx === -1) return;
            state.scrollHand.splice(idx, 1);
            state.scrollDiscard.push(action.payload);
            state.cardMana = Math.max(0, state.cardMana - 1);
        },
        discardHand(state) {
            state.scrollDiscard.push(...state.scrollHand);
            state.scrollHand = [];
        },
        refillCardMana(state) {
            state.cardMana = state.maxCardMana;
        },
        clearScrollSystem(state) {
            state.scrollDeck = [];
            state.scrollHand = [];
            state.scrollDiscard = [];
            state.cardMana = state.maxCardMana;
        },
        /** Move a living enemy from the front layer to the mid layer (knockback). */
        knockbackEnemy(state, action: PayloadAction<number>) {
            const enemyId = action.payload;
            const frontIdx = state.frontLayer.indexOf(enemyId);
            if (frontIdx === -1) return;
            state.frontLayer.splice(frontIdx, 1);
            state.midLayer.unshift(enemyId);
        },
        /** Trigger the floating gold loot animation with the given total amount. */
        triggerGoldLootEffect(state, action: PayloadAction<number>) {
            state.goldLootEffect = { amount: action.payload, pulse: state.goldLootEffect.pulse + 1 };
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
    initScrollDeck,
    drawScrolls,
    useScrollCard,
    discardHand,
    refillCardMana,
    clearScrollSystem,
    knockbackEnemy,
    triggerGoldLootEffect,
} = combatSlice.actions;

export default combatSlice.reducer
