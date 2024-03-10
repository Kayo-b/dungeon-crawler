import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, Animated } from 'react-native';
import  { useAppDispatch, useAppSelector } from '../../app/hooks';
// import { dmg, dmg2 } from '../../features/player/playerSlice'

export const Enemy = () => {
    const dispatch = useAppDispatch(); // Use the hook to get the dispatch function
    const count = useAppSelector(state => state.enemyhealth.value); // Select the current count
    const dmgTaken = useAppSelector(state => state.enemyhealth.dmgLog[state.enemyhealth.dmgLog.length - 1]); // Select the current count
    const [tempHealth, setTempHealt] = useState(count);

    const fadeAnim = useRef(new Animated.Value(1)).current; 
    const fadeAnimDmg = useRef(new Animated.Value(1)).current; 
    const moveAnimDmg = useRef(new Animated.Value(0)).current;
    useEffect(() => {

        fadeAnimDmg.setValue(1);
        moveAnimDmg.setValue(0);
        
        Animated.sequence([
            Animated.timing(moveAnimDmg, {
                toValue: -10,
                duration: 700,
                useNativeDriver: true, 
            }),
            Animated.timing(fadeAnimDmg, {
                toValue: 0,
                duration: 700,
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
    }, [count]);

    return (
        <View > 
            <Animated.View style={{ opacity: fadeAnim }}>
                <ImageBackground
                        source={require('../../resources/skeleton_01.png')} 
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
