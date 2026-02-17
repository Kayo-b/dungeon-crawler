// Map Type Definitions
// Defines the structure for dungeon maps and tiles

export type Direction = 'N' | 'S' | 'E' | 'W';

export type TileType =
  | 0  // Wall - impassable
  | 1  // Corridor - straight passage
  | 2  // Turn - corner/junction (2-way)
  | 3  // ThreeWay - T-intersection (3-way)
  | 4  // FourWay - cross intersection (4-way)
  | 5  // Door - passable, can be open/closed
  | 6  // StairsUp - stairs leading to upper level
  | 7  // StairsDown - stairs leading to lower level
  | 8; // DeadEnd - corridor that terminates

export const TILE_NAMES: Record<TileType, string> = {
  0: 'Wall',
  1: 'Corridor',
  2: 'Turn',
  3: 'ThreeWay',
  4: 'FourWay',
  5: 'Door',
  6: 'StairsUp',
  7: 'StairsDown',
  8: 'DeadEnd',
};

// Tile behavior flags
export interface TileBehavior {
  walkable: boolean;       // Can player walk on this tile
  blocksVision: boolean;   // Does this block line of sight
  interactive: boolean;    // Can player interact with this tile
  transition: boolean;     // Does this tile transition to another level
}

export const TILE_BEHAVIORS: Record<TileType, TileBehavior> = {
  0: { walkable: false, blocksVision: true, interactive: false, transition: false },  // Wall
  1: { walkable: true, blocksVision: false, interactive: false, transition: false },  // Corridor
  2: { walkable: true, blocksVision: false, interactive: false, transition: false },  // Turn
  3: { walkable: true, blocksVision: false, interactive: false, transition: false },  // ThreeWay
  4: { walkable: true, blocksVision: false, interactive: false, transition: false },  // FourWay
  5: { walkable: true, blocksVision: false, interactive: true, transition: false },   // Door
  6: { walkable: true, blocksVision: false, interactive: true, transition: true },    // StairsUp
  7: { walkable: true, blocksVision: false, interactive: true, transition: true },    // StairsDown
  8: { walkable: true, blocksVision: false, interactive: false, transition: false },  // DeadEnd
};

export interface Position {
  x: number;
  y: number;
}

export interface MapConfig {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  tiles: TileType[][];  // [row][col] -> [y][x]
  startPosition: Position;
  startDirection: Direction;
  metadata?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    theme?: string;
    author?: string;
    version?: number;
    merchantPosition?: Position;
  };
}

export interface MapState {
  config: MapConfig;
  horizontalArray: TileType[][];  // dg_map equivalent [y][x]
  verticalArray: TileType[][];    // transposed [x][y]
}

// Validation result
export interface MapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Turn direction lookup table
export const TURN_DIRECTIONS: Record<Direction, Record<'L' | 'R', Direction>> = {
  'N': { 'L': 'W', 'R': 'E' },
  'S': { 'L': 'E', 'R': 'W' },
  'E': { 'L': 'N', 'R': 'S' },
  'W': { 'L': 'S', 'R': 'N' },
};

// Opposite directions
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  'N': 'S',
  'S': 'N',
  'E': 'W',
  'W': 'E',
};

// Direction vectors for movement
export const DIRECTION_VECTORS: Record<Direction, Position> = {
  'N': { x: 0, y: -1 },
  'S': { x: 0, y: 1 },
  'E': { x: 1, y: 0 },
  'W': { x: -1, y: 0 },
};

// Check if direction is vertical (N/S) or horizontal (E/W)
export const isVerticalDirection = (dir: Direction): boolean => {
  return dir === 'N' || dir === 'S';
};

export const isHorizontalDirection = (dir: Direction): boolean => {
  return dir === 'E' || dir === 'W';
};
