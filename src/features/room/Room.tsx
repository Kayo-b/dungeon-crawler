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
    const backtrackArr: Array<NodeRequire> = [];
    const [pathTileArr, setPathTileArray] = useState<NodeRequire[]>(resources);
    const [backtrack, setBacktrack] = useState(backtrackArr);
    const [verticalTileArr, setVerticalTileArr] = useState<Array<Array<number>>>(Array.from({ length: 8 }, () => []));
    
    const turnTileRight = require('../../resources/dung-turn.png');
    const turnTileLeft = require('../../resources/dung-turn-left.png');
    const corridorTile = require('../../resources/dung-corridor.png');
    const facingWallTile = require('../../resources/brickwall.png');
    const turnThreeWay = require('../../resources/dung-threeway.png');
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
        [2, 1, 1, 3, 1, 3, 1, 2],
        [1, 0, 0, 1, 0, 1, 0, 1],
        [3, 1, 1, 3, 1, 3, 1, 3],
        [1, 0, 0, 1, 0, 1, 0, 1],
        [3, 1, 1, 3, 1, 3, 1, 3],
        [1, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 1],
        [2, 1, 1, 1, 1, 3, 1, 2]
    ]

    type Direction = 'N' | 'S' | 'E' | 'W';
    type TurnDirection = 'L' | 'R';
    type TileType = 0 | 1 | 2 | 3 | undefined;
    type MapArray = Array<TileType>;

    /**
     * Map of new directions when turning left or right from a given direction
     */
    const DIRECTION_MAP = {
    'N': { 'L': 'W', 'R': 'E' },
    'S': { 'L': 'E', 'R': 'W' },
    'E': { 'L': 'N', 'R': 'S' },
    'W': { 'L': 'S', 'R': 'N' }
    };

/**
 * Generates map resources based on player's current position and direction
 */
const generateMapResources = (
  currentDirLocal: Direction,
  newPosition: number,
  newDir?: boolean,
  isReverse?: boolean,
  is3turn?: boolean
) => {
  // Initialize variables
  let tempArr = [];
  let tempArrTiles = [];
  let mapArr: MapArray;
  let arrayPosition: number;
  
  // Use provided newDir or fall back to initial direction
  const effectiveNewDir = newDir !== undefined ? newDir : iniDir;
  
  // Set up map array and position based on direction
  ({ mapArr, arrayPosition } = setupMapArrayAndPosition(
    currentDirLocal, 
    newPosition, 
    positionX, 
    positionY
  ));
  
  // Handle direction changes
  handleDirectionChange(
    currentDirLocal, 
    currentDirTemp, 
    isReverse, 
    effectiveNewDir
  );
  
  // Process map array
  const tempArray = [...mapArr];
  const processedMapArr = processMapArray(mapArr);
  if (shouldUpdateMapArray(processedMapArr)) {
    setMapArray(processedMapArr);
  }
  
  // Reverse array if needed based on direction
  const finalMapArr = adjustMapArrayForDirection(
    processedMapArr, 
    currentDirLocal
  );
  
  // Generate tiles
  const { tileArray, tileTypes } = generateTiles(
    finalMapArr,
    tempArray,
    arrayPosition,
    currentDirLocal,
    effectiveNewDir
  );
  
  // Update state with generated tiles
  updateTileState(tileArray, tileTypes);
};

/**
 * Sets up the map array and position based on direction
 */
const setupMapArrayAndPosition = (
  direction: Direction,
  newPosition: number | undefined,
  posX: number,
  posY: number
): { mapArr: MapArray; arrayPosition: number } => {
  if (direction === "N" || direction === "S") {
    return {
      mapArr: verticalTileArr[posX],
      arrayPosition: newPosition !== undefined ? newPosition : posY
    };
  } else {
    return {
      mapArr: dg_map[posY],
      arrayPosition: newPosition !== undefined ? newPosition : posX
    };
  }
};

/**
 * Handle changes in direction and update initial direction state if needed
 */
const handleDirectionChange = (
  currentDir: Direction,
  previousDir: Direction,
  isReverse: boolean | undefined,
  newDir: boolean
) => {
    console.log(previousDir, currentDir, "prev and curr")
  if (previousDir !== currentDir && isReverse === undefined) {
    // Only process if direction has changed and not in reverse mode
    if (areOppositeDirections(previousDir, currentDir)) {
      dispatch(invertInitialDirection());
      return !newDir;
    }
  }
  
  setCurrentDirTemp(currentDir);
  return newDir;
};

