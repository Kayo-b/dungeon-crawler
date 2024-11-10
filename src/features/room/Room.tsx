import { setStatusBarNetworkActivityIndicatorVisible, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { changeDir, setHorzRes, setVertRes , currentLocation } from '../../features/room/roomSlice';
import { useRoom } from '../../events/room';
import { ImageSourcePropType } from 'react-native';
import { useEffect, useState } from 'react';
import { useCombat } from '../../events/combat'
import { current } from '@reduxjs/toolkit';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';
let display = 0;

export const Room = () => {
    const dispatch = useAppDispatch(); 
    // const enemyHealth = useAppSelector(state => state.enemy.enemies[0].stats.health); 
    const inCombat = useAppSelector(state => state.combat.inCombat);
    const currentLvl = useAppSelector(state => state.room.currentLvlIndex);
    const enemies = useAppSelector(state => state.enemy.enemies)
    const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId);
    const currentDir = useAppSelector(state => state.room.direction);
    const verticalResources = useAppSelector(state => state.room.verticalRes);
    const horizontalResources = useAppSelector(state => state.room.horizontalRes);
    const positionY = useAppSelector(state => state.room.posY);
    const positionX = useAppSelector(state => state.room.posX);
    const { changeLvl, getEnemies } = useRoom();
    const { startCombat } = useCombat();
    dispatch(currentLocation([2,0]))
    
    // generate resources array based on dg_map layout
    // 1- take verticalTileArr for vertical tiles array and  dg_map for horizontal
    // 2- take current position of player
    // 3- based on position generate tiles with resources.

    const [resources, setRes1] = useState([])
    const [resources2, setRes2] = useState([])
    // generateMapResources()
    const backtrackArr: Array<NodeRequire> = [];
    const [position, setPosition] = useState(resources);
    const [backtrack, setBacktrack] = useState(backtrackArr)
    
    const turnTile = require('../../resources/dung-turn.png');
    const corridorTile = require('../../resources/dung-corridor.png');

    const dg_map = [
        [0, 0, 2, 1, 1, 2, 0, 0],
        [0, 0, 2, 0, 0, 1, 0, 0],
        [0, 0, 2, 0, 0, 2, 1, 2],
        [1, 0, 2, 1, 0, 0, 0, 1],
        [1, 0, 2, 3, 1, 1, 1, 2],
        [1, 0, 2, 1, 0, 0, 0, 0],
        [2, 1, 1, 3, 0, 0, 0, 0],
        [0, 0, 0, 2, 1, 1, 1, 0]
    ]
    let verticalTileArr: Array<Array<number>> = Array.from({ length:8 }, () => []) 
    const generateMapResources = () => {
        let tempArrX = verticalTileArr[positionX];
        setRes1([]) 
        for(let i = 0; i < tempArrX.length; i++) {
            console.log(tempArrX,tempArrX[i],'resources1')
            switch(tempArrX[i]){
                case 1:
                    // setRes1([corridorTile, ...resources]);
                    setRes1(resources.push(corridorTile));
                break;
                case 2:
                    // setRes1([turnTile, ...resources]);
                    setRes1(resources.push(turnTile));
                break;
                default:
                    // resources.push(0)
                
            }
        }
        // setPosition(resources)

        dispatch(setVertRes(verticalTileArr[positionX]))
        dispatch(setHorzRes(dg_map[positionY]))
        console.log(verticalTileArr[positionX], "map resssss1")
        console.log(resources,'resources1')
        // console.log(verticalResources, "map resssss1")
        // console.log(store.getState().room.verticalRes, "map resssss2")
    }
    
    useEffect(() => {
        tileArrConstr(dg_map);
        generateMapResources();
    },[positionX, positionY])
    
    useEffect(() => {
        console.log(verticalResources, "map resssss3")
        console.log(horizontalResources, "map resssss4")
        console.log(position, resources, 'position3')
    }, [verticalResources, horizontalResources, resources]);

    
    const tileArrConstr = (map:Array<number[]>) => {
        // let horizontalTileArr: Array<Array<number>> = Array.from({ length:8 }, () => []) 
        for(let i = 0; i < map.length; i++) {
            let row: Array<number> = map[i]; // pass posY  as i value to be the row position
            for(let j = 0; j < row.length; j++) {
                verticalTileArr[j].push(row[j]);
            }
        }
        console.log(verticalTileArr, "dog_map");
    }


    // changeLvl()
    let enemiesVal = Object.values(enemies)
    useEffect(() => {
        dispatch(fetchEnemies());
    }, [currentEnemy, dispatch]);
    useEffect(() => {
        // dispatch(getEnemies);
        enemiesVal = Object.values(enemies)
        console.log(resources,"MOVE")
        console.log("ENEMIES #### ROOM REFRESH", enemies, new Date().toLocaleTimeString(), enemiesVal[currentEnemy].health)
    },[Object.values(enemies).length, enemies, dispatch, position])

    Object.values(enemies).map((val, index) => {
        console.log('ENEMIES OBJECT VALUES', val, index);
    });
    const startCombatAux = (index:number) => {
        if(!inCombat) {
            dispatch(setCurrentEnemy(index));
            startCombat(index);
        } 
    }
    
    const mapPlacement = () => {
        setBacktrack([...backtrack, position[0]]);
        setPosition(position.slice(1));
        console.log(backtrack,position, "backtrack")
    }
    const mapPlacement2 = () => {
        // setBacktrack([...backtrack, position[0]]);
        let backtrackRev = backtrack.reverse();
        let positionTemp = position.reverse();
        setPosition(backtrackRev);
        setBacktrack(positionTemp);
        // setPosition(position.slice(1));
        console.log(backtrack,position,"backtrack")
    }
    const turn = (dir:string) => {
        switch(currentDir){
            
            case 'N':
                if(dir === 'R') dispatch(changeDir('E'));
                if(dir === 'L') dispatch(changeDir('W'));
                setPosition(resources2)
                setBacktrack([])
            break;
            
            case 'S':
                if(dir === 'R') dispatch(changeDir('W'));
                if(dir === 'L') dispatch(changeDir('E'));
            break;

            case 'W':
                if(dir === 'R') dispatch(changeDir('N'));
                if(dir === 'L') dispatch(changeDir('S'));
            break;
            
            case 'E':
                if(dir === 'R') dispatch(changeDir('S'));
                if(dir === 'L') dispatch(changeDir('N'));
            break;

            default:
                console.log(
                    "DEFAULT"
                )
       }
       // Align with horizontal tile array if there is a path to that direction(aka if section its 2 or 3)
       console.log(currentDir, "direction");
    }
    return (
        <View style={styles.backgroundImage}>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ () => mapPlacement() }>
               <Text>Move ↑</Text> 
            </TouchableOpacity>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ () => mapPlacement2() }>
               <Text>Move ↓</Text> 
            </TouchableOpacity>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ () => turn('R') }>
               <Text>Right</Text> 
            </TouchableOpacity>           
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ () => turn('L') }>
               <Text>Left</Text> 
            </TouchableOpacity>
            {/* <Button style={{styles.button}} title="next level" onPress={ changeLvl }></Button> */}
            <ImageBackground
            source={resources[0] as ImageSourcePropType} 
            style={styles.backgroundImage}>
            {position.map((val, index) => {
                console.log(position, 'position')
                    return <ImageBackground 
                    source={position[index] as ImageSourcePropType} 
                    style={[
                        styles.backgroundImage,
                        {
                            transform: [{scale: index === 1 ? 0.67 : 0.67/index+0.1}],
                            position: 'absolute'
                        }
                    ]} 
                    >
                    </ImageBackground>
            })}
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
        backgroundImage2: {
        alignSelf: 'center', 
        resizeMode: 'cover', 
        width: '100%', 
        height: '100%',
        transform: [{scale: 0.65}],
        flex: 0,
        padding: 10,
        position: 'absolute',
        justifyContent: 'space-around',
        alignItems: 'center',
        flexDirection: 'row',

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
