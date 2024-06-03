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
        try {
            const data = await AsyncStorage.getItem('characters');
            const obj = data ? JSON.parse(data) : {};
    
            // if (!obj.character) {
            //     obj.character = {};
            // }
            // if (!obj.character.equipment) {
            //     obj.character.equipment = {};
            // }
    
            const itemType = val.type;
    
            obj.character.equipment[itemType] = val;
    
            await AsyncStorage.setItem('characters', JSON.stringify(obj));

        } catch (error) {
            console.error('Error equipping item:', error);
        }
        
    }

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