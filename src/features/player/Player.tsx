import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useCombat } from '../../events/combat' 
// import {dmg, dmg2 } from '../../features/player/playerSlice'

import { dmgTaken } from '../../features/enemy/enemySlice'

export const Player = () => {
    const dispatch = useAppDispatch(); 
    const playerHealth = useAppSelector(state => state.player.health); 
    const dmgtaken = useAppSelector(state => state.player.dmgLog[state.player.dmgLog.length - 1]); // Select the current count
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    
    useEffect(() => {
        fadeAnimDmg.setValue(1);
        Animated.timing(fadeAnimDmg, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true, // Use native driver for better performance
        }).start();
    },[playerHealth])
    
    const { attack, startCombat } = useCombat();
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
            <Text style={styles.text}>Player Life: {playerHealth}</Text>
            <Button title="Atk" onPress={ startCombat }></Button>
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
