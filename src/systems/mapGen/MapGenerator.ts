// Map Generator
// Procedural dungeon map generation

import { MapConfig, TileType, Direction, Position } from '../../types/map';

/**
 * Map generation options
 */
export interface MapGeneratorOptions {
  width: number;
  height: number;
  seed?: number;

  // Generation parameters
  turnDensity: number;      // 0-1, how often to place turns
  threeWayDensity: number;  // 0-1, how often turns become 3-ways
  fourWayDensity: number;   // 0-1, how often 3-ways become 4-ways
  branchChance: number;     // 0-1, chance to create branches
  loopChance: number;       // 0-1, chance to connect back to existing paths

  // Special tiles
  doorChance: number;       // 0-1, chance to place doors in corridors
  deadEndChance: number;    // 0-1, chance to create dead ends with unique tiles
  stairsCount: number;      // Number of stair pairs (up/down) to place

  // Constraints
  minPathLength: number;    // Minimum corridor length between turns
  maxDeadEnds: number;      // Maximum dead ends allowed
  ensureLoop: boolean;      // Guarantee at least one loop

  // Starting position
  startCorner: 'NW' | 'NE' | 'SW' | 'SE' | 'center' | 'random';
  startDirection: Direction | 'random';
}

/**
 * Default generation options
 */
export const DEFAULT_OPTIONS: MapGeneratorOptions = {
  width: 8,
  height: 8,
  turnDensity: 0.3,
  threeWayDensity: 0.2,
  fourWayDensity: 0.1,
  branchChance: 0.3,
  loopChance: 0.4,
  doorChance: 0.15,
  deadEndChance: 0.2,
  stairsCount: 1,
  minPathLength: 2,
  maxDeadEnds: 4,
  ensureLoop: true,
  startCorner: 'NW',
  startDirection: 'W',
};

/**
 * Preset configurations
 */
export const PRESETS = {
  simple: {
    ...DEFAULT_OPTIONS,
    turnDensity: 0.2,
    threeWayDensity: 0.1,
    fourWayDensity: 0.05,
    branchChance: 0.1,
    loopChance: 0.2,
    doorChance: 0.1,
    deadEndChance: 0.1,
    stairsCount: 1,
  } as MapGeneratorOptions,

  moderate: {
    ...DEFAULT_OPTIONS,
    turnDensity: 0.35,
    threeWayDensity: 0.25,
    fourWayDensity: 0.1,
    branchChance: 0.3,
    loopChance: 0.4,
    doorChance: 0.15,
    deadEndChance: 0.2,
    stairsCount: 1,
  } as MapGeneratorOptions,

  complex: {
    ...DEFAULT_OPTIONS,
    turnDensity: 0.5,
    threeWayDensity: 0.4,
    fourWayDensity: 0.15,
    branchChance: 0.5,
    loopChance: 0.6,
    doorChance: 0.2,
    deadEndChance: 0.25,
    stairsCount: 2,
  } as MapGeneratorOptions,

  maze: {
    ...DEFAULT_OPTIONS,
    turnDensity: 0.6,
    threeWayDensity: 0.5,
    fourWayDensity: 0.2,
    branchChance: 0.7,
    loopChance: 0.3,
    doorChance: 0.25,
    deadEndChance: 0.3,
    stairsCount: 2,
    maxDeadEnds: 8,
  } as MapGeneratorOptions,
};

/**
 * Seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

/**
 * Map Generator Class
 */
export class MapGenerator {
  private options: MapGeneratorOptions;
  private random: SeededRandom;
  private tiles: TileType[][];
  private visited: boolean[][];

  constructor(options: Partial<MapGeneratorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.random = new SeededRandom(this.options.seed);
    this.tiles = [];
    this.visited = [];
  }

