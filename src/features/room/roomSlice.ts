import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/rooms.json';


interface RoomState {
    currentLvlIndex: number;
    currentLvl: number;
    initialDirection: boolean;
    direction: string;
    posX: number;
    posY: number;
    verticalRes?: NodeRequire[];
    horizontalRes?: NodeRequire[];
    currentArrPos: number;
    lastTurnDir: string;
}

const roomInitialState: RoomState = {
    currentLvlIndex: 0,
    currentLvl: data.rooms[0].id,
    initialDirection: false, // true = clockwise, false = counter-clockwise
    direction: 'S', // N S W E
    posX: 0,
    posY: 0,
    verticalRes: [],
    horizontalRes: [],
    currentArrPos: 0,
    lastTurnDir: '',
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
        setCurrentPos(state, action: PayloadAction<number[]>) {
            state.posX = action.payload[0];
            state.posY = action.payload[1];
        },
        setCurrentArrPos(state, action: PayloadAction<number>) {
            state.currentArrPos = action.payload;
        },
        invertInitialDirection(state) {
            state.initialDirection = !state.initialDirection;
        },
        setInitialDirection(state, action: PayloadAction<boolean>) {
            state.initialDirection = action.payload;
        },
        setLastTurnDir(state, action: PayloadAction<string>) {
            state.lastTurnDir = action.payload;
        },
    }
})

export const { changeRoom, changeDir, changeX, changeY, setCurrentPos, setHorzRes, setVertRes, setCurrentArrPos, invertInitialDirection, setLastTurnDir, setInitialDirection } = roomSlice.actions;
export default roomSlice.reducer;