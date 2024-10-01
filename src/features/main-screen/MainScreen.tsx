import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Dimensions } from 'react-native';
// import { store } from u/app/store';
import { useAppDispatch } from '../../app/hooks'; 
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
import { Room } from '../room/Room'
import { Player } from '../player/Player'
import { Counter } from '../counter/Counter'
import { fetchEnemies, addEnemy } from '../enemy/enemySlice';

export const MainScreen = () => {

    const dispatch = useAppDispatch(); 
    // const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    // const count = useAppSelector(state => state.counter.value); // Select the current count
        dispatch(fetchEnemies())
        dispatch(addEnemy({index:0, id:0}))
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

