import { createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit';

interface CombatInfo {
    enemyPack: boolean;
    enemyCount: number;
}

const initialState: CombatInfo = {
    enemyPack: false,
    enemyCount: 1,
}

const combatSlice = createSlice({
    name: 'combat',
    initialState,
    reducers: {
        setEnemyPack(state, action: PayloadAction<boolean>) {
            state.enemyPack = action.payload
        },
        setEnemyCount(state, action: PayloadAction<number>) {
            state.enemyCount = action.payload 
        }
    }
})

export const {
    setEnemyCount,
    setEnemyPack
} = combatSlice.actions;

export default combatSlice.reducer