/**
 * Check if two directions are opposite
 */
const areOppositeDirections = (dir1: Direction, dir2: Direction): boolean => {
  const opposites = {
    'N': 'S',
    'S': 'N',
    'E': 'W',
    'W': 'E'
  };
  
  return opposites[dir1] === dir2;
};

/**
 * Process the map array to filter out unwanted tiles
 */
const processMapArray = (mapArr: MapArray): MapArray => {
  // console.log(isWallTurn,'is facing wall?')
  mapArr.map(val => {
    if(val === 3 && mapArr[0] === 1) mapArr.shift();
    if(val === 3 && mapArr[mapArr.length - 1] === 1) mapArr.pop();
  }) 
  return mapArr.filter(val => val !== 0);
};

/**
 * Determine if the map array should be updated in state
 */
const shouldUpdateMapArray = (mapArr: MapArray): boolean => {
  return mapArr.filter(val => val !== 1).filter(val => val !== 0).length !== 0;
};

/**
 * Adjust map array based on direction (reverse if needed)
 */
const adjustMapArrayForDirection = (
  mapArr: MapArray,
  direction: Direction
): MapArray => {
  if (direction === 'N' || direction === 'W') {
    return [...mapArr].reverse();
  }
  return mapArr;
};

/**
 * Generate tile objects based on map array and position
 */
const generateTiles = (
  mapArr: MapArray,
  originalArray: MapArray,
  arrayPosition: number,
  direction: Direction,
  newDir: boolean
) => {
  const tileArray = [];
  const tileTypes = [];
  
  // process each tile
  for (let i = arrayPosition; i < originalArray.length; i++) {
    const tileType = mapArr[i];
    const tileResult = processTile(
      tileType,
      direction,
      i,
      newDir,
      arrayPosition,
      mapArr
    );
    
    if (tileResult.tile) {
      tileArray.push(tileResult.tile);
      tileTypes.push(tileResult.tile);
    }
  }
  
  return { tileArray, tileTypes };
};

/**
 * Process a single tile and return the appropriate tile asset
 */
const processTile = (
  tileType: TileType,
  direction: Direction,
  index: number,
  newDir: boolean,
  arrayPosition: number,
  mapArr: MapArray
) => {
  switch (tileType) {
    case 1:
      return processCorridorTile(direction);
    case 2:
      return processTurnTile(direction, index, newDir);
    case 3:
      return processThreeWayTile(direction, index, newDir, mapArr);
    case undefined:
      return processWallTile(direction);
    default:
      return { tile: null };
  }
};

/**
 * Process a corridor tile (type 1)
 */
const processCorridorTile = (direction: Direction) => {
  // Check if we're facing a wall
  if (isFacingWall(direction)) {
    return { tile: null };
  }
  
  return { tile: corridorTile };
};

/**
 * Determine if player is facing a wall
 */
const isFacingWall = (direction: Direction): boolean => {
  switch (direction) {
    case 'N':
      return verticalTileArr[positionX][positionY - 1] === 0 ||
             verticalTileArr[positionX][positionY - 1] === undefined;
    case 'S':
      return verticalTileArr[positionX][positionY + 1] === 0 ||
             verticalTileArr[positionX][positionY + 1] === undefined;
    case 'E':
      return dg_map[positionY][positionX + 1] === 0 ||
             dg_map[positionY][positionX + 1] === undefined;
    case 'W':
      return dg_map[positionY][positionX - 1] === 0 ||
             dg_map[positionY][positionX - 1] === undefined;
  }
};

/**
 * Process a turn tile (type 2)
 */
const processTurnTile = (
  direction: Direction,
  index: number,
  newDir: boolean
) => {
  // determine if we should use left or right turn tile
  const shouldUseRightTurn = shouldUseTurnRight(direction, index, newDir);
  
  return {
    tile: shouldUseRightTurn ? turnTileRight : turnTileLeft
  };
};

/**
 * Determine whether to use right turn tile based on direction
 */
