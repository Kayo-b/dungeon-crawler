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
            itemArr.push(val.name)
        })
    }
    unpackInv();

    return (
        <View>
            <Text style={styles.text}>Inventory</Text>
            {itemArr.map((val, index) => (
                <Text key={index} style={styles.text}>{val}</Text>
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