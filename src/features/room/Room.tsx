import { setStatusBarNetworkActivityIndicatorVisible, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Platform, ImageBackground, TouchableOpacity, Touchable, Image } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Enemy } from '../enemy/Enemy';
import { fetchEnemies, setCurrentEnemy } from '../../features/enemy/enemySlice';
import { changeDir, setHorzRes, setVertRes , setCurrentPos, setCurrentArrPos, invertInitialDirection, setLastTurnDir, setInitialDirection, loadMap, resetPosition } from '../../features/room/roomSlice';
import { dmg2Player, regenResourcesOnTile } from '../player/playerSlice';
import { getMapList, MapInfo } from '../../data/maps';
import { ImageSourcePropType } from 'react-native';
import { ReactNode, useCallback, useDebugValue, useEffect, useMemo, useRef, useState } from 'react';
import { current } from '@reduxjs/toolkit';
import { debugMove, movementDebug, Direction } from '../../utils/debug';
import { DebugOverlay } from './DebugOverlay';
import { useMovement } from '../../systems/movement/useMovement';
import { useMovementWithRender, TileImages } from '../../systems/movement/useMovementWithRender';
import { isBlocked } from '../../systems/movement/TileNavigator';
import { Room3D } from './Room3D';
import { Direction as FacingDirection } from '../../types/map';
import { registerEnemyAttack } from '../../events/combatSlice';
import { getDoorTargetMap, getMapDepth, getStairsTargetMap } from '../../data/maps/transitions';
import {
    getEnemyDistanceInFacingDirection,
    isEnemyCombatReachable,
    isEnemyOccludedByCloserEnemy,
    isEnemyVisibleToPlayer,
} from '../enemy/enemyPerception';
import { computeDerivedPlayerStats } from '../player/playerStats';
// import { incremented, amoutAdded } from '.main-screen/room/counterSlice';

const ROOM_VIEWPORT_SIZE = 512;

/**
 * Calculate the correct array position directly from player coordinates
 * This avoids desync issues from stale state during rapid turns
 */
function calculateArrPosFromCoords(
    playerX: number,
    playerY: number,
    direction: string,
    horizontalMap: number[][],
    verticalMap: number[][]
): { arrPos: number; pathLength: number; filteredPath: number[]; iniDirForNewPath: boolean } {
    // Get the raw path for the target direction
    let rawPath: number[];
    let playerCoord: number;

    if (direction === 'N' || direction === 'S') {
        rawPath = verticalMap[playerX] || [];
        playerCoord = playerY;
    } else {
        rawPath = horizontalMap[playerY] || [];
        playerCoord = playerX;
    }

    // Build position lookup and filtered path (removing walls)
    const positionLookup: number[] = [];
    const filteredPath: number[] = [];

    for (let i = 0; i < rawPath.length; i++) {
        if (rawPath[i] !== 0) {
            positionLookup.push(i);
            filteredPath.push(rawPath[i]);
        }
    }

    // Find player's index in the filtered array
    let arrPos = positionLookup.indexOf(playerCoord);
    if (arrPos === -1) {
        // Player coordinate not found in path - find closest
        arrPos = 0;
        for (let i = 0; i < positionLookup.length; i++) {
            if (positionLookup[i] <= playerCoord) {
                arrPos = i;
            }
        }
    }

    // For N/W, the array is reversed in generateMapResources, so adjust position
    // arrPos should be the distance from the "start" of the visible path
    let iniDirForNewPath: boolean;
    if (direction === 'N' || direction === 'W') {
        arrPos = filteredPath.length - 1 - arrPos;
        // When entering from S going N, or E going W, iniDir should be based on entry
        iniDirForNewPath = direction === 'N' ? false : false;
    } else {
        // S or E direction
        iniDirForNewPath = direction === 'S' ? true : true;
    }

    return {
        arrPos: Math.max(0, Math.min(arrPos, filteredPath.length - 1)),
        pathLength: filteredPath.length,
        filteredPath,
        iniDirForNewPath
    };
}

let display = 0;

interface RoomProps {
    startCombat: (id: number) => void;
    engagePlayerAttack: (id: number) => void;
    skillOverlay?: ReactNode;
    rightOverlay?: ReactNode;
}