const shouldUseTurnRight = (
  direction: Direction,
  index: number,
  newDir: boolean
): boolean => {
  let nextTileOfPerpAxis;
  
  switch (direction) {
    case 'N':
      nextTileOfPerpAxis = dg_map[index][positionX + 1];
      return nextTileOfPerpAxis === 1 || newDir;
    case 'S':
      nextTileOfPerpAxis = dg_map[index][positionX + 1];
      return !(nextTileOfPerpAxis === 1 || !newDir);
    case 'W':
      nextTileOfPerpAxis = verticalTileArr[index][positionY + 1];
      return !(nextTileOfPerpAxis === 1 || !newDir);
    case 'E':
      nextTileOfPerpAxis = verticalTileArr[index][positionY + 1];
      return nextTileOfPerpAxis === 1 || newDir;
    default:
      return false;
  }
};

/**
 * Process a three-way tile (type 3)
 */
const processThreeWayTile = (
  direction: Direction,
  index: number,
  newDir: boolean,
  mapArr: MapArray
) => {
  if (isFacingWall(direction)) {
    return { tile: facingWallTile };
  }
  
  // check perpendicular paths for three-way intersection
  const hasThreeWayIntersection = checkForThreeWayIntersection(
    direction, 
    index
  );
  
  if (hasThreeWayIntersection) {
    return { tile: turnThreeWay };
  }
  
  // Otherwise return appropriate turn tile
  return {
    tile: newDir ? turnTileRight : turnTileLeft
  };
};

/**
 * Check if there's a three-way intersection
 */
const checkForThreeWayIntersection = (
  direction: Direction,
  index: number
): boolean => {
  let perpTileNext, perpTilePrev;
  
  switch (direction) {
    case 'N':
    case 'S':
      perpTileNext = dg_map[index][positionX + 1];
      perpTilePrev = dg_map[index][positionX - 1];
      break;
    case 'E':
    case 'W':
      perpTileNext = verticalTileArr[index][positionY + 1];
      perpTilePrev = verticalTileArr[index][positionY - 1];
      break;
  }
  
  return (perpTileNext === 1 && perpTilePrev === 1) || 
         (perpTileNext === 0 && perpTilePrev === 0);
};

/**
 * Process a wall tile
 */
const processWallTile = (direction: Direction) => {
  // Only show wall if we haven't already counted one
  if (wallAlreadyCounted()) {
    return { tile: null };
  }
  
  if (isFacingWall(direction)) {
    incrementWallCount();
    return { tile: facingWallTile };
  }
  
  return { tile: null };
};

/**
 * Update tile state with generated tiles
 */
const updateTileState = (tileArray, tileTypes) => {
  setVertRes(tileArray);
  setPathTileArray(tileArray.filter(val => val != ''));
};

// Helper variables and functions for wall counting
let wallCount = 0;

const wallAlreadyCounted = () => wallCount > 0;
const incrementWallCount = () => wallCount++;
const resetWallCount = () => wallCount = 0;
    
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
        console.log(verticalTileArr[positionX][positionY -1], "-VERTICAL TILE ARR CHECK")
        console.log(verticalTileArr[positionX][positionY +1], "+VERTICAL TILE ARR CHECK")
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
        console.log("turndir inidir currentdir", iniDir, currentDir, mapArray, lastTurnDir, tempArrPos)
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
        console.log(currentArrPos,iniDir,"backtrack")
    }
/**
 * Handle turning mechanics based on current direction and turn direction
 */
const handleTurn = (
  currentDir: Direction, 
  lastTurnDir: string, 
  turnDirection: TurnDirection, 
  is3turn?: boolean, 
  isWallTurn?: boolean
) => {
  // get new direction based on current direction and turn direction
  const newDirection = DIRECTION_MAP[currentDir][turnDirection];
  // Calculate positions
  const newPosition = mapArray?.length - currentArrPos;
  const newPositionX = /**(mapArray?.length - 1)**/ 7 - positionX;
  const newPositionY = /**(mapArray?.length - 1)**/ 7 - positionY;
  console.log(mapArray, 'new positions', 'X ' + newPositionX, 'Y '+newPositionY, 'path Tiel arr', pathTileArr)
  
  // If this is a three-way intersection turn
  if (is3turn) {
    handle3WayTurn(
      currentDir,
      newDirection,
      turnDirection,
      newPositionX,
      newPositionY,
      isWallTurn
    );
  } else {
    // Handle regular turn
    handleRegularTurn(
      currentDir,
      newDirection,
      lastTurnDir,
      turnDirection,
      newPosition
    );
  }
};

