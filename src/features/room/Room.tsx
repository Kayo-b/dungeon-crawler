import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';

export const Room = () => {
    const dispatch = useAppDispatch(); 
    const count = useAppSelector(state => state.counter.value); 

    return (
        <View style={styles.backgroundImage}>
            <ImageBackground
                source={require('../../resources/dungeon-room_01.jpg')} 
                style={styles.backgroundImage}
                >
                <Enemy/>
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
