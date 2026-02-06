// Movement Controller
// Central controller for all player movement operations

import { Direction, Position, TileType } from '../../types/map';
import {
  getTurnDirection,
  getOppositeDirection,
  getNextPosition,
  isVertical,
  TURN_MATRIX,
} from './DirectionUtils';
import {
  getTileAt,
  getPathArray,
  getWalkablePath,
  isBlocked,
  isWalkable,
  checkPerpendicularTiles,
  TILE,
  getTileName,
} from './TileNavigator';

/**
 * Movement state - all the info needed to track player position
 */
export interface MovementState {
  position: Position;
  direction: Direction;
  currentArrPos: number;
  iniDir: boolean;  // Initial direction (clockwise orientation)
  lastTurnDir: 'L' | 'R' | '';
}

/**
 * Map data needed for movement calculations
 */
export interface MapData {
  tiles: TileType[][];       // Horizontal [y][x]
  verticalTiles: TileType[][]; // Vertical [x][y]
  width: number;
  height: number;
}

/**
 * Result of a movement operation
 */
export interface MovementResult {
  success: boolean;
  newState: MovementState;
  message?: string;
  tileType?: TileType;
}

/**
 * Movement Controller Class
 * Handles all movement calculations and state transitions
 */
export class MovementController {
  private mapData: MapData;

  constructor(mapData: MapData) {
    this.mapData = mapData;
  }

  /**
   * Update map data (when switching maps)
   */
  setMapData(mapData: MapData): void {
    this.mapData = mapData;
  }

  /**
   * Get current tile at position
   */
  getCurrentTile(pos: Position): TileType | null {
    return getTileAt(pos, this.mapData.tiles, this.mapData.width, this.mapData.height);
  }

  /**
   * Check if player can move forward
   */
  canMoveForward(state: MovementState): boolean {
    return !isBlocked(
      state.position,
      state.direction,
      this.mapData.tiles,
      this.mapData.width,
      this.mapData.height
    );
  }

  /**
   * Move forward one tile
   */
  moveForward(state: MovementState): MovementResult {
    if (!this.canMoveForward(state)) {
      return {
        success: false,
        newState: state,
        message: 'Blocked by wall',
      };
    }

    const newPos = getNextPosition(state.position, state.direction);
    const newArrPos = state.currentArrPos + 1;

    const newState: MovementState = {
      ...state,
      position: newPos,
      currentArrPos: newArrPos,
      lastTurnDir: '',
    };

    return {
      success: true,
      newState,
      tileType: this.getCurrentTile(newPos) ?? undefined,
      message: `Moved ${state.direction} to (${newPos.x}, ${newPos.y})`,
    };
  }

  /**
   * Reverse direction (180-degree turn)
   */
  reverse(state: MovementState): MovementResult {
    const newDirection = getOppositeDirection(state.direction);

    // Get the path array for current direction
    const pathArray = getWalkablePath(
      state.position,
      state.direction,
      this.mapData.tiles,
      this.mapData.verticalTiles
    );

    // Calculate new array position (flip it)
    const newArrPos = Math.max(0, pathArray.length - state.currentArrPos - 1);

    const newState: MovementState = {
      ...state,
      direction: newDirection,
      currentArrPos: newArrPos,
      iniDir: !state.iniDir,
      lastTurnDir: '',
    };

    return {
      success: true,
      newState,
      message: `Reversed from ${state.direction} to ${newDirection}`,
    };
  }

  /**
   * Check if player can turn in a direction
   */
  canTurn(state: MovementState, turnDir: 'L' | 'R'): boolean {
    const currentTile = this.getCurrentTile(state.position);

    // Can always turn if facing a wall (to escape dead ends)
    if (isBlocked(state.position, state.direction, this.mapData.tiles, this.mapData.width, this.mapData.height)) {
      const newDirection = getTurnDirection(state.direction, turnDir);
      const afterTurnPos = getNextPosition(state.position, newDirection);
      return isWalkable(afterTurnPos, this.mapData.tiles, this.mapData.width, this.mapData.height);
    }

    // Check if current tile is a turn or intersection
    if (currentTile === TILE.TURN || currentTile === TILE.THREE_WAY || currentTile === TILE.FOUR_WAY) {
      const newDirection = getTurnDirection(state.direction, turnDir);
      const afterTurnPos = getNextPosition(state.position, newDirection);
      return isWalkable(afterTurnPos, this.mapData.tiles, this.mapData.width, this.mapData.height);
    }

    return false;
  }