export const Room = ({ startCombat, engagePlayerAttack, skillOverlay, rightOverlay }: RoomProps) => {
    const dispatch = useAppDispatch(); 
    // const enemyHealth = useAppSelector(state => state.enemy.enemies[0].stats.health); 
    const inCombat = useAppSelector(state => state.combat.inCombat);
    const currentLvl = useAppSelector(state => state.room.currentLvlIndex);
    const enemies = useAppSelector(state => state.enemy.enemies)
    const playerHealth = useAppSelector(state => state.player.health);
    const playerDodgeChance = useAppSelector(state => state.player.dodgeChance || 0);
    const playerStats = useAppSelector(state => state.player.stats as Record<string, any>);
    const playerLevel = useAppSelector(state => state.player.level);
    const currentEnemy = useAppSelector(state => state.enemy.currentEnemyId);
    const currentDir = useAppSelector(state => state.room.direction);
    const verticalResources = useAppSelector(state => state.room.verticalRes);
    const horizontalResources = useAppSelector(state => state.room.horizontalRes);
    const positionY = useAppSelector(state => state.room.posY);
    const positionX = useAppSelector(state => state.room.posX);
    const currentArrPos = useAppSelector(state => state.room.currentArrPos);
    const iniDir = useAppSelector(state => state.room.initialDirection);
    const lastTurnDir = useAppSelector(state => state.room.lastTurnDir);

    // Map data from Redux (new)
    const currentMapId = useAppSelector(state => state.room.currentMapId);
    const dungeonDepth = getMapDepth(currentMapId);
    const mapWidth = useAppSelector(state => state.room.mapWidth);
    const mapHeight = useAppSelector(state => state.room.mapHeight);
    const mapTiles = useAppSelector(state => state.room.mapTiles);
    const reduxVerticalTiles = useAppSelector(state => state.room.verticalTiles);

    // Use Redux map data instead of hardcoded - dg_map now references Redux state
    const dg_map = mapTiles;
    const playerClass = useAppSelector(state => state.player.classArchetype || 'warrior');
    const effectiveStamina = useMemo(() => {
        const derived = computeDerivedPlayerStats(playerStats || {}, {}, {
            classArchetype: playerClass,
            level: playerLevel,
        });
        return Number(derived.maxStamina || 0);
    }, [playerStats, playerClass, playerLevel]);

    // Get current tile type at player position for special tile interactions
    const currentTileType = mapTiles?.[positionY]?.[positionX] ?? 0;
    const isOnStairsUp = currentTileType === 6;
    const isOnStairsDown = currentTileType === 7;
    const isOnDoor = currentTileType === 5;
    const isOnSpecialTile = isOnStairsUp || isOnStairsDown || isOnDoor;

    // Handle stairs interaction (changes dungeon depth/map branch)
    const handleStairsInteraction = () => {
        if (inCombat) return;
        const targetMap = isOnStairsUp
            ? getStairsTargetMap(currentMapId, 'up')
            : isOnStairsDown
                ? getStairsTargetMap(currentMapId, 'down')
                : undefined;

        if (!targetMap) {
            console.log(`[Room] No stairs transition configured for map "${currentMapId}"`);
            return;
        }

        console.log(`[Room] Stairs transition: ${currentMapId} -> ${targetMap}`);
        dispatch(loadMap(targetMap));
    };

    // Handle door interaction (switch map, keep same dungeon depth)
    const handleDoorInteraction = () => {
        if (inCombat) return;
        if (!isOnDoor) return;
        const targetMap = getDoorTargetMap(currentMapId);
        if (!targetMap) {
            console.log(`[Room] No door transition configured for map "${currentMapId}"`);
            return;
        }

        console.log(`[Room] Door transition: ${currentMapId} -> ${targetMap}`);
        dispatch(loadMap(targetMap));
    };

    // New movement system hook
    const movement = useMovement();
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
    // Use Redux vertical tiles, or initialize from map dimensions
    const [verticalTileArr, setVerticalTileArr] = useState<Array<Array<number>>>(
        reduxVerticalTiles.length > 0 ? reduxVerticalTiles : Array.from({ length: mapWidth }, () => [])
    );
    
    const turnTileRight = require('../../resources/dung-turn.png');
    const turnTileLeft = require('../../resources/dung-turn-left.png');
    const corridorTile = require('../../resources/dung-corridor.png');
    const facingWallTile = require('../../resources/brickwall.png');
    const turnThreeWay = require('../../resources/dung-threeway.png');
    const doorFrontLeft = require('../../resources/door_parts/door_front_left.png');
    const doorFrontRight = require('../../resources/door_parts/door_front_right.png');
    const doorSideLeft = require('../../resources/door_parts/door_side_left.png');
    const doorSideRight = require('../../resources/door_parts/door_side_right.png');
    const doorFrontLeftFar = require('../../resources/door_parts/door_front_left_far.png');
    const doorFrontRightFar = require('../../resources/door_parts/door_front_right_far.png');
    const doorSideLeftFar = require('../../resources/door_parts/door_side_left_far.png');
    const doorSideRightFar = require('../../resources/door_parts/door_side_right_far.png');

    // Tile images for new movement system
    // Note: door, stairs, deadEnd, and fourWay use placeholders until custom images are added
    const tileImages: TileImages = {
        corridor: corridorTile,
        turnLeft: turnTileLeft,
        turnRight: turnTileRight,
        threeWay: turnThreeWay,
        wall: facingWallTile,
        // New tile types - using fallbacks until dedicated images exist
        fourWay: turnThreeWay,      // Fallback to 3-way for now
        door: corridorTile,          // Fallback to corridor for now
        doorOpen: corridorTile,      // Fallback to corridor for now
        stairsUp: corridorTile,      // Fallback to corridor for now
        stairsDown: corridorTile,    // Fallback to corridor for now
        deadEnd: facingWallTile,     // Fallback to wall for now
    };

    // Toggle for new vs old movement system
    const [useNewMovement, setUseNewMovement] = useState(false);

    // Toggle for CSS 3D rendering mode (experimental)
    const [use3DRendering, setUse3DRendering] = useState(true);
    const rangedShotCooldownRef = useRef<{ [key: number]: number }>({});
    const lastPlayerTileRef = useRef<{ x: number; y: number; mapId: string } | null>(null);
    const lastMoveFrameAtRef = useRef(0);

    const getDoorOverlaySources = (tileSprite: NodeRequire, distanceIndex: number): NodeRequire[] => {
        const useFar = distanceIndex >= 4;
        if (tileSprite === turnTileLeft) {
            return [useFar ? doorSideLeftFar : doorSideLeft];
        }
        if (tileSprite === turnTileRight) {
            return [useFar ? doorSideRightFar : doorSideRight];
        }
        return [
            useFar ? doorFrontLeftFar : doorFrontLeft,
            useFar ? doorFrontRightFar : doorFrontRight,
        ];
    };

    // New movement system hook
    const newMovement = useMovementWithRender(tileImages);

    // Map data now comes from Redux state (mapTiles/dg_map, reduxVerticalTiles)
    // Available maps can be loaded via dispatch(loadMap('level1')) etc.
    // reverse maparr if:
    // .                  direction is N 
    ///                   direction is W
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

        console.log('WALL CHECK VERTICAL 2! ', newPosition, verticalTileArr[positionX][positionY], 'array position',arrayPosition)
        console.log(mapArr, arrayPosition,"TEMP ARR 1 +_+", newPosition, positionY)
        let tempArray = [...mapArr]
        mapArr = mapArr.filter(val => val !== 0)
        let mapArrCount = mapArr.filter(val => val !== 1).length;
        console.log(mapArrCount, 'turndir maparrcount', mapArr);
        if(mapArr.filter(val => val !== 1).length !== 0) {
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
        }
        console.log('()_+ IIIII currentArrPos', newPosition)
        console.log('()_+ IIIII', currentDirLocal, mapArr, positionX, positionY, arrayPosition)
        let undefCount = 0;

        // Build a lookup table: for each index in the filtered mapArr, what's the actual map position?
        // This is needed because filtering removes walls and shifts indices
        const positionLookup: number[] = [];
        let lookupIdx = 0;
        for (let pos = 0; pos < tempArray.length; pos++) {
            if (tempArray[pos] !== 0) {
                positionLookup[lookupIdx] = pos;
                lookupIdx++;
            }
        }

        if(currentDirLocal === 'N' || currentDirLocal === 'W') {
            mapArr = mapArr.reverse();
            positionLookup.reverse();
        }

        // FIX: Calculate the visible path length - stop at first wall in the direction we're facing
        // This prevents rendering tiles that are behind walls
        let visiblePathEnd = mapArr.length;

        // Find player's current position in the original tempArray
        const playerCoord = currentDirLocal === 'N' || currentDirLocal === 'S' ? positionY : positionX;

        // Check for walls blocking the view from current position
        if (currentDirLocal === 'S') {
            // Walking south (increasing Y), check for walls ahead
            for (let y = positionY + 1; y < tempArray.length; y++) {
                if (tempArray[y] === 0) {
                    // Found a wall - find corresponding index in filtered array
                    const wallIdx = positionLookup.findIndex(p => p >= y);
                    if (wallIdx !== -1) {
                        visiblePathEnd = wallIdx;
                    } else {
                        visiblePathEnd = mapArr.length;
                    }
                    break;
                }
            }
        } else if (currentDirLocal === 'N') {
            // Walking north (decreasing Y), array is reversed
            // In reversed array, we walk forward but check original positions going backwards
            for (let idx = arrayPosition; idx < mapArr.length; idx++) {
                const originalPos = positionLookup[idx];
                // Check if there's a wall between current position and this tile
                for (let y = positionY - 1; y > originalPos; y--) {
                    if (tempArray[y] === 0) {
                        visiblePathEnd = idx;
                        break;
                    }
                }
                if (visiblePathEnd !== mapArr.length) break;
            }
        } else if (currentDirLocal === 'E') {
            // Walking east (increasing X), check for walls ahead
            for (let x = positionX + 1; x < tempArray.length; x++) {
                if (tempArray[x] === 0) {
                    const wallIdx = positionLookup.findIndex(p => p >= x);
                    if (wallIdx !== -1) {
                        visiblePathEnd = wallIdx;
                    } else {
                        visiblePathEnd = mapArr.length;
                    }
                    break;
                }
            }
        } else if (currentDirLocal === 'W') {
            // Walking west (decreasing X), array is reversed
            for (let idx = arrayPosition; idx < mapArr.length; idx++) {
                const originalPos = positionLookup[idx];
                for (let x = positionX - 1; x > originalPos; x--) {
                    if (tempArray[x] === 0) {
                        visiblePathEnd = idx;
                        break;
                    }
                }
                if (visiblePathEnd !== mapArr.length) break;
            }
        }

        console.log('wallcheck arrays', mapArr, tempArray, arrayPosition, 'positionLookup:', positionLookup, 'visiblePathEnd:', visiblePathEnd)

        // Use visiblePathEnd to limit the loop instead of tempArray.length
        const loopEnd = Math.min(visiblePathEnd, mapArr.length);
        for(let i = arrayPosition; i < loopEnd; i++) {
            // Get actual map position for perpendicular tile lookups
            // i is used to index into mapArr, positionLookup[i] gives actual map coordinate
            const actualMapPos = positionLookup[i] ?? i;

            console.log(mapArr,mapArr[i],resources,'resourcesxx',tempArray, 'actualPos:', actualMapPos);
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
                    let prevTileOfPerpAxis;
                    switch(currentDirLocal) {
                        case 'N':
                            // Use actualMapPos for Y coordinate when moving N/S
                            // Check BOTH perpendicular directions: East (x+1) and West (x-1)
                            nextTileOfPerpAxis = dg_map[actualMapPos]?.[positionX+1]; // East
                            prevTileOfPerpAxis = dg_map[actualMapPos]?.[positionX-1]; // West
                            console.log('case 2 N: East=', nextTileOfPerpAxis, 'West=', prevTileOfPerpAxis, 'actualMapPos:', actualMapPos)
                            // When facing North: East is to your RIGHT, West is to your LEFT
                            const hasEastPathN = nextTileOfPerpAxis !== undefined && nextTileOfPerpAxis !== 0;
                            const hasWestPathN = prevTileOfPerpAxis !== undefined && prevTileOfPerpAxis !== 0;
                            if(hasEastPathN && !hasWestPathN) {
                                console.log('()_+ RIGHT (path to East)')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else if(hasWestPathN && !hasEastPathN) {
                                console.log('()_+ LEFT (path to West)')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else {
                                // Both or neither have paths - use iniDir fallback
                                if(newDir) {
                                    console.log(newDir,"NEWDIR RRRR (fallback)")
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    console.log(newDir,"NEWDIR LLLL (fallback)")
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'S':
                            // Use actualMapPos for Y coordinate when moving N/S
                            // Check BOTH perpendicular directions: East (x+1) and West (x-1)
                            nextTileOfPerpAxis = dg_map[actualMapPos]?.[positionX+1]; // East
                            prevTileOfPerpAxis = dg_map[actualMapPos]?.[positionX-1]; // West
                            console.log('case 2 S: East=', nextTileOfPerpAxis, 'West=', prevTileOfPerpAxis, 'actualMapPos:', actualMapPos)
                            // When facing South: East is to your LEFT, West is to your RIGHT
                            const hasEastPathS = nextTileOfPerpAxis !== undefined && nextTileOfPerpAxis !== 0;
                            const hasWestPathS = prevTileOfPerpAxis !== undefined && prevTileOfPerpAxis !== 0;
                            if(hasEastPathS && !hasWestPathS) {
                                console.log('()_+ LEFT (path to East)')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else if(hasWestPathS && !hasEastPathS) {
                                console.log('()_+ RIGHT (path to West)')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else {
                                // Both or neither have paths - use iniDir fallback
                                console.log(newDir,"NEWDIR (fallback)")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'W':
                            // Use actualMapPos for X coordinate when moving E/W
                            // Check BOTH perpendicular directions: South (y+1) and North (y-1)
                            nextTileOfPerpAxis = verticalTileArr[actualMapPos]?.[positionY+1]; // South
                            prevTileOfPerpAxis = verticalTileArr[actualMapPos]?.[positionY-1]; // North
                            console.log('case 2 W: South=', nextTileOfPerpAxis, 'North=', prevTileOfPerpAxis, 'actualMapPos:', actualMapPos)
                            // When facing West: South is to your LEFT, North is to your RIGHT
                            const hasSouthPathW = nextTileOfPerpAxis !== undefined && nextTileOfPerpAxis !== 0;
                            const hasNorthPathW = prevTileOfPerpAxis !== undefined && prevTileOfPerpAxis !== 0;
                            if(hasSouthPathW && !hasNorthPathW) {
                                console.log('()_+ LEFT (path to South)')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else if(hasNorthPathW && !hasSouthPathW) {
                                console.log('()_+ RIGHT (path to North)')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else {
                                // Both or neither have paths - use iniDir fallback
                                console.log(newDir,"NEWDIR (fallback)")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        case 'E':
                            // Use actualMapPos for X coordinate when moving E/W
                            // Check BOTH perpendicular directions: South (y+1) and North (y-1)
                            nextTileOfPerpAxis = verticalTileArr[actualMapPos]?.[positionY+1]; // South
                            prevTileOfPerpAxis = verticalTileArr[actualMapPos]?.[positionY-1]; // North
                            console.log('case 2 E: South=', nextTileOfPerpAxis, 'North=', prevTileOfPerpAxis, 'actualMapPos:', actualMapPos)
                            // When facing East: South is to your RIGHT, North is to your LEFT
                            const hasSouthPathE = nextTileOfPerpAxis !== undefined && nextTileOfPerpAxis !== 0;
                            const hasNorthPathE = prevTileOfPerpAxis !== undefined && prevTileOfPerpAxis !== 0;
                            if(hasSouthPathE && !hasNorthPathE) {
                                console.log('()_+ RIGHT (path to South)')
                                tempArr.push(turnTileRight)
                                tempArrTiles.push(turnTileRight)
                            } else if(hasNorthPathE && !hasSouthPathE) {
                                console.log('()_+ LEFT (path to North)')
                                tempArr.push(turnTileLeft)
                                tempArrTiles.push(turnTileLeft)
                            } else {
                                // Both or neither have paths - use iniDir fallback
                                console.log(newDir,"NEWDIR (fallback)")
                                if(newDir) {
                                    tempArr.push(turnTileRight)
                                    tempArrTiles.push(turnTileRight)
                                } else {
                                    tempArr.push(turnTileLeft)
                                    tempArrTiles.push(turnTileLeft)
                                }
                            }
                        break;
                        default:

                    }
                case 3:
                    console.log(verticalTileArr[positionX], dg_map[positionY][positionX], positionX, positionY,'()_+ case 3')
                    switch(currentDirLocal) {
                        case 'N':
                            // Use actualMapPos for correct perpendicular tile lookup
                            // Check BOTH perpendicular directions: East (x+1) and West (x-1)
                            const nextTileOfPerpAxisHorz = dg_map[actualMapPos]?.[positionX+1]; // East
                            const prevTileOfPerpAxisHorz = dg_map[actualMapPos]?.[positionX-1]; // West
                            const nextTileOfPerpAxisVert = verticalTileArr[positionX]?.[actualMapPos+1];
                            const prevTileOfPerpAxisVert = verticalTileArr[positionX]?.[actualMapPos-1];
                            console.log('case 3 N: East=', nextTileOfPerpAxisHorz, 'West=', prevTileOfPerpAxisHorz, 'actualMapPos:', actualMapPos)
                            if(mapArr[i] !== 2) {
                                if(verticalTileArr[positionX][positionY-1] === 0 ||
                                verticalTileArr[positionX][positionY-1] === undefined) {
                                    tempArr.push(facingWallTile)
                                    tempArrTiles.push(facingWallTile)
                                } else {
                                    // When facing North: East is to your RIGHT, West is to your LEFT
                                    const hasEastPath3N = nextTileOfPerpAxisHorz !== undefined && nextTileOfPerpAxisHorz !== 0;
                                    const hasWestPath3N = prevTileOfPerpAxisHorz !== undefined && prevTileOfPerpAxisHorz !== 0;
                                    if(hasEastPath3N && hasWestPath3N) {
                                        // Both sides have paths - show 3-way
                                        console.log('()_+ 3-WAY (both paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    } else if(hasEastPath3N && !hasWestPath3N) {
                                        // Only East (right) has path
                                        console.log('()_+ RIGHT (path to East only)')
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else if(hasWestPath3N && !hasEastPath3N) {
                                        // Only West (left) has path
                                        console.log('()_+ LEFT (path to West only)')
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    } else {
                                        // Neither has path - use 3-way as fallback
                                        console.log('()_+ 3-WAY (fallback, no perp paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    }
                                }
                            }
                        break;
                        case 'S':
                            // Use actualMapPos for correct perpendicular tile lookup
                            // Check BOTH perpendicular directions: East (x+1) and West (x-1)
                            const nextTileOfPerpAxis3S = dg_map[actualMapPos]?.[positionX+1]; // East
                            const prevTileOfPerpAxis3S = dg_map[actualMapPos]?.[positionX-1]; // West
                            console.log('case 3 S: East=', nextTileOfPerpAxis3S, 'West=', prevTileOfPerpAxis3S, 'actualMapPos:', actualMapPos)
                            if(mapArr[i] !== 2) {
                                if(verticalTileArr[positionX][positionY+1] === 0 ||
                                verticalTileArr[positionX][positionY+1] === undefined) {
                                    tempArr.push(facingWallTile)
                                    tempArrTiles.push(facingWallTile)
                                } else {
                                    // When facing South: East is to your LEFT, West is to your RIGHT
                                    const hasEastPath3S = nextTileOfPerpAxis3S !== undefined && nextTileOfPerpAxis3S !== 0;
                                    const hasWestPath3S = prevTileOfPerpAxis3S !== undefined && prevTileOfPerpAxis3S !== 0;
                                    if(hasEastPath3S && hasWestPath3S) {
                                        // Both sides have paths - show 3-way
                                        console.log('()_+ 3-WAY (both paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    } else if(hasEastPath3S && !hasWestPath3S) {
                                        // Only East (left when facing South) has path
                                        console.log('()_+ LEFT (path to East only)')
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    } else if(hasWestPath3S && !hasEastPath3S) {
                                        // Only West (right when facing South) has path
                                        console.log('()_+ RIGHT (path to West only)')
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else {
                                        // Neither has path - use 3-way as fallback
                                        console.log('()_+ 3-WAY (fallback, no perp paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    }
                                }
                            }
                        break;
                        case 'W':
                            // Use actualMapPos for correct perpendicular tile lookup
                            // Check BOTH perpendicular directions: South (y+1) and North (y-1)
                            const nextTileOfPerpAxisHorz1 = dg_map[positionY]?.[actualMapPos+1];
                            const prevTileOfPerpAxisHorz1 = dg_map[positionY]?.[actualMapPos-1];
                            const nextTileOfPerpAxisVert1 = verticalTileArr[actualMapPos]?.[positionY+1]; // South
                            const prevTileOfPerpAxisVert1 = verticalTileArr[actualMapPos]?.[positionY-1]; // North
                            console.log('case 3 W: South=', nextTileOfPerpAxisVert1, 'North=', prevTileOfPerpAxisVert1, 'actualMapPos:', actualMapPos)
                            if(mapArr[i] !== 2) {
                                if(dg_map[positionY][positionX-1] === 0 || dg_map[positionY][positionX-1] === undefined) {
                                    tempArr.push(facingWallTile)
                                    tempArrTiles.push(facingWallTile)
                                } else {
                                    // When facing West: South is to your LEFT, North is to your RIGHT
                                    const hasSouthPath3W = nextTileOfPerpAxisVert1 !== undefined && nextTileOfPerpAxisVert1 !== 0;
                                    const hasNorthPath3W = prevTileOfPerpAxisVert1 !== undefined && prevTileOfPerpAxisVert1 !== 0;
                                    if(hasSouthPath3W && hasNorthPath3W) {
                                        // Both sides have paths - show 3-way
                                        console.log('()_+ 3-WAY (both paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    } else if(hasSouthPath3W && !hasNorthPath3W) {
                                        // Only South (left when facing West) has path
                                        console.log('()_+ LEFT (path to South only)')
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    } else if(hasNorthPath3W && !hasSouthPath3W) {
                                        // Only North (right when facing West) has path
                                        console.log('()_+ RIGHT (path to North only)')
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else {
                                        // Neither has path - use 3-way as fallback
                                        console.log('()_+ 3-WAY (fallback, no perp paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    }
                                }
                           }
                        break;
                        case 'E':
                            // Use actualMapPos for correct perpendicular tile lookup
                            // Check BOTH perpendicular directions: South (y+1) and North (y-1)
                            const nextTileOfPerpAxis3E = verticalTileArr[actualMapPos]?.[positionY+1]; // South
                            const prevTileOfPerpAxis3E = verticalTileArr[actualMapPos]?.[positionY-1]; // North
                            console.log('case 3 E: South=', nextTileOfPerpAxis3E, 'North=', prevTileOfPerpAxis3E, 'actualMapPos:', actualMapPos)
                            if(mapArr[i] !== 2) {
                                if(dg_map[positionY][positionX+1] === 0 || dg_map[positionY][positionX+1] === undefined) {
                                    tempArr.push(facingWallTile)
                                    tempArrTiles.push(facingWallTile)
                                } else {
                                    // When facing East: South is to your RIGHT, North is to your LEFT
                                    const hasSouthPath3E = nextTileOfPerpAxis3E !== undefined && nextTileOfPerpAxis3E !== 0;
                                    const hasNorthPath3E = prevTileOfPerpAxis3E !== undefined && prevTileOfPerpAxis3E !== 0;
                                    if(hasSouthPath3E && hasNorthPath3E) {
                                        // Both sides have paths - show 3-way
                                        console.log('()_+ 3-WAY (both paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
                                    } else if(hasSouthPath3E && !hasNorthPath3E) {
                                        // Only South (right when facing East) has path
                                        console.log('()_+ RIGHT (path to South only)')
                                        tempArr.push(turnTileRight)
                                        tempArrTiles.push(turnTileRight)
                                    } else if(hasNorthPath3E && !hasSouthPath3E) {
                                        // Only North (left when facing East) has path
                                        console.log('()_+ LEFT (path to North only)')
                                        tempArr.push(turnTileLeft)
                                        tempArrTiles.push(turnTileLeft)
                                    } else {
                                        // Neither has path - use 3-way as fallback
                                        console.log('()_+ 3-WAY (fallback, no perp paths)')
                                        tempArr.push(turnThreeWay)
                                        tempArrTiles.push(turnThreeWay)
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
            console.log('()_+ IIIII tempArr',tempArr)
        }

        setVertRes(tempArr)
        setPathTileArray(tempArr.filter(val => val != ''))
        console.log('wallcheck 2', pathTileArr, tempArr)
        console.log(tempArr, tempArr.filter(val => val != ''), tempArrTiles.length, "TEMP!@")
        console.log(tempArr.length, tempArrTiles.length,"TEMP ARR")
        console.log(verticalResources,"TEMP ARR 3");
    }
    
    // Sync verticalTileArr with Redux when map changes
    useEffect(() => {
        if (reduxVerticalTiles.length > 0) {
            console.log('[Room] Using Redux vertical tiles for map:', currentMapId);
            setVerticalTileArr(reduxVerticalTiles);
        } else {
            // Fallback: construct from dg_map
            tileArrConstr(dg_map);
        }
    }, [currentMapId, reduxVerticalTiles])

    const tileArrConstr = (map:Array<number[]>) => {
        if (!map || map.length === 0) return;
        const width = map[0]?.length || mapWidth;
        const newVerticalArr:Array<Array<number>> = Array.from({ length: width }, () => []);
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
        console.log( 'vertial', verticalTileArr[positionX], 'horizontal: ', dg_map[positionY])
        
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
        if (enemiesVal.length > 0 && enemiesVal[currentEnemy]) {
            console.log("ENEMIES #### ROOM REFRESH", enemies, new Date().toLocaleTimeString(), enemiesVal[currentEnemy].health)
        }
    },[Object.values(enemies).length, enemies, dispatch, pathTileArr])

    Object.values(enemies).map((val, index) => {
        console.log('ENEMIES OBJECT VALUES', val, index);
    });

    const startCombatAux = (index:number, armPlayer: boolean = false) => {
        console.log("=== COMBAT START ATTEMPT ===");
        console.log("Enemy index:", index);
        console.log("inCombat:", inCombat);
        console.log("enemies:", enemies);
        console.log("enemiesVal:", enemiesVal);
        if(!inCombat) {
            console.log("Starting combat with enemy index:", index);
            dispatch(setCurrentEnemy(index));
            startCombat(index);
            if (armPlayer) {
                engagePlayerAttack(index);
            }
        } else {
            console.log("Combat active: arming player attack on target:", index);
            engagePlayerAttack(index);
        }
    }

    const findAutoMeleeAggressor = (): number => {
        const facingDirection = currentDir as FacingDirection;
        const laneEnemies = Object.values(enemies) as any[];
        let selectedIndex = -1;
        let closestDistance = Number.POSITIVE_INFINITY;

        laneEnemies.forEach((enemy, index) => {
            if (!enemy || enemy.health <= 0) return;
            if ((enemy.disposition || 'hostile') !== 'hostile') return;
            if (enemy.visibilityMode === 'ambush') return;
            if ((enemy.attackStyle || 'melee') !== 'melee') return;

            const distance = getEnemyDistanceInFacingDirection(
                positionX,
                positionY,
                facingDirection,
                enemy.positionX ?? 0,
                enemy.positionY ?? 0
            );

            if (distance === null) return;
            const enemyAttackRange = Math.max(1, enemy.attackRange ?? 1);
            if (distance > enemyAttackRange) return;

            if (distance < closestDistance) {
                closestDistance = distance;
                selectedIndex = index;
            }
        });

        return selectedIndex;
    };

    useEffect(() => {
        if (inCombat) return;

        const enemyOnCurrentTile = enemiesVal.findIndex((enemy) =>
            enemy &&
            enemy.health > 0 &&
            (enemy.disposition || 'hostile') === 'hostile' &&
            enemy.positionX === positionX &&
            enemy.positionY === positionY
        );

        if (enemyOnCurrentTile >= 0) {
            startCombatAux(enemyOnCurrentTile);
        }
    }, [positionX, positionY, enemies, inCombat]);

    useEffect(() => {
        if (inCombat || playerHealth <= 0) return;

        const aggressor = findAutoMeleeAggressor();
        if (aggressor >= 0) {
            startCombatAux(aggressor);
        }
    }, [positionX, positionY, currentDir, enemies, inCombat, playerHealth]);

    useEffect(() => {
        const currentTile = { x: positionX, y: positionY, mapId: currentMapId };
        const previousTile = lastPlayerTileRef.current;

        if (!previousTile) {
            lastPlayerTileRef.current = currentTile;
            return;
        }

        if (previousTile.mapId !== currentTile.mapId) {
            lastPlayerTileRef.current = currentTile;
            return;
        }

        if (previousTile.x === currentTile.x && previousTile.y === currentTile.y) {
            return;
        }

        lastPlayerTileRef.current = currentTile;
        dispatch(regenResourcesOnTile());
    }, [positionX, positionY, currentMapId, dispatch]);

    useEffect(() => {
        if (inCombat || playerHealth <= 0) return;

        const tryRangedAttacks = () => {
            const now = Date.now();
            const facingDirection = currentDir as FacingDirection;
            const laneEnemies = Object.values(enemies) as any[];

            laneEnemies.forEach((enemy, index) => {
                if (!enemy || enemy.health <= 0) return;
                if ((enemy.disposition || 'hostile') !== 'hostile') return;
                if (enemy.attackStyle !== 'ranged') return;

                const distance = getEnemyDistanceInFacingDirection(
                    positionX,
                    positionY,
                    facingDirection,
                    enemy.positionX ?? 0,
                    enemy.positionY ?? 0
                );

                if (distance === null) return;
                if (isEnemyOccludedByCloserEnemy(index, laneEnemies, positionX, positionY, facingDirection)) return;

                const attackRange = enemy.attackRange ?? 4;
                if (distance > attackRange) return;

                const cooldownMs = Math.max(500, Math.floor(1000 / Math.max(enemy.atkSpeed || 1, 0.25)));
                const lastShotAt = rangedShotCooldownRef.current[index] || 0;
                if (now - lastShotAt < cooldownMs) return;

                rangedShotCooldownRef.current[index] = now;

                const randomAddDmg = Math.floor(Math.random() * 2);
                const critRoll = Math.random();
                const critChance = enemy.stats?.crit || 0.06;
                const isCrit = critRoll <= critChance;
                let dmg = (enemy.damage || 1) + randomAddDmg;
                if (isCrit) dmg *= 2;

                dispatch(registerEnemyAttack(index));
                if (Math.random() <= playerDodgeChance) {
                    dispatch(dmg2Player({ dmg: 0, crit: false, enemy: `${enemy.info?.name || 'Ranged enemy'} (ranged)` }));
                    return;
                }
                dispatch(dmg2Player({ dmg, crit: isCrit, enemy: `${enemy.info?.name || 'Ranged enemy'} (ranged)` }));
            });
        };

        tryRangedAttacks();
        const interval = setInterval(tryRangedAttacks, 300);
        return () => clearInterval(interval);
    }, [positionX, positionY, currentDir, enemies, inCombat, playerHealth, playerDodgeChance]);
    
    const forward = () => {
        // DEBUG: Start tracking forward movement
        const currentTileType = (currentDir === 'N' || currentDir === 'S')
            ? verticalTileArr[positionX]?.[positionY] ?? -1
            : dg_map[positionY]?.[positionX] ?? -1;

        debugMove.start('forward', {
            posX: positionX,
            posY: positionY,
            direction: currentDir as Direction,
            currentArrPos,
            iniDir,
            lastTurnDir,
            tileType: currentTileType,
        });

        // WALL COLLISION CHECK - Don't move if blocked
        const blocked = isBlocked(
            { x: positionX, y: positionY },
            currentDir as Direction,
            dg_map as any,
            mapWidth,
            mapHeight
        );

        if (blocked) {
            debugMove.note('BLOCKED by wall - movement cancelled');
            debugMove.end({
                posX: positionX,
                posY: positionY,
                direction: currentDir as Direction,
                currentArrPos,
                iniDir,
                success: false,
            });
            console.log('Wall collision! Cannot move forward.');
            return; // Exit without moving
        }

        let tempPosY = positionY;
        let tempPosX = positionX;
        let tempArrPos = currentArrPos;
        console.log(currentArrPos,"POS 123")
        console.log("turndir inidir currentdir", iniDir, currentDir, mapArray, lastTurnDir, tempArrPos)

        switch(currentDir) {
            case 'N':
                tempPosY = positionY - 1;
                tempArrPos++;
                debugMove.note(`Moving N: Y ${positionY} -> ${tempPosY}`);
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('N', tempArrPos);
            break;
            case 'S':
                tempPosY = positionY + 1;
                tempArrPos++;
                debugMove.note(`Moving S: Y ${positionY} -> ${tempPosY}`);
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('S', tempArrPos);
            break;
            case 'E':
                tempPosX = positionX + 1;
                tempArrPos++;
                debugMove.note(`Moving E: X ${positionX} -> ${tempPosX}`);
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('E', tempArrPos);
            break;
            default:
                tempPosX = positionX - 1;
                tempArrPos++;
                debugMove.note(`Moving W: X ${positionX} -> ${tempPosX}`);
                dispatch(setCurrentArrPos(tempArrPos))
                generateMapResources('W', tempArrPos);
        }

        dispatch(setCurrentPos([tempPosX,tempPosY]))
        dispatch(setLastTurnDir(''));
        console.log(backtrack,pathTileArr, currentDir, tempArrPos, "+_+ backtrack")

        // DEBUG: End tracking forward movement
        debugMove.end({
            posX: tempPosX,
            posY: tempPosY,
            direction: currentDir as Direction,
            currentArrPos: tempArrPos,
            iniDir,
            success: true,
        });
    }

    const reverse = () => {
        // DEBUG: Start tracking reverse movement
        const currentTileType = (currentDir === 'N' || currentDir === 'S')
            ? verticalTileArr[positionX]?.[positionY] ?? -1
            : dg_map[positionY]?.[positionX] ?? -1;

        debugMove.start('reverse', {
            posX: positionX,
            posY: positionY,
            direction: currentDir as Direction,
            currentArrPos,
            iniDir,
            lastTurnDir,
            tileType: currentTileType,
        });

        console.log('turndir 1 reverse', mapArray?.length, currentArrPos)
    //   facingWallTile  // setBacktrack(positionTemp);
        let newPosition
        let newDir: boolean;
        let newDirection: Direction = currentDir as Direction;

        switch(currentDir){
            case 'N':
                newPosition = mapArray?.length - currentArrPos;
                newDirection = 'S';
                debugMove.note(`Reverse N->S, arrPos: ${currentArrPos} -> ${newPosition - 1}`);
                dispatch(changeDir('S'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('S', newPosition-1, !iniDir, true);
            break;

            case 'S':
                newPosition = mapArray?.length - currentArrPos;
                newDirection = 'N';
                debugMove.note(`Reverse S->N, arrPos: ${currentArrPos} -> ${newPosition - 1}`);
                dispatch(changeDir('N'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('N', newPosition - 1, !iniDir, true);
            break;

            case 'W':
                newPosition = mapArray?.length - currentArrPos;
                newDirection = 'E';
                debugMove.note(`Reverse W->E, arrPos: ${currentArrPos} -> ${newPosition - 1}`);
                dispatch(changeDir('E'));
                dispatch(setCurrentArrPos(newPosition - 1))
                dispatch(invertInitialDirection())
                generateMapResources('E', newPosition - 1, !iniDir, true);
            break;

            case 'E':
                newPosition = mapArray?.length - currentArrPos;
                newDirection = 'W';
                debugMove.note(`Reverse E->W, arrPos: ${currentArrPos} -> ${newPosition - 1}`);
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

        // DEBUG: End tracking reverse movement
        debugMove.end({
            posX: positionX,
            posY: positionY,
            direction: newDirection,
            currentArrPos: (newPosition ?? currentArrPos) - 1,
            iniDir: !iniDir,
            success: true,
        });
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

// FIXED: Simplified turn handler using coordinate-based position calculation
// This avoids desync issues from stale mapArray state during rapid turns

const handleTurnFixed = (currentDir: string, turnDirection: 'L' | 'R', is3turn?: boolean) => {
  // Determine new direction using turn matrix
  const TURN_LOOKUP: Record<string, Record<string, string>> = {
    'N': { 'L': 'W', 'R': 'E' },
    'S': { 'L': 'E', 'R': 'W' },
    'E': { 'L': 'N', 'R': 'S' },
    'W': { 'L': 'S', 'R': 'N' },
  };

  const newDirection = TURN_LOOKUP[currentDir]?.[turnDirection];
  if (!newDirection) {
    console.log("Invalid direction for turn");
    return;
  }

  debugMove.note(`handleTurnFixed: ${currentDir} + ${turnDirection} -> ${newDirection}, is3way=${is3turn}`);

  // Calculate correct array position from actual player coordinates
  // This is the KEY FIX - we calculate from coords, not from stale state
  const posInfo = calculateArrPosFromCoords(
    positionX,
    positionY,
    newDirection,
    dg_map as number[][],
    verticalTileArr
  );

  console.log('FIXED TURN:', {
    from: currentDir,
    to: newDirection,
    turnDir: turnDirection,
    playerPos: { x: positionX, y: positionY },
    calculatedArrPos: posInfo.arrPos,
    pathLength: posInfo.pathLength,
    is3turn
  });

  // Determine iniDir based on turn direction and current position
  // When turning right from N->E or S->W, or left from N->W or S->E
  // The visual orientation depends on which side of the path we're on
  let newIniDir: boolean;

  if (newDirection === 'E' || newDirection === 'W') {
    // Horizontal path - iniDir based on whether we're closer to start or end
    const pathMidpoint = Math.floor(posInfo.pathLength / 2);
    if (turnDirection === 'R') {
      newIniDir = posInfo.arrPos <= pathMidpoint;
    } else {
      newIniDir = posInfo.arrPos > pathMidpoint;
    }
  } else {
    // Vertical path (N or S)
    const pathMidpoint = Math.floor(posInfo.pathLength / 2);
    if (turnDirection === 'R') {
      newIniDir = posInfo.arrPos <= pathMidpoint;
    } else {
      newIniDir = posInfo.arrPos > pathMidpoint;
    }
  }

  // Apply the state updates
  dispatch(changeDir(newDirection));
  dispatch(setCurrentArrPos(posInfo.arrPos));
  dispatch(setInitialDirection(newIniDir));

  // Generate resources with calculated position
  generateMapResources(newDirection, posInfo.arrPos, newIniDir);
};

// Legacy handleTurn - kept for reference but calls handleTurnFixed
const handleTurn = (currentDir, lastTurnDir, turnDirection, is3turn, isWallTurn) => {
  // DEBUG: Log handleTurn parameters
  debugMove.note(`handleTurn (legacy): dir=${currentDir}, lastTurn=${lastTurnDir}, turn=${turnDirection}, is3way=${is3turn}, isWall=${isWallTurn}`);

  // Use the fixed implementation
  handleTurnFixed(currentDir, turnDirection as 'L' | 'R', is3turn);
  return;

  // OLD CODE BELOW - kept for reference but not executed
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

  // Calculate new position
  newPosition = mapArray?.length - currentArrPos;
  const newPositionX = (mapArray?.length - 1) - positionX;
  
  console.log(lastTurnDir, turnDirection, currentArrPos, positionX, mapArray,'turn direction x0', newPosition) 
  if (is3turn) {
    console.log('is3 turn', currentDir);
    switch (currentDir) {
        case 'N':
            if (currentArrPos !== 0) {
                console.log('test 3turn 1 ')
              // Handle cases where currentArrPos is not 0
              if (localLastTurnDir !== turnDirection) {
                console.log('Turn direction changed for N with currentArrPos !== 0');
                if (turnDirection === 'R') {
                  console.log('R maybe? N');
                  generateMapResources(newDirection, positionX, true);
                  dispatch(setInitialDirection(true));
                  dispatch(setCurrentArrPos(positionX));
                } else if (turnDirection === 'L') {
                  console.log('turn3 inverse dir');
                  generateMapResources(newDirection, newPositionX, false);
                  dispatch(setInitialDirection(false));
                  dispatch(setCurrentArrPos(newPositionX));
                }
              } else {
                console.log('test 3turn 2 ')
                // Original logic for when turn direction remains the same
                if (turnDirection === 'R') {
                  console.log('R maybe? N');
                  generateMapResources(newDirection, positionX, true);
                  dispatch(setInitialDirection(true));
                  dispatch(setCurrentArrPos(positionX));
                } else if (turnDirection === 'L') {
                  console.log('turn3 inverse dir', mapArray.length, 'new position 3: ',newPositionX);
                  generateMapResources(newDirection, newPositionX, false);
                  dispatch(setInitialDirection(false));
                  dispatch(setCurrentArrPos(newPositionX));
                }
              }
            } else {
              // Handle cases where currentArrPos is 0
              if (iniDir) {
                console.log('test 3turn 3 ')
                if (localLastTurnDir !== turnDirection) {
                    if(turnDirection === 'R') {
                        console.log('maybe here ?! N 1 R', iniDir, turnDirection);
                        generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
                        dispatch(setCurrentArrPos(positionX));
                        dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                    } else {
                        console.log('maybe here ?! N 1 L', iniDir, turnDirection);
                        generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? !iniDir : iniDir);
                        dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                        dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                    }
                } else {
                  if (turnDirection === 'R') {
                    console.log('north 3way inidir true right');
                    dispatch(changeDir(newDirection));
                    generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
                    dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                    dispatch(setCurrentArrPos(positionX));
                  } else {
                    console.log('north 3way inidir true left');
                    dispatch(changeDir(newDirection));
                    generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? !iniDir : iniDir);
                    dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                    dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                  }
                }
              } else {
                console.log('test 3turn 4 ')
                if (localLastTurnDir !== turnDirection) {
                  if (turnDirection === 'R') {
                    console.log('maybe here ?! N 2 R', iniDir);
                    generateMapResources(newDirection, positionX, false);
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(positionX));
                  } else {
                    console.log('maybe here ?! N 2 L', iniDir);
                    generateMapResources(newDirection, positionX, false);
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(positionX));
                  }
                } else {
                  console.log('north 3way inidir false');
                  dispatch(changeDir(newDirection));
                  generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? iniDir : !iniDir);
                  dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                  dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                }
              }
            }
            break;
            
          case 'S':
            if (currentArrPos !== 0) {
                console.log('test 3turn 5 ')
              // Handle cases where currentArrPos is not 0
              if (localLastTurnDir !== turnDirection) {
                console.log('Turn direction changed for S with currentArrPos !== 0');
                if (turnDirection === 'R') {
                  console.log('turn3 inverse dir');
                  generateMapResources(newDirection, (mapArray.length - 1) - positionX, true);
                  dispatch(setInitialDirection(true));
                  dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                } else if (turnDirection === 'L') {
                  console.log('R maybe? S');
                  generateMapResources(newDirection, positionX, false);
                  dispatch(setInitialDirection(false));
                  dispatch(setCurrentArrPos(positionX));

                }
              } else {
                console.log('test 3turn 6 ')
                // Original logic for whe1n turn direction remains the same
                if (turnDirection === 'R') {
                  console.log('turn3 inverse dir', mapArray.length);
                  generateMapResources(newDirection,(mapArray.length - 1) - positionX, true);
                  dispatch(setInitialDirection(true));
                  dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
               } else if (turnDirection === 'L') {
                  console.log('R maybe? S');
                  generateMapResources(newDirection, positionX, false);
                  dispatch(setInitialDirection(false));
                  dispatch(setCurrentArrPos(positionX));
                }
              }
            } else {
                console.log('test 3turn 7 ')
              // Handle cases where currentArrPos is 0
              if (iniDir) {
                if (localLastTurnDir !== turnDirection) {
                    if(turnDirection === 'R') {
                        console.log('maybe here ?! S 1 L', iniDir, turnDirection);
                        generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? !iniDir : iniDir);
                        dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                        dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                     } else {
                        console.log('maybe here ?! S 1 R', iniDir, turnDirection);
                        generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
                        dispatch(setCurrentArrPos(positionX));
                        dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                   }
                } else {
                  if (turnDirection === 'R') {
                    console.log('south 3way inidir true left');
                    dispatch(changeDir(newDirection));
                    generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? iniDir : !iniDir);
                    dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                    dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                   } else {
                    console.log('south 3way inidir true right');
                    dispatch(changeDir(newDirection));
                    generateMapResources(newDirection, positionX, isWallTurn ? !iniDir : iniDir);
                    dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                    dispatch(setCurrentArrPos(positionX));
                 }
                }
              } else {
                console.log('test 3turn 8 ')
                if (localLastTurnDir !== turnDirection) {
                  if (turnDirection === 'R') {
                    console.log('maybe here ?! S 2 R', iniDir);
                    generateMapResources(newDirection, (mapArray.length - 1) - positionX, false);
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
                  } else {
                    console.log('maybe here ?! S 2 L', iniDir);
                    generateMapResources(newDirection, positionX, false);
                    dispatch(setInitialDirection(false));
                    dispatch(setCurrentArrPos(positionX));
                  }
                } else {
                  console.log('south 3way inidir false');
                  dispatch(changeDir(newDirection));
                  generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
                  dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                  dispatch(setCurrentArrPos(positionX));
                }
              }
            }
            break;
      
      case 'W':
        if (currentArrPos !== 0) {
            console.log('test 3turn 9 ')
          // Handle cases where currentArrPos is not 0
          if (localLastTurnDir !== turnDirection) {
            console.log('Turn direction changed for W with currentArrPos !== 0');
            if (turnDirection === 'R') {
              console.log('R maybe?, W', mapArr, mapArray);
              generateMapResources(newDirection, (mapArray.length - 1)- positionY, true);
              dispatch(setInitialDirection(true));
              dispatch(setCurrentArrPos((mapArray?.length - 1)- positionY));
            } else if (turnDirection === 'L') {
              generateMapResources(newDirection, positionY, false);
              dispatch(setInitialDirection(false));
              dispatch(setCurrentArrPos(positionY));
            }
          } else {
            console.log('test 3turn 10 ')
            // Original logic for when turn direction remains the same
            if (turnDirection === 'R') {
              console.log('R maybe?, W', mapArr, mapArray);
              generateMapResources(newDirection, (mapArray.length - 1) - positionY, true);
              dispatch(setInitialDirection(true));
              dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
            } else if (turnDirection === 'L') {
              console.log('test 3turn 10.1 ')
              generateMapResources(newDirection, positionY, false);
              dispatch(setInitialDirection(false));
              dispatch(setCurrentArrPos(positionY));
            }
          }
        } else {
          // Handle cases where currentArrPos is 0
          if (iniDir) {
            console.log('test 3turn 11 ')
            if (localLastTurnDir !== turnDirection) {
                if(turnDirection === 'R') {
                    console.log('maybe here ?! W 1 R', iniDir, turnDirection);
                    generateMapResources(newDirection, (mapArray.length -1) - positionY, iniDir);
                    dispatch(setCurrentArrPos((mapArray.length -1) - positionY));
                    // dispatch(invertInitialDirection()) 
                    dispatch(setInitialDirection(iniDir));
                } else {
                    console.log('maybe here ?! W 1 L', iniDir, turnDirection);
                    generateMapResources(newDirection, positionY, isWallTurn ? !iniDir : iniDir);
                    dispatch(setCurrentArrPos(positionY));
                    // dispatch(invertInitialDirection()) 
                    dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                }
            } else {
              dispatch(changeDir(newDirection));
              if (turnDirection === 'R') {
                generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? iniDir : !iniDir);
                dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
                console.log('west 3way inidir true right');
              } else {
                generateMapResources(newDirection, positionY, isWallTurn ? !iniDir : iniDir);
                dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                dispatch(setCurrentArrPos(positionY));
                console.log('west 3way inidir true left');
              }
            }
          } else {
            console.log('test 3turn 12 ')
            if (localLastTurnDir !== turnDirection) {

              console.log('maybe here ?! W 2', iniDir);
              generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
              dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
              dispatch(setInitialDirection(false));

            } else {
              console.log('west 3way W inidir false');
              dispatch(changeDir(newDirection));
              generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
              dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
              dispatch(setCurrentArrPos(positionY));
            }
          }
        }
        break;
  
      case 'E':
        if (currentArrPos !== 0) {
            console.log('test 3turn 13 ')
          // Handle cases where currentArrPos is not 0
          if (localLastTurnDir !== turnDirection) {
            console.log('Turn direction changed for E with currentArrPos !== 0');
            if (turnDirection === 'R') {
              console.log('R maybe?, E', mapArr, mapArray);
              generateMapResources(newDirection, positionY, true);
              dispatch(setInitialDirection(true));
              dispatch(setCurrentArrPos(positionY));
            } else if (turnDirection === 'L') {
              console.log('turn3 inverse dir', currentArrPos, positionY);
              generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
              dispatch(setInitialDirection(false));
              dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
            }
          } else {
            // Original logic for when turn direction remains the same
            console.log('test 3turn 14 ')
            if (turnDirection === 'R') {
              console.log('R maybe?, E', mapArr, mapArray);
              generateMapResources(newDirection, positionY, true);
              dispatch(setInitialDirection(true));
              dispatch(setCurrentArrPos(positionY));
            } else if (turnDirection === 'L') {
              console.log('turn3 inverse dir', currentArrPos, positionY);
              generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
              dispatch(setInitialDirection(false));
              dispatch(setCurrentArrPos((mapArray.length - 1) - positionY,));
            }
          }
        } else {
          // Handle cases where currentArrPos is 0
          if (iniDir) {
            console.log('test 3turn 15 ', localLastTurnDir, turnDirection)
            if (localLastTurnDir !== turnDirection) {
                if(turnDirection === 'L') {
                    console.log('maybe here ?! W 1 R', iniDir, turnDirection);
                    generateMapResources(newDirection, (mapArray.length -1) - positionY, isWallTurn ? iniDir : !iniDir);
                    dispatch(setCurrentArrPos((mapArray.length -1) - positionY));
                    // dispatch(invertInitialDirection()) 
                    dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                } else {
                    console.log('maybe here ?! W 1 L', iniDir, turnDirection);
                    generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
                    dispatch(setCurrentArrPos(positionY));
                    // dispatch(invertInitialDirection()) 
                    dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                }
            } else {
              if (turnDirection === 'R') {
                console.log('east 3way inidir true right');
                dispatch(changeDir(newDirection));
                generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
                dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
                dispatch(setCurrentArrPos(positionY));

              } else {
                console.log('east 3way inidir true left');
                dispatch(changeDir(newDirection));
                generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? !iniDir : iniDir);
                dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
                dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));

              }
            }
          } else {
            if (localLastTurnDir !== turnDirection) {
              console.log('maybe here ?! E 2', iniDir, positionY);
              generateMapResources(newDirection, positionY, false);
              dispatch(setInitialDirection(false));
              dispatch(setCurrentArrPos(positionY));
            } else {
              console.log('east 3way inidir false');
              dispatch(changeDir(newDirection));
              generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? iniDir : !iniDir);
              dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
              dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
            }
          }
        }
        break;
    }
  } else {
  // Update state with new direction and position
  if(lastTurnDir !== turnDirection) {
    if(currentDir === 'N' || currentDir === 'S') {
        if(positionX !== 1) {
            dispatch(changeDir(newDirection));
            dispatch(setCurrentArrPos(newPosition - 1));
            generateMapResources(newDirection, newPosition - 1);
            console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 0 x 01',newPosition) 
        } else {
            if(iniDir) {
                dispatch(changeDir(newDirection));
                dispatch(setCurrentArrPos(newPosition - 1));
                generateMapResources(newDirection, newPosition - 1);
                console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 0 x 02 ') 
            } else {
                if(positionX === 1) {
                    dispatch(changeDir(newDirection));
                    dispatch(setCurrentArrPos(newPosition - 1));
                    generateMapResources(newDirection, newPosition - 1);
                } else {
                    generateMapResources(newDirection, currentArrPos);
                    console.log(lastTurnDir, turnDirection, 'turn direction change arr pos 1 x ') 
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
                    console.log(lastTurnDir, turnDirection, currentArrPos, 'turn direction change arr pos 2 y') 
                }
            }
        }
    }
    } else {
        generateMapResources(newDirection, currentArrPos);
        console.log(lastTurnDir, turnDirection, currentArrPos,'turn direction change arr pos 3') 
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

    // Feature flag for using fixed turn logic
    const [useFixedTurn, setUseFixedTurn] = useState(true);

/**
 * FIXED: Simplified turn function that uses coordinate-based position calculation
 * This avoids desync issues from stale state during rapid turns
 */
const turnFixed = (turnDir: 'L' | 'R') => {
    // DEBUG: Start tracking turn movement
    const currentTileType = (currentDir === 'N' || currentDir === 'S')
        ? verticalTileArr[positionX]?.[positionY] ?? -1
        : dg_map[positionY]?.[positionX] ?? -1;

    const moveType = turnDir === 'L' ? 'turn_L' : 'turn_R';
    debugMove.start(moveType, {
        posX: positionX,
        posY: positionY,
        direction: currentDir as Direction,
        currentArrPos,
        iniDir,
        lastTurnDir,
        tileType: currentTileType,
    });

    // Determine new direction using turn matrix
    const TURN_LOOKUP: Record<string, Record<string, string>> = {
        'N': { 'L': 'W', 'R': 'E' },
        'S': { 'L': 'E', 'R': 'W' },
        'E': { 'L': 'N', 'R': 'S' },
        'W': { 'L': 'S', 'R': 'N' },
    };

    const newDirection = TURN_LOOKUP[currentDir]?.[turnDir];
    if (!newDirection) {
        console.log("Invalid direction for turn");
        debugMove.end({
            posX: positionX,
            posY: positionY,
            direction: currentDir as Direction,
            currentArrPos,
            iniDir,
            success: false,
        });
        return;
    }

    debugMove.note(`turnFixed: ${currentDir} + ${turnDir} -> ${newDirection}`);

    // Calculate correct array position from actual player coordinates
    const posInfo = calculateArrPosFromCoords(
        positionX,
        positionY,
        newDirection,
        dg_map as number[][],
        verticalTileArr
    );

    console.log('TURN FIXED:', {
        from: currentDir,
        to: newDirection,
        turnDir,
        playerPos: { x: positionX, y: positionY },
        calculatedArrPos: posInfo.arrPos,
        pathLength: posInfo.pathLength,
        tileType: currentTileType
    });

    // Determine iniDir based on entry direction and position in path
    // This determines which way turn tiles appear (left vs right visual)
    let newIniDir: boolean;

    // Check if there's a path to the left and right in the new direction
    const leftDir = TURN_LOOKUP[newDirection]?.['L'];
    const rightDir = TURN_LOOKUP[newDirection]?.['R'];

    let leftHasPath = false;
    let rightHasPath = false;

    // Check perpendicular paths
    if (leftDir) {
        const leftPos = leftDir === 'N' ? { x: positionX, y: positionY - 1 } :
                       leftDir === 'S' ? { x: positionX, y: positionY + 1 } :
                       leftDir === 'E' ? { x: positionX + 1, y: positionY } :
                       { x: positionX - 1, y: positionY };
        const leftTile = dg_map[leftPos.y]?.[leftPos.x];
        leftHasPath = leftTile !== undefined && leftTile !== 0;
    }
    if (rightDir) {
        const rightPos = rightDir === 'N' ? { x: positionX, y: positionY - 1 } :
                        rightDir === 'S' ? { x: positionX, y: positionY + 1 } :
                        rightDir === 'E' ? { x: positionX + 1, y: positionY } :
                        { x: positionX - 1, y: positionY };
        const rightTile = dg_map[rightPos.y]?.[rightPos.x];
        rightHasPath = rightTile !== undefined && rightTile !== 0;
    }

    // Set iniDir based on turn direction - this affects which turn tile visual is shown
    if (turnDir === 'R') {
        newIniDir = true;
    } else {
        newIniDir = false;
    }

    // Apply the state updates
    dispatch(changeDir(newDirection));
    dispatch(setCurrentArrPos(posInfo.arrPos));
    dispatch(setInitialDirection(newIniDir));
    dispatch(setLastTurnDir(turnDir));
    setLocalLastTurnDir(turnDir);

    // Generate resources with calculated position
    generateMapResources(newDirection, posInfo.arrPos, newIniDir);

    // DEBUG: End tracking
    debugMove.end({
        posX: positionX,
        posY: positionY,
        direction: newDirection as Direction,
        currentArrPos: posInfo.arrPos,
        iniDir: newIniDir,
        success: true,
    });
};

const turn = (turnDir:string) => {
    // Use fixed turn logic if enabled
    if (useFixedTurn) {
        turnFixed(turnDir as 'L' | 'R');
        return;
    }

    // Legacy code below (only runs if useFixedTurn is false)
    // DEBUG: Start tracking turn movement
    const currentTileType = (currentDir === 'N' || currentDir === 'S')
        ? verticalTileArr[positionX]?.[positionY] ?? -1
        : dg_map[positionY]?.[positionX] ?? -1;

    const moveType = turnDir === 'L' ? 'turn_L' : 'turn_R';
    debugMove.start(moveType, {
        posX: positionX,
        posY: positionY,
        direction: currentDir as Direction,
        currentArrPos,
        iniDir,
        lastTurnDir,
        tileType: currentTileType,
    });

    // Track what direction we'll end up facing
    const TURN_MATRIX: Record<string, Record<string, Direction>> = {
        'N': { 'L': 'W', 'R': 'E' },
        'S': { 'L': 'E', 'R': 'W' },
        'E': { 'L': 'N', 'R': 'S' },
        'W': { 'L': 'S', 'R': 'N' },
    };
    const expectedNewDir = TURN_MATRIX[currentDir]?.[turnDir] ?? currentDir;
    debugMove.note(`Turn ${turnDir} from ${currentDir}, expect -> ${expectedNewDir}, tile=${currentTileType}`);

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
                                handleTurn(currentDir, lastTurnDir, turnDir, false)
                                console.log('turn direction 0 N', lastTurnDir, turnDir)
                                console.log('CORNER TURN no e -3- ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER wst2')
                                } else {
                                    generateMapResources('E', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e real corner', currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }
                        }
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
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
                                console.log('CORNER TURN no e 3 L ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER wst2')
                                } else {
                                    generateMapResources('W', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e real corner', currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    console.log('should be here2')
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }

                        }
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0));
                        console.log('LOL if set current arr pos to zero', mapArray, pathTileArr, currentArrayPositionHorz, currentArrayPositionVert);
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
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }

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
                                console.log('CORNER TURN no e 3 not corner ',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER wst2')
                                } else {
                                    generateMapResources('E', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e real corner', currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }

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
                                console.log('CORNER TURN no e 3 not corner',currentArrayPositionHorz, currentArrPos, positionY)
                            } else {
                                if(currentArrayPositionHorz === 3) {
                                    handleTurn(currentDir, lastTurnDir, turnDir, true)
                                    console.log('NOT CORNER wst2')
                                } else {
                                    generateMapResources('N', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no e real corner', currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }
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
                                    console.log('CORNER TURN no e real corner ',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }

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
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    console.log('not sure')
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }

                        }
                    }
                    if((pathTileArr[0] === 1 || pathTileArr[0] === 2) && currentArrayPositionHorz !== 3) {
                        dispatch(setCurrentArrPos(0))
                            console.log('LOL7.4')
                    }                    
                } else {
                    handleTurn(currentDir, lastTurnDir, turnDir);
                    console.log('final else ')
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
                                    generateMapResources('N', 0); 
                                    dispatch(setCurrentArrPos(0))
                                    console.log('CORNER TURN no east2 ',currentArrayPositionHorz)
                                }
                            }
                        } else {
                            if(currentArrayPositionHorz === 3) {
                                    console.log('should be here')
                                    handleTurn(currentDir, lastTurnDir, turnDir, true, true)
                                } else {
                                    handleTurn(currentDir, lastTurnDir, turnDir);
                            }
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

    // DEBUG: End tracking turn movement
    // Note: We use expectedNewDir since the dispatch hasn't updated Redux yet in this render
    debugMove.end({
        posX: positionX,
        posY: positionY,
        direction: expectedNewDir as Direction,
        currentArrPos: currentArrPos, // This may be updated by handleTurn
        iniDir: iniDir, // This may be updated by handleTurn
        success: true,
    });
}

    useEffect(() => {
        console.log('LOL current position change', currentArrPos, pathTileArr[0], iniDir)
    },[currentArrPos])
    
    // Select movement functions based on toggle
    const activeForward = useNewMovement ? newMovement.forward : forward;
    const activeReverse = useNewMovement ? newMovement.reverse : reverse;
    const activeTurn = useNewMovement ? newMovement.turn : turn;
    const activePathTileArr = useNewMovement ? newMovement.pathTileArr : pathTileArr;
    const activeMapArray = useNewMovement ? newMovement.mapArray : mapArray;

    const isBlockedByEnemyAhead = () => {
        let nextX = positionX;
        let nextY = positionY;
        switch (currentDir) {
            case 'N': nextY -= 1; break;
            case 'S': nextY += 1; break;
            case 'E': nextX += 1; break;
            case 'W': nextX -= 1; break;
        }

        const enemiesOnNextTile = Object.values(enemies).filter((enemy) =>
            enemy &&
            enemy.health > 0 &&
            (enemy.disposition || 'hostile') === 'hostile' &&
            enemy.positionX === nextX &&
            enemy.positionY === nextY
        );

        if (enemiesOnNextTile.length === 0) {
            return false;
        }

        // Allow stepping into pure ambush stacks so they can trigger jump-in combat.
        const hasNonAmbushEnemy = enemiesOnNextTile.some((enemy) => enemy.visibilityMode !== 'ambush');
        return hasNonAmbushEnemy;
    };

    const consumeMovementFrame = () => {
        const now = Date.now();
        const frameCooldownMs = effectiveStamina <= 0 ? 1000 : 250;
        if (now - lastMoveFrameAtRef.current < frameCooldownMs) {
            return false;
        }
        lastMoveFrameAtRef.current = now;
        return true;
    };

    const guardedForward = () => {
        if (inCombat) {
            console.log('Cannot move away while in combat.');
            return;
        }

        const enemyOnCurrentTile = enemiesVal.findIndex((enemy) =>
            enemy &&
            enemy.health > 0 &&
            (enemy.disposition || 'hostile') === 'hostile' &&
            enemy.positionX === positionX &&
            enemy.positionY === positionY
        );

        if (enemyOnCurrentTile >= 0) {
            startCombatAux(enemyOnCurrentTile);
            return;
        }

        if (isBlockedByEnemyAhead()) {
            console.log('Enemy blocking path! Defeat it to proceed.');
            return;
        }

        if (!consumeMovementFrame()) {
            return;
        }

        activeForward();
    };

    const guardedReverse = () => {
        if (inCombat) {
            console.log('Cannot move away while in combat.');
            return;
        }

        if (!consumeMovementFrame()) {
            return;
        }

        activeReverse();
    };

    const guardedTurn = (dir: 'L' | 'R') => {
        if (inCombat) {
            console.log('Cannot move away while in combat.');
            return;
        }

        if (!consumeMovementFrame()) {
            return;
        }

        activeTurn(dir);
    };

    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
            guardedForward();
            break;
            case 's':
            case 'arrowdown':
            guardedReverse();
            break;
            case 'a':
            case 'arrowleft':
            guardedTurn('L');
            break;
            case 'd':
            case 'arrowright':
            guardedTurn('R');
            break;
            case 't': // Toggle movement system with 'T' key
            setUseNewMovement(prev => !prev);
            break;
            default:
            break;
        }
    }, [guardedForward, guardedReverse, guardedTurn]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [handleKeyPress]);

    const renderVisibleEnemies = () => {
        // Guard: Skip if no enemies loaded yet
        if (!enemiesVal || enemiesVal.length === 0) return null;
        const facingDirection = currentDir as FacingDirection;
        const laneEnemies = enemiesVal as any[];

        // Group enemies by position for stacking
        const enemiesByPosition: { [key: string]: { enemy: typeof enemiesVal[0], index: number }[] } = {};

        enemiesVal.forEach((val, index) => {
            if (!val || val.health <= 0) return;
            const key = `${val.positionX ?? 0},${val.positionY ?? 0}`;
            if (!enemiesByPosition[key]) {
                enemiesByPosition[key] = [];
            }
            enemiesByPosition[key].push({ enemy: val, index });
        });

        // Render grouped enemies
        return Object.entries(enemiesByPosition).map(([posKey, enemyGroup]) => {
            const firstEnemy = enemyGroup[0].enemy;
            const enemyX = firstEnemy.positionX ?? 0;
            const enemyY = firstEnemy.positionY ?? 0;

            const distance = getEnemyDistanceInFacingDirection(
                positionX,
                positionY,
                facingDirection,
                enemyX,
                enemyY
            );

            if (distance === null) {
                return null;
            }

            const canSeeGroup = enemyGroup.some(({ enemy, index }) => {
                if (!enemy || enemy.health <= 0) return false;
                if (!isEnemyVisibleToPlayer(enemy as any, positionX, positionY, facingDirection)) return false;
                return !isEnemyOccludedByCloserEnemy(index, laneEnemies, positionX, positionY, facingDirection);
            });

            if (!canSeeGroup) {
                return null;
            }

            // Calculate perspective scale
            const perspectiveScale = distance === 0 ? 1.0 :
                                    distance === 1 ? 0.80 :
                                    distance === 2 ? 0.75 :
                                    distance === 3 ? 0.65 :
                                    0.4 / distance + 0.10;

            // Calculate fog opacity
            const fogPerTile = 0.12;
            const fogOpacity = Math.min(0.75, distance * fogPerTile);

            const canEngage = enemyGroup.some(({ enemy, index }) => {
                if (!enemy || enemy.health <= 0) return false;
                if ((enemy.disposition || 'hostile') !== 'hostile') return false;
                if (isEnemyOccludedByCloserEnemy(index, laneEnemies, positionX, positionY, facingDirection)) return false;
                return isEnemyCombatReachable(
                    enemy as any,
                    positionX,
                    positionY,
                    facingDirection,
                    playerClass
                );
            });

            return (
                <View
                    key={posKey}
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 100 - distance,
                    }}
                >
                    <View style={{
                        transform: [{scale: perspectiveScale}],
                        flexDirection: 'row',
                    }}>
                        {/* Render stacked enemies with slight offset */}
                        {enemyGroup.map(({ enemy, index }, stackIndex) => {
                            if (enemy.health <= 0) return null;

                            // Spread stacks from center to reduce heavy overlap in packs.
                            const stackCenter = (enemyGroup.length - 1) / 2;
                            const centeredSlot = stackIndex - stackCenter;
                            const isRat = enemy.id === 1;
                            const horizontalSpread = isRat ? 52 : 40;
                            const verticalSpread = isRat ? 8 : 12;
                            const offsetX = centeredSlot * horizontalSpread;
                            const offsetY = -Math.abs(centeredSlot) * verticalSpread;
                            const stackZ = 200 - Math.abs(centeredSlot);

                            return (
                                <View
                                    key={index}
                                    style={{
                                        transform: [
                                            { translateX: offsetX },
                                            { translateY: offsetY }
                                        ],
                                        zIndex: stackZ,
                                    }}
                                >
                                    <TouchableOpacity
                                        onPress={() => canEngage ? startCombatAux(index, true) : null}
                                        disabled={!canEngage}
                                        style={{ opacity: canEngage ? 1 : 0.9 }}
                                    >
                                        <Enemy
                                            index={index}
                                            jumpIntoView={enemy.visibilityMode === 'ambush' && distance === 0}
                                        />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                        {/* Pack count indicator */}
                        {enemyGroup.length > 1 && (
                            <View style={{
                                position: 'absolute',
                                top: -20,
                                right: -20,
                                backgroundColor: '#ff4444',
                                borderRadius: 12,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                zIndex: 999,
                            }}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                                    x{enemyGroup.length}
                                </Text>
                            </View>
                        )}
                        {/* Fog overlay for distant enemies */}
                        {fogOpacity > 0 && (
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    top: -50,
                                    left: -50,
                                    right: -50,
                                    bottom: -50,
                                    backgroundColor: '#0a0a12',
                                    opacity: fogOpacity,
                                }}
                            />
                        )}
                    </View>
                </View>
            );
        });
    };

    return (
        <View style={styles.roomRoot}>
            {/* DEBUG OVERLAY */}
            <DebugOverlay
                visible={true}
                mapArray={activeMapArray}
                pathTileArr={activePathTileArr}
                verticalTileArr={verticalTileArr}
                dg_map={dg_map}
            />
            <View style={styles.depthIndicator}>
                <Text style={styles.depthIndicatorText}>{`Depth ${dungeonDepth} · ${currentMapId}`}</Text>
            </View>

            {/* Movement System Toggle */}
            <TouchableOpacity
            style={{...styles.button, backgroundColor: useNewMovement ? '#00aa00' : '#aa0000', opacity: 1}}
            onPress={() => setUseNewMovement(!useNewMovement)}>
               <Text style={{color: '#fff', fontSize: 10}}>{useNewMovement ? 'NEW' : 'OLD'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
            style={{...styles.button, opacity: 1}}
            onPress={guardedForward}>
               <Text>Move ↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={{...styles.button, opacity: 1}}
            onPress={guardedReverse}>
               <Text>Move ↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={{...styles.button, opacity: 1}}
            onPress={ () => guardedTurn('R') }>
               <Text>Right</Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={{...styles.button, opacity: 1}}
            onPress={ () => guardedTurn('L') }>
               <Text>Left</Text>
            </TouchableOpacity>

            {/* Stairs Interaction Button - appears when standing on stairs */}
            {(isOnStairsUp || isOnStairsDown) && (
                <TouchableOpacity
                    style={{
                        ...styles.button,
                        backgroundColor: '#4a4a8a',
                        borderColor: '#6a6aaa',
                        borderWidth: 2,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                    }}
                    onPress={handleStairsInteraction}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                        {isOnStairsUp ? '↑ GO UP' : '↓ GO DOWN'}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Door Interaction Button - appears when standing on doors */}
            {isOnDoor && (
                <TouchableOpacity
                    style={{
                        ...styles.button,
                        backgroundColor: '#8B4513',
                        borderColor: '#D2691E',
                        borderWidth: 2,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                    }}
                    onPress={handleDoorInteraction}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                        ENTER DOOR
                    </Text>
                </TouchableOpacity>
            )}

            {/* 3D Rendering Mode Toggle */}
            <TouchableOpacity
                style={{
                    ...styles.button,
                    backgroundColor: use3DRendering ? '#0088ff' : '#555',
                    opacity: 1,
                    marginLeft: 10,
                }}
                onPress={() => setUse3DRendering(!use3DRendering)}
            >
                <Text style={{ color: '#fff', fontSize: 10 }}>
                    {use3DRendering ? '3D' : '2D'}
                </Text>
            </TouchableOpacity>

            {/* Conditional rendering: 3D CSS mode or classic 2D tiles */}
            <View style={styles.gameViewport}>
            {use3DRendering ? (
                <Room3D
                    positionX={positionX}
                    positionY={positionY}
                    direction={currentDir}
                    mapTiles={mapTiles}
                    mapWidth={mapWidth}
                    mapHeight={mapHeight}
                    viewDistance={5}
                />
            ) : (
            <ImageBackground
            source={resources[0] as ImageSourcePropType}
            style={styles.tileViewport}>
            {activePathTileArr.map((val, index) => {
                    // Calculate fog opacity based on distance (index)
                    // Each tile gets fog proportional to its distance from player
                    // index 0: nearest tile (least fog)
                    // Higher index = further away = more fog
                    const fogPerTile = 0.12; // 12% fog added per tile of distance
                    const fogOpacity = Math.min(0.75, index * fogPerTile);

                    // Get tile type for special tile labels
                    const tileType = activeMapArray?.[index];
                    const isDoor = tileType === 5;
                    const isStairsUp = tileType === 6;
                    const isStairsDown = tileType === 7;
                    const isSpecialTile = isStairsUp || isStairsDown;
                    const tileSprite = activePathTileArr[index] as NodeRequire;
                    const doorOverlays = isDoor ? getDoorOverlaySources(tileSprite, index) : [];

                    // Get label for special tiles
                    const getSpecialTileLabel = () => {
                        if (isDoor) return 'DOOR';
                        if (isStairsUp) return '↑ STAIRS';
                        if (isStairsDown) return '↓ STAIRS';
                        return '';
                    };

                    // Original scale formula - index 0 is nearest (largest), higher = further (smaller)
                    // index 0: special case to avoid division by zero
                    // index 1: 0.67
                    // index 2+: progressively smaller
                    const tileScale = index === 0 ? 0.77 :
                                     index === 1 ? 0.67 :
                                     0.67 / index + 0.1;

                    return <View
                        key={index}
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <ImageBackground
                        source={activePathTileArr[index] as ImageSourcePropType}
                        style={[
                            styles.tileViewport,
                            {
                                transform: [{scale: tileScale}],
                                position: 'absolute'
                            }
                        ]}
                        >
                            {/* Special tile label overlay (Door/Stairs) */}
                            {isSpecialTile && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: '40%',
                                        left: 0,
                                        right: 0,
                                        alignItems: 'center',
                                        zIndex: 10,
                                    }}
                                >
                                    <View style={{
                                        backgroundColor: '#4a4a8a',
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        borderWidth: 2,
                                        borderColor: '#6a6aaa',
                                    }}>
                                        <Text style={{
                                            color: '#fff',
                                            fontSize: 18,
                                            fontWeight: 'bold',
                                            textShadowColor: '#000',
                                            textShadowOffset: { width: 1, height: 1 },
                                            textShadowRadius: 2,
                                        }}>
                                            {getSpecialTileLabel()}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            {doorOverlays.map((overlay, overlayIndex) => (
                                <Image
                                    key={`door-overlay-${index}-${overlayIndex}`}
                                    testID={`door-overlay-${index}-${overlayIndex}`}
                                    source={overlay}
                                    resizeMode="contain"
                                    style={styles.doorOverlay}
                                />
                            ))}
                            {/* Fog of war overlay */}
                            {fogOpacity > 0 && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: '#0a0a12',
                                        opacity: fogOpacity,
                                    }}
                                />
                            )}
                        </ImageBackground>
                    </View>
            })}
        </ImageBackground>
            )}
            {renderVisibleEnemies()}
            {skillOverlay ? (
                <View style={styles.skillOverlayWrap}>
                    {skillOverlay}
                </View>
            ) : null}
            {rightOverlay ? (
                <View style={styles.rightOverlayWrap}>
                    {rightOverlay}
                </View>
            ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    roomRoot: {
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
    gameViewport: {
        width: ROOM_VIEWPORT_SIZE,
        height: ROOM_VIEWPORT_SIZE,
        backgroundColor: '#0a0a12',
        overflow: 'hidden',
        position: 'relative',
    },
    tileViewport: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        overflow: 'hidden',
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
    skillOverlayWrap: {
        position: 'absolute',
        left: 10,
        bottom: 10,
        zIndex: 250,
    },
    rightOverlayWrap: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        zIndex: 250,
    },
    depthIndicator: {
        position: 'absolute',
        top: 10,
        right: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#3f3f46',
        backgroundColor: 'rgba(10, 10, 18, 0.85)',
        borderRadius: 8,
        zIndex: 280,
    },
    depthIndicatorText: {
        color: '#e2e8f0',
        fontSize: 11,
        fontWeight: '700',
    },
    doorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 14,
    },
});
