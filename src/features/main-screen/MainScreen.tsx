import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground } from 'react-native';
// import { store } from u/app/store';
// import { useAppDispatch, useAppSelector } from '../../../app/hooks';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
import { Room } from '../room/Room'

export const MainScreen = () => {
    // const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    // const count = useAppSelector(state => state.counter.value); // Select the current count

    return (
        <View style={styles.mainScreen}>
            <Room/>
        </View>
    );
};

const styles = StyleSheet.create({
   mainScreen: {
    // Adjust these percentages to maintain the 4:3 ratio and fit your design
    width: '100%', // Example width percentage
    aspectRatio: 4 / 3, // This maintains the 4:3 ratio
    justifyContent: 'center',
    alignItems: 'center',
  }, 
});

