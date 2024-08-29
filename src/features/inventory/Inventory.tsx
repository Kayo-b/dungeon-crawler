import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { StyleSheet, Text, View, Button, ImageBackground, Animated, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setEquipment, restoreHealth } from '../../features/player/playerSlice'
import { setInventory } from './inventorySlice';
export const Inventory = () => {

    const dispatch = useAppDispatch();

    const inventory = useAppSelector(state => state.inventory.inventory); 
    const equipment = useAppSelector(state => state.player.equipment);
    const playerHealth = useAppSelector(state => state.player.health); 
    let itemArr: Array<Object> = [];
    let equipmentArr: Array<Object> = [];
    console.log(inventory,"INV INV")

    const unpackInv = () => {
        inventory.forEach(val => {
            itemArr.push(val)
        });
        Object.keys(equipment).map(key => {
            console.log(equipment[key], "KEY")
            equipment[key].name.length > 0 ? equipmentArr.push(equipment[key]) : null;
            
        })
        console.log(equipmentArr)
    }
    unpackInv();
    useEffect(() => {
        console.log('Updated Equipment State:', equipment);
        console.log('Updated inventory State:', inventory);
        equipItem(null, 0);
    }, [equipment, inventory]);

    const equipItem = async (val:any, index: number) => {
        try {
            const dataChar = await AsyncStorage.getItem('characters');
            const objChar = dataChar ? JSON.parse(dataChar) : {};
            const itemType = val.type;
            if(itemType === 'currency') {
                console.log("cant equip currency");
                return;
            }
            if(itemType === 'consumable') {
                    dispatch(restoreHealth(val.stats.amount));
                    objChar.character.stats.health = playerHealth + val.stats.amount;
                    // objChar.character.inventory = objChar.character.inventory.filter(val => val.name !== itemType)
                    objChar.character.inventory.splice(index, 1)
                    console.log(val,objChar.character.inventory,"VALLL")
                
                    dispatch(setInventory([...objChar.character.inventory]))
                    console.log( typeof playerHealth, typeof val.stats.amount,objChar.character.stats, "obj health")
            } else {
                const currentEquipedItem =  objChar.character.equipment[itemType];
                //transfer item from equip to inv
                if(currentEquipedItem.name !== '') {
                    objChar.character.inventory.push(objChar.character.equipment[itemType])
                }
                objChar.character.inventory.splice(index, 1)
                objChar.character.equipment[itemType] = val;
                dispatch(setInventory([...objChar.character.inventory]));
                dispatch(setEquipment({ ...objChar.character.equipment }));
            }

            await AsyncStorage.setItem('characters', JSON.stringify(objChar));

        } catch (error) {
            console.error('Error equipping item:', error);
        }
    }
    return (
        <View style={styles.viewContainer}>
            <View>
                <Text style={[styles.text, {backgroundColor: "orange"}]}>Inventory</Text>
                <ScrollView style={styles.rowContainer}>
                    {itemArr.map((val, index) => (
                        <Text key={index} style={styles.text} onPress={() => equipItem(val, index)}>{val.name}</Text>
                    ))}
                </ScrollView>
            </View>
            <View>
                <Text style={[styles.text, {backgroundColor: "blue"}]}>Equipment</Text>
                <ScrollView style={styles.rowContainer}>
                    {equipmentArr.map((val, index) => (
                        <Text key={index} style={styles.text}>{val.name}</Text>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    text: {
        color: 'white',
        width: 150,
        height: 20,
    },
    viewContainer: {
        flex: 1,
        flexDirection: 'row',
        maxWidth: 400,
        maxHeight: 150,
        overflow: 'scroll',
    },
    rowContainer: {
        flexDirection: 'column',
        flex: 1,
        maxHeight: 150,
        maxWidth: 150
    },
    
});