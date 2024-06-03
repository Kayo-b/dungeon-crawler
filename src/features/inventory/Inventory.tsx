import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';



export const Inventory = () => {

    const inventory = useAppSelector(state => state.inventory.inventory); 
    let itemArr: Array<Object> = [];
    console.log(inventory,"INV INV")

    const unpackInv = () => {
        inventory.forEach(val => {
            itemArr.push(val)
        })
    }
    unpackInv();

    const equipItem = async (val:any) => {
        console.log("CLICK EQUIP ITEM", val)
        const data = await AsyncStorage.getItem('characters');
        const obj = data ? JSON.parse(data) : {};
        obj.character.equipment.ring = val
        await AsyncStorage.setItem('characters',JSON.stringify(obj));
    }
    // useEffect(() => {
    //     console.log("Use effect!!")
    // },[inventoryObj])
    return (
        <View>
            <Text style={styles.text}>Inventory</Text>
            {itemArr.map((val, index) => (
                <Text key={index} style={styles.text} onClick={() => equipItem(val)}>{val.name}</Text>
            ))}
        </View>
    )

}

const styles = StyleSheet.create({
    text: {
        color: 'white',
        borderWidth: 2,
        borderColor: 'white',
        width: 150,
        height: 20,
    }

})