import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Dimensions } from 'react-native';
// import { store } from u/app/store';
// import { useAppDispatch, useAppSelector } from '../../../app/hooks';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
import { Room } from '../room/Room'
import { Player } from '../player/Player'
import { Counter } from '../counter/Counter'

export const MainScreen = () => {
    // const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    // const count = useAppSelector(state => state.counter.value); // Select the current count

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

