import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/rooms.json';


interface RoomState {
    currentLvlIndex: number;
    currentLvl: number;
}

const roomInitialState: RoomState = {
    currentLvlIndex: 0,
    currentLvl: data.rooms[0].id,
}
// console.log(data.rooms[0].background, "Background");
const roomSlice = createSlice ({
    name: 'room',
    initialState: roomInitialState,
    reducers: {
        changeRoom(state, action: PayloadAction<number>) {
            state.currentLvlIndex = action.payload;
            state.currentLvl = data.rooms[action.payload].id;
        }
    }

})

export const { changeRoom } = roomSlice.actions;
export default roomSlice.reducer;