/**
 * Handle turn at a three-way intersection
 */
const handle3WayTurn = (
  currentDir: Direction,
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPositionX: number,
  newPositionY: number,
  isWallTurn?: boolean
) => {
  // Configuration for each direction
  const directionConfig = {
    'N': handleNorth3WayTurn,
    'S': handleSouth3WayTurn,
    'W': handleWest3WayTurn,
    'E': handleEast3WayTurn
  };
  
  // Call the appropriate handler for the current direction
  directionConfig[currentDir](
    newDirection,
    turnDirection,
    newPositionX,
    newPositionY,
    isWallTurn
  );
};

/**
 * Handle North direction 3-way turn
 */
const handleNorth3WayTurn = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPositionX: number,
  newPositionY: number,
  isWallTurn?: boolean
) => {
  if (currentArrPos !== 0) {
    console.log('north not at start')
    // Not at starting position
    handle3WayTurnNotAtStart(
      newDirection,
      turnDirection,
      positionX,
      newPositionX
    );
  } else {
    // At starting position
    if (iniDir) {
    console.log('north at start with inidir')
      handleNorth3WayTurnAtStartWithIniDir(
        newDirection,
        turnDirection,
        positionX,
        newPositionX,
        isWallTurn
      );
    } else {
    console.log('north at start no inidir')
      handleNorth3WayTurnAtStartWithoutIniDir(
        newDirection,
        turnDirection,
        positionX,
        newPositionX,
        isWallTurn
      );
    }
  }
};

/**
 * Handle North 3-way turn when not at starting position
 */
const handle3WayTurnNotAtStart = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  posX: number,
  newPosX: number
) => {
  if (localLastTurnDir !== turnDirection) {
    // Turn direction changed
    if (turnDirection === 'R') {
      generateMapResources(newDirection, posX, true);
      dispatch(setInitialDirection(true));
      dispatch(setCurrentArrPos(posX));
    } else {
      generateMapResources(newDirection, newPosX, false);
      dispatch(setInitialDirection(false));
      dispatch(setCurrentArrPos(newPosX));
    }
  } else {
    // Turn direction remained the same
    if (turnDirection === 'R') {
      generateMapResources(newDirection, posX, true);
      dispatch(setInitialDirection(true));
      dispatch(setCurrentArrPos(posX));
    } else {
      generateMapResources(newDirection, newPosX, false);
      dispatch(setInitialDirection(false));
      dispatch(setCurrentArrPos(newPosX));
    }
  }
};

/**
 * Handle North 3-way turn at starting position with initial direction
 */
const handleNorth3WayTurnAtStartWithIniDir = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  posX: number,
  newPosX: number,
  isWallTurn?: boolean
) => {
  if (localLastTurnDir !== turnDirection) {
    if (turnDirection === 'R') {
      generateMapResources(newDirection, posX, isWallTurn ? iniDir : !iniDir);
      dispatch(setCurrentArrPos(posX));
      dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
    } else {
      generateMapResources(newDirection, newPosX, isWallTurn ? !iniDir : iniDir);
      dispatch(setCurrentArrPos(newPosX));
      dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
    }
  } else {
    dispatch(changeDir(newDirection));
    if (turnDirection === 'R') {
      generateMapResources(newDirection, posX, isWallTurn ? iniDir : !iniDir);
      dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
      dispatch(setCurrentArrPos(posX));
    } else {
      generateMapResources(newDirection, newPosX, isWallTurn ? !iniDir : iniDir);
      dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
      dispatch(setCurrentArrPos(newPosX));
    }
  }
};

/**
 * Handle North 3-way turn at starting position without initial direction
 */
const handleNorth3WayTurnAtStartWithoutIniDir = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  posX: number,
  newPosX: number,
  isWallTurn?: boolean
) => {
  console.log('north last turn dir x local last turn dir', turnDirection,localLastTurnDir)
  if (localLastTurnDir !== turnDirection) {
    console.log('north posX', newPosX)
    generateMapResources(newDirection, newPosX, false);
    dispatch(setInitialDirection(false));
    dispatch(setCurrentArrPos(newPosX));
  } else {
    console.log('north newPosX', newPosX)
    dispatch(changeDir(newDirection));
    generateMapResources(newDirection, posX, isWallTurn ? iniDir : !iniDir);//changed newPosX to posX  to fix turn in short-pathway-on-wall, might break something !!!!!
    dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
    dispatch(setCurrentArrPos(posX));
  }
};

