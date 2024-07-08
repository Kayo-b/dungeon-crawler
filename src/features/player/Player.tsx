import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useCombat } from '../../events/combat'
import { Inventory } from '../inventory/Inventory'
import data from '../../data/characters.json';
import itemData from '../../data/items.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import {dmg, dmg2 } from '../../features/player/playerSlice'

import { setHealth, setCrit, setXP, setLevel, setStats, setPlayerDmg, setAttackRating, setDefenceRating, setEquipment, setCombatLog, fetchEquipment } from '../../features/player/playerSlice'
import { setInventory } from '../../features/inventory/inventorySlice';

export const Player = () => {
    const dispatch = useAppDispatch(); 
    const count = useAppSelector(state => state.player.health); // Select the current count
    const playerHealth = useAppSelector(state => state.player.health); 
    const playerXP = useAppSelector(state => state.player.experience);
    const playerLevel = useAppSelector(state => state.player.level);
    const dmgTaken = useAppSelector(state => state.player.dmgLog[state.player.dmgLog.length - 1]); // Select the current count
    const dmgTakenLog = useAppSelector(state => state.player.dmgLog);
    const dmgDoneArr = useAppSelector(state => state.enemy.dmgLog);
    const dmgTakenArr = useAppSelector(state => state.player.dmgLog); // Select the current count
    let combatLog = useAppSelector(state => state.player.combatLog);
    const stats = useAppSelector(state => state.player.stats)
    const defence = useAppSelector(state => state.player.defenceRating)
    const attack = useAppSelector(state => state.player.attackRating)
    const playerDmg = useAppSelector(state => state.player.playerDmg);
    const playerLog = useAppSelector(state => state.player.dmgLog); 
    const enemyLog = useAppSelector(state => state.enemy.dmgLog); 
    const fadeAnimDmg = useRef(new Animated.Value(1)).current;
    let equipment = useAppSelector(state => state.player.equipment);
    const screenWidth = Dimensions.get('window').width;
    let inventory: Array<Object>;
    
    async function initializeData() {
        // const dispatch = useAppDispatch()
        const storedData = await AsyncStorage.getItem('characters');
        console.log(storedData, "storedData ")
        let obj = storedData ? JSON.parse(storedData) : {};
        if(!storedData) {
            await AsyncStorage.setItem('characters', JSON.stringify(data));
            await AsyncStorage.setItem('items', JSON.stringify(itemData));
            const storedData = await AsyncStorage.getItem('characters');
            obj = storedData ? JSON.parse(storedData) : {};
        }
        const health = obj.character.stats.health;
        const experience = obj.character.experience;
        const level = obj.character.level; 
        const stats = obj.character.stats;
        const baseDmg = obj.character.equipment.weapon.stats.damage;
        const baseAR = obj.character.equipment.weapon.stats.atkSpeed;
        const baseCrit = stats.crit;
        const weaponCritMod = obj.character.equipment.weapon.stats.critMod;
        console.log("CRIT WEAP AND BASE", baseCrit, weaponCritMod)
        const crit =  baseCrit + weaponCritMod;
        inventory = obj.character.inventory;
        const baseDef = obj.character.equipment.armor.stats.defence +
        obj.character.equipment.ring.stats.defence;
        // !!!! Make the defence in hitChance be the enemy defence(not the players)
        // Will need to be implemented somwhere else.
        const playerDmg = physicalDmg(baseDmg, stats.strength, 3);
        let playerAR = attackRating(baseAR, stats.dexterity, 1, 1);
        let playerDR = defenceRating(baseDef, 1, stats.dexterity);
        // let hitChan = hitChance(playerAR, playerDef, 1, 1);
        // console.log(hitChan,"HIT")
        dispatch(setStats(stats));
        dispatch(setHealth(health));
        dispatch(setXP(experience));
        dispatch(setLevel(level));
        dispatch(setPlayerDmg(playerDmg));
        dispatch(setAttackRating(playerAR));
        dispatch(setDefenceRating(playerDR));
        dispatch(setInventory(inventory));
        dispatch(setPlayerDmg(playerDmg));
        console.log("SET CRIT", crit)
        dispatch(setCrit(crit));
        // dispatch(setEquipment(obj.character.equipment))
        // dispatch(setEquipment(obj.character.equipment));
        console.log(playerAR, playerDR, "AR DR STATS")
        console.log("EQUIP PLAYER")
        console.log("PLYER DMG", playerDmg)
    }

    // these values might be wrong, need to check the formula
    const physicalDmg = (baseDmg: number, str: number, strMod: number) => {
        return Math.floor(baseDmg + str / 10 * strMod)
    }

    // const hitChance = (AR: number, DR: number, ALevel: number, DLevel: number) => {
    //     return 2 * (AR / (AR + DR)) * (ALevel / (ALevel + DLevel));
    // }

    const attackRating = (baseAR: number, dex: number, ARperDex: number, attackBonus: number) => {
        const value = (baseAR + dex * ARperDex) * (attackBonus + 1);
        return value; 
    }

    const defenceRating = (baseDef: number, bonusDef: number, dex: number) => { 
        return baseDef * (bonusDef + dex * 0.1);
    }

    useEffect(() => {
        dispatch(fetchEquipment());
    }, [dispatch]);

    useEffect(() => {
        initializeData()
        console.log(inventory, "inventory!!!!")
    },[playerLevel, equipment])

    useEffect(() => {
        fadeAnimDmg.setValue(1); 
        Animated.timing(fadeAnimDmg, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true, 
        }).start();

    },[count])
    useEffect(() => {
        console.log(dmgTakenArr, "DMG TAKEN")
        if(dmgTakenArr.length > 0) {
        dispatch(setCombatLog(`You took ${dmgTakenArr[dmgTakenArr.length - 1]} damage.`))
        }
        console.log(combatLog, "DMG COMBAT LOG")
    }, [dmgTakenArr.length])

   useEffect(() => {
        console.log(dmgDoneArr, "DMG DONE")
        if(dmgDoneArr.length > 0) {
        dispatch(setCombatLog(`Enemy took ${dmgDoneArr[dmgDoneArr.length - 1]} damage .`))
        }
        console.log(combatLog, "DMG COMBAT LOG")
    }, [dmgDoneArr.length])

    const { startCombat } = useCombat();
    return (
        <View style={[styles.playerContainer, { width: screenWidth }]}> 
            <View>
                <ImageBackground
                        source={require('../../resources/portrait.png')} 
                        style={styles.enemy}
                    >
                        <Animated.Text style={[styles.dmgTxt, { opacity: fadeAnimDmg }]}>
                            <Text>{dmgTaken}</Text>
                        </Animated.Text>
                </ImageBackground>
                <Text style={styles.text}>Player Life: {playerHealth}</Text>
                <Text style={styles.text}>XP: {playerXP}</Text>
                <Text style={styles.text}>Level: {playerLevel}</Text>
                <Text style={styles.text}>DMG: {playerDmg} | DEF: {JSON.stringify(defence)}</Text>
                <Text style={styles.text}>STATS: {JSON.stringify(stats)}</Text>
                <TouchableOpacity style={styles.button} onPress={ startCombat }>
                    <Text>Attack</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.dmgLog}>
                <Text style={styles.dmgLog}>Combat Log</Text>
                <ScrollView style={styles.logView}>
                {combatLog.map((val:any, index:number) => (
                    <Text style={styles.text}>
                        {val}
                    </Text>   
                ))}
                </ScrollView>
            </View>
            <View style={styles.inventory}>
                <Inventory></Inventory>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    playerContainer: {
        position: 'absolute',
        top: 625, 
        left: 0,  
        width: '100%', 
        flexDirection: 'row',
        // justifyContent: 'space-between',
        padding: 10, 
      },
      playerStats: {
        borderWidth: 1,
        borderColor: 'white',

      },
      dmgLog: {
        backgroundColor: 'gray',
        width: 125
      },
      enemy: {
        width: 65,
        height: 65,
        alignSelf: 'flex-start', 
      },
      text: {
        color: 'white',
        fontSize: 10,
        maxWidth: 125,
      },
      dmgTxt: {
        color: 'red',
        fontSize: 20,
        alignContent: 'center',
      },
      inventory: {
        position: 'relative',
        // maxWidth: 600,
        // maxHeight: 300,
        // overflow: 'scroll',
        // bottom: 0,
        // right: 0,
        // margin: 10,
      },
      button: {
        backgroundColor: '#007bff',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
        maxWidth: 100
      },
      logView: {
        flex: 1,
        flexDirection: 'column'
      }

});
