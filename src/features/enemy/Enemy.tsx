import { useState, useEffect, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import  { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setAttackRating, setStats } from '../../features/enemy/enemySlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { dmg, dmg2 } from '../../features/player/playerSlice'

export const Enemy = () => {
    const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    const count = useAppSelector(state => state.enemy.health); // Select the current count
    const dmgLog = useAppSelector(state => state.enemy.dmgLog); // Select the current count
    const dmgTaken = useAppSelector(state => state.enemy.dmgLog[state.enemy.dmgLog.length - 1]); // Select the current count
    const dmgTakenArr = useAppSelector(state => state.enemy.dmgLog); // Select the current count
    const enemyIndex = useAppSelector(state => state.enemy.currentEnemyIndex); 
    const enemyAR = useAppSelector(state => state.enemy.atkSpeed);
    const enemyStats = useAppSelector(state => state.enemy.stats);
    // const dex = stats.dexterity;
    const fadeAnim = useRef(new Animated.Value(1)).current; 
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    const moveAnimDmg = useRef(new Animated.Value(0)).current;
    let stats;
    
    const resources = [
        require('../../resources/skeleton_01.png'),
        require('../../resources/demonrat_01.png'),
    ]
    async function setData() {
        console.log("SETDATA")
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        stats = obj.enemies[enemyIndex].stats; 
        //await AsyncStorage.setItem('characters',JSON.stringify(obj));
        // dispatch(setStats(stats))
        dispatch(setAttackRating(attackRating(enemyAR, stats.dexterity, 1, 1)))
    }
    setData();
    const initializeData = () => {
        
    }
    const attackRating = (baseAR: number, dex: number, ARperDex: number, attackBonus: number) => {
        const value = (baseAR + dex * ARperDex) * (attackBonus + 1);
        return value; 
    }


    useEffect(() => {
        console.log(count,"health Enemy")
        fadeAnimDmg.setValue(1);
        moveAnimDmg.setValue(0);
        console.log(dmgTakenArr, "DMG TAKEN ARR")
        
        Animated.sequence([
            Animated.timing(moveAnimDmg, {
                toValue: -10,
                duration: 1000,
                useNativeDriver: true, 
            }),
            Animated.timing(fadeAnimDmg, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true, 
            }),
        ]).start();
        if (count <= 0) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true, 
            }).start();
        } else {
            fadeAnim.setValue(1);
        }
    }, [dmgTakenArr.length, count]);

    return (
        <View > 
            <Animated.View style={{ opacity: fadeAnim }}>
                <ImageBackground
                        source={resources[enemyIndex] as ImageSourcePropType} 
                        style={[styles.enemy]}
                        resizeMode="contain"
                    >
                    <Animated.Text style={[styles.damageText, {
                        opacity: fadeAnimDmg,
                        transform: [{ translateY: moveAnimDmg }]}]}>
                            <Text>{dmgTaken}</Text>
                    </Animated.Text>
                    <Text style={styles.text}>Life: {count}</Text>
                </ImageBackground>
            </Animated.View>
            {/* <Button title="test" onPress={() => dispatch(dmg())}></Button> */}
        </View>
    );
};

const styles = StyleSheet.create({
    enemy: {
        width: 100,
        height: 100,
        alignSelf: 'center',
        position: 'absolute',
        top: 95,
    }, 
    text: {
        color: 'magenta',
        fontSize: 15,
    },
    damageText: {
        color: 'red',
        fontSize: 11,
        position: 'absolute',
        top: -15,
        left: 60
    }

});
