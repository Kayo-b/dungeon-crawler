import { setStatusBarNetworkActivityIndicatorVisible, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Platform, ImageBackground, TouchableOpacity, Touchable } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { changeDir, setHorzRes, setVertRes , setCurrentPos, setCurrentArrPos, invertInitialDirection, setLastTurnDir, setInitialDirection } from '../../features/room/roomSlice';
import { useRoom } from '../../events/room';
import { ImageSourcePropType } from 'react-native';
import { useCallback, useDebugValue, useEffect, useState } from 'react';
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
    // const dg_map = [
    //     [0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 2, 1, 1, 1, 1, 2, 0],
    //     [0, 1, 0, 0, 0, 0, 1, 0],
    //     [0, 1, 0, 0, 0, 0, 1, 0],
    //     [0, 1, 0, 0, 0, 0, 1, 0],
    //     [0, 1, 0, 0, 0, 0, 1, 0],
    //     [0, 2, 1, 1, 1, 1, 2, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0]
    // ]
    // const dg_map = [
    //     [2, 1, 1, 1, 1, 1, 1, 2],
    //     [1, 0, 0, 0, 0, 0, 0, 1],
    //     [1, 0, 0, 0, 0, 0, 0, 1]3
    //     [1, 0, 0, 0, 0, 0, 0, 1],
    //     [1, 0, 0, 0, 0, 0, 0, 1],
    //     [2, 1, 1, 1, 1, 1, 1, 2],
    //     [1, 0, 0, 0, 0, 0, 0, 1],
    //     [2, 1, 1, 1, 1, 1, 1, 2]
    // ]
    const dg_map = [
        [2, 1, 1, 3, 1, 1, 1, 2],
        [1, 0, 0, 1, 0, 0, 0, 1],
        [3, 1, 1, 1, 1, 1, 1, 3],
        [1, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 0, 1, 0, 0, 0, 1],
        [3, 1, 1, 1, 1, 1, 1, 3],
        [1, 0, 0, 0, 0, 0, 0, 1],
        [2, 1, 1, 1, 1, 1, 1, 2]
    ]
    // Cases for 3: if arrayPosition

    let mapArr = [];
    const generateMapResources = (currentDirLocal:String, newPosition: number, newDir: boolean, isReverse: boolean, is3turn) => {
        console.log('WALL CHECK VERTICAL ! ', newPosition, verticalTileArr[positionX][positionY])
        // console.log(arrayReverse,'()_+ array reverse')
        let tempArr = [];
        let tempArrTiles = []
        // let facingWall = false;
        let arrayPosition;
        console.log(newDir,'NEWDIR 2', iniDir)
        newDir = newDir !== undefined ? newDir : iniDir; 
        if(currentDirLocal === "N" || currentDirLocal === "S") {
            mapArr = verticalTileArr[positionX];
            console.log(verticalTileArr, positionX, 'TEMP ARR 1 +_+')
            arrayPosition = newPosition !== undefined ? newPosition : positionY
            console.log(currentDirLocal,'()_+ verticallllllllll !!!!!')
            console.log("WALL CHECK VERTICAL",verticalTileArr[positionX][positionY+1],positionX, positionY,currentDirLocal, newPosition, arrayPosition) //             if(reverse) { //                             console.log("REVERSE TRUE") //     arrayPosition = mapArr.length - positionY
        } else {
            mapArr = dg_map[positionY]
            arrayPosition = newPosition !== undefined ? newPosition : positionX
            console.log("WALL CHECK HORIZONTAL",dg_map[positionY][positionX+1], positionX,positionY, currentDirLocal)
            console.log(currentDirLocal,'()_+ horizontalllllllllll')
        }

        console.log('WALL CHECK VERTICAL 2! ', newPosition, verticalTileArr[positionX][positionY])
        console.log(mapArr, arrayPosition,"TEMP ARR 1 +_+", newPosition, positionY)
        let tempArray = [...mapArr]
        mapArr = mapArr.filter(val => val !== 0)
        let mapArrCount = mapArr.filter(val => val !== 1).length;
        console.log(mapArrCount, 'turndir maparrcount', mapArr);
        if(mapArr.filter(val => val !== 1).filter(val => val !== 0).length !== 0) {
            setMapArray(mapArr);
            console.log(currentDirLocal, currentDirTemp, 'turndir current dir local')
            if(currentDirTemp !== currentDirLocal && isReverse === undefined) {
                console.log("LOL GENERATE")
                switch(currentDirTemp) {
                    case 'N':
                        if(currentDirLocal === 'S') {
                            dispatch(invertInitialDirection());
                            newDir = !iniDir;
                        }
                    break;
                    case 'S':
                        if (currentDirLocal === 'N') {
                            dispatch(invertInitialDirection());
                            newDir = !iniDir;
                        }
                        break;
                    case 'E':
                        if (currentDirLocal === 'W') {
                            dispatch(invertInitialDirection());
                            newDir = !iniDir;
                        }
                        break;
                    case 'W':
                        if (currentDirLocal === 'E') {
                            dispatch(invertInitialDirection());
                            newDir = !iniDir;
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
        let undefCount = 0;
        console.log('wallcheck arrays', mapArr, tempArray, arrayPosition)
        for(let i = arrayPosition; i < tempArray.length; i++) {
            console.log(mapArr,mapArr[i],resources,'resourcesxx',tempArray);
            console.log('wallcheck trigger', mapArr[i], arrayPosition);
            switch(mapArr[i]) {
                case 1:
                    switch(currentDirLocal) {
                        case 'N':
                            if(verticalTileArr[positionX][positionY-1] === 0 ||
                                verticalTileArr[positionX][positionY-1] === undefined) {
                                // facingWall = true;
                                // tempArr.push(facingWallTile);
                                // tempArrTiles.push(facingWallTile); 
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            } 
                            console.log('wallcheck dir N', mapArr)
                        break;
                        case 'S':
                            if(verticalTileArr[positionX][positionY+1] === 0 ||
                                verticalTileArr[positionX][positionY+1] === undefined) {
                                // facingWall = true;
                                // tempArr.push(facingWallTile);
                                // tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                            console.log('wallcheck dir S', mapArr)
                        break;
                        case 'E':
                            if(dg_map[positionY][positionX+1] === 0 ||
                                dg_map[positionY][positionX+1] === undefined
                            ) {
                                // facingWall = true;
                                // tempArr.push(facingWallTile);
                                // tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                            console.log('wallcheck dir E', mapArr)
                        break;
                        default:
                            if(dg_map[positionY][positionX-1] === 0 || 
                                dg_map[positionY][positionX-1] === undefined
                            ) {
                                // facingWall = true;
                                // tempArr.push(facingWallTile);
                                // tempArrTiles.push(facingWallTile);
                            } else {
                                tempArr.push(corridorTile);
                                tempArrTiles.push(corridorTile);
                            }
                            console.log('wallcheck dir W', mapArr[i])
                        break;
                    }
                break;
                case 2:
                    console.log(verticalTileArr[positionX], dg_map[positionY][positionX], positionX, positionY,'()_+')
                    let nextTileOfPerpAxis;
                    switch(currentDirLocal) {
                        case 'N':
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
                case 3:
                    console.log(verticalTileArr[positionX], dg_map[positionY][positionX], positionX, positionY,'()_+')
                    switch(currentDirLocal) {
                        case 'N':
                            nextTileOfPerpAxis = dg_map[i][positionX+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, dg_map[i], positionX, '()_+vertical reverse', iniDir)
                            if(mapArr[i] !== 2) {
                                if(nextTileOfPerpAxis === 1) {
                                    console.log(newDir,"NEWDIR RRRRR 1 3")
                                    console.log('()_+ RIGHT')
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    if(newDir) {
                                        console.log(newDir,"NEWDIR RRRR 3")
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else {
                                        console.log(newDir,"NEWDIR LLLL 3")
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    }
                                }
                            }
                        break;
                        case 'S':
                            nextTileOfPerpAxis = dg_map[i][positionX+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, verticalTileArr[i], positionY, '()_+vertical reverse 3 S', mapArr[i])
                            if(mapArr[i] !== 2) {
                                if(nextTileOfPerpAxis === 1) {
                                    console.log('()_+ LEFT 3here') 
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                } else {
                                    console.log(newDir,"NEWDIR 3here")
                                    if(newDir) {
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else {
                                        console.log('()_+ RIGHT 3here')
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    }
                                }
                            }
                        break;
                        case 'W':
                            nextTileOfPerpAxis = verticalTileArr[i][positionY+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, verticalTileArr[i], i, positionX, '()_+vertical reverse', iniDir)
                            if(mapArr[i] !== 2) {
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
                            }
                        break;
                        case 'E':
                            nextTileOfPerpAxis = verticalTileArr[i][positionY+1];
                            console.log(nextTileOfPerpAxis, currentDirLocal, dg_map[i], positionY, '()_+vertical reverse', newDir)
                            if(mapArr[i] !== 2) {
                                if(nextTileOfPerpAxis === 1) {
                                    console.log(newDir,"NEWDIR RRRRR 1 ")
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
                            }
                        break;
                        default:
                           
                    }

                case undefined:
                    if(undefCount < 1) {
                    switch(currentDirLocal) {
                        case 'N':
                            if(verticalTileArr[positionX][positionY-1] === 0) {
                                // facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile); 
                            } 
                            undefCount++
                            console.log('wallcheck dir N', mapArr)
                        break;
                        case 'S':
                            if(verticalTileArr[positionX][positionY+1] === 0) {
                                // facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            } 
                            undefCount++
                            console.log('wallcheck dir S', mapArr)
                        break;
                        case 'E':
                            if(dg_map[positionY][positionX+1] === 0) {
                                // facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            } 
                            undefCount++
                            console.log('wallcheck dir E', mapArr)
                        break;
                        default:
                            if(dg_map[positionY][positionX-1] === 0) {
                                // facingWall = true;
                                tempArr.push(facingWallTile);
                                tempArrTiles.push(facingWallTile);
                            }
                            undefCount++
                            console.log('wallcheck dir W', mapArr[i])
                        break;
                    }

                    }
               break;
                default:
                   tempArr.push('');
            }
            console.log('()_+ IIIII',tempArr)
        }
        setVertRes(tempArr)
        setPathTileArray(tempArr.filter(val => val != ''))
        console.log('wallcheck 2', pathTileArr, tempArr)
        console.log(tempArr, tempArr.filter(val => val != ''), tempArrTiles.length, "TEMP!@")
        console.log(tempArr.length, tempArrTiles.length,"TEMP ARR")
        console.log(verticalResources,"TEMP ARR 3");
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
        let currentArrayPositionVert
        let currentArrayPositionHorz

    useEffect(() => {
        console.log(verticalTileArr[positionX][positionY], "VERTICAL TILE ARR CHECK")
        currentArrayPositionVert = verticalTileArr[positionX][positionY];
        currentArrayPositionHorz = dg_map[positionY][positionX];
        console.log(verticalTileArr[positionX], '+_+ vertical')
        console.log(dg_map[positionY], '+_+  horizontal')
        console.log(positionX, currentArrPos, iniDir, currentDir, '+_+ positionX')
        console.log(positionY, currentArrPos,'+_+ positionY')
        console.log(currentDir, pathTileArr, '+_+ path Tiles array', resources)
        console.log( currentArrayPositionVert,':Vertical',currentArrayPositionHorz, ":Horizontal", '+_+ current map arraty position')
        
    },[verticalTileArr, pathTileArr])

    useEffect(() => {
        generateMapResources(currentDir, 0);
    },[verticalTileArr])
    useEffect(() => {

    },[lastTurnDir, localLastTurnDir, currentDir])
    let enemiesVal = Object.values(enemies)
    useEffect(() => {
        dispatch(fetchEnemies());
    }, [currentEnemy, dispatch]);

    useEffect(() => {
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
        let tempPosY = positionY; 
        let tempPosX = positionX;
        let tempArrPos = currentArrPos;
        console.log(currentArrPos,"POS 123")
        console.log("turndir inidir currentdir",iniDir, currentDir, mapArray, lastTurnDir)
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
        dispatch(setLastTurnDir(''));
        console.log(backtrack,pathTileArr, currentDir, tempArrPos, "+_+ backtrack")
    }

    const reverse = () => {
        console.log('turndir 1 reverse', mapArray?.length, currentArrPos)
    //   facingWallTile  // setBacktrack(positionTemp);
        let newPosition
        let newDir: boolean;
        switch(currentDir){
            case 'N':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('S'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('S', newPosition-1, !iniDir, true);
            break;
            
            case 'S':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('N'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('N', newPosition - 1, !iniDir, true);
            break;

            case 'W':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('E'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('E', newPosition - 1, !iniDir, true);
            break;
            
            case 'E':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('W'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('W', newPosition - 1, !iniDir, true);
            break;

            default:
                console.log(
                    "DEFAULT"
                )
       }       
        // dispatch(invertInitialDirection(iniDir));
        console.log(currentArrPos,iniDir,"backtrack")
    }
// looking north, facing wall, turns right = E (East - since turning right from North leads to East)
// looking north, facing wall, turns left = E
    const reverseTurn = (turnDirection) => {
        switch(currentDir){
            case 'N':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('S'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('S', newPosition-1, !iniDir, true);
            break;
            
            case 'S':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('N'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('N', newPosition - 1, !iniDir, true);
            break;

            case 'W':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('E'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('E', newPosition - 1, !iniDir, true);
            break;
            
            case 'E':
                newPosition = mapArray?.length - currentArrPos;
                dispatch(changeDir('W'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('W', newPosition - 1, !iniDir, true);
            break;

            default:
                console.log(
                    "DEFAULT"
                )
       }       
    }

// currentDir = east, turn left, currentDir = north, turn right
// if lastTurnDir === turnDirection -> keep currentArrPos
// else 
// currentDir North, lastTurnDir === currentDir
// looking north, facing wall, turns left = W 
// looking south, facing wall, turns right = W 
// looking south, facing wall, turns left = E 
// looking east, facing wall, turns right = S 
// looking east, facing wall, turns left = N 
// looking west, facing wall, turns right = N 
// looking west, facing wall, turns left = S 

const handleTurn = (currentDir, lastTurnDir, turnDirection, is3turn) => {
  let newDirection;
  let newPosition;
  let tempLastTurnDir = 'test';
  tempLastTurnDir = lastTurnDir !== '' ? lastTurnDir : tempLastTurnDir;
  console.log('TEMP LAST TURN', localLastTurnDir,' | ', lastTurnDir, turnDirection)
  
  switch(currentDir) {
    case 'N':
      if (turnDirection === 'R') {
        newDirection = 'E';
      } else if (turnDirection === 'L') {
        newDirection = 'W';
      }
      break;
    
    case 'S':
      if (turnDirection === 'R') {
        newDirection = 'W';
      } else if (turnDirection === 'L') {
        newDirection = 'E';
      }
      break;
    
    case 'E':
      if (turnDirection === 'R') {
        newDirection = 'S';
      } else if (turnDirection === 'L') {
        newDirection = 'N';
      }
      break;
    
    case 'W':
      if (turnDirection === 'R') {
        newDirection = 'N';
        console.log('here is it?')
      } else if (turnDirection === 'L') {
        newDirection = 'S';
      }
      break;
      
    default:
      console.log("Invalid direction");
      return;
  }

  // Calculate new position (following your similar structure)
  newPosition = mapArray?.length - currentArrPos;
  
  console.log(lastTurnDir, turnDirection, currentArrPos, positionX, mapArray,'turn direction') 
  if(is3turn ) {
    console.log('is3 turn', currentDir)
    switch(currentDir) {
        case 'N':
            switch (turnDirection) {
                case 'R':
                    console.log('R maybe?')
                    generateMapResources(newDirection, positionX, true); 
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(positionX));
                break;
                case 'L':
                    console.log('turn3 inverse dir')
                    generateMapResources(newDirection, currentArrPos - positionX, false)
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(currentArrPos - positionX));
                break;
            }
        break;
        case 'S':
            switch (turnDirection) {
                case 'R':
                    console.log('R maybe?')
                    generateMapResources(newDirection, positionX, true); 
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(positionX))
                break;
                case 'L':
                    console.log('turn3 inverse dir')
                    generateMapResources(newDirection, currentArrPos - positionX, false)
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(currentArrPos - positionX));
                break;
            }
        break;
        case 'W':
            switch (turnDirection) {
                case 'R':
                    console.log('R maybe?')
                    if(currentArrayPositionHorz === 3) {
                    generateMapResources(newDirection, 7 - positionY, true)
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(7 - positionY));

                    } else {
                    generateMapResources(newDirection, currentArrPos - positionY, true); 
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(currentArrPos - positionY))

                    }
                break;
                case 'L':
                    console.log('turn3 inverse dir W L', positionY)
                    generateMapResources(newDirection, positionY, true)
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(positionY));
                break;
            }
        break;
        case 'E':
            switch (turnDirection) {
                case 'R':
                    console.log('R maybe?')
                    generateMapResources(newDirection, positionY, true); 
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(positionY))
                break;
                case 'L': // LAST CHANGE HERE
                    if(currentArrayPositionHorz === 3) {
                    generateMapResources(newDirection, (mapArr.length - 2) - positionY, true)
                    dispatch(setInitialDirection(true));
                    dispatch(setCurrentArrPos(7 - positionY));

                    } else {
                    console.log('turn3 inverse dir', currentArrPos, positionY)
                    generateMapResources(newDirection, currentArrPos - positionY, false)
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(currentArrPos - positionY));

                    }
                break;
            }
        break;
    }

    if((localLastTurnDir !== turnDirection) && currentArrPos === 0) {
        console.log('maybe here ?!', iniDir)
           dispatch(invertInitialDirection()) 
    }
    } else {
  // Update state with new direction and position
  if(lastTurnDir !== turnDirection) {
    if(currentDir === 'N' || currentDir === 'S') {
        if(positionX !== 1) {
            dispatch(changeDir(newDirection));
            dispatch(setCurrentArrPos(newPosition - 1));
            generateMapResources(newDirection, newPosition - 1);
            console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 0 x') 
        } else {
            if(iniDir) {
                dispatch(changeDir(newDirection));
                dispatch(setCurrentArrPos(newPosition - 1));
                generateMapResources(newDirection, newPosition - 1);
                console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 0 x') 
            } else {
                if(positionX === 1) {
                    dispatch(changeDir(newDirection));
                    dispatch(setCurrentArrPos(newPosition - 1));
                    generateMapResources(newDirection, newPosition - 1);
                } else {
                    generateMapResources(newDirection, currentArrPos);
                    console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 1 x') 
                }
            }
        }
    } else {
        if(positionY !== 1) {
            dispatch(changeDir(newDirection));
            dispatch(setCurrentArrPos(newPosition - 1));
            console.log(lastTurnDir, turnDirection, positionY, 'turn direction change arr pos 0 y') 
            generateMapResources(newDirection, newPosition - 1);
        } else {
            if(iniDir) {
                dispatch(changeDir(newDirection));
                dispatch(setCurrentArrPos(newPosition - 1));
                generateMapResources(newDirection, newPosition - 1);
                console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 1 y') 
            } else {
                if(positionY === 1) {
                    dispatch(changeDir(newDirection));
                    dispatch(setCurrentArrPos(newPosition - 1));
                    generateMapResources(newDirection, newPosition - 1);
                } else {
                    generateMapResources(newDirection, currentArrPos);
                    console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 2 y') 
                }
            }
        }
    }
    } else {
        generateMapResources(newDirection, currentArrPos);
        console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 3') 
    }
    }
};
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
  

const turn = (turnDir:string) => {
    console.log('LOL BASE 0', mapArray?.length, currentArrPos, pathTileArr, mapArray)
    console.log('LOL BASE', currentDir, turnDir)
    // console.log('turndir 1', lastTurnDir, mapArray, mapArray?.length, currentArrPos)
    // setCurrentTurnDir(turnDir);
    let newPosition
    let newDir: boolean;
    switch(currentDir) {
        case 'N':
            if(turnDir === 'R') {
                dispatch(changeDir('E'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                console.log(' LOL N R START', mapArray?.length, positionX, trueFalseVar)
                if(trueFalseVar) {  
                    console.log(' LOL N R TRUE', pathTileArr[0])
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('E', 0 , !iniDir); 
                        dispatch(invertInitialDirection());
                            console.log('CORNER TURN?')
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && dg_map[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0 N', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e 3 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                generateMapResources('E', 0); 
                                console.log('CORNER TURN no e ',currentArrayPositionHorz)
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                            console.log('LOL handle Turn')
                        }
                    }
                    if(pathTileArr[0] === 1 || pathTileArr[0] === 2 && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                    }                    
                } else {
                    console.log('LOL N R FINAL ELSE')
                    handleTurn(currentDir, lastTurnDir, turnDir)
                    console.log('here!')
                }
                console.log('N R END')
            }
            if(turnDir === 'L') {
                dispatch(changeDir('W'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                console.log(iniDir, pathTileArr[0], typeof pathTileArr[0], 'LOL N L', trueFalseVar)
                if(trueFalseVar) {
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('W', 0, !iniDir); 
                        dispatch(invertInitialDirection());
                        console.log('LOL2 first if')
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && dg_map[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0 N L', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e 3 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                generateMapResources('W', 0); 
                                dispatch(setCurrentArrPos(0))
                                console.log('CORNER TURN no e N L ',currentArrayPositionHorz)
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        }
                    }
                    if(pathTileArr[0] === 1 || pathTileArr[0] === 2 && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0));
                        console.log('LOL if set current arr pos to zero', mapArray, pathTileArr);
                    }
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                    console.log('here!')
                }
            } 
        break;
        
        case 'S':
            if(turnDir === 'R') {
                dispatch(changeDir('W'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                if(trueFalseVar) {  
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('W', 0, !iniDir); 
                        dispatch(invertInitialDirection());
                            console.log('CORNER TURN?')
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && dg_map[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e -> 3 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER 1?')
                                } else {
                                    generateMapResources('W', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e S R',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        } 
                    }
                    if(pathTileArr[0] === 1 || pathTileArr[0] === 2 && currentArrayPositionHorz !== 3) { 
                        dispatch(setCurrentArrPos(0))
                    }
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                }
            }
            if(turnDir === 'L') {
                dispatch(changeDir('E'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                console.log(iniDir, pathTileArr[0], typeof pathTileArr[0], 'LOL L', trueFalseVar)
                if(trueFalseVar) {
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('E', 0, !iniDir); 
                            console.log('CORNER TURN?')
                        dispatch(invertInitialDirection());
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && dg_map[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e 3 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                generateMapResources('E', 0); 
                                dispatch(setCurrentArrPos(0))
                                console.log('CORNER TURN no e ',currentArrayPositionHorz)
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        }
                    }
                    if(pathTileArr[0] === 1 || pathTileArr[0] === 2 && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                    }                       
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
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
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('N', 0, !iniDir); 
                        dispatch(invertInitialDirection());
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && verticalTileArr[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e 3 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                } else {
                                    generateMapResources('N', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e ',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        }
                    } 
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                    }
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                }               
            } 
            if(turnDir === 'L') { 
                dispatch(changeDir('S'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                console.log(iniDir, pathTileArr[0] !== 3, typeof pathTileArr[0] !== 'undefined', 'LOLTEST')
                if(trueFalseVar) {
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('S', 0, !iniDir); 
                        dispatch(invertInitialDirection());
                            console.log('LOL6.2')
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && verticalTileArr[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e west1',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER wst2')
                                } else {
                                    generateMapResources('S', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e ',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        } 
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0));
                            console.log('LOL6.4')
                    }                    
                
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
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
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('S', 0, !iniDir); 
                        dispatch(invertInitialDirection());
                            console.log('LOL7.2')
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && verticalTileArr[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('CORNER TURN right no east1 L ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('no corner east !!!')
                                } else {
                                    generateMapResources('S', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN right no east2 L ',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        }
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                            console.log('LOL7.4')
                    }                    
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                }
            } 
            if(turnDir === 'L') {
                dispatch(changeDir('N'));
                let trueFalseVar = iniDir ?
                pathTileArr[0] !== 3 :
                typeof pathTileArr[0] !== 'undefined';
                if(trueFalseVar) {
                    if(currentArrPos === 0 && currentArrayPositionHorz !== 3) {
                        generateMapResources('N', 0, !iniDir);
                        dispatch(invertInitialDirection());
                    } else {
                        if(typeof pathTileArr[0] !== 'undefined' && pathTileArr[0] !== 3 && pathTileArr[0] !== 4) {
                            if(currentArrayPositionHorz === 3 && verticalTileArr[currentArrPos + 1] === undefined) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                console.log('turn direction 0', lastTurnDir, turnDir)
                                console.log('CORNER TURN no east1 ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                handleTurn(currentDir, lastTurnDir, turnDir, true)
                                } else {
                                    generateMapResources('N', ); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no east2 ',currentArrayPositionHorz)

                                }
                            }
                        } else {
                            handleTurn(currentDir, lastTurnDir, turnDir);
                        }
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                        console.log('CORNER SET TO ZERO', currentArrayPositionHorz)
                    }
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                }
            }
            setBacktrack([])
        break;
        default:
            console.log(
                "LOL DEFAULT"
            )
        }
    dispatch(setLastTurnDir(turnDir));
    setLocalLastTurnDir(turnDir);
    if(pathTileArr[0] === 4 || pathTileArr.length === 0) {
        dispatch(setLastTurnDir(''))
    }
   console.log(currentDir, "turndir", turnDir);
   console.log('wallcheck', pathTileArr)
}

    useEffect(() => {
        console.log('LOL current position change', currentArrPos, pathTileArr[0], iniDir)
    },[currentArrPos])
    
    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
            forward();
            break;
            case 's':
            case 'arrowdown':
            reverse();
            break;
            case 'a':
            case 'arrowleft':
            turn('L');
            break;
            case 'd':
            case 'arrowright':
            turn('R');
            break;
            default:
            break;
        }
    }, [forward, reverse, turn]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [handleKeyPress]); 
    return (
        <View style={styles.backgroundImage}>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={forward}>
               <Text>Move ↑</Text> 
            </TouchableOpacity>
            <TouchableOpacity 
            style={{...styles.button, opacity: 1}} 
            onPress={reverse}>
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
