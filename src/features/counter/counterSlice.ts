import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CounterState {
    value: number;
}

const initialState: CounterState = {
    value: 0,
}

const counterSlice = createSlice({
    name: 'counter',
    initialState,
    reducers: {
        // increment
        incremented(state) {
            // adding immutable code using immer so we can use mutable syntax and 
            // immer makes it immutable (aka copy add value to copy...) 
            state.value++;
        },
        amoutAdded(state, action: PayloadAction<number>) {
           state.value += action.payload; 
        }
    }
})

export const { incremented, amoutAdded } = counterSlice.actions
export default counterSlice.reducer;
   