  /**
   * Generate a new map
   */
  generate(): MapConfig {
    const { width, height } = this.options;

    // Initialize with walls
    this.tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 0 as TileType)
    );
    this.visited = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => false)
    );

    // Get starting position
    const startPos = this.getStartPosition();
    const startDir = this.getStartDirection();

    // Generate the main path
    this.generatePath(startPos, startDir);

    // Add branches
    this.addBranches();

    // Ensure loops if required
    if (this.options.ensureLoop) {
      this.ensureLoops();
    }

    // Fix corners and intersections
    this.fixIntersections();

    // Place special tiles
    this.placeDoors();
    this.placeStairs();
    this.markDeadEnds();

    // Validate and clean up
    this.cleanup();

    return {
      id: `generated-${Date.now()}`,
      name: `Generated ${width}x${height}`,
      description: 'Procedurally generated dungeon',
      width,
      height,
      tiles: this.tiles,
      startPosition: startPos,
      startDirection: startDir,
      metadata: {
        difficulty: this.calculateDifficulty(),
        theme: 'dungeon',
        author: 'generator',
        version: 1,
      },
    };
  }

  /**
   * Get starting position based on options
   */
  private getStartPosition(): Position {
    const { width, height, startCorner } = this.options;

    switch (startCorner) {
      case 'NW': return { x: 0, y: 0 };
      case 'NE': return { x: width - 1, y: 0 };
      case 'SW': return { x: 0, y: height - 1 };
      case 'SE': return { x: width - 1, y: height - 1 };
      case 'center': return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
      case 'random': return {
        x: this.random.nextInt(1, width - 2),
        y: this.random.nextInt(1, height - 2),
      };
      default: return { x: 0, y: 0 };
    }
  }

  /**
   * Get starting direction based on options
   */
  private getStartDirection(): Direction {
    const { startDirection, startCorner } = this.options;

    if (startDirection !== 'random') {
      return startDirection;
    }

    // Pick a sensible direction based on start corner
    switch (startCorner) {
      case 'NW': return this.random.pick(['E', 'S']);
      case 'NE': return this.random.pick(['W', 'S']);
      case 'SW': return this.random.pick(['E', 'N']);
      case 'SE': return this.random.pick(['W', 'N']);
      default: return this.random.pick(['N', 'S', 'E', 'W']);
    }
  }

  /**
   * Generate a path from a starting point
   */
  private generatePath(start: Position, direction: Direction, depth = 0): void {
    if (depth > 100) return; // Prevent infinite recursion

    let pos = { ...start };
    let dir = direction;
    let pathLength = 0;

    // Place starting tile
    this.setTile(pos, 2); // Start with a turn tile
    this.visited[pos.y][pos.x] = true;

    while (true) {
      // Move in current direction
      const nextPos = this.getNextPosition(pos, dir);

      // Check if we can continue
      if (!this.isValidPosition(nextPos)) {
        // Hit the edge - place a turn if we have enough path
        if (pathLength >= this.options.minPathLength) {
          this.setTile(pos, 2);
        }
        break;
      }

      // Check if position is already used
      if (this.visited[nextPos.y][nextPos.x]) {
        // Connect to existing path (create loop)
        if (this.random.chance(this.options.loopChance)) {
          this.setTile(pos, 3); // Make it a 3-way
          this.setTile(nextPos, 3);
        }
        break;
      }

      // Move to next position
      pos = nextPos;
      pathLength++;
      this.visited[pos.y][pos.x] = true;

      // Decide what to place
      if (pathLength >= this.options.minPathLength && this.random.chance(this.options.turnDensity)) {
        // Place a turn or intersection
        if (this.random.chance(this.options.threeWayDensity)) {
          this.setTile(pos, 3);

          // Maybe branch
          if (this.random.chance(this.options.branchChance)) {
            const branchDir = this.getPerpendicularDirection(dir);
            this.generatePath(pos, branchDir, depth + 1);
          }
        } else {
          this.setTile(pos, 2);
        }

        // Turn
        dir = this.getTurnDirection(pos, dir);
        pathLength = 0;
      } else {
        // Place corridor
        this.setTile(pos, 1);
      }
    }
  }

  /**
   * Add branches to existing paths
   */
  private addBranches(): void {
    const { width, height } = this.options;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tiles[y][x];

        // Only branch from corridors or turns
        if (tile !== 1 && tile !== 2) continue;

        if (this.random.chance(this.options.branchChance * 0.3)) {
          // Try to create a branch
          const directions: Direction[] = ['N', 'S', 'E', 'W'];

          for (const dir of this.random.pick([directions])) {
            const nextPos = this.getNextPosition({ x, y }, dir);

            if (this.isValidPosition(nextPos) && !this.visited[nextPos.y][nextPos.x]) {
              // Upgrade current tile
              this.setTile({ x, y }, 3);

              // Generate branch
              this.generatePath(nextPos, dir, 50);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Ensure the map has at least one loop
   */
  private ensureLoops(): void {
    const { width, height } = this.options;

    // Find potential connection points
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (this.tiles[y][x] !== 0) continue; // Skip non-walls

        // Check if connecting this would create a loop
        const neighbors = this.getNeighborTiles({ x, y });
        const pathNeighbors = neighbors.filter(n => n.tile !== 0);

        if (pathNeighbors.length >= 2) {
          // This wall separates two paths - connect them
          this.setTile({ x, y }, 1);

          // Upgrade neighbors to 3-way if needed
          for (const neighbor of pathNeighbors) {
            if (this.tiles[neighbor.pos.y][neighbor.pos.x] === 1) {
              this.setTile(neighbor.pos, 3);
            }
          }

          return; // One loop is enough
        }
      }
    }
  }

  /**
   * Fix intersections and corners
   */
  private fixIntersections(): void {
    const { width, height } = this.options;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tiles[y][x];
        if (tile === 0) continue;

        const neighbors = this.getNeighborTiles({ x, y });
        const pathNeighbors = neighbors.filter(n => n.tile !== 0);

        // Determine correct tile type based on connections
        if (pathNeighbors.length === 1) {
          // Dead end - should be corridor or turn at edge
          this.setTile({ x, y }, 2);
        } else if (pathNeighbors.length === 2) {
          // Check if it's a corner or straight
          const dirs = pathNeighbors.map(n => n.dir);
          const isCorner = (dirs.includes('N') || dirs.includes('S')) &&
                          (dirs.includes('E') || dirs.includes('W'));
          this.setTile({ x, y }, isCorner ? 2 : 1);
        } else if (pathNeighbors.length === 3) {
          this.setTile({ x, y }, 3);
        } else if (pathNeighbors.length === 4) {
          this.setTile({ x, y }, 4 as TileType); // 4-way intersection
        }
      }
    }
  }

  /**
   * Clean up the map
   */
  private cleanup(): void {
    // Ensure corners are properly marked
    const corners = [
      { x: 0, y: 0 },
      { x: this.options.width - 1, y: 0 },
      { x: 0, y: this.options.height - 1 },
      { x: this.options.width - 1, y: this.options.height - 1 },
    ];

    for (const corner of corners) {
      if (this.tiles[corner.y][corner.x] !== 0) {
        this.setTile(corner, 2);
      }
    }
  }

  /**
   * Place doors in corridors
   */
  private placeDoors(): void {
    const { width, height, doorChance } = this.options;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tiles[y][x];

        // Only place doors in corridors (not at turns or intersections)
        if (tile !== 1) continue;

        // Check if this is a good spot for a door (middle of corridor)
        const neighbors = this.getNeighborTiles({ x, y });
        const pathNeighbors = neighbors.filter(n => n.tile !== 0);

        // Doors work best in straight corridors (2 neighbors in opposite directions)
        if (pathNeighbors.length !== 2) continue;

        const dirs = pathNeighbors.map(n => n.dir);
        const isStraight = (dirs.includes('N') && dirs.includes('S')) ||
                          (dirs.includes('E') && dirs.includes('W'));

        if (isStraight && this.random.chance(doorChance)) {
          this.setTile({ x, y }, 5 as TileType); // Door
        }
      }
    }
  }

  /**
   * Place stairs (up/down pairs)
   */
  private placeStairs(): void {
    const { width, height, stairsCount } = this.options;

    // Find all valid positions for stairs (dead ends or corners are ideal)
    const validPositions: Position[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tiles[y][x];

        // Stairs can go in corridors, turns, or dead ends
        if (tile === 0 || tile === 3 || tile === 4 || tile === 5) continue;

        // Prefer positions with only 1-2 neighbors (dead ends or corners)
        const neighbors = this.getNeighborTiles({ x, y });
        const pathNeighbors = neighbors.filter(n => n.tile !== 0);

        if (pathNeighbors.length <= 2) {
          validPositions.push({ x, y });
        }
      }
    }

    // Place stair pairs
    for (let i = 0; i < stairsCount && validPositions.length >= 2; i++) {
      // Pick random positions for up and down stairs
      const upIdx = this.random.nextInt(0, validPositions.length - 1);
      const upPos = validPositions.splice(upIdx, 1)[0];

      // Pick a different position for down stairs (preferably far from up)
      let bestDownIdx = 0;
      let maxDist = 0;
      for (let j = 0; j < validPositions.length; j++) {
        const pos = validPositions[j];
        const dist = Math.abs(pos.x - upPos.x) + Math.abs(pos.y - upPos.y);
        if (dist > maxDist) {
          maxDist = dist;
          bestDownIdx = j;
        }
      }

      const downPos = validPositions.splice(bestDownIdx, 1)[0];

      this.setTile(upPos, 6 as TileType);   // Stairs Up
      this.setTile(downPos, 7 as TileType); // Stairs Down
    }
  }

  /**
   * Mark dead ends with special tile type
   */
  private markDeadEnds(): void {
    const { width, height, deadEndChance } = this.options;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tiles[y][x];

        // Skip walls, doors, and stairs
        if (tile === 0 || tile === 5 || tile === 6 || tile === 7) continue;

        // Check if this is a dead end (only 1 path neighbor)
        const neighbors = this.getNeighborTiles({ x, y });
        const pathNeighbors = neighbors.filter(n => n.tile !== 0);

        if (pathNeighbors.length === 1 && this.random.chance(deadEndChance)) {
          this.setTile({ x, y }, 8 as TileType); // Dead End
        }
      }
    }
  }

  /**
   * Calculate map difficulty
   */
  private calculateDifficulty(): 'easy' | 'medium' | 'hard' {
    let turns = 0;
    let threeWays = 0;
    let fourWays = 0;
    let doors = 0;
    let stairs = 0;
    let deadEnds = 0;

    for (const row of this.tiles) {
      for (const tile of row) {
        if (tile === 2) turns++;
        if (tile === 3) threeWays++;
        if (tile === 4) fourWays++;
        if (tile === 5) doors++;
        if (tile === 6 || tile === 7) stairs++;
        if (tile === 8) deadEnds++;
      }
    }

    // Complexity considers intersections, special tiles, and dead ends
    const intersectionScore = turns + threeWays * 2 + fourWays * 3;
    const specialScore = doors * 0.5 + stairs * 1 + deadEnds * 0.5;
    const complexity = (intersectionScore + specialScore) / (this.options.width * this.options.height);

    if (complexity < 0.15) return 'easy';
    if (complexity < 0.25) return 'medium';
    return 'hard';
  }

  // Helper methods

  private setTile(pos: Position, type: TileType): void {
    if (this.isValidPosition(pos)) {
      this.tiles[pos.y][pos.x] = type;
    }
  }

  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.options.width &&
           pos.y >= 0 && pos.y < this.options.height;
  }

  private getNextPosition(pos: Position, dir: Direction): Position {
    switch (dir) {
      case 'N': return { x: pos.x, y: pos.y - 1 };
      case 'S': return { x: pos.x, y: pos.y + 1 };
      case 'E': return { x: pos.x + 1, y: pos.y };
      case 'W': return { x: pos.x - 1, y: pos.y };
    }
  }

  private getPerpendicularDirection(dir: Direction): Direction {
    switch (dir) {
      case 'N':
      case 'S':
        return this.random.pick(['E', 'W']);
      case 'E':
      case 'W':
        return this.random.pick(['N', 'S']);
    }
  }

  private getTurnDirection(pos: Position, currentDir: Direction): Direction {
    const perpDirs = currentDir === 'N' || currentDir === 'S'
      ? ['E', 'W'] as Direction[]
      : ['N', 'S'] as Direction[];

    // Prefer direction that leads to open space
    for (const dir of perpDirs) {
      const nextPos = this.getNextPosition(pos, dir);
      if (this.isValidPosition(nextPos) && !this.visited[nextPos.y][nextPos.x]) {
        return dir;
      }
    }

    return this.random.pick(perpDirs);
  }

  private getNeighborTiles(pos: Position): Array<{ pos: Position; tile: TileType; dir: Direction }> {
    const neighbors: Array<{ pos: Position; tile: TileType; dir: Direction }> = [];
    const directions: Direction[] = ['N', 'S', 'E', 'W'];

    for (const dir of directions) {
      const nextPos = this.getNextPosition(pos, dir);
      if (this.isValidPosition(nextPos)) {
        neighbors.push({
          pos: nextPos,
          tile: this.tiles[nextPos.y][nextPos.x],
          dir,
        });
      }
    }

    return neighbors;
  }
}

/**
 * Generate a map with the given options
 */
export function generateMap(options: Partial<MapGeneratorOptions> = {}): MapConfig {
  const generator = new MapGenerator(options);
  return generator.generate();
}

/**
 * Generate a map from a preset
 */
export function generateFromPreset(
  preset: keyof typeof PRESETS,
  overrides: Partial<MapGeneratorOptions> = {}
): MapConfig {
  const options = { ...PRESETS[preset], ...overrides };
  return generateMap(options);
}
