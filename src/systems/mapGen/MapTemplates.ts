// Map Templates
// Predefined map patterns and shapes

import { MapConfig, TileType, Direction, Position } from '../../types/map';

/**
 * Template types
 */
export type TemplateType =
  | 'loop'           // Simple rectangular loop
  | 'figure8'        // Figure-8 pattern
  | 'cross'          // Cross/plus shape
  | 'spiral'         // Spiral pattern
  | 'grid'           // Grid with intersections
  | 'corridors'      // Multiple parallel corridors
  | 'rooms'          // Connected rooms
  | 'L-shape'        // L-shaped map
  | 'T-shape'        // T-shaped map
  | 'H-shape';       // H-shaped map

/**
 * Template options
 */
export interface TemplateOptions {
  width: number;
  height: number;
  variant?: number;  // For templates with variations
}

/**
 * Generate a map from a template
 */
export function generateFromTemplate(
  type: TemplateType,
  options: TemplateOptions
): MapConfig {
  const { width, height } = options;

  let tiles: TileType[][];
  let startPos: Position;
  let startDir: Direction;

  switch (type) {
    case 'loop':
      ({ tiles, startPos, startDir } = generateLoop(width, height));
      break;
    case 'figure8':
      ({ tiles, startPos, startDir } = generateFigure8(width, height));
      break;
    case 'cross':
      ({ tiles, startPos, startDir } = generateCross(width, height));
      break;
    case 'spiral':
      ({ tiles, startPos, startDir } = generateSpiral(width, height));
      break;
    case 'grid':
      ({ tiles, startPos, startDir } = generateGrid(width, height));
      break;
    case 'corridors':
      ({ tiles, startPos, startDir } = generateCorridors(width, height));
      break;
    case 'rooms':
      ({ tiles, startPos, startDir } = generateRooms(width, height));
      break;
    case 'L-shape':
      ({ tiles, startPos, startDir } = generateLShape(width, height));
      break;
    case 'T-shape':
      ({ tiles, startPos, startDir } = generateTShape(width, height));
      break;
    case 'H-shape':
      ({ tiles, startPos, startDir } = generateHShape(width, height));
      break;
    default:
      ({ tiles, startPos, startDir } = generateLoop(width, height));
  }

  return {
    id: `template-${type}-${Date.now()}`,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} (${width}x${height})`,
    description: `${type} template dungeon`,
    width,
    height,
    tiles,
    startPosition: startPos,
    startDirection: startDir,
    metadata: {
      theme: 'dungeon',
      author: 'template',
      version: 1,
    },
  };
}

/**
 * Simple rectangular loop
 */
function generateLoop(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);

  // Top edge
  tiles[0][0] = 2; // NW corner
  for (let x = 1; x < width - 1; x++) {
    tiles[0][x] = 1;
  }
  tiles[0][width - 1] = 2; // NE corner

  // Right edge
  for (let y = 1; y < height - 1; y++) {
    tiles[y][width - 1] = 1;
  }

  // Bottom edge
  tiles[height - 1][width - 1] = 2; // SE corner
  for (let x = width - 2; x > 0; x--) {
    tiles[height - 1][x] = 1;
  }
  tiles[height - 1][0] = 2; // SW corner

  // Left edge
  for (let y = height - 2; y > 0; y--) {
    tiles[y][0] = 1;
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * Figure-8 pattern
 */
function generateFigure8(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  // Top loop
  tiles[0][0] = 2;
  for (let x = 1; x < midX; x++) tiles[0][x] = 1;
  tiles[0][midX] = 3; // Center top - 3-way
  for (let x = midX + 1; x < width - 1; x++) tiles[0][x] = 1;
  tiles[0][width - 1] = 2;

  // Middle row
  tiles[midY][0] = 2;
  for (let x = 1; x < midX; x++) tiles[midY][x] = 1;
  tiles[midY][midX] = 3; // Center - 3-way
  for (let x = midX + 1; x < width - 1; x++) tiles[midY][x] = 1;
  tiles[midY][width - 1] = 2;

  // Bottom row
  tiles[height - 1][0] = 2;
  for (let x = 1; x < midX; x++) tiles[height - 1][x] = 1;
  tiles[height - 1][midX] = 3; // Center bottom - 3-way
  for (let x = midX + 1; x < width - 1; x++) tiles[height - 1][x] = 1;
  tiles[height - 1][width - 1] = 2;

  // Vertical connections
  for (let y = 1; y < midY; y++) {
    tiles[y][0] = 1;
    tiles[y][midX] = 1;
    tiles[y][width - 1] = 1;
  }
  for (let y = midY + 1; y < height - 1; y++) {
    tiles[y][0] = 1;
    tiles[y][midX] = 1;
    tiles[y][width - 1] = 1;
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * Cross/plus shape
 */
function generateCross(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  // Vertical bar
  tiles[0][midX] = 2; // Top
  for (let y = 1; y < height - 1; y++) {
    tiles[y][midX] = y === midY ? 3 : 1; // Center is 3-way
  }
  tiles[height - 1][midX] = 2; // Bottom

  // Horizontal bar
  tiles[midY][0] = 2; // Left
  for (let x = 1; x < width - 1; x++) {
    if (x !== midX) {
      tiles[midY][x] = 1;
    }
  }
  tiles[midY][width - 1] = 2; // Right

  return {
    tiles,
    startPos: { x: midX, y: 0 },
    startDir: 'S',
  };
}

/**
 * Spiral pattern
 */
function generateSpiral(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);

  let x = 0, y = 0;
  let dx = 1, dy = 0;
  let segmentLength = width - 1;
  let segmentPassed = 0;
  let turnCount = 0;

  tiles[y][x] = 2; // Start corner

  while (segmentLength > 0) {
    // Move in current direction
    x += dx;
    y += dy;
    segmentPassed++;

    if (!isInBounds(x, y, width, height)) break;

    // Check if we need to turn
    if (segmentPassed === segmentLength) {
      tiles[y][x] = 2; // Turn corner
      segmentPassed = 0;
      turnCount++;

      // Rotate direction (clockwise inward spiral)
      [dx, dy] = [-dy, dx];

      // Reduce segment length every 2 turns
      if (turnCount % 2 === 0) {
        segmentLength--;
      }
    } else {
      tiles[y][x] = 1; // Corridor
    }
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * Grid with intersections
 */
function generateGrid(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const spacing = 2; // Corridor spacing

  // Create horizontal corridors
  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x++) {
      tiles[y][x] = 1;
    }
  }

  // Create vertical corridors
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y++) {
      tiles[y][x] = tiles[y][x] === 1 ? 3 : 1; // 3-way at intersections
    }
  }

  // Fix corners
  tiles[0][0] = 2;
  tiles[0][width - 1] = 2;
  tiles[height - 1][0] = 2;
  tiles[height - 1][width - 1] = 2;

  // Fix edges (not intersections)
  for (let x = spacing; x < width - 1; x += spacing) {
    if (tiles[0][x] === 3) tiles[0][x] = 3;
    if (tiles[height - 1][x] === 3) tiles[height - 1][x] = 3;
  }
  for (let y = spacing; y < height - 1; y += spacing) {
    if (tiles[y][0] === 3) tiles[y][0] = 3;
    if (tiles[y][width - 1] === 3) tiles[y][width - 1] = 3;
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * Multiple parallel corridors
 */
function generateCorridors(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const numCorridors = Math.floor(height / 2);

  for (let i = 0; i < numCorridors; i++) {
    const y = i * 2;

    // Horizontal corridor
    tiles[y][0] = 2;
    for (let x = 1; x < width - 1; x++) {
      tiles[y][x] = 1;
    }
    tiles[y][width - 1] = 2;

    // Connect to next corridor (alternating sides)
    if (i < numCorridors - 1) {
      const connectX = i % 2 === 0 ? width - 1 : 0;
      tiles[y][connectX] = 3;
      tiles[y + 1][connectX] = 1;
      tiles[y + 2][connectX] = 3;
    }
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * Connected rooms pattern
 */
function generateRooms(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);

  // Create 4 "rooms" (loops) connected by corridors
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // Top-left room
  createRoom(tiles, 0, 0, halfW, halfH);

  // Top-right room
  createRoom(tiles, halfW - 1, 0, width - halfW + 1, halfH);

  // Bottom-left room
  createRoom(tiles, 0, halfH - 1, halfW, height - halfH + 1);

  // Bottom-right room
  createRoom(tiles, halfW - 1, halfH - 1, width - halfW + 1, height - halfH + 1);

  // Connect rooms with 3-ways at intersections
  tiles[0][halfW - 1] = 3;
  tiles[halfH - 1][0] = 3;
  tiles[halfH - 1][width - 1] = 3;
  tiles[height - 1][halfW - 1] = 3;
  tiles[halfH - 1][halfW - 1] = 3; // Center

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * L-shaped map
 */
function generateLShape(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  // Vertical part (left side, full height)
  tiles[0][0] = 2;
  for (let y = 1; y < height - 1; y++) {
    tiles[y][0] = 1;
  }
  tiles[height - 1][0] = 2;

  // Horizontal part (bottom, from left to right)
  for (let x = 1; x < width - 1; x++) {
    tiles[height - 1][x] = 1;
  }
  tiles[height - 1][width - 1] = 2;

  // Corner connection
  tiles[height - 1][0] = 2;

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'S',
  };
}

/**
 * T-shaped map
 */
function generateTShape(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const midX = Math.floor(width / 2);

  // Top horizontal bar
  tiles[0][0] = 2;
  for (let x = 1; x < width - 1; x++) {
    tiles[0][x] = x === midX ? 3 : 1;
  }
  tiles[0][width - 1] = 2;

  // Vertical stem
  for (let y = 1; y < height - 1; y++) {
    tiles[y][midX] = 1;
  }
  tiles[height - 1][midX] = 2;

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'E',
  };
}

/**
 * H-shaped map
 */
function generateHShape(width: number, height: number): {
  tiles: TileType[][];
  startPos: Position;
  startDir: Direction;
} {
  const tiles = createEmptyMap(width, height);
  const midY = Math.floor(height / 2);

  // Left vertical bar
  tiles[0][0] = 2;
  for (let y = 1; y < height - 1; y++) {
    tiles[y][0] = y === midY ? 3 : 1;
  }
  tiles[height - 1][0] = 2;

  // Right vertical bar
  tiles[0][width - 1] = 2;
  for (let y = 1; y < height - 1; y++) {
    tiles[y][width - 1] = y === midY ? 3 : 1;
  }
  tiles[height - 1][width - 1] = 2;

  // Middle horizontal bar
  for (let x = 1; x < width - 1; x++) {
    tiles[midY][x] = 1;
  }

  return {
    tiles,
    startPos: { x: 0, y: 0 },
    startDir: 'S',
  };
}

// Helper functions

function createEmptyMap(width: number, height: number): TileType[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0 as TileType)
  );
}

function isInBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function createRoom(
  tiles: TileType[][],
  startX: number,
  startY: number,
  width: number,
  height: number
): void {
  const endX = startX + width - 1;
  const endY = startY + height - 1;

  // Top edge
  for (let x = startX; x <= endX; x++) {
    tiles[startY][x] = tiles[startY][x] === 0 ? 1 : tiles[startY][x];
  }
  tiles[startY][startX] = 2;
  tiles[startY][endX] = 2;

  // Bottom edge
  for (let x = startX; x <= endX; x++) {
    tiles[endY][x] = tiles[endY][x] === 0 ? 1 : tiles[endY][x];
  }
  tiles[endY][startX] = 2;
  tiles[endY][endX] = 2;

  // Left edge
  for (let y = startY + 1; y < endY; y++) {
    tiles[y][startX] = tiles[y][startX] === 0 ? 1 : tiles[y][startX];
  }

  // Right edge
  for (let y = startY + 1; y < endY; y++) {
    tiles[y][endX] = tiles[y][endX] === 0 ? 1 : tiles[y][endX];
  }
}

/**
 * Get list of available templates
 */
export function getTemplateList(): Array<{ type: TemplateType; name: string; description: string }> {
  return [
    { type: 'loop', name: 'Loop', description: 'Simple rectangular loop' },
    { type: 'figure8', name: 'Figure 8', description: 'Two connected loops' },
    { type: 'cross', name: 'Cross', description: 'Plus-shaped intersection' },
    { type: 'spiral', name: 'Spiral', description: 'Inward spiral pattern' },
    { type: 'grid', name: 'Grid', description: 'Grid with intersections' },
    { type: 'corridors', name: 'Corridors', description: 'Parallel connected corridors' },
    { type: 'rooms', name: 'Rooms', description: 'Four connected rooms' },
    { type: 'L-shape', name: 'L-Shape', description: 'L-shaped corridor' },
    { type: 'T-shape', name: 'T-Shape', description: 'T-shaped junction' },
    { type: 'H-shape', name: 'H-Shape', description: 'H-shaped double junction' },
  ];
}
