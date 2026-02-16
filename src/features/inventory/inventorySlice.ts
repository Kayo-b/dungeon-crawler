import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BAG_CAPACITY, CONSUMABLE_STASH_CAPACITY } from './inventoryUtils';

interface InventoryState {
    inventory: Array<Object>;
    consumableStash: Array<Object>;
}

const initialState: InventoryState = {
    inventory: [],
    consumableStash: [],
}

const inventorySlice = createSlice({
    name:'inventory',
    initialState,
    reducers: {
        setInventory(state, action: PayloadAction<Array<Object>>) {
            state.inventory = (action.payload as Array<Object>).slice(0, BAG_CAPACITY);
        },
        setConsumableStash(state, action: PayloadAction<Array<Object>>) {
            state.consumableStash = (action.payload as Array<Object>).slice(0, CONSUMABLE_STASH_CAPACITY);
        },
        setAllInventory(state, action: PayloadAction<{ inventory: Array<Object>; consumableStash: Array<Object> }>) {
            state.inventory = (action.payload.inventory || []).slice(0, BAG_CAPACITY);
            state.consumableStash = (action.payload.consumableStash || []).slice(0, CONSUMABLE_STASH_CAPACITY);
        },
        setAddToInv(state,  action: PayloadAction<Object> ) {
            if (state.inventory.length < BAG_CAPACITY) {
                state.inventory.push(action.payload)
            }
        }

    }
}) 

export const { setInventory, setConsumableStash, setAllInventory, setAddToInv } = inventorySlice.actions;
export default inventorySlice.reducer;