  /**
   * Turn left or right
   */
  turn(state: MovementState, turnDir: 'L' | 'R'): MovementResult {
    const newDirection = getTurnDirection(state.direction, turnDir);
    const currentTile = this.getCurrentTile(state.position);

    // Check perpendicular tiles to determine turn validity
    const { leftTile, rightTile } = checkPerpendicularTiles(
      state.position,
      state.direction,
      this.mapData.tiles,
      this.mapData.width,
      this.mapData.height
    );

    const targetTile = turnDir === 'L' ? leftTile : rightTile;

    // Check if turn is blocked
    if (targetTile === null || targetTile === TILE.WALL) {
      // Check if we're at a wall (allowed to turn to escape)
      const facingWall = isBlocked(
        state.position,
        state.direction,
        this.mapData.tiles,
        this.mapData.width,
        this.mapData.height
      );

      if (!facingWall) {
        return {
          success: false,
          newState: state,
          message: `Cannot turn ${turnDir} - blocked`,
        };
      }
    }

    // Calculate new array position based on turn
    const newPathArray = getWalkablePath(
      state.position,
      newDirection,
      this.mapData.tiles,
      this.mapData.verticalTiles
    );

    // Determine new position in the path array
    let newArrPos: number;
    let newIniDir: boolean;

    const wasVertical = isVertical(state.direction);
    const nowVertical = isVertical(newDirection);

    if (wasVertical !== nowVertical) {
      // Axis changed - recalculate position
      if (nowVertical) {
        // Now moving N/S, position based on Y
        newArrPos = state.position.y;
      } else {
        // Now moving E/W, position based on X
        newArrPos = state.position.x;
      }

      // Determine initial direction based on turn direction and facing
      newIniDir = this.calculateNewIniDir(state.direction, newDirection, turnDir, state.iniDir);
    } else {
      // Same axis (shouldn't happen in normal turns, but handle it)
      newArrPos = state.currentArrPos;
      newIniDir = !state.iniDir;
    }

    // Handle 3-way intersection special logic
    if (currentTile === TILE.THREE_WAY) {
      const result = this.handleThreeWayTurn(state, turnDir, newDirection, newPathArray.length);
      newArrPos = result.newArrPos;
      newIniDir = result.newIniDir;
    }

    // Clamp array position to valid range
    newArrPos = Math.max(0, Math.min(newArrPos, newPathArray.length - 1));

    const newState: MovementState = {
      ...state,
      direction: newDirection,
      currentArrPos: newArrPos,
      iniDir: newIniDir,
      lastTurnDir: turnDir,
    };

    return {
      success: true,
      newState,
      tileType: currentTile ?? undefined,
      message: `Turned ${turnDir} from ${state.direction} to ${newDirection}`,
    };
  }

  /**
   * Calculate new initial direction after turning
   */
  private calculateNewIniDir(
    oldDir: Direction,
    newDir: Direction,
    turnDir: 'L' | 'R',
    currentIniDir: boolean
  ): boolean {
    // The iniDir determines rendering order (clockwise vs counter-clockwise)
    // This logic maps the turn to whether we flip the orientation

    // When turning right from N or S, generally keep same iniDir
    // When turning left, generally flip iniDir
    // But this also depends on current iniDir state

    if (oldDir === 'N') {
      return turnDir === 'R' ? true : false;
    } else if (oldDir === 'S') {
      return turnDir === 'R' ? true : false;
    } else if (oldDir === 'E') {
      return turnDir === 'R' ? true : false;
    } else { // W
      return turnDir === 'R' ? true : false;
    }
  }

  /**
   * Handle special 3-way intersection turn logic
   */
  private handleThreeWayTurn(
    state: MovementState,
    turnDir: 'L' | 'R',
    newDirection: Direction,
    pathLength: number
  ): { newArrPos: number; newIniDir: boolean } {
    const pos = state.position;

    // At a 3-way, determine position based on which branch we're taking
    const nowVertical = isVertical(newDirection);

    let newArrPos: number;
    let newIniDir: boolean;

    if (nowVertical) {
      // Taking vertical branch - use Y position
      if (newDirection === 'N') {
        newArrPos = pos.y;
        newIniDir = turnDir === 'R';
      } else {
        newArrPos = pos.y;
        newIniDir = turnDir === 'L';
      }
    } else {
      // Taking horizontal branch - use X position
      if (newDirection === 'E') {
        newArrPos = pos.x;
        newIniDir = turnDir === 'R';
      } else {
        newArrPos = pathLength - 1 - pos.x;
        newIniDir = turnDir === 'L';
      }
    }

    return { newArrPos, newIniDir };
  }

  /**
   * Get available movement options at current position
   */
  getMovementOptions(state: MovementState): {
    canMoveForward: boolean;
    canTurnLeft: boolean;
    canTurnRight: boolean;
    canReverse: boolean;
    currentTile: TileType | null;
    tileName: string;
  } {
    const currentTile = this.getCurrentTile(state.position);

    return {
      canMoveForward: this.canMoveForward(state),
      canTurnLeft: this.canTurn(state, 'L'),
      canTurnRight: this.canTurn(state, 'R'),
      canReverse: true, // Can always reverse
      currentTile,
      tileName: getTileName(currentTile),
    };
  }

  /**
   * Get path tiles ahead of player (for rendering)
   */
  getPathAhead(state: MovementState): TileType[] {
    const fullPath = getPathArray(
      state.position,
      state.direction,
      this.mapData.tiles,
      this.mapData.verticalTiles
    );

    // Filter out walls and get tiles ahead based on direction
    const walkablePath = fullPath.filter(t => t !== TILE.WALL);

    // Reverse for N/W directions to get correct render order
    if (state.direction === 'N' || state.direction === 'W') {
      return [...walkablePath].reverse();
    }

    return walkablePath;
  }
}

/**
 * Create a movement controller instance
 */
export function createMovementController(mapData: MapData): MovementController {
  return new MovementController(mapData);
}
