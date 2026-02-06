// Tile Renderer
// Generates tile resources for rendering based on position and direction

import { Direction, Position, TileType } from '../../types/map';
import { isVertical, TURN_MATRIX } from './DirectionUtils';
import { getTileAt, getPathArray, TILE, checkPerpendicularTiles } from './TileNavigator';

/**
 * Tile resources (images) - these match the requires in Room.tsx
 */
export interface TileResources {
  corridor: any;      // corridorTile
  turnLeft: any;      // turnTileLeft
  turnRight: any;     // turnTileRight
  threeWay: any;      // turnThreeWay
  fourWay?: any;      // fourWay intersection (optional, falls back to threeWay)
  wall: any;          // facingWallTile
  door?: any;         // door tile (optional, falls back to corridor)
  doorOpen?: any;     // open door tile (optional)
  stairsUp?: any;     // stairs up tile (optional, falls back to corridor)
  stairsDown?: any;   // stairs down tile (optional, falls back to corridor)
  deadEnd?: any;      // dead end tile (optional, falls back to wall)
}

/**
 * Result of tile generation
 */
export interface TileRenderResult {
  tiles: any[];           // Array of tile resources to render
  pathArray: TileType[];  // The underlying tile types
  facingWall: boolean;    // Whether player is facing a wall
}

/**
 * Determine which tile image to use based on tile type and context
 */
export function getTileResource(
  tileType: TileType,
  pos: Position,
  index: number,
  facing: Direction,
  iniDir: boolean,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number,
  resources: TileResources
): any {
  // Wall tile
  if (tileType === TILE.WALL) {
    return resources.wall;
  }

  // Corridor tile
  if (tileType === TILE.CORRIDOR) {
    return resources.corridor;
  }

  // Door tile
  if (tileType === TILE.DOOR) {
    // Use door resource if available, otherwise fall back to corridor
    return resources.door || resources.corridor;
  }

  // Stairs Up
  if (tileType === TILE.STAIRS_UP) {
    return resources.stairsUp || resources.corridor;
  }

  // Stairs Down
  if (tileType === TILE.STAIRS_DOWN) {
    return resources.stairsDown || resources.corridor;
  }

  // Dead End - shows as a wall at the end
  if (tileType === TILE.DEAD_END) {
    return resources.deadEnd || resources.wall;
  }

  // Turn or intersection - need to check perpendicular tiles
  const { leftTile, rightTile } = checkPerpendicularTiles(
    pos, facing, mapTiles, mapWidth, mapHeight
  );

  const hasLeft = leftTile !== null && leftTile !== TILE.WALL;
  const hasRight = rightTile !== null && rightTile !== TILE.WALL;

  // Three-way intersection
  if (tileType === TILE.THREE_WAY) {
    if (hasLeft && hasRight) {
      return resources.threeWay;
    }
    // Only one direction available - show as turn
    if (hasRight) return resources.turnRight;
    if (hasLeft) return resources.turnLeft;
    return resources.threeWay; // Default
  }

  // Four-way intersection
  if (tileType === TILE.FOUR_WAY) {
    // Use fourWay if available, otherwise threeWay
    return resources.fourWay || resources.threeWay;
  }

  // Regular turn (type 2)
  if (tileType === TILE.TURN) {
    // Determine turn direction based on perpendicular connections
    if (hasRight && !hasLeft) {
      return resources.turnRight;
    }
    if (hasLeft && !hasRight) {
      return resources.turnLeft;
    }

    // Both or neither - use iniDir to determine
    return iniDir ? resources.turnRight : resources.turnLeft;
  }

  // Default to corridor
  return resources.corridor;
}

/**
 * Generate tile resources for rendering
 * This replaces the complex generateMapResources function
 */
export function generateTileResources(
  position: Position,
  direction: Direction,
  currentArrPos: number,
  iniDir: boolean,
  mapTiles: TileType[][],
  verticalTiles: TileType[][],
  mapWidth: number,
  mapHeight: number,
  resources: TileResources
): TileRenderResult {
  // Get the path array for current direction
  const pathArray = getPathArray(position, direction, mapTiles, verticalTiles);

  // Filter out walls to get walkable path
  const walkablePath = pathArray.filter(t => t !== TILE.WALL);

  // Check if facing a wall
  const nextPos = getNextPositionForDirection(position, direction);
  const nextTile = getTileAt(nextPos, mapTiles, mapWidth, mapHeight);
  const facingWall = nextTile === null || nextTile === TILE.WALL;

  // Generate tile resources
  const tiles: any[] = [];

  // Reverse array for N/W directions (to show tiles in correct perspective order)
  let orderedPath = [...walkablePath];
  if (direction === 'N' || direction === 'W') {
    orderedPath = orderedPath.reverse();
  }

  // Start from current array position
  for (let i = currentArrPos; i < orderedPath.length; i++) {
    const tileType = orderedPath[i];

    // Calculate the position of this tile in the map
    const tilePos = calculateTilePosition(position, direction, i - currentArrPos, mapWidth, mapHeight);

    const resource = getTileResource(
      tileType,
      tilePos,
      i,
      direction,
      iniDir,
      mapTiles,
      mapWidth,
      mapHeight,
      resources
    );

    if (resource) {
      tiles.push(resource);
    }
  }

  // If facing wall, add wall tile at the start
  if (facingWall && tiles.length === 0) {
    tiles.push(resources.wall);
  }

  return {
    tiles,
    pathArray: walkablePath,
    facingWall,
  };
}

/**
 * Get next position in a direction
 */
function getNextPositionForDirection(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'N': return { x: pos.x, y: pos.y - 1 };
    case 'S': return { x: pos.x, y: pos.y + 1 };
    case 'E': return { x: pos.x + 1, y: pos.y };
    case 'W': return { x: pos.x - 1, y: pos.y };
  }
}

/**
 * Calculate the map position of a tile at a given distance ahead
 */
function calculateTilePosition(
  playerPos: Position,
  direction: Direction,
  distance: number,
  mapWidth: number,
  mapHeight: number
): Position {
  switch (direction) {
    case 'N':
      return { x: playerPos.x, y: Math.max(0, playerPos.y - distance) };
    case 'S':
      return { x: playerPos.x, y: Math.min(mapHeight - 1, playerPos.y + distance) };
    case 'E':
      return { x: Math.min(mapWidth - 1, playerPos.x + distance), y: playerPos.y };
    case 'W':
      return { x: Math.max(0, playerPos.x - distance), y: playerPos.y };
  }
}

/**
 * Simplified turn visual determination
 * Returns which turn tile to show based on position and direction
 */
export function determineTurnTile(
  position: Position,
  facing: Direction,
  turnDir: 'L' | 'R',
  iniDir: boolean,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number,
  resources: TileResources
): any {
  const { leftTile, rightTile } = checkPerpendicularTiles(
    position, facing, mapTiles, mapWidth, mapHeight
  );

  const hasLeft = leftTile !== null && leftTile !== TILE.WALL;
  const hasRight = rightTile !== null && rightTile !== TILE.WALL;

  // Both directions open - three-way
  if (hasLeft && hasRight) {
    return resources.threeWay;
  }

  // Only turning direction open
  if (turnDir === 'L' && hasLeft) {
    return resources.turnLeft;
  }
  if (turnDir === 'R' && hasRight) {
    return resources.turnRight;
  }

  // Fallback based on iniDir
  return iniDir ? resources.turnRight : resources.turnLeft;
}
