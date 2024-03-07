import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';

export const Room = () => {
    const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    const count = useAppSelector(state => state.counter.value); // Select the current count

    return (
        <View style={styles.backgroundImage}>
            <ImageBackground
                source={require('../../resources/dungeon-room_01.jpg')} 
                style={styles.backgroundImage}
            >
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        alignSelf: 'center', 
        resizeMode: 'cover', 
        width: '100%', 
        height: '100%',
    },
});
