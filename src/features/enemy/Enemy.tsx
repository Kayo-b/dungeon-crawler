import { useState, useEffect, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import  { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setAttackRating, setStats, fetchEnemies } from '../../features/enemy/enemySlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { dmg, dmg2 } from '../../features/player/playerSlice'

export const Enemy = () => {
    const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    const count = useAppSelector(state => state.enemy.health); 
    const dmgLog = useAppSelector(state => state.enemy.dmgLog);
    const dmgTakenArr = useAppSelector(state => state.enemy.dmgLog); 
    console.log(dmgTakenArr, "DMG TAKEN ARR PAYLOAD")
    const dmgTaken = dmgTakenArr.length > 0 ? dmgTakenArr[dmgTakenArr.length - 1] :
    {test:1};
    const enemyIndex = useAppSelector(state => state.enemy.currentEnemyIndex); 
    const enemyAR = useAppSelector(state => state.enemy.atkSpeed);
    const enemyStats = useAppSelector(state => state.enemy.stats);
    const enemies = useAppSelector(state => state.enemy.enemies)
    // const dex = stats.dexterity;
    const fadeAnim = useRef(new Animated.Value(1)).current; 
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    const moveAnimDmg = useRef(new Animated.Value(0)).current;
    let stats;
    let loot;
    console.log("SET DATA outside")
    const resources = [
        require('../../resources/skeleton_01.png'),
        require('../../resources/demonrat_01.png'),
    ]
    useEffect(() => {
        dispatch({ type: 'enemy/fetchData', payload: enemyIndex });
    }, [dispatch, enemyIndex]);
    async function setData() {
        // const data = await AsyncStorage.getItem('characters');
        // const obj = data ? JSON.parse(data) : {};
        stats = enemies[enemyIndex].stats; 
        loot = enemies[enemyIndex].loot;
        let baseAR = enemies[enemyIndex].stats.atkSpeed;
        //await AsyncStorage.setItem('characters',JSON.stringify(obj));
        // dispatch(setStats(stats))
        let atkRating = attackRating(baseAR, stats.dexterity, 2, 1);
        console.log(atkRating, "ATK RATING")
        console.log(atkRating,"SETDATA <><><")
        console.log("SETDATA <><><")
        dispatch(setAttackRating(atkRating));
    }
    const initializeData = () => {
        
    }
    const attackRating = (baseAR: number, dex: number, ARperDex: number, attackBonus: number) => {
        const value = (baseAR + dex * ARperDex) * (attackBonus + 1);
        console.log(value, "ATK RATING")
        return value; 
    }
    useEffect(() => {
        dispatch(fetchEnemies());
        setData();

    }, [dispatch]);

    useEffect(() => {
        console.log(count,"health Enemy")
        fadeAnimDmg.setValue(1);
        moveAnimDmg.setValue(0);
        console.log(dmgTakenArr[0], "DMG TAKEN ARR")
        console.log(dmgTaken, "DMG TAKEN ????")
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
                    <Animated.Text style={[!dmgTaken.crit ? styles.damageNormalText : styles.damageCritText, {
                        opacity: fadeAnimDmg,
                        transform: [{ translateY: moveAnimDmg }]}]}>
                            <Text>{dmgTaken.dmg === 0 ? "Miss" : dmgTaken.dmg}</Text>
                    </Animated.Text>
                    <Text style={styles.text}>Life:{count}</Text>
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
    damageCritText: {
        color: 'red',
        fontSize: 22,
        position: 'absolute',
        top: -15,
        left: 60
    },
    damageNormalText: {
        color: 'white',
        fontSize: 12,
        position: 'absolute',
        top: -15,
        left: 60
    }


});
