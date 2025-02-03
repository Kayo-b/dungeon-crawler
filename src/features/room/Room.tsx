import { setStatusBarNetworkActivityIndicatorVisible, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { changeDir, setHorzRes, setVertRes , setCurrentPos, setCurrentArrPos, setInitialDirection, setLastTurnDir } from '../../features/room/roomSlice';
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
    const currentArrPos = useAppSelector(state => state.room.currentArrPos);
    const iniDir = useAppSelector(state => state.room.initialDirection);
    const lastTurnDir = useAppSelector(state => state.room.lastTurnDir);
    const { changeLvl, getEnemies } = useRoom();
    const { startCombat } = useCombat();
    // dispatch(setCurrentPos([2,6]))
    // generate resources array based on dg_map layout
    // 1- take verticalTileArr for vertical tiles array and  dg_map for horizontal
    // 2- take current position of player
    // 3- based on position generate tiles with resources.
    
    const [localLastTurnDir, setLocalLastTurnDir] = useState<String>();
    const [resources, setRes1] = useState([]);
    const [resources2, setRes2] = useState([]);
    const [mapArray, setMapArray] = useState<Array<number>>();
    const [currentDirTemp, setCurrentDirTemp] = useState(currentDir);
    // generateMapResources()
    const backtrackArr: Array<NodeRequire> = [];
    const [pathTileArr, setPathTileArray] = useState<NodeRequire[]>(resources);
    const [backtrack, setBacktrack] = useState(backtrackArr);
    const [verticalTileArr, setVerticalTileArr] = useState<Array<Array<number>>>(Array.from({ length: 8 }, () => []));
    
    const turnTileRight = require('../../resources/dung-turn.png');
    const turnTileLeft = require('../../resources/dung-turn-left.png');
    const corridorTile = require('../../resources/dung-corridor.png');
    const facingWallTile = require('../../resources/brickwall.png');
    // Need to find a way to identify if the turn tile is left or right
    // vertical check: posX tiles will depend on the positionY[posX]
    // direction N && perpendicular axis index + 1 === 1 -> RIGHT TURN -ELSE- LEFT
    // direction S && perpendicular axis index + 1 === 1 -> LEFT TURN -ELSE- RIGHT
    // direction W && perpendicular axis index + 1 === 1 -> LEFT TURN -ELSE RIGHT
    // direction E && perpendicular axis index + 1 === 1 -> Right TURN -ELSE- LEFT
    // AT horizontal array[5,0 W] -> passes through tile type 2 -> needs to read vertical array 2(i) positionY 
    // At vertical array[2,0 S] -> passes thrrough tile type 2 -> needs to read horizontal array 0(i) positionX
    const dg_map = [
        [0, 2, 1, 1, 1, 1, 1, 2],
        [0, 1, 0, 0, 0, 0, 0, 1],
        [0, 1, 0, 0, 0, 0, 0, 1],
        [0, 1, 0, 0, 0, 0, 0, 1],
        [0, 1, 0, 0, 0, 0, 0, 1],
        [0, 1, 0, 0, 0, 0, 0, 1],
        [0, 2, 1, 1, 1, 1, 1, 2],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ]

    let mapArr = [];
    const generateMapResources = (currentDirLocal:String, newPosition: number, newDir: boolean) => {
        console.log('WALL CHECK VERTICAL ! ', newPosition)
        // console.log(arrayReverse,'()_+ array reverse')
        let tempArr = [];
        let tempArrTiles = []
        let facingWall = false;
        let arrayPosition;
        console.log(newDir,'NEWDIR 2', iniDir)
        newDir = newDir !== undefined ? newDir : iniDir; 

        if(currentDirLocal === "N" || currentDirLocal === "S") {
            mapArr = verticalTileArr[positionX];
            console.log(verticalTileArr, positionX, 'TEMP ARR 1 +_+')
            arrayPosition = newPosition !== undefined ? newPosition : positionY
            console.log(currentDirLocal,'()_+ verticallllllllll !!!!!')
            console.log("WALL CHECK VERTICAL",verticalTileArr[positionX][positionY+1],positionX, positionY,currentDirLocal, newPosition, arrayPosition) //             if(reverse) { //                             console.log("REVERSE TRUE") //     arrayPosition = mapArr.length - positionY
        // }
        } else {
            mapArr = dg_map[positionY]
            arrayPosition = newPosition !== undefined ? newPosition : positionX
            console.log("WALL CHECK HORIZONTAL",dg_map[positionY][positionX+1], positionX,positionY, currentDirLocal)
            console.log(currentDirLocal,'()_+ horizontalllllllllll')
        //                         if(reverse) {
        //                             console.log("REVERSE TRUE")
        //     arrayPosition = mapArr.length - positionX
        // }
        }

        console.log(mapArr, arrayPosition,"TEMP ARR 1 +_+", newPosition, positionY)
        mapArr = mapArr.filter(val => val !== 0)
        let mapArrCount = mapArr.filter(val => val !== 1).length;
        console.log(mapArrCount, 'turndir maparrcount', mapArr)
        if(mapArr.filter(val => val !== 1).length !== 0) {
            setMapArray(mapArr);
            console.log(currentDirLocal, currentDirTemp, 'turndir current dir local')
            if(currentDirTemp !== currentDirLocal) {
                switch(currentDirTemp) {
                    case 'N':
                        if(currentDirLocal === 'S') {
                            dispatch(setInitialDirection());
                        }
                    break;
                    case 'S':
                        if (currentDirLocal === 'N') {
                            dispatch(setInitialDirection());
                        }
                        break;
                    case 'E':
                        if (currentDirLocal === 'W') {
                            dispatch(setInitialDirection());
                        }
                        break;
                    case 'W':
                        if (currentDirLocal === 'E') {
                            dispatch(setInitialDirection());
                        }
                        break;
                    default:
                        break;
            }
        }
            setCurrentDirTemp(currentDirLocal);

            // dispatch(setLastTurnDir(''));
        }
        console.log('()_+ IIIII currentArrPos', newPosition)
        console.log('()_+ IIIII', currentDirLocal, mapArr, positionX, positionY, arrayPosition)

        for(let i = arrayPosition; i < mapArr.length; i++) {
            console.log(mapArr,mapArr[i],resources,'resourcesxx')
            console.log(verticalTileArr[positionX][positionY-1], 'limit wall position')
            switch(mapArr[i]) {
                case 1:
                    // setRes1([corridorTile, ...resources]);
                    // tempArr.push(corridorTile);
                    // tempArrTiles.push(corridorTile);
                    switch(currentDirLocal) {
                        case 'N':
                            if(verticalTileArr[positionX][positionY-1] === 0 ||
                                verticalTileArr[positionX][positionY-1] === undefined) {
                                facingWall = true;
                                tempArr.push(turnTileRight);
                                tempArrTiles.push(turnTileLeft); 
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            } 
                        break;
                        case 'S':
                            if(verticalTileArr[positionX][positionY+1] === 0) {
                                facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                        break;
                        case 'E':
                            if(dg_map[positionY][positionX+1] === 0) {
                                facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                        break;
                        default:
                            if(dg_map[positionY][positionX-1] === 0) {
                                facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                        break;
                    }
                break;
                case 2:
                    console.log(verticalTileArr[positionX], dg_map[positionY][positionX], positionX, positionY,'()_+')
                    // setRes1([turnTile, ...resources]);
                    let nextTileOfPerpAxis;
                    switch(currentDirLocal) {
                        case 'N':
                            //
                            nextTileOfPerpAxis = dg_map[i][positionX+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, dg_map[i], positionX, '()_+vertical reverse', iniDir)
                            if(nextTileOfPerpAxis === 1) {
                                    console.log(newDir,"NEWDIR RRRRR 1")
                                console.log('()_+ RIGHT')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else {
                                if(newDir) {
                                    console.log(newDir,"NEWDIR RRRR")
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    console.log(newDir,"NEWDIR LLLL")
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'S':
                            //
                            nextTileOfPerpAxis = dg_map[i][positionX+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, dg_map[i], positionY, '()_+vertical reverse', iniDir)
                            if(nextTileOfPerpAxis === 1) {
                                console.log('()_+ LEFT')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else {
                                console.log(newDir,"NEWDIR")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    console.log('()_+ RIGHT')
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'W':
                            //
                            nextTileOfPerpAxis = verticalTileArr[i][positionY+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, verticalTileArr[i], i, positionX, '()_+vertical reverse', iniDir)
                            if(nextTileOfPerpAxis === 1) {
                                console.log('()_+ LEFT')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else {
                                console.log(newDir,"NEWDIR")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    console.log('()_+ RIGHT')
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'E':
                            //
                            nextTileOfPerpAxis = verticalTileArr[i][positionY+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, dg_map[i], positionY, '()_+vertical reverse', newDir)
                            if(nextTileOfPerpAxis === 1) {
                                console.log(newDir,"NEWDIR RRRRR 1")
                                console.log('()_+  RIGHT')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else {
                                console.log(newDir,"NEWDIR <><>")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    console.log(newDir,"NEWDIR RRRR")
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    console.log('()_+  LEFT')
                                    console.log(newDir,"NEWDIR LLLL")
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                } 
                            }
                        break;
                        default:
                    }
               break;
                default:
                    tempArr.push('');
                    // tempArrTiles.push(facingWall)
            }
            console.log('()_+ IIIII',tempArr)
        }
        setVertRes(tempArr)
        setPathTileArray(tempArr.filter(val => val != ''))
        console.log('()_+ IIIII >>>>>>', pathTileArr)
        console.log(tempArr, tempArr.filter(val => val != ''), tempArrTiles.length, "TEMP!@")
        console.log(tempArr.length, tempArrTiles.length,"TEMP ARR")
        console.log(verticalResources,"TEMP ARR 3")
    }
    
    useEffect(() => {
        tileArrConstr(dg_map);
    },[])
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
        console.log(positionX, currentArrPos, '+_+ positionX')
        console.log(positionY, currentArrPos,'+_+ positionY')
        console.log(currentDir, pathTileArr, '+_+ path Tiles array', resources)
        console.log( currentArrayPositionVert,':Vertical',currentArrayPositionHorz, ":Horizontal", '+_+ current map arraty position')
        
    },[verticalTileArr, pathTileArr])

    useEffect(() => {
        console.log('111222')
        generateMapResources(currentDir, 0);
    },[verticalTileArr])
    useEffect(() => {

    },[lastTurnDir, localLastTurnDir, currentDir])
    let enemiesVal = Object.values(enemies)
    useEffect(() => {
        console.log('111222')
        dispatch(fetchEnemies());
    }, [currentEnemy, dispatch]);

    useEffect(() => {
        console.log('111222')
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
        // setBacktrack([...backtrack, pathTileArr[0]]);
        // setPathTileArray(pathTileArr.slice(1));
        let tempPosY = positionY; 
        let tempPosX = positionX;
        let tempArrPos = currentArrPos;
        console.log(currentArrPos,"POS 123")
        console.log("turndir inidir currentdir",iniDir, currentDir, mapArray, lastTurnDir)
        // dispatch(setLastTurnDir(''))
        switch(currentDir) {
            case 'N':
                tempPosY = positionY - 1;
                tempArrPos++;
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('N', tempArrPos);
            break;
            case 'S':
                tempPosY = positionY + 1;
                tempArrPos++;
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('S', tempArrPos);
            break;
            case 'E': 
                tempPosX = positionX + 1;
                tempArrPos++;
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('E', tempArrPos);
            break;
            default:
                tempPosX = positionX - 1;
                tempArrPos++;
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('W', tempArrPos);

        }
        dispatch(setCurrentPos([tempPosX,tempPosY]))
        console.log(backtrack,pathTileArr, currentDir, tempArrPos, "+_+ backtrack")
    }

    const reverse = () => {
        // setBacktrack([...backtrack, pathTileArr[0]]);
        // let backtrackRev = backtrack.reverse();
        // console.log(backtrack,"BACKTRACK <<<<<<<<<< ")
        // let positionTemp = pathTileArr.reverse();
        // setPathTileArray(backtrackRev);
        // setBacktrack(positionTemp);
        // setPathTileArray(position.slice(1));
        // setBacktrack([])
        let newPosition
        let newDir: boolean;
        // let setInitialDirectionLocal = () => {
        //     newDir = !iniDir
        // } 
        // setInitialDirectionLocal();
        console.log('NEWDIR 3', newDir)
        console.log('POS 123 4', currentArrPos)
        console.log(mapArray.length, currentArrPos, "CUR PATH TILE")
        dispatch(setLastTurnDir(''))
        switch(currentDir){
            case 'N':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('S'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(setInitialDirection())
                generateMapResources('S', newPosition-1, !iniDir);
            break;
            
            case 'S':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('N'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(setInitialDirection())
                generateMapResources('N', newPosition - 1, !iniDir);
            break;

            case 'W':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('E'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(setInitialDirection())
                generateMapResources('E', newPosition - 1, !iniDir);
            break;
            
            case 'E':
                newPosition = mapArray?.length- currentArrPos;
                dispatch(changeDir('W'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(setInitialDirection())
                generateMapResources('W', newPosition - 1, !iniDir);
            break;

            default:
                console.log(
                    "DEFAULT"
                )
       }       
        // dispatch(setInitialDirection(iniDir));
        console.log(currentArrPos,iniDir,"backtrack")
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
    // const [lastTurnCounter, setLastTurnCounter] = useState<number>(0)
    // const [currentTurnDir, setCurrentTurnDir] = useState<string>('');
    // useEffect(() => {
    //     if(currentTurnDir === lastTurnDir) {
    //          setLastTurnCounter(prev => prev + 1)
    //             // setLastTurnCounter(prev => prev + 1);
    //             // if(lastTurnCounter === 2) {
    //             //     dispatch(setInitialDirection())
    //             //     setLastTurnCounter(0)
    //             // }
    //                 console.log('turndir use effect() =>', currentTurnDir, lastTurnDir, lastTurnCounter, lastTurnCounter)
    //             if( lastTurnCounter >= 2) {
    //                 dispatch(setInitialDirection())
    //                 console.log('turndir use effect() =>', currentTurnDir, lastTurnDir, lastTurnCounter, lastTurnCounter)
    //                 setLastTurnCounter(0)
    //             }
                
    //         }
    //     // const turnCounterFunc = () => {
    //     //       if(currentTurnDir === lastTurnDir) {
    //     //         setLastTurnCounter(prev => prev + 1);
    //     //         if(lastTurnCounter === 2) {
    //     //             dispatch(setInitialDirection())
    //     //             setLastTurnCounter(0)
    //     //         }
    //     //         console.log('turndir use effect() =>', currentTurnDir, lastTurnDir, lastTurnCounter)
    //     //     }
    //     // }
    //     // turnCounterFunc(); 
    // }, [currentDir])
    // useEffect(() => {
    //     console.log('turndir useeffect() 2', lastTurnCounter)
    // },[lastTurnCounter])

    const turn = (turnDir:string) => {
        console.log('turndir 1', lastTurnDir, mapArray)
        // setCurrentTurnDir(turnDir);
        let newPosition
        let newDir: boolean;
        // const turnCounterFunc = () => {
        //     if(currentTurnDir === lastTurnDir) {
        //         setLastTurnCounter(prev => prev + 1);
        //         if(lastTurnCounter === 2) {
        //             dispatch(setInitialDirection())
        //         }
        //         console.log('turndir use effect() =>', currentTurnDir, lastTurnDir, lastTurnCounter)
        //         lastTurnCounter >= 2 ? setLastTurnCounter(0) : null;
        //     }
        // }
        // turnCounterFunc(); 
        switch(currentDir) {
            case 'N':
                if(turnDir === 'R') {
                    dispatch(changeDir('E'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    if(trueFalseVar) {  
                        if(currentArrPos === 0) {
                            generateMapResources('E', 0 , !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('E', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, "LOL1")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('E', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('E', currentArrPos);
                                }
                            }
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }                    
                    } else {
                        generateMapResources('E', currentArrPos); 
                    }
                }
                if(turnDir === 'L'){
                    dispatch(changeDir('W'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('W', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('W', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir NL', iniDir, turnDir, lastTurnDir, "LOL2")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('W', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('W', currentArrPos);
                                }
                            }
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }
                    } else {
                        generateMapResources('W', currentArrPos); 
                    }
                } 
            break;
            
            case 'S':
                if(turnDir === 'R') {
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    dispatch(changeDir('W'));
                    if(trueFalseVar) {  
                        if(currentArrPos === 0) {
                            generateMapResources('W', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('W', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, "LOL3")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('W', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('W', currentArrPos);
                                }
                            } 
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }
                    } else {
                        generateMapResources('W', currentArrPos); 
                    }
                }
                if(turnDir === 'L') {
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    dispatch(changeDir('E'));
                    if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('E', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('E', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, "LOL4")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('E', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('E', currentArrPos);
                                }
                            }
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }                       
                    } else {
                        generateMapResources('E', currentArrPos); 
                    }
                } 
                setBacktrack([])
            break;

            case 'W':
                if(turnDir === 'R') {
                    dispatch(changeDir('N'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                     if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('N', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('N', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, "LOL5")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('N', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('N', currentArrPos);
                                }
                            }
                        } 
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }
                    } else {
                        generateMapResources('N', currentArrPos); 
                    }               
                } 
                if(turnDir === 'L') { 
                    dispatch(changeDir('S'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('S', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('S', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, "LOL6")

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('S', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('S', currentArrPos);
                                }
                            } 
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }                    
                    
                    } else {
                        generateMapResources('S', currentArrPos); 
                    }
                }
                setBacktrack([])
            break;
            
            case 'E':
                if(turnDir === 'R') {
                    dispatch(changeDir('S'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';
                    if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('S', 0, !iniDir); 
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('S', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, mapArray, currentArrPos, 'LOL7')

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('S', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('S', currentArrPos);
                                }
                            }
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }                    
                    } else {
                        generateMapResources('S', currentArrPos); 
                    }
                } 
                if(turnDir === 'L') {
                    dispatch(changeDir('N'));
                    let trueFalseVar = iniDir ?
                    pathTileArr[0] !== 3 :
                    typeof pathTileArr[0] !== 'undefined';

                    if(trueFalseVar) {
                        if(currentArrPos === 0) {
                            generateMapResources('N', 0, !iniDir);
                            dispatch(setInitialDirection());
                        } else {
                            if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                                generateMapResources('N', 0); 
                            } else {
                                if(mapArray.length > 2) { 
                                    console.log('turndir', iniDir, turnDir, lastTurnDir, mapArray, currentArrPos, 'LOL8')

                                    newPosition = mapArray.length - currentArrPos;
                                    dispatch(setCurrentArrPos(newPosition - 1))
                                    generateMapResources('N', newPosition - 1, !iniDir);
                                } else {
                                    generateMapResources('N', currentArrPos);
                                }
                            }
                        }
                        if(pathTileArr[0] === 1 || pathTileArr[0] === 2) {
                            dispatch(setCurrentArrPos(0))
                        }
                       } else {
                        generateMapResources('N', currentArrPos);
                    }
                }
                setBacktrack([])
            break;
            default:
                console.log(
                    "DEFAULT"
                )
            }
            
        dispatch(setLastTurnDir(turnDir));
        setLocalLastTurnDir(turnDir);
       console.log(currentDir, "turndir", turnDir);
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