/**
 * Handle South direction 3-way turn
 */
const handleSouth3WayTurn = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPositionX: number,
  newPositionY: number,
  isWallTurn?: boolean
) => {
  if (currentArrPos !== 0) {
    // Not at starting position
      console.log('south not at start pos')
    if (localLastTurnDir !== turnDirection) {
      if (turnDirection === 'R') {
        // Changed the line below to fix the shorter pathway turining logic, might break something !!!
        // generateMapResources(newDirection, (mapArray.length - 1) - positionX, true);
        generateMapResources(newDirection, newPositionX, true);
        dispatch(setInitialDirection(true));
        dispatch(setCurrentArrPos(newPositionX));
      } else {
        generateMapResources(newDirection, positionX, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos(positionX));
      }
    } else {
      // Turn direction remained the same
      if (turnDirection === 'R') {
        console.log('double turn R')
        generateMapResources(newDirection, (mapArray.length - 1) - positionX, true);
        dispatch(setInitialDirection(true));
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
      } else {
        generateMapResources(newDirection, positionX, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos(positionX));
      }
    }
  } else {
    // At starting position
    if (iniDir) {
      console.log('south inidir')
      if (localLastTurnDir !== turnDirection) {
        if (turnDirection === 'R') {
          generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? !iniDir : iniDir);
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        } else {
          generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
          dispatch(setCurrentArrPos(positionX));
          dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
        }
      } else {
        if (turnDirection === 'R') {
          dispatch(changeDir(newDirection));
          generateMapResources(newDirection, (mapArray.length - 1) - positionX, isWallTurn ? iniDir : !iniDir);
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionX));
        } else {
          dispatch(changeDir(newDirection));
          generateMapResources(newDirection, positionX, isWallTurn ? !iniDir : iniDir);
          dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
          dispatch(setCurrentArrPos(positionX));
        }
      }
    } else {
      console.log('south not inidir')
      if (localLastTurnDir !== turnDirection) {
        if (turnDirection === 'R') {
           generateMapResources(newDirection, newPositionX,false);
          // the change might have broken something
          // generateMapResources(newDirection, (mapArray.length - 1) - positionX, false);
          dispatch(setInitialDirection(false));
          dispatch(setCurrentArrPos(newPositionX));
        } else {
          generateMapResources(newDirection, positionX, false);
          dispatch(setInitialDirection(false));
          dispatch(setCurrentArrPos(positionX));
        }
      } else {
        dispatch(changeDir(newDirection));
        generateMapResources(newDirection, positionX, isWallTurn ? iniDir : !iniDir);
        dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        dispatch(setCurrentArrPos(positionX));
      }
    }
  }
};

/**
 * Handle West direction 3-way turn
 */
