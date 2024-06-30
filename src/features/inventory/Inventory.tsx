import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { StyleSheet, Text, View, Button, ImageBackground, Animated, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setEquipment } from '../../features/player/playerSlice'
import { setInventory } from './inventorySlice';
export const Inventory = () => {

    const dispatch = useAppDispatch();

    const inventory = useAppSelector(state => state.inventory.inventory); 
    const equipment = useAppSelector(state => state.player.equipment); 
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
            if(itemType !== 'currency') {
                const currentEquipedItem =  objChar.character.equipment[itemType];
                //transfer item from equip to inv
                if(currentEquipedItem.name !== '') {
                    objChar.character.inventory.push(objChar.character.equipment[itemType])
                }
                objChar.character.inventory.splice(index, 1)
                console.log(objChar.character.inventory[index], "INDEX")
                console.log(objChar.character.equipment[itemType], "ITEM EQUIP")
                console.log(objChar.character.inventory,"ITEM EQUIP INVENTORY | ")
                objChar.character.equipment[itemType] = val;
                // itemArr.splice(1, index)
                dispatch(setInventory([...objChar.character.inventory]));
                dispatch(setEquipment({ ...objChar.character.equipment }));
            } else {
                console.log("cant equip currency")
            }
    
            await AsyncStorage.setItem('characters', JSON.stringify(objChar));
                            
            console.log("EQUIP", equipment)
            console.log("EQUIP2", objChar.character.equipment)
            console.log("EQUIP3", objChar.character.inventory)

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
        borderWidth: 2,
        borderColor: 'white',
        width: 150,
        height: 20,
    },
    viewContainer: {
        flex: 1,
        borderWidth: 1,
        flexDirection: 'row',
    },
    rowContainer: {
        flexDirection: 'column',
        flex: 1,
        maxHeight: 150,
        maxWidth: 150
    },
    
});