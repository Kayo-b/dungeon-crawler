import { configureStore } from "@reduxjs/toolkit";
import counterReducer from '../features/counter/counterSlice';
import playerReducer from '../features/player/playerSlice';
import enemyReducer from '../features/enemy/enemySlice';
import roomReducer from '../features/room/roomSlice';
import inventoryReducer from '../features/inventory/inventorySlice';
import combatSlice from "../events/combatSlice";


export const store = configureStore({
     reducer: {
          counter: counterReducer,
          player: playerReducer,
          enemy: enemyReducer,
          room: roomReducer,
          inventory: inventoryReducer,
          combat: combatSlice
     },
})

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>; 