import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { changeEnemy } from '../../features/enemy/enemySlice';
import { useRoom } from '../../events/room';
import { ImageSourcePropType } from 'react-native';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';

export const Room = () => {
    const dispatch = useAppDispatch(); 
    const enemyHealth = useAppSelector(state => state.enemy.health); 
    const currentLvl = useAppSelector(state => state.room.currentLvlIndex);
    const { changeLvl } = useRoom();

    const resources = [
        require('../../resources/dungeon-room_01.jpg'),
        require('../../resources/dungeon-room_02.jpg'),
    ]

    return (
        <View style={styles.backgroundImage}>
            <TouchableOpacity 
            style={{...styles.button, opacity: enemyHealth <= 0 ? 1 : 0 }} 
            onPress={ changeLvl }>
               <Text>Next Level</Text> 
            </TouchableOpacity>
            {/* <Button style={{styles.button}} title="next level" onPress={ changeLvl }></Button> */}
            <ImageBackground
                source={resources[currentLvl] as ImageSourcePropType} 
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
    button: {
        marginTop: 10,
        alignItems: 'center',
        backgroundColor: '#2196F3',
        padding: 5,
    }
});
