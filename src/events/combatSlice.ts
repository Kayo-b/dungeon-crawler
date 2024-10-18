import { createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit';

interface CombatInfo {
    enemyPack: boolean;
    enemyCount: number;
    inCombat: boolean,
}

const initialState: CombatInfo = {
    enemyPack: false,
    enemyCount: 1,
    inCombat: false,
}

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

    }
})

export const {
    setEnemyCount,
    // setEnemyPack,
    setInCombat,
} = combatSlice.actions;

export default combatSlice.reducer