const handleWest3WayTurn = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPositionX: number,
  newPositionY: number,
  isWallTurn?: boolean
) => {
  const isShortPath = verticalTileArr[positionX].filter(val => val !== 0).length === 8 ? false : true;

  if (currentArrPos !== 0) {
    // Not at starting position
    if (localLastTurnDir !== turnDirection) {
      if (turnDirection === 'R') {
        console.log(isWallTurn,'is wall?', mapArray.length)
        if(isShortPath) {
          // if mapArray length is shorter because of partial path:
          // check if its a short corridor
          generateMapResources(newDirection, positionY, true);
          dispatch(setInitialDirection(true));
          dispatch(setCurrentArrPos(positionY));
        } else {
          generateMapResources(newDirection, (mapArray.length - 1) - positionY, true);
          dispatch(setInitialDirection(true));
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
        }
        if(isWallTurn) {
            console.log('is wall turn west 3 way')
            generateMapResources(newDirection, 0, !iniDir);
            dispatch(invertInitialDirection());
            dispatch(setCurrentArrPos(0));
        }
      } else {
        console.log('double turn L')
        generateMapResources(newDirection, positionY, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos(positionY));
        if(isWallTurn) {
            generateMapResources(newDirection, 0);
            dispatch(setCurrentArrPos(0));
        }
      }
    } else {
      // Turn direction remained the same
      if (turnDirection === 'R') {
        console.log('double turn R')
        generateMapResources(newDirection, (mapArray.length - 1) - positionY, true);
        dispatch(setInitialDirection(true));
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
      } else {
        console.log('double turn L')
        generateMapResources(newDirection, positionY, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos(positionY));
      }
    }
  } else {
    // At starting position
    if (iniDir) {
      if (localLastTurnDir !== turnDirection) {
        if (turnDirection === 'R') {
          generateMapResources(newDirection, (mapArray.length - 1) - positionY, iniDir);
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
          dispatch(setInitialDirection(iniDir));
        } else {
          generateMapResources(newDirection, positionY, isWallTurn ? !iniDir : iniDir);
          dispatch(setCurrentArrPos(positionY));
          dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
        }
      } else {
        dispatch(changeDir(newDirection));
        if (turnDirection === 'R') {
          generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? iniDir : !iniDir);
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
        } else {
          generateMapResources(newDirection, positionY, isWallTurn ? !iniDir : iniDir);
          dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
          dispatch(setCurrentArrPos(positionY));
        }
      }
    } else {
      if (localLastTurnDir !== turnDirection) {
        generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
        dispatch(setInitialDirection(false));
      } else {
        dispatch(changeDir(newDirection));
        generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
        dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        dispatch(setCurrentArrPos(positionY));
      }
    }
  }
};

/**
 * Handle East direction 3-way turn
 */
const handleEast3WayTurn = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPositionX: number,
  newPositionY: number,
  isWallTurn?: boolean
) => {
  if (currentArrPos !== 0) {
    // Not at starting position
    if (localLastTurnDir !== turnDirection) {
      if (turnDirection === 'R') {
        generateMapResources(newDirection, positionY, true);
        dispatch(setInitialDirection(true));
        dispatch(setCurrentArrPos(positionY));
      } else {
        generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
      }
    } else {
      // Turn direction remained the same
      if (turnDirection === 'R') {
        console.log('double turn R')
        generateMapResources(newDirection, positionY, true);
        dispatch(setInitialDirection(true));
        dispatch(setCurrentArrPos(positionY));
      } else {
        console.log('double turn L')
        generateMapResources(newDirection, (mapArray.length - 1) - positionY, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
      }
    }
  } else {
    // At starting position
    if (iniDir) {
      if (localLastTurnDir !== turnDirection) {
        if (turnDirection === 'L') {
          generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? iniDir : !iniDir);
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        } else {
          generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
          dispatch(setCurrentArrPos(positionY));
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        }
      } else {
        if (turnDirection === 'R') {
          dispatch(changeDir(newDirection));
          generateMapResources(newDirection, positionY, isWallTurn ? iniDir : !iniDir);
          dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
          dispatch(setCurrentArrPos(positionY));
        } else {
          dispatch(changeDir(newDirection));
          generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? !iniDir : iniDir);
          dispatch(setInitialDirection(isWallTurn ? !iniDir : iniDir));
          dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
        }
      }
    } else {
      if (localLastTurnDir !== turnDirection) {
        generateMapResources(newDirection, positionY, false);
        dispatch(setInitialDirection(false));
        dispatch(setCurrentArrPos(positionY));
      } else {
        dispatch(changeDir(newDirection));
        generateMapResources(newDirection, (mapArray.length - 1) - positionY, isWallTurn ? iniDir : !iniDir);
        dispatch(setInitialDirection(isWallTurn ? iniDir : !iniDir));
        dispatch(setCurrentArrPos((mapArray.length - 1) - positionY));
      }
    }
  }
};
/**
 * Handle regular (non-3-way) turns
 */
const handleRegularTurn = (
  currentDir: Direction,
  newDirection: Direction,
  lastTurnDir: string,
  turnDirection: TurnDirection,
  newPosition: number
) => {
  if (lastTurnDir !== turnDirection) {
    // When turn direction has changed from last turn
    handleChangedTurnDirection(
      currentDir,
      newDirection,
      turnDirection,
      newPosition
    );
  } else {
    // When turn direction is the same as last turn
    console.log(iniDir, 'unchanged')
    generateMapResources(newDirection, currentArrPos, !iniDir);
    dispatch(invertInitialDirection());
  }
};

