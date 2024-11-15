import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/rooms.json';


interface RoomState {
    currentLvlIndex: number;
    currentLvl: number;
    direction: string;
    posX: number;
    posY: number;
    verticalRes?: NodeRequire[];
    horizontalRes?: NodeRequire[];
}

const roomInitialState: RoomState = {
    currentLvlIndex: 0,
    currentLvl: data.rooms[0].id,
    direction: 'N', // N S W E
    posX: 0,
    posY: 0,
    verticalRes: [],
    horizontalRes: []
}
// console.log(data.rooms[0].background, "Background");
const roomSlice = createSlice ({
    name: 'room',
    initialState: roomInitialState,
    reducers: {
        changeRoom(state, action: PayloadAction<number>) {
            state.currentLvlIndex = action.payload;
            state.currentLvl = data.rooms[action.payload].id;
        },
        changeDir(state, action: PayloadAction<string>) {
            state.direction = action.payload;
        },
        changeX(state, action: PayloadAction<number>) {
            state.posX = action.payload;
        },
        changeY(state, action: PayloadAction<number>) {
            state.posY = action.payload;
        },
        setVertRes(state, action: PayloadAction<NodeRequire[]>) {
            state.verticalRes = action.payload;
        },
        setHorzRes(state, action: PayloadAction<NodeRequire[]>) {
            state.horizontalRes = action.payload;
        },
        currentLocation(state, action: PayloadAction<number[]>) {
            state.posX = action.payload[0];
            state.posY = action.payload[1];
        }
        
    }
})

export const { changeRoom, changeDir, changeX, changeY, currentLocation, setHorzRes, setVertRes} = roomSlice.actions;
export default roomSlice.reducer;