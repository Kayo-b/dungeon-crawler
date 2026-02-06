// useMovementWithRender Hook
// Combines movement logic with tile rendering for Room component

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  changeDir,
  setCurrentPos,
  setCurrentArrPos,
  setInitialDirection,
  setLastTurnDir,
} from '../../features/room/roomSlice';
import { debugMove, Direction as DebugDirection } from '../../utils/debug';
import { Direction, TileType } from '../../types/map';
import { MovementController, MovementState, MapData } from './MovementController';
import { getTileAt, getPathArray, getWalkablePath, TILE, checkPerpendicularTiles } from './TileNavigator';
import { isVertical, TURN_MATRIX } from './DirectionUtils';

/**
 * Tile resources interface
 */
export interface TileImages {
  corridor: any;
  turnLeft: any;
  turnRight: any;
  threeWay: any;
  wall: any;
  // Optional new tile types
  fourWay?: any;
  door?: any;
  doorOpen?: any;
  stairsUp?: any;
  stairsDown?: any;
  deadEnd?: any;
}

/**
 * Hook return type
 */
export interface UseMovementWithRenderReturn {
  // Movement functions
  forward: () => void;
  reverse: () => void;
  turn: (dir: 'L' | 'R') => void;

  // Render data
  pathTileArr: any[];
  mapArray: TileType[];

  // State
  position: { x: number; y: number };
  direction: Direction;
  currentArrPos: number;
  iniDir: boolean;
}

/**
 * useMovementWithRender - Combines movement with tile rendering
 */
