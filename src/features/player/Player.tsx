import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useCombat } from '../../events/combat'
import data from '../../data/characters.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import {dmg, dmg2 } from '../../features/player/playerSlice'

import { setHealth, setXP, setLevel } from '../../features/player/playerSlice'

export const Player = () => {
    const dispatch = useAppDispatch(); 
    const playerHealth = useAppSelector(state => state.player.health); 
    const playerXP = useAppSelector(state => state.player.experience);
    const playerLevel = useAppSelector(state => state.player.level);
    const dmgtaken = useAppSelector(state => state.player.dmgLog[state.player.dmgLog.length - 1]); // Select the current count
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    async function initializeData() {
        // const dispatch = useAppDispatch()
        const storedData = await AsyncStorage.getItem('characters');
        console.log(storedData, "storedData ")
        let obj = storedData ? JSON.parse(storedData) : {};
        if(!storedData) {
            await AsyncStorage.setItem('characters', JSON.stringify(data));
            const storedData = await AsyncStorage.getItem('characters');
            obj = storedData ? JSON.parse(storedData) : {};
        }
        const health = obj.character.stats.health;
        const experience = obj.character.experience;
        const level = obj.character.level; 
        console.log(level,"LEVEL");
        dispatch(setHealth(health));
        dispatch(setXP(experience));
        dispatch(setLevel(level));
    }
    
    useEffect(() => {
        initializeData()
    },[])

    useEffect(() => {
        fadeAnimDmg.setValue(1);
        Animated.timing(fadeAnimDmg, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true, 
        }).start();
    },[playerHealth])
    
    const { startCombat } = useCombat();
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
            <Text style={styles.text}>XP: {playerXP}</Text>
            <Text style={styles.text}>Level: {playerLevel}</Text>
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
