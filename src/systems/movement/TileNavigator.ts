// Tile Navigator
// Handles tile-specific movement rules and path calculations

import { Direction, Position, TileType, MapState } from '../../types/map';
import { isVertical, getNextPosition, TURN_MATRIX, OPPOSITE } from './DirectionUtils';

/**
 * Tile type constants with names
 */
export const TILE = {
  WALL: 0 as TileType,
  CORRIDOR: 1 as TileType,
  TURN: 2 as TileType,
  THREE_WAY: 3 as TileType,
  FOUR_WAY: 4 as TileType,
  DOOR: 5 as TileType,
  STAIRS_UP: 6 as TileType,
  STAIRS_DOWN: 7 as TileType,
  DEAD_END: 8 as TileType,
};

export const TILE_NAMES: Record<TileType, string> = {
  0: 'Wall',
  1: 'Corridor',
  2: 'Turn',
  3: 'Three-Way',
  4: 'Four-Way',
  5: 'Door',
  6: 'Stairs Up',
  7: 'Stairs Down',
  8: 'Dead End',
};

/**
 * Check if a tile type is walkable
 */
export function isTileWalkable(tile: TileType | null): boolean {
  if (tile === null) return false;
  // All tiles except walls are walkable
  return tile !== TILE.WALL;
}

/**
 * Check if a tile is interactive (doors, stairs)
 */
export function isTileInteractive(tile: TileType | null): boolean {
  if (tile === null) return false;
  return tile === TILE.DOOR || tile === TILE.STAIRS_UP || tile === TILE.STAIRS_DOWN;
}

/**
 * Check if a tile is a transition point (stairs)
 */
export function isTileTransition(tile: TileType | null): boolean {
  if (tile === null) return false;
  return tile === TILE.STAIRS_UP || tile === TILE.STAIRS_DOWN;
}

/**
 * Check if a tile allows turning (junctions, intersections, dead ends)
 */
export function isTileTurnable(tile: TileType | null): boolean {
  if (tile === null) return false;
  return tile === TILE.TURN || tile === TILE.THREE_WAY || tile === TILE.FOUR_WAY || tile === TILE.DEAD_END;
}

/**
 * Get tile at position from map
 */
export function getTileAt(
  pos: Position,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): TileType | null {
  if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) {
    return null;
  }
  return mapTiles[pos.y]?.[pos.x] ?? null;
}

/**
 * Get tile from the appropriate array based on facing direction
 * For N/S movement: use vertical array [x][y]
 * For E/W movement: use horizontal array [y][x]
 */
export function getTileForDirection(
  pos: Position,
  direction: Direction,
  horizontalTiles: TileType[][],  // [y][x]
  verticalTiles: TileType[][]     // [x][y]
): TileType | null {
  if (isVertical(direction)) {
    return verticalTiles[pos.x]?.[pos.y] ?? null;
  } else {
    return horizontalTiles[pos.y]?.[pos.x] ?? null;
  }
}

/**
 * Check if a position is walkable (not a wall or out of bounds)
 */
export function isWalkable(
  pos: Position,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): boolean {
  const tile = getTileAt(pos, mapTiles, mapWidth, mapHeight);
  return isTileWalkable(tile);
}

/**
 * Check if movement in a direction is blocked
 */
export function isBlocked(
  pos: Position,
  direction: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): boolean {
  const nextPos = getNextPosition(pos, direction);
  return !isWalkable(nextPos, mapTiles, mapWidth, mapHeight);
}

/**
 * Get the path array for current position and direction
 * Returns the row or column the player is currently on
 */
export function getPathArray(
  pos: Position,
  direction: Direction,
  horizontalTiles: TileType[][],
  verticalTiles: TileType[][]
): TileType[] {
  if (isVertical(direction)) {
    // Moving N/S: use the vertical column at posX
    return verticalTiles[pos.x] || [];
  } else {
    // Moving E/W: use the horizontal row at posY
    return horizontalTiles[pos.y] || [];
  }
}

/**
 * Get walkable path (filtered to remove walls)
 */
export function getWalkablePath(
  pos: Position,
  direction: Direction,
  horizontalTiles: TileType[][],
  verticalTiles: TileType[][]
): TileType[] {
  const path = getPathArray(pos, direction, horizontalTiles, verticalTiles);
  return path.filter(tile => tile !== TILE.WALL);
}

/**
 * Check if current tile allows turning in a direction
 */
export function canTurnAtTile(
  pos: Position,
  turnDir: 'L' | 'R',
  currentFacing: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): boolean {
  const currentTile = getTileAt(pos, mapTiles, mapWidth, mapHeight);

  // Can only turn on turnable tiles (turns, intersections, dead ends)
  // Corridors and doors don't allow turning mid-tile
  if (!isTileTurnable(currentTile)) {
    return false;
  }

  // Check if there's a path in the turn direction
  const newDirection = TURN_MATRIX[currentFacing][turnDir];
  const nextPos = getNextPosition(pos, newDirection);

  return isWalkable(nextPos, mapTiles, mapWidth, mapHeight);
}