export function useMovementWithRender(tileImages: TileImages): UseMovementWithRenderReturn {
  const dispatch = useAppDispatch();

  // Redux state
  const positionX = useAppSelector(state => state.room.posX);
  const positionY = useAppSelector(state => state.room.posY);
  const direction = useAppSelector(state => state.room.direction) as Direction;
  const currentArrPos = useAppSelector(state => state.room.currentArrPos);
  const iniDir = useAppSelector(state => state.room.initialDirection);
  const lastTurnDir = useAppSelector(state => state.room.lastTurnDir);

  // Map data
  const mapTiles = useAppSelector(state => state.room.mapTiles);
  const verticalTiles = useAppSelector(state => state.room.verticalTiles);
  const mapWidth = useAppSelector(state => state.room.mapWidth);
  const mapHeight = useAppSelector(state => state.room.mapHeight);

  // Local state for rendered tiles
  const [pathTileArr, setPathTileArr] = useState<any[]>([]);
  const [mapArray, setMapArray] = useState<TileType[]>([]);

  // Create map data
  const mapData: MapData = useMemo(() => ({
    tiles: mapTiles,
    verticalTiles,
    width: mapWidth,
    height: mapHeight,
  }), [mapTiles, verticalTiles, mapWidth, mapHeight]);

  // Movement controller
  const controller = useMemo(() => new MovementController(mapData), [mapData]);

  // Current state
  const currentState: MovementState = useMemo(() => ({
    position: { x: positionX, y: positionY },
    direction,
    currentArrPos,
    iniDir,
    lastTurnDir: lastTurnDir as 'L' | 'R' | '',
  }), [positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir]);

  /**
   * Generate tile resources for rendering
   */
  const generateResources = useCallback((
    dir: Direction,
    arrPos: number,
    newIniDir?: boolean
  ) => {
    const effectiveIniDir = newIniDir !== undefined ? newIniDir : iniDir;

    // Get the appropriate path array
    const path = isVertical(dir)
      ? verticalTiles[positionX] || []
      : mapTiles[positionY] || [];

    // Filter walls
    const walkable = path.filter(t => t !== TILE.WALL);
    setMapArray(walkable);

    // Reverse for N/W
    let orderedPath = [...walkable];
    if (dir === 'N' || dir === 'W') {
      orderedPath = orderedPath.reverse();
    }

    // Generate tile images
    const tiles: any[] = [];

    for (let i = arrPos; i < orderedPath.length; i++) {
      const tileType = orderedPath[i];
      const tile = getTileImage(tileType, i, dir, effectiveIniDir);
      if (tile) {
        tiles.push(tile);
      }
    }

    // Check if facing wall
    const nextTile = getNextTile(dir);
    if (nextTile === TILE.WALL || nextTile === null) {
      if (tiles.length === 0) {
        tiles.push(tileImages.wall);
      }
    }

    setPathTileArr(tiles.filter(t => t !== ''));
  }, [mapTiles, verticalTiles, positionX, positionY, iniDir, tileImages]);

  /**
   * Get tile image based on type
   */
  const getTileImage = useCallback((
    tileType: TileType,
    index: number,
    dir: Direction,
    effectiveIniDir: boolean
  ): any => {
    // Wall tile
    if (tileType === TILE.WALL) {
      return tileImages.wall;
    }

    // Corridor tile
    if (tileType === TILE.CORRIDOR) {
      return tileImages.corridor;
    }

    // Door tile - use door image if available, fallback to corridor
    if (tileType === TILE.DOOR) {
      return tileImages.door || tileImages.corridor;
    }

    // Stairs Up - use stairsUp image if available, fallback to corridor
    if (tileType === TILE.STAIRS_UP) {
      return tileImages.stairsUp || tileImages.corridor;
    }

    // Stairs Down - use stairsDown image if available, fallback to corridor
    if (tileType === TILE.STAIRS_DOWN) {
      return tileImages.stairsDown || tileImages.corridor;
    }

    // Dead End - use deadEnd image if available, fallback to wall
    if (tileType === TILE.DEAD_END) {
      return tileImages.deadEnd || tileImages.wall;
    }

    // For turns and intersections, check perpendicular tiles
    const { leftTile, rightTile } = checkPerpendicularTiles(
      { x: positionX, y: positionY },
      dir,
      mapTiles,
      mapWidth,
      mapHeight
    );

    const hasLeft = leftTile !== null && leftTile !== TILE.WALL;
    const hasRight = rightTile !== null && rightTile !== TILE.WALL;

    // Four-way intersection - use fourWay image if available, fallback to threeWay
    if (tileType === TILE.FOUR_WAY) {
      return tileImages.fourWay || tileImages.threeWay;
    }

    // Three-way intersection
    if (tileType === TILE.THREE_WAY) {
      if (hasLeft && hasRight) {
        return tileImages.threeWay;
      }
      return hasRight ? tileImages.turnRight : tileImages.turnLeft;
    }

    // Turn tile
    if (tileType === TILE.TURN) {
      if (hasRight && !hasLeft) return tileImages.turnRight;
      if (hasLeft && !hasRight) return tileImages.turnLeft;
      return effectiveIniDir ? tileImages.turnRight : tileImages.turnLeft;
    }

    return tileImages.corridor;
  }, [tileImages, positionX, positionY, mapTiles, mapWidth, mapHeight]);

  /**
   * Get tile in front of player
   */
  const getNextTile = useCallback((dir: Direction): TileType | null => {
    let nextX = positionX;
    let nextY = positionY;

    switch (dir) {
      case 'N': nextY--; break;
      case 'S': nextY++; break;
      case 'E': nextX++; break;
      case 'W': nextX--; break;
    }

    return getTileAt({ x: nextX, y: nextY }, mapTiles, mapWidth, mapHeight);
  }, [positionX, positionY, mapTiles, mapWidth, mapHeight]);

  /**
   * Forward movement
   */
  const forward = useCallback(() => {
    const currentTile = getTileAt({ x: positionX, y: positionY }, mapTiles, mapWidth, mapHeight);

    debugMove.start('forward', {
      posX: positionX,
      posY: positionY,
      direction: direction as DebugDirection,
      currentArrPos,
      iniDir,
      lastTurnDir,
      tileType: currentTile ?? -1,
    });

    const result = controller.moveForward(currentState);

    if (result.success) {
      const { newState } = result;

      dispatch(setCurrentPos([newState.position.x, newState.position.y]));
      dispatch(setCurrentArrPos(newState.currentArrPos));
      dispatch(setLastTurnDir(''));

      // Generate resources for new position
      generateResources(direction, newState.currentArrPos);

      debugMove.note(`Moved to (${newState.position.x}, ${newState.position.y})`);
    } else {
      debugMove.note('Blocked by wall');
    }

    debugMove.end({
      posX: result.newState.position.x,
      posY: result.newState.position.y,
      direction: result.newState.direction as DebugDirection,
      currentArrPos: result.newState.currentArrPos,
      iniDir: result.newState.iniDir,
      success: result.success,
    });
  }, [controller, currentState, dispatch, generateResources, direction, positionX, positionY, currentArrPos, iniDir, lastTurnDir, mapTiles, mapWidth, mapHeight]);

  /**
   * Reverse movement
   */
  const reverse = useCallback(() => {
    const currentTile = getTileAt({ x: positionX, y: positionY }, mapTiles, mapWidth, mapHeight);

    debugMove.start('reverse', {
      posX: positionX,
      posY: positionY,
      direction: direction as DebugDirection,
      currentArrPos,
      iniDir,
      lastTurnDir,
      tileType: currentTile ?? -1,
    });

    const result = controller.reverse(currentState);
    const { newState } = result;

    dispatch(changeDir(newState.direction));
    dispatch(setCurrentArrPos(newState.currentArrPos));
    dispatch(setInitialDirection(newState.iniDir));
    dispatch(setLastTurnDir(''));

    // Generate resources for new direction
    generateResources(newState.direction, newState.currentArrPos, newState.iniDir);

    debugMove.note(`Reversed to ${newState.direction}`);

    debugMove.end({
      posX: newState.position.x,
      posY: newState.position.y,
      direction: newState.direction as DebugDirection,
      currentArrPos: newState.currentArrPos,
      iniDir: newState.iniDir,
      success: true,
    });
  }, [controller, currentState, dispatch, generateResources, positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir, mapTiles, mapWidth, mapHeight]);

  /**
   * Turn movement
   */
  const turn = useCallback((turnDir: 'L' | 'R') => {
    const currentTile = getTileAt({ x: positionX, y: positionY }, mapTiles, mapWidth, mapHeight);
    const moveType = turnDir === 'L' ? 'turn_L' : 'turn_R';

    debugMove.start(moveType, {
      posX: positionX,
      posY: positionY,
      direction: direction as DebugDirection,
      currentArrPos,
      iniDir,
      lastTurnDir,
      tileType: currentTile ?? -1,
    });

    // Calculate new direction
    const newDirection = TURN_MATRIX[direction][turnDir];

    // Calculate new array position
    const nowVertical = isVertical(newDirection);
    let newArrPos: number;
    let newIniDir: boolean;

    if (nowVertical) {
      newArrPos = positionY;
      newIniDir = turnDir === 'R';
    } else {
      newArrPos = positionX;
      newIniDir = turnDir === 'R';
    }

    // Handle special cases for 3-way intersections
    if (currentTile === TILE.THREE_WAY) {
      // At 3-way, adjust position based on turn direction
      const path = getWalkablePath(
        { x: positionX, y: positionY },
        newDirection,
        mapTiles,
        verticalTiles
      );

      if (turnDir === 'L') {
        newArrPos = path.length - 1 - newArrPos;
        newIniDir = false;
      }
    }

    // Clamp to valid range
    newArrPos = Math.max(0, newArrPos);

    // Update state
    dispatch(changeDir(newDirection));
    dispatch(setCurrentArrPos(newArrPos));
    dispatch(setInitialDirection(newIniDir));
    dispatch(setLastTurnDir(turnDir));

    // Generate resources
    generateResources(newDirection, newArrPos, newIniDir);

    debugMove.note(`Turned ${turnDir} to ${newDirection}, arrPos=${newArrPos}, iniDir=${newIniDir}`);

    debugMove.end({
      posX: positionX,
      posY: positionY,
      direction: newDirection as DebugDirection,
      currentArrPos: newArrPos,
      iniDir: newIniDir,
      success: true,
    });
  }, [dispatch, generateResources, positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir, mapTiles, verticalTiles, mapWidth, mapHeight]);

  // Initialize resources on mount and when position/direction changes
  useEffect(() => {
    generateResources(direction, currentArrPos);
  }, [verticalTiles, mapTiles]);

  return {
    forward,
    reverse,
    turn,
    pathTileArr,
    mapArray,
    position: { x: positionX, y: positionY },
    direction,
    currentArrPos,
    iniDir,
  };
}

export default useMovementWithRender;