/**
 * Handle when turn direction has changed from previous turn
 */
const handleChangedTurnDirection = (
  currentDir: Direction,
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPosition: number
) => {
  // Check if moving along vertical or horizontal axis
  if (currentDir === 'N' || currentDir === 'S') {
    handleChangedTurnInVerticalDirection(
      newDirection,
      turnDirection,
      newPosition
    );
  } else {
    handleChangedTurnInHorizontalDirection(
      newDirection,
      turnDirection,
      newPosition
    );
  }
};

/**
 * Handle changed turn direction in vertical (N/S) axis
 */
const handleChangedTurnInVerticalDirection = (
  newDirection: Direction,
  turnDirection: TurnDirection,
  newPosition: number
) => {
  if (positionX !== 1) {
    // Not at special X position
    dispatch(changeDir(newDirection));
    dispatch(setCurrentArrPos(newPosition - 1));
    generateMapResources(newDirection, newPosition - 1);
  } else {
    // At special X position
    if (iniDir) {
      dispatch(changeDir(newDirection));
      dispatch(setCurrentArrPos(newPosition - 1));
      generateMapResources(newDirection, newPosition - 1);
    } else {
      // Initialize at position X=1
      if (positionX === 1) {
        dispatch(changeDir(newDirection));
        dispatch(setCurrentArrPos(newPosition - 1));
        generateMapResources(newDirection, newPosition - 1);
      } else {
        generateMapResources(newDirection, currentArrPos);
      }
    }
  }
};

/**
 * Handle changed turn direction in horizontal (E/W) axis
 */
