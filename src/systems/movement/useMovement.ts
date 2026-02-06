// useMovement Hook
// React hook that integrates MovementController with Redux

import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  changeDir,
  setCurrentPos,
  setCurrentArrPos,
  setInitialDirection,
  setLastTurnDir,
  invertInitialDirection,
} from '../../features/room/roomSlice';
import { debugMove, Direction as DebugDirection } from '../../utils/debug';
import { Direction, TileType } from '../../types/map';
import {
  MovementController,
  MovementState,
  MapData,
  MovementResult,
} from './MovementController';
import { getTileAt, TILE } from './TileNavigator';
import { getOppositeDirection, getTurnDirection } from './DirectionUtils';

/**
 * Hook return type
 */
export interface UseMovementReturn {
  // Current state
  position: { x: number; y: number };
  direction: Direction;
  currentArrPos: number;
  iniDir: boolean;
  lastTurnDir: string;
  currentTile: TileType | null;

  // Movement functions
  moveForward: () => boolean;
  moveReverse: () => boolean;
  turnLeft: () => boolean;
  turnRight: () => boolean;
  turn: (dir: 'L' | 'R') => boolean;

  // Movement checks
  canMoveForward: boolean;
  canTurnLeft: boolean;
  canTurnRight: boolean;

  // Map data
  mapData: MapData;
}

/**
 * useMovement - Hook for handling player movement
 *
 * This hook provides clean movement functions that:
 * 1. Calculate movement using MovementController
 * 2. Dispatch Redux actions to update state
 * 3. Log debug information
 */
export function useMovement(): UseMovementReturn {
  const dispatch = useAppDispatch();

  // Get current state from Redux
  const positionX = useAppSelector(state => state.room.posX);
  const positionY = useAppSelector(state => state.room.posY);
  const direction = useAppSelector(state => state.room.direction) as Direction;
  const currentArrPos = useAppSelector(state => state.room.currentArrPos);
  const iniDir = useAppSelector(state => state.room.initialDirection);
  const lastTurnDir = useAppSelector(state => state.room.lastTurnDir);

  // Get map data from Redux
  const mapTiles = useAppSelector(state => state.room.mapTiles);
  const verticalTiles = useAppSelector(state => state.room.verticalTiles);
  const mapWidth = useAppSelector(state => state.room.mapWidth);
  const mapHeight = useAppSelector(state => state.room.mapHeight);

  // Create map data object
  const mapData: MapData = useMemo(() => ({
    tiles: mapTiles,
    verticalTiles: verticalTiles,
    width: mapWidth,
    height: mapHeight,
  }), [mapTiles, verticalTiles, mapWidth, mapHeight]);

  // Create movement controller
  const controller = useMemo(() => new MovementController(mapData), [mapData]);

  // Current movement state
  const currentState: MovementState = useMemo(() => ({
    position: { x: positionX, y: positionY },
    direction,
    currentArrPos,
    iniDir,
    lastTurnDir: lastTurnDir as 'L' | 'R' | '',
  }), [positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir]);

  // Get current tile
  const currentTile = useMemo(() =>
    getTileAt({ x: positionX, y: positionY }, mapTiles, mapWidth, mapHeight),
    [positionX, positionY, mapTiles, mapWidth, mapHeight]
  );

  // Check movement options
  const canMoveForward = useMemo(() =>
    controller.canMoveForward(currentState),
    [controller, currentState]
  );

  const canTurnLeft = useMemo(() =>
    controller.canTurn(currentState, 'L'),
    [controller, currentState]
  );

  const canTurnRight = useMemo(() =>
    controller.canTurn(currentState, 'R'),
    [controller, currentState]
  );

  /**
   * Apply movement result to Redux
   */
  const applyMovementResult = useCallback((result: MovementResult): boolean => {
    if (!result.success) {
      return false;
    }

    const { newState } = result;

    // Update position
    dispatch(setCurrentPos([newState.position.x, newState.position.y]));

    // Update direction if changed
    if (newState.direction !== direction) {
      dispatch(changeDir(newState.direction));
    }

    // Update array position
    dispatch(setCurrentArrPos(newState.currentArrPos));

    // Update initial direction
    if (newState.iniDir !== iniDir) {
      dispatch(setInitialDirection(newState.iniDir));
    }

    // Update last turn direction
    dispatch(setLastTurnDir(newState.lastTurnDir));

    return true;
  }, [dispatch, direction, iniDir]);

  /**
   * Move forward
   */
  const moveForward = useCallback((): boolean => {
    // Debug start
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

    debugMove.note(result.message || 'No message');

    // Debug end
    debugMove.end({
      posX: result.newState.position.x,
      posY: result.newState.position.y,
      direction: result.newState.direction as DebugDirection,
      currentArrPos: result.newState.currentArrPos,
      iniDir: result.newState.iniDir,
      success: result.success,
    });

    return applyMovementResult(result);
  }, [controller, currentState, positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir, currentTile, applyMovementResult]);

  /**
   * Reverse (180-degree turn)
   */
  const moveReverse = useCallback((): boolean => {
    // Debug start
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

    debugMove.note(result.message || 'No message');

    // Debug end
    debugMove.end({
      posX: result.newState.position.x,
      posY: result.newState.position.y,
      direction: result.newState.direction as DebugDirection,
      currentArrPos: result.newState.currentArrPos,
      iniDir: result.newState.iniDir,
      success: result.success,
    });

    return applyMovementResult(result);
  }, [controller, currentState, positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir, currentTile, applyMovementResult]);

  /**
   * Turn in a direction
   */
  const turn = useCallback((turnDir: 'L' | 'R'): boolean => {
    // Debug start
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

    const result = controller.turn(currentState, turnDir);

    debugMove.note(result.message || 'No message');

    // Debug end
    debugMove.end({
      posX: result.newState.position.x,
      posY: result.newState.position.y,
      direction: result.newState.direction as DebugDirection,
      currentArrPos: result.newState.currentArrPos,
      iniDir: result.newState.iniDir,
      success: result.success,
    });

    return applyMovementResult(result);
  }, [controller, currentState, positionX, positionY, direction, currentArrPos, iniDir, lastTurnDir, currentTile, applyMovementResult]);

  const turnLeft = useCallback(() => turn('L'), [turn]);
  const turnRight = useCallback(() => turn('R'), [turn]);

  return {
    // Current state
    position: { x: positionX, y: positionY },
    direction,
    currentArrPos,
    iniDir,
    lastTurnDir,
    currentTile,

    // Movement functions
    moveForward,
    moveReverse,
    turnLeft,
    turnRight,
    turn,

    // Movement checks
    canMoveForward,
    canTurnLeft,
    canTurnRight,

    // Map data
    mapData,
  };
}

export default useMovement;
