import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { useRoom } from '../../events/room';
import { ImageSourcePropType } from 'react-native';
import { useEffect } from 'react';
import { useCombat } from '../../events/combat'
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
let display = 0;

export const Room = () => {
    const dispatch = useAppDispatch(); 
    // const enemyHealth = useAppSelector(state => state.enemy.enemies[0].stats.health); 
    const currentLvl = useAppSelector(state => state.room.currentLvlIndex);
    const enemies = useAppSelector(state => state.enemy.enemies)
    const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId);
    const { changeLvl, getEnemies } = useRoom();
    const { startCombat } = useCombat();
    const resources = [
        require('../../resources/dungeon-room_01.jpg'),
        require('../../resources/dungeon-room_02.jpg'),
    ]
    // changeLvl()
    let enemiesVal = Object.values(enemies)
    useEffect(() => {
        dispatch(fetchEnemies());
    }, [currentEnemy, dispatch]);
    useEffect(() => {
        // dispatch(getEnemies);
        enemiesVal = Object.values(enemies)
        console.log("ENEMIES #### ROOM REFRESH", enemies, new Date().toLocaleTimeString(), enemiesVal[currentEnemy].health)
    },[Object.values(enemies).length, enemies, dispatch])

    Object.values(enemies).map((val, index) => {
        console.log('ENEMIES OBJECT VALUES', val, index);
    });
    const startCombatAux = (index:number) => {
        dispatch(setCurrentEnemy(index));
        startCombat(index);
    }
    return (
        <View style={styles.backgroundImage}>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ changeLvl }>
               <Text>Next Level</Text> 
            </TouchableOpacity>
            {/* <Button style={{styles.button}} title="next level" onPress={ changeLvl }></Button> */}
            <ImageBackground
            source={resources[currentLvl] as ImageSourcePropType} 
            style={styles.backgroundImage}>
            {enemiesVal.map((val, index) => (
                val.health > 0 ? ( 
                    <View style={styles.enemiesContainer} key={index}>
                        <TouchableOpacity onPress={() => startCombatAux(index)}>
                            <Enemy index={index} />
                        </TouchableOpacity>
                    </View>
                ) : null
            ))}
        </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    backgroundImage: {
        alignSelf: 'center', 
        resizeMode: 'cover', 
        width: '100%', 
        height: '100%',
        flex: 1,
        padding: 10,
        justifyContent: 'space-around',
        alignItems: 'center',
        flexDirection: 'row'
    },
    button: {
        marginTop: 10,
        alignItems: 'center',
        backgroundColor: '#2196F3',
        padding: 5,
    },
    enemiesContainer: {
        flexDirection: 'row',
  },
});
