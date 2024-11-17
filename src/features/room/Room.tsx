import { setStatusBarNetworkActivityIndicatorVisible, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { changeDir, setHorzRes, setVertRes , setCurrentPos } from '../../features/room/roomSlice';
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
    // dispatch(setCurrentPos([2,6]))
    
    // generate resources array based on dg_map layout
    // 1- take verticalTileArr for vertical tiles array and  dg_map for horizontal
    // 2- take current position of player
    // 3- based on position generate tiles with resources.
    
    const [resources, setRes1] = useState([])
    const [resources2, setRes2] = useState([])
    // generateMapResources()
    const backtrackArr: Array<NodeRequire> = [];
    const [pathTileArr, setPathTileArray] = useState<NodeRequire[]>(resources);
    const [backtrack, setBacktrack] = useState(backtrackArr)
    const [verticalTileArr, setVerticalTileArr] = useState<Array<Array<number>>>(Array.from({ length: 8 }, () => []));
    
    const turnTile = require('../../resources/dung-turn.png');
    const corridorTile = require('../../resources/dung-corridor.png');

    const dg_map = [
        [0, 0, 2, 1, 1, 2, 0, 0],
        [0, 0, 1, 0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0, 1, 0, 2],
        [1, 0, 1, 0, 0, 1, 0, 1],
        [3, 1, 1, 0, 0, 1, 1, 2],
        [1, 0, 1, 0, 0, 1, 0, 0],
        [1, 0, 2, 1, 1, 2, 0, 0],
        [0, 0, 0, 2, 1, 1, 1, 0]
    ]

    const generateMapResources = (arrayDir:String) => {
        let mapArr = [];
        if(arrayDir === 'vertical') {
            mapArr = verticalTileArr[positionX];
        } else {
            mapArr = dg_map[positionY]
        }
        console.log(mapArr,"TEMP ARR 1")
        let tempArr = [];
        for(let i = 0; i < mapArr.length; i++) {
            console.log(mapArr,mapArr[i],resources,'resourcesxx')
            switch(mapArr[i]){
                case 1:
                    // setRes1([corridorTile, ...resources]);
                    tempArr.push(corridorTile);
                break;
                case 2:
                    // setRes1([turnTile, ...resources]);
                    tempArr.push(turnTile)
                break;
                default:
                    // setVertRes('0')
            }
        }
        // setPathTileArray(resources)
        // dispatch(setVertRes(verticalTileArr[positionX]))
        // dispatch(setHorzRes(dg_map[positionY]))
        // console.log(verticalTileArr[positionX], "map resssss1")
        // console.log(resources,'resources1')
        // console.log(verticalResources, "map resssss1")
        // console.log(store.getState().room.verticalRes, "map resssss2")
        setVertRes(tempArr)
        setPathTileArray(tempArr)
        console.log(tempArr,"TEMP ARR")
        console.log(verticalResources,"TEMP ARR 3")
    }
    
    useEffect(() => {
        tileArrConstr(dg_map);
    },[])
    // useEffect(() => {
        //     console.log(verticalResources, "TEMP ARR 4")
        //     console.log(horizontalResources, "map resssss4")
        //     console.log(position, resources, 'TEMP ARR 5')
        // }, [verticalResources, horizontalResources, resources]);
        
    const tileArrConstr = (map:Array<number[]>) => {
        const newVerticalArr:Array<Array<number>> = Array.from({ length: 8 }, () => []);
        console.log('backtrack 3',map.length, verticalTileArr)
        // let horizontalTileArr: Array<Array<number>> = Array.from({ length:8 }, () => []) 
        for(let i = 0; i < map.length; i++) {
            let row: Array<number> = map[i]; // pass posY  as i value to be the row position
            for(let j = 0; j < row.length; j++) {
                newVerticalArr[j].push(row[j])
            }
        }
        console.log('backtrack4', newVerticalArr)
        setVerticalTileArr(newVerticalArr)
    }

    useEffect(() => {
        let currentArrayPositionVert = verticalTileArr[positionX][positionY];
        let currentArrayPositionHorz = dg_map[positionY][positionX];
        console.log(verticalTileArr[positionX], '+_+ vertical')
        console.log(dg_map[positionY], '+_+  horizontal')
        console.log(positionX, '+_+ positionX')
        console.log(positionY, '+_+ positionY')
        console.log(pathTileArr, '+_+ path Tiles array')
        console.log( currentArrayPositionVert,':Vertical',currentArrayPositionHorz, ":Horizontal", '+_+ current map arraty position')
        
    },[verticalTileArr, pathTileArr])

    useEffect(() => {
        generateMapResources('vertical');
    },[verticalTileArr])

    let enemiesVal = Object.values(enemies)
    useEffect(() => {
        dispatch(fetchEnemies());
    }, [currentEnemy, dispatch]);

    useEffect(() => {
        // dispatch(getEnemies);
        enemiesVal = Object.values(enemies)
        console.log(resources,"MOVE")
        console.log("ENEMIES #### ROOM REFRESH", enemies, new Date().toLocaleTimeString(), enemiesVal[currentEnemy].health)
    },[Object.values(enemies).length, enemies, dispatch, pathTileArr])

    Object.values(enemies).map((val, index) => {
        console.log('ENEMIES OBJECT VALUES', val, index);
    });

    const startCombatAux = (index:number) => {
        if(!inCombat) {
            dispatch(setCurrentEnemy(index));
            startCombat(index);
        } 
    }
    
    const forward = () => {
        setBacktrack([...backtrack, pathTileArr[0]]);
        setPathTileArray(pathTileArr.slice(1));
        let tempPosY; 
        switch(currentDir) {
            case 'N':
                tempPosY = positionY - 1;
            break;
            case 'S ':
                tempPosY = positionY + 1;
            break;
            case 'E': 
                tempPosY = positionX + 1;
            break;
            default:
                tempPosY = positionX - 1;

        }
        dispatch(setCurrentPos([positionX,tempPosY]))
        console.log(backtrack,pathTileArr,verticalTileArr,positionX, "+_+ backtrack")
    }

    const reverse = () => {
        // setBacktrack([...backtrack, pathTileArr[0]]);
        let backtrackRev = backtrack.reverse();
        let positionTemp = pathTileArr.reverse();
        setPathTileArray(backtrackRev);
        setBacktrack(positionTemp);
        // setPathTileArray(position.slice(1));
        console.log(backtrack,pathTileArr,"backtrack")
    }
    
    //in resources array + map array(one for loading tiles other for controling position and dictating what will happen)
    // if dir N and at first index in tile array = looking at the wall
    // if dir S and at last index in tile array = looking at the wall
    // if dir W and at fist index tile arr = looking at wall
    // if dir E and at last index tile arr = looking at wall
    // N types of placement/direction/tile rendering:
     //  1. Pure index placement + current direction (N S L E)
     //  2. Index placement + current tile type(1,2,3...) + current direction.

    // Scenario: 
    // character is in "vertical lane"(N-S tile array),
    // last index and facing north(N-S tile array),
    // char moves forward (N) and reaches a tile type 2(turn),
    // character turns left or right -> change tile array to horizontal (W-E tile array)
    // check type of lane cardinal direction and current facing position to determine what to render.
    // Todo: 
    //      - track/change position when moving
    //      - correlate movement to placement in map array

    const turn = (turnDir:string) => {
        switch(currentDir){
            case 'N':
                if(turnDir === 'R') dispatch(changeDir('E'));
                if(turnDir === 'L') dispatch(changeDir('W'));
                setPathTileArray(resources2)
                generateMapResources('horizontal')
                setBacktrack([])
            break;
            
            case 'S':
                if(turnDir === 'R') dispatch(changeDir('W'));
                if(turnDir === 'L') dispatch(changeDir('E'));
            break;

            case 'W':
                if(turnDir === 'R') dispatch(changeDir('N'));
                if(turnDir === 'L') dispatch(changeDir('S'));
            break;
            
            case 'E':
                if(turnDir === 'R') dispatch(changeDir('S'));
                if(turnDir === 'L') dispatch(changeDir('N'));
                generateMapResources('vertical')
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
            onPress={ () => forward() }>
               <Text>Move ↑</Text> 
            </TouchableOpacity>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={ () => reverse() }>
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
            {pathTileArr.map((val, index) => {
                console.log(pathTileArr, 'pathTileArray')
                    return <ImageBackground 
                    source={pathTileArr[index] as ImageSourcePropType} 
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
