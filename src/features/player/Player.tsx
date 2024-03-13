import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useCombat } from '../../events/combat' 
// import {dmg, dmg2 } from '../../features/player/playerSlice'

import { dmgTaken } from '../../features/enemy/enemySlice'

export const Player = () => {
    const dispatch = useAppDispatch(); 
    const count = useAppSelector(state => state.playerhealth.value); 
    const dmgtaken = useAppSelector(state => state.playerhealth.dmgLog[state.playerhealth.dmgLog.length - 1]); // Select the current count
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    
    useEffect(() => {
        fadeAnimDmg.setValue(1);
        Animated.timing(fadeAnimDmg, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true, // Use native driver for better performance
        }).start();
    },[count])

    const { attack } = useCombat();
    return (
        <View > 
            <ImageBackground
                    source={require('../../resources/portrait.png')} 
                    style={styles.enemy}
                >
                    <Animated.Text style={[styles.dmgTxt, { opacity: fadeAnimDmg }]}>
                        <Text>-{dmgtaken}</Text>
                    </Animated.Text>
            </ImageBackground>
            <Text style={styles.text}>Player Life: {count}</Text>
            <Button title="Atk" onPress={ attack }></Button>
        </View>
    );
};

const styles = StyleSheet.create({
    enemy: {
        width: 65,
        height: 65,
        alignSelf: 'auto'
    }, 
    text: {
        color: 'white',
        fontSize: 10,
    },
    dmgTxt: {
        color: 'red',
        fontSize: 20,
        alignContent: 'center',
    }

});
