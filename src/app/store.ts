import { configureStore } from "@reduxjs/toolkit";
import counterReducer from '../features/counter/counterSlice';
import playerReducer from '../features/player/playerSlice';
import enemyReducer from '../features/enemy/enemySlice';


export const store = configureStore({
     reducer: {
          counter: counterReducer,
          playerhealth: playerReducer,
          enemyhealth: enemyReducer,
     },
})

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>; 