const handleChangedTurnInHorizontalDirection = (
  newDirection: Direction, 
  turnDirection: TurnDirection,
  newPosition: number
) => {
  if (positionY !== 1) {
    // Not at special Y position
    dispatch(changeDir(newDirection));
    dispatch(setCurrentArrPos(newPosition - 1));
    generateMapResources(newDirection, newPosition - 1);
  } else {
    // At special Y position
    if (iniDir) {
      dispatch(changeDir(newDirection));
      dispatch(setCurrentArrPos(newPosition - 1));
      generateMapResources(newDirection, newPosition - 1);
    } else {
      // Initialize at position Y=1
      if (positionY === 1) {
        dispatch(changeDir(newDirection));
        dispatch(setCurrentArrPos(newPosition - 1));
        generateMapResources(newDirection, newPosition - 1);
      } else {
        generateMapResources(newDirection, currentArrPos);
      }
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

/**
 * Handle player turning left or right
 */
const turn = (turnDir: TurnDirection) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Turn initiated', { currentDir, turnDir, mapArray, currentArrPos });
  }
  const isWall = checkForWall(currentDir)
  console.log(isWall, 'is wall 1')
  // Get the new direction based on current direction and turn direction
  const newDirection = DIRECTION_MAP[currentDir][turnDir];
  
  // Update the direction in the state
  dispatch(changeDir(newDirection));
  
  // Determine if we should apply the special turn logic
  const shouldApplySpecialTurnLogic = determineIfSpecialTurn();
  
  if (shouldApplySpecialTurnLogic) {
    console.log(isWall,'is wall def 2')
    handleSpecialTurn(newDirection, turnDir, isWall);
  } else {
    console.log(isWall,'is wall def')
    // Default case - use the handleTurn function
    handleTurn(currentDir, lastTurnDir, turnDir, null, isWall);
  }
  
  // Update last turn direction
  dispatch(setLastTurnDir(turnDir));
  setLocalLastTurnDir(turnDir);
  
  // Reset last turn direction if needed
  if (pathTileArr[0] === 4 || pathTileArr.length === 0) {
    dispatch(setLastTurnDir(''));
  }
  
  // Only for W, S, and E directions
  if (currentDir !== 'N') {
    setBacktrack([]);
  }
};

/**
 * Determine if special turn logic should be applied
 */
const determineIfSpecialTurn = () => {
  // The condition that was repeated across all directions
  const trueFalseVar = iniDir
    ? pathTileArr[0] !== 3
    : typeof pathTileArr[0] !== 'undefined';
  
  return trueFalseVar;
};

/**
 * Handle special turn cases
 */
const handleSpecialTurn = (newDirection: Direction, turnDir: TurnDirection, isWall) => {
  // Case 1: At the start of array and not at a 3-way intersection
  if (currentArrPos === 0 && currentArrayPositionHorz !== 3) {
    generateMapResources(newDirection, 0, !iniDir);
    dispatch(invertInitialDirection());
    return;
  }
  
  // Case 2: Regular tile that is not undefined, 3, or 4
  if (typeof pathTileArr[0] !== 'undefined' && 
      pathTileArr[0] !== 3 && 
      pathTileArr[0] !== 4) {
    
    // Check for edge case with intersection and undefined next position
    const isAtEdgeIntersection = 
      currentArrayPositionHorz === 3 && 
      (currentDir === 'N' || currentDir === 'S' 
        ? dg_map[currentArrPos + 1] === undefined
        : verticalTileArr[currentArrPos + 1] === undefined);
    
    if (isAtEdgeIntersection) {
      handleTurn(currentDir, lastTurnDir, turnDir, true);
      return;
    }
    
    // At a 3-way intersection
    if (currentArrayPositionHorz === 3) {
      handleTurn(currentDir, lastTurnDir, turnDir, true, isWall);
      return;
    }
    
    // Regular corner
    generateMapResources(newDirection, 0);
    dispatch(setCurrentArrPos(0));
    return;
  }
  
  // Case 3: Special tile types (3-way intersection)
  if (currentArrayPositionHorz === 3) {
    handleTurn(currentDir, lastTurnDir, turnDir, true, true);
    return;
  }
  
  // Default case
  handleTurn(currentDir, lastTurnDir, turnDir);
  
  // Reset position if we're at a corridor or turn tile and not at a 3-way intersection
  if ((pathTileArr[0] === 1 || pathTileArr[0] === 2) && 
      currentArrayPositionHorz !== 3) {
    dispatch(setCurrentArrPos(0));
  }
};
    const checkForWall = (currentDirLocal, checkBack = false) => {
        console.log('Checking for wall in direction:', currentDirLocal, 'checkBack:', checkBack);
        switch(currentDirLocal) {
            case 'N':
                if(checkBack) {
                    return verticalTileArr[positionX] && 
                        (verticalTileArr[positionX][positionY+1] === 0 || 
                        verticalTileArr[positionX][positionY+1] === undefined);
                } else {
                    let wall = dg_map[positionY-1] && 
                        !(dg_map[positionY-1][positionX+1] === 1 && 
                          dg_map[positionY-1][positionX-1] === 1);
                    console.log('North wall check:', wall);
                    return wall;
                }
            
            case 'S':
                if(checkBack) {
                    return verticalTileArr[positionX] && 
                        (verticalTileArr[positionX][positionY-1] === 0 || 
                        verticalTileArr[positionX][positionY-1] === undefined);
                } else {
                    let wall = dg_map[positionY+1] && 
                        !(dg_map[positionY+1][positionX+1] === 1 && 
                          dg_map[positionY+1][positionX-1] === 1);
                    console.log('South wall check:', wall);
                    return wall;
                }
            
            case 'E':
                if(checkBack) {
                    return dg_map[positionY] && 
                        (dg_map[positionY][positionX-1] === 0 || 
                        dg_map[positionY][positionX-1] === undefined);
                } else {
                    let wall = verticalTileArr[positionX+1] && 
                        !(verticalTileArr[positionX+1][positionY+1] === 1 && 
                          verticalTileArr[positionX+1][positionY-1] === 1);
                    console.log('East wall check:', wall);
                    return wall;
                }
            
            case 'W':
                if(checkBack) {
                    return dg_map[positionY] && 
                        (dg_map[positionY][positionX+1] === 0|| 
                        dg_map[positionY][positionX+1] === undefined);
                } else {
                    let wall = verticalTileArr[positionX] && 
                        !(verticalTileArr[positionX][positionY+1] === 1 && 
                          verticalTileArr[positionX][positionY-1] === 1);
                    console.log('West wall check:', wall);
                    return wall;
                }
            
            default:
                console.log('Wall check default case - no wall');
                return false;
        }
    };
/**
 * Debug logger for development environment only
 */
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data || '');
  }
};
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
