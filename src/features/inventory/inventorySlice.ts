import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InventoryState {
    inventory: Array<Object>
}

const initialState: InventoryState = {
    inventory: [],
}

const inventorySlice = createSlice({
    name:'inventory',
    initialState,
    reducers: {
        setInventory(state, action: PayloadAction<Array<Object>>) {
            state.inventory = action.payload as Array<Object>;
        },
        setAddToInv(state,  action: PayloadAction<Object> ) {
            state.inventory.push(action.payload)
        }

    }
}) 

export const { setInventory, setAddToInv } = inventorySlice.actions;
export default inventorySlice.reducer;
