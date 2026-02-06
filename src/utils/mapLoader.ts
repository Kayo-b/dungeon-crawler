// Map Loader Utility
// Handles loading, validation, and transformation of map data

import {
  MapConfig,
  MapState,
  MapValidationResult,
  TileType,
  Position,
  Direction,
  TILE_NAMES,
  DIRECTION_VECTORS,
  isVerticalDirection,
} from '../types/map';

/**
 * Validates a map configuration for correctness
 */
export function validateMap(config: MapConfig): MapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check dimensions
  if (config.width < 3 || config.height < 3) {
    errors.push(`Map too small: ${config.width}x${config.height}. Minimum is 3x3.`);
  }

  if (config.width > 32 || config.height > 32) {
    warnings.push(`Large map: ${config.width}x${config.height}. May affect performance.`);
  }

  // Check tiles array dimensions
  if (config.tiles.length !== config.height) {
    errors.push(`Tiles array height (${config.tiles.length}) doesn't match config height (${config.height}).`);
  }

  for (let y = 0; y < config.tiles.length; y++) {
    if (config.tiles[y].length !== config.width) {
      errors.push(`Row ${y} width (${config.tiles[y].length}) doesn't match config width (${config.width}).`);
    }
  }

  // Check start position
  if (!isPositionInBounds(config.startPosition, config)) {
    errors.push(`Start position (${config.startPosition.x}, ${config.startPosition.y}) is out of bounds.`);
  } else {
    const startTile = config.tiles[config.startPosition.y]?.[config.startPosition.x];
    if (startTile === 0) {
      errors.push(`Start position (${config.startPosition.x}, ${config.startPosition.y}) is on a wall tile.`);
    }
  }

  // Check for valid tile types
  for (let y = 0; y < config.tiles.length; y++) {
    for (let x = 0; x < config.tiles[y].length; x++) {
      const tile = config.tiles[y][x];
      if (![0, 1, 2, 3, 4].includes(tile)) {
        errors.push(`Invalid tile type ${tile} at (${x}, ${y}).`);
      }
    }
  }

  // Check map connectivity (basic check - corners should connect)
  const turnTiles = findTilesOfType(config, 2);
  const threeWayTiles = findTilesOfType(config, 3);

  if (turnTiles.length === 0 && threeWayTiles.length === 0) {
    warnings.push('Map has no turn or junction tiles.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if a position is within map bounds
 */
export function isPositionInBounds(pos: Position, config: MapConfig): boolean {
  return pos.x >= 0 && pos.x < config.width && pos.y >= 0 && pos.y < config.height;
}

/**
 * Gets the tile type at a given position
 */
export function getTileAt(pos: Position, config: MapConfig): TileType | undefined {
  if (!isPositionInBounds(pos, config)) {
    return undefined;
  }
  return config.tiles[pos.y]?.[pos.x] as TileType;
}

/**
 * Gets the tile type at a given position from the appropriate array based on direction
 */
export function getTileForDirection(
  pos: Position,
  direction: Direction,
  state: MapState
): TileType | undefined {
  if (isVerticalDirection(direction)) {
    // Use vertical array [x][y]
    return state.verticalArray[pos.x]?.[pos.y] as TileType;
  } else {
    // Use horizontal array [y][x]
    return state.horizontalArray[pos.y]?.[pos.x] as TileType;
  }
}

/**
 * Finds all tiles of a specific type
 */
export function findTilesOfType(config: MapConfig, type: TileType): Position[] {
  const positions: Position[] = [];

  for (let y = 0; y < config.tiles.length; y++) {
    for (let x = 0; x < config.tiles[y].length; x++) {
      if (config.tiles[y][x] === type) {
        positions.push({ x, y });
      }
    }
  }

  return positions;
}

/**
 * Transposes the map array (converts rows to columns)
 * Creates vertical array from horizontal array
 */
export function transposeMap(tiles: TileType[][]): TileType[][] {
  if (tiles.length === 0) return [];

  const height = tiles.length;
  const width = tiles[0].length;
  const transposed: TileType[][] = Array.from({ length: width }, () => []);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      transposed[x].push(tiles[y][x]);
    }
  }

  return transposed;
}

