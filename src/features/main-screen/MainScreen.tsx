import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Dimensions } from 'react-native';
// import { store } from u/app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks'; 
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
import { Room } from '../room/Room'
import { Player } from '../player/Player'
import { Counter } from '../counter/Counter'
import { fetchEnemies, addEnemy } from '../enemy/enemySlice';
import { setCurrentPos } from '../room/roomSlice';
import { useEffect } from 'react';

function randomNumber(range: number) {
    return Math.floor(Math.random() * range);
}

export const MainScreen = () => {
    const dispatch = useAppDispatch(); 
    // const currentArrPos = useAppSelector(state => state.room.currentArrPos)
    // const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    // const count = useAppSelector(state => state.counter.value); // Select the current count
        dispatch(fetchEnemies())
        dispatch(addEnemy({index:0, id:0}))
        dispatch(setCurrentPos([7,7]))
    useEffect(() =>  {
        dispatch(addEnemy({index:0, id: randomNumber(2)}))
        console.log(randomNumber(2), 'random number')
    },[])
    return (
        <View style={styles.mainScreen}>
            <Room/>
            <Player/>
        </View>
    );
};

const styles = StyleSheet.create({
   mainScreen: {
    width: 800,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 150, 
  }, 
});

