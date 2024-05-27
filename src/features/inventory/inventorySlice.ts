import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';


let inventory;

async function getData() {
    const data = await AsyncStorage.getItem('characters');
    const obj = data ? JSON.parse(data) : {};
    inventory = obj.character.inventory
    //await AsyncStorage.setItem('characters',JSON.stringify(obj));
    console.log(inventory, "GETDATA INV")
}

getData();

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
        }

    }
}) 

export const { setInventory } = inventorySlice.actions;
export default inventorySlice.reducer;