/**
 * Loads a map configuration and prepares it for use
 */
export function loadMap(config: MapConfig): MapState {
  const validation = validateMap(config);

  if (!validation.valid) {
    console.error('[MapLoader] Map validation failed:', validation.errors);
    throw new Error(`Invalid map: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn('[MapLoader] Map warnings:', validation.warnings);
  }

  const horizontalArray = config.tiles;
  const verticalArray = transposeMap(config.tiles);

  console.log(`[MapLoader] Loaded map "${config.name}" (${config.width}x${config.height})`);

  return {
    config,
    horizontalArray,
    verticalArray,
  };
}

/**
 * Gets the array (path) for the current direction
 * For N/S movement, returns vertical column at posX
 * For E/W movement, returns horizontal row at posY
 */
export function getPathArray(
  pos: Position,
  direction: Direction,
  state: MapState
): TileType[] {
  if (isVerticalDirection(direction)) {
    return state.verticalArray[pos.x] || [];
  } else {
    return state.horizontalArray[pos.y] || [];
  }
}

/**
 * Gets the filtered path array (no walls) for the current direction
 */
export function getWalkablePath(
  pos: Position,
  direction: Direction,
  state: MapState
): TileType[] {
  const path = getPathArray(pos, direction, state);
  return path.filter(tile => tile !== 0);
}

/**
 * Checks if a move in the given direction is valid
 */
export function canMove(
  pos: Position,
  direction: Direction,
  state: MapState
): boolean {
  const vector = DIRECTION_VECTORS[direction];
  const newPos: Position = {
    x: pos.x + vector.x,
    y: pos.y + vector.y,
  };

  if (!isPositionInBounds(newPos, state.config)) {
    return false;
  }

  const targetTile = getTileAt(newPos, state.config);
  return targetTile !== undefined && targetTile !== 0;
}

/**
 * Gets the next position after moving in a direction
 */
export function getNextPosition(pos: Position, direction: Direction): Position {
  const vector = DIRECTION_VECTORS[direction];
  return {
    x: pos.x + vector.x,
    y: pos.y + vector.y,
  };
}

/**
 * Gets perpendicular tile for turn detection
 * Returns the tile to the left or right of current position
 */
export function getPerpendicularTile(
  pos: Position,
  direction: Direction,
  side: 'L' | 'R',
  state: MapState
): TileType | undefined {
  // When facing N/S, perpendicular is E/W
  // When facing E/W, perpendicular is N/S
  let checkDir: Direction;

  if (direction === 'N') {
    checkDir = side === 'L' ? 'W' : 'E';
  } else if (direction === 'S') {
    checkDir = side === 'L' ? 'E' : 'W';
  } else if (direction === 'E') {
    checkDir = side === 'L' ? 'N' : 'S';
  } else {
    checkDir = side === 'L' ? 'S' : 'N';
  }

  const checkPos = getNextPosition(pos, checkDir);
  return getTileAt(checkPos, state.config);
}

/**
 * Debug helper - prints map to console
 */
export function printMap(state: MapState, playerPos?: Position, playerDir?: Direction): void {
  const dirSymbols: Record<Direction, string> = {
    'N': '^',
    'S': 'v',
    'E': '>',
    'W': '<',
  };

  const tileSymbols: Record<TileType, string> = {
    0: '#',   // Wall
    1: '.',   // Corridor
    2: '+',   // Turn
    3: 'T',   // Three-way
    4: 'X',   // Four-way
    5: 'D',   // Door
    6: 'U',   // Stairs Up
    7: 'd',   // Stairs Down
    8: '!',   // Dead End
  };

  console.log(`\n=== ${state.config.name} (${state.config.width}x${state.config.height}) ===`);

  for (let y = 0; y < state.config.height; y++) {
    let row = '';
    for (let x = 0; x < state.config.width; x++) {
      if (playerPos && playerPos.x === x && playerPos.y === y) {
        row += playerDir ? dirSymbols[playerDir] : '@';
      } else {
        const tile = state.config.tiles[y][x] as TileType;
        row += tileSymbols[tile] || '?';
      }
    }
    console.log(row);
  }
  console.log('');
}
