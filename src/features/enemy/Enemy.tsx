import { useState, useEffect, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import  { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setAttackRating, fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { dmg, dmg2 } from '../../features/player/playerSlice'
interface EnemyProps {
    index: number
}
export const Enemy: React.FC<EnemyProps> = ({index}) => {
    const dispatch = useAppDispatch();
    // const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId)
    const enemies = useAppSelector(state => state.enemy.enemies)
    const currentEnemy = useAppSelector(state => state.enemy.enemies)
    const enemiesStorage = useAppSelector(state => state.enemy.enemiesStorage)
    console.log(enemiesStorage, "*****************************************STORAGE1")
    console.log(enemies,"ENEMIES #######", enemies[index], "IDDDD", index,"INDEXXXXXXX")
    const id = Object.values(enemies)[index].id;

    // console.log(enemies, index, id, enemies[index], "***************************************** !@#")
    const count = useAppSelector(state => state.enemy.enemies[index].health); 
    const dmgLog = useAppSelector(state => state.enemy.enemies[index].dmgLog);
    const dmgTakenArr = useAppSelector(state => state.enemy.enemies[index].dmgLog); 
    console.log(dmgTakenArr, "DMG TAKEN ARR PAYLOAD")
    const dmgTaken = dmgTakenArr.length > 0 ? dmgTakenArr[dmgTakenArr.length - 1] :
    {test:1};

    // const enemyIndex = useAppSelector(state => state.enemy.currentEnemyId); 
    const enemyAR = useAppSelector(state => state.enemy.enemies[index].atkSpeed);
    const enemyStats = useAppSelector(state => state.enemy.enemies[index].stats);
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
        dispatch({ type: 'enemy/fetchData', payload: id});
    }, [dispatch, id]);

    async function setData() {
        // const data = await AsyncStorage.getItem('characters');
        // const obj = data ? JSON.parse(data) : {};
        stats = enemies[index].stats; 
        loot = enemies[index].loot;
        let baseAR = enemies[index].stats.atkSpeed;
        //await AsyncStorage.setItem('characters',JSON.stringify(obj));
        // dispatch(setStats(stats))
        let atkRating = attackRating(baseAR, stats.dexterity, 2, 1);
        console.log(atkRating, "ATK RATING")
        console.log(atkRating,"SETDATA <><><")
        console.log("SETDATA <><><")
        // console.log("SET ATTACK RATING", id, index, atkRating, enemies[index])
        dispatch(setAttackRating({id: index, rating: atkRating}));
    }
    
    const attackRating = (baseAR: number, dex: number, ARperDex: number, attackBonus: number) => {
        const value = (baseAR + dex * ARperDex) * (attackBonus + 1);
        console.log(value, "ATK RATING")
        return value; 
    }

    useEffect(() => {
        dispatch(fetchEnemies());
        setData();
    }, [Object.values(enemies).length]);

    useEffect(() => {
        console.log(count,"health Enemy", id,"enemyID")
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
                        source={resources[id] as ImageSourcePropType} 
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
        width: 150,
        height: 150,
        alignSelf: 'center',
        position: 'absolute',
        top: 70,
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