/**
 * Get available turn directions at current position
 */
export function getAvailableTurns(
  pos: Position,
  currentFacing: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): { left: boolean; right: boolean } {
  return {
    left: canTurnAtTile(pos, 'L', currentFacing, mapTiles, mapWidth, mapHeight),
    right: canTurnAtTile(pos, 'R', currentFacing, mapTiles, mapWidth, mapHeight),
  };
}

/**
 * Check perpendicular tiles for turn detection
 * Returns what's to the left and right of the player
 */
export function checkPerpendicularTiles(
  pos: Position,
  facing: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): { leftTile: TileType | null; rightTile: TileType | null } {
  const leftDir = TURN_MATRIX[facing]['L'];
  const rightDir = TURN_MATRIX[facing]['R'];

  const leftPos = getNextPosition(pos, leftDir);
  const rightPos = getNextPosition(pos, rightDir);

  return {
    leftTile: getTileAt(leftPos, mapTiles, mapWidth, mapHeight),
    rightTile: getTileAt(rightPos, mapTiles, mapWidth, mapHeight),
  };
}

/**
 * Determine tile visual type based on connections
 * Used for rendering the correct turn tile (left/right)
 */
export function determineTurnVisual(
  pos: Position,
  facing: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): 'left' | 'right' | 'threeway' | 'corridor' | 'wall' {
  const currentTile = getTileAt(pos, mapTiles, mapWidth, mapHeight);

  if (currentTile === TILE.WALL) return 'wall';
  if (currentTile === TILE.CORRIDOR) return 'corridor';

  const { leftTile, rightTile } = checkPerpendicularTiles(
    pos, facing, mapTiles, mapWidth, mapHeight
  );

  const hasLeft = leftTile !== null && leftTile !== TILE.WALL;
  const hasRight = rightTile !== null && rightTile !== TILE.WALL;

  if (currentTile === TILE.THREE_WAY || (hasLeft && hasRight)) {
    return 'threeway';
  }

  if (hasRight && !hasLeft) return 'right';
  if (hasLeft && !hasRight) return 'left';

  // Default based on current tile type
  return currentTile === TILE.TURN ? 'right' : 'corridor';
}

/**
 * Calculate array position after turning
 * This is the complex logic that determines where in the new path array
 * the player should be after turning
 */
export function calculateTurnPosition(
  pos: Position,
  currentArrPos: number,
  currentFacing: Direction,
  newFacing: Direction,
  turnDir: 'L' | 'R',
  pathLength: number,
  iniDir: boolean
): { newArrPos: number; newIniDir: boolean } {
  // When turning, we need to figure out our position in the new path
  // This depends on which way we turned and our current orientation

  // For N/S movement, position in array is based on Y
  // For E/W movement, position in array is based on X

  const wasVertical = isVertical(currentFacing);
  const nowVertical = isVertical(newFacing);

  // If we were moving vertically and now horizontal (or vice versa)
  // our position reference changes from Y to X (or vice versa)

  let newArrPos: number;
  let newIniDir: boolean;

  if (wasVertical && !nowVertical) {
    // Was N/S, now E/W - use X position
    newArrPos = pos.x;
    // Determine initial direction based on turn
    if (turnDir === 'R') {
      newIniDir = currentFacing === 'N' ? true : false;
    } else {
      newIniDir = currentFacing === 'N' ? false : true;
    }
  } else if (!wasVertical && nowVertical) {
    // Was E/W, now N/S - use Y position
    newArrPos = pos.y;
    // Determine initial direction based on turn
    if (turnDir === 'R') {
      newIniDir = currentFacing === 'E' ? true : false;
    } else {
      newIniDir = currentFacing === 'E' ? false : true;
    }
  } else {
    // Same axis (shouldn't happen in normal turns)
    newArrPos = currentArrPos;
    newIniDir = !iniDir;
  }

  return { newArrPos, newIniDir };
}

/**
 * Calculate position after reversing (180-degree turn)
 */
export function calculateReversePosition(
  currentArrPos: number,
  pathLength: number,
  iniDir: boolean
): { newArrPos: number; newIniDir: boolean } {
  // When reversing, we flip our position in the array
  // and invert the initial direction
  const newArrPos = pathLength - currentArrPos - 1;
  return {
    newArrPos: Math.max(0, newArrPos),
    newIniDir: !iniDir,
  };
}

/**
 * Get the tile type name
 */
export function getTileName(type: TileType | null): string {
  if (type === null) return 'Out of Bounds';
  return TILE_NAMES[type] || `Unknown(${type})`;
}
