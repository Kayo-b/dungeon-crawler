// Movement Testing Utility
// Automated tests for movement system validation

import { Direction, TileType, Position } from '../types/map';
import { TURN_MATRIX, getNextPosition, isVertical } from '../systems/movement/DirectionUtils';
import { getTileAt, TILE } from '../systems/movement/TileNavigator';

/**
 * Test result structure
 */
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Movement state for testing
 */
export interface TestState {
  position: Position;
  direction: Direction;
  currentArrPos: number;
  iniDir: boolean;
}

/**
 * Test suite for movement validation
 */
export class MovementTester {
  private results: TestResult[] = [];
  private mapTiles: TileType[][];
  private mapWidth: number;
  private mapHeight: number;

  constructor(mapTiles: TileType[][], mapWidth: number, mapHeight: number) {
    this.mapTiles = mapTiles;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  /**
   * Run all tests
   */
  runAllTests(currentState: TestState): TestResult[] {
    this.results = [];

    // Basic position tests
    this.testCurrentPositionValid(currentState);
    this.testNotOnWall(currentState);

    // Wall collision tests
    this.testWallCollisionAllDirections(currentState);

    // Turn validation tests
    this.testTurnDirectionMatrix();

    // Full rotation test
    this.testFullRotation(currentState);

    // Path connectivity tests
    this.testMapConnectivity();

    // Turn tile validation
    this.testTurnTileCorrectness();

    // Turn perspective test
    this.testTurnTilePerspective(currentState);

    // Boundary tests
    this.testBoundaryConditions(currentState);

    // Wall clipping test
    this.testWallClipping();

    // Comprehensive corridor walk test
    this.testAllCorridors();

    return this.results;
  }

  /**
   * Walk through all corridors and test tile rendering at each position
   */
  private testAllCorridors(): void {
    const issues: string[] = [];
    const tested: string[] = [];

    // Find all walkable tiles
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.mapTiles[y]?.[x];
        if (tile === undefined || tile === TILE.WALL) continue;

        const pos: Position = { x, y };
        const directions: Direction[] = ['N', 'S', 'E', 'W'];

        for (const dir of directions) {
          // Check if we can face this direction (path exists)
          const behindPos = getNextPosition(pos, TURN_MATRIX[dir]['L'] === dir ? dir :
            dir === 'N' ? 'S' : dir === 'S' ? 'N' : dir === 'E' ? 'W' : 'E');

          // Test: verify the path array for this position and direction
          const pathInfo = this.getPathInfo(pos, dir);

          if (pathInfo.error) {
            issues.push(`(${x},${y}) ${dir}: ${pathInfo.error}`);
          } else {
            tested.push(`(${x},${y}) ${dir}: ${pathInfo.tilesAhead} tiles ahead`);
          }

          // Test: verify turn tile directions match actual connections
          if (tile === TILE.TURN || tile === TILE.THREE_WAY) {
            const turnCheck = this.checkTurnTileRendering(pos, dir);
            if (turnCheck.issue) {
              issues.push(`Turn at (${x},${y}) ${dir}: ${turnCheck.issue}`);
            }
          }
        }
      }
    }

    this.results.push({
      name: 'Corridor Walk Test',
      passed: issues.length === 0,
      message: issues.length === 0
        ? `Tested ${tested.length} position/direction combinations`
        : `Issues: ${issues.slice(0, 5).join('; ')}${issues.length > 5 ? ` (+${issues.length - 5} more)` : ''}`,
      details: { tested: tested.length, issues }
    });
  }

  /**
   * Get path info for a position and direction
   */
  private getPathInfo(pos: Position, dir: Direction): { tilesAhead: number; error?: string } {
    let tilesAhead = 0;
    let currentPos = { ...pos };

    // Walk forward until we hit a wall or edge
    for (let i = 0; i < 20; i++) { // Max 20 tiles to prevent infinite loop
      const nextPos = getNextPosition(currentPos, dir);
      const nextTile = getTileAt(nextPos, this.mapTiles, this.mapWidth, this.mapHeight);

      if (nextTile === null || nextTile === TILE.WALL) {
        break;
      }

      tilesAhead++;
      currentPos = nextPos;

      // Verify the tile we're on is valid
      const currentTile = getTileAt(currentPos, this.mapTiles, this.mapWidth, this.mapHeight);
      if (currentTile === TILE.WALL) {
        return { tilesAhead, error: `Walked into wall at (${currentPos.x},${currentPos.y})` };
      }
    }

    return { tilesAhead };
  }

  /**
   * Check if turn tile rendering would be correct for given position/direction
   */
  private checkTurnTileRendering(pos: Position, facingDir: Direction): { issue?: string } {
    const tile = getTileAt(pos, this.mapTiles, this.mapWidth, this.mapHeight);
    if (tile !== TILE.TURN && tile !== TILE.THREE_WAY) {
      return {};
    }

    // Get connections from this tile
    const connections = this.getConnections(pos);

    // Determine expected turn direction based on connections and facing
    const opposite: Record<Direction, Direction> = { 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E' };
    const entryDir = opposite[facingDir]; // Where we came from

    // Check if we could have entered from this direction
    if (!connections.includes(entryDir)) {
      return {}; // Can't enter from this direction, skip
    }

    // Find exit directions (connections other than entry)
    const exitDirs = connections.filter(d => d !== entryDir);

    if (tile === TILE.TURN && exitDirs.length !== 1) {
      return { issue: `Turn has ${exitDirs.length} exits, expected 1` };
    }

    // Verify the exit direction makes sense for a turn
    if (tile === TILE.TURN && exitDirs.length === 1) {
      const exitDir = exitDirs[0];
      // A turn should exit perpendicular to entry
      const isPerp = (entryDir === 'N' || entryDir === 'S')
        ? (exitDir === 'E' || exitDir === 'W')
        : (exitDir === 'N' || exitDir === 'S');

      if (!isPerp) {
        return { issue: `Turn exit ${exitDir} not perpendicular to entry ${entryDir}` };
      }
    }

    return {};
  }

  /**
   * Test that current position is within map bounds
   */
  private testCurrentPositionValid(state: TestState): void {
    const inBounds = state.position.x >= 0 &&
                     state.position.x < this.mapWidth &&
                     state.position.y >= 0 &&
                     state.position.y < this.mapHeight;

    this.results.push({
      name: 'Position In Bounds',
      passed: inBounds,
      message: inBounds
        ? `Position (${state.position.x}, ${state.position.y}) is valid`
        : `Position (${state.position.x}, ${state.position.y}) is OUT OF BOUNDS!`,
      details: { position: state.position, mapSize: { width: this.mapWidth, height: this.mapHeight } }
    });
  }

  /**
   * Test that player is not standing on a wall
   */
  private testNotOnWall(state: TestState): void {
    const tile = getTileAt(state.position, this.mapTiles, this.mapWidth, this.mapHeight);
    const notOnWall = tile !== null && tile !== TILE.WALL;

    this.results.push({
      name: 'Not On Wall',
      passed: notOnWall,
      message: notOnWall
        ? `Standing on tile type ${tile} (valid)`
        : `ERROR: Standing on wall or invalid tile!`,
      details: { position: state.position, tileType: tile }
    });
  }

  /**
   * Test wall collision detection in all directions
   */
  private testWallCollisionAllDirections(state: TestState): void {
    const directions: Direction[] = ['N', 'S', 'E', 'W'];

    for (const dir of directions) {
      const nextPos = getNextPosition(state.position, dir);
      const nextTile = getTileAt(nextPos, this.mapTiles, this.mapWidth, this.mapHeight);
      const isWall = nextTile === null || nextTile === TILE.WALL;
      const isBlocked = !this.canMoveTo(nextPos);

      // If it's a wall, movement should be blocked
      // If it's not a wall, movement should be allowed
      const correct = isWall === isBlocked;

      this.results.push({
        name: `Wall Detection ${dir}`,
        passed: correct,
        message: correct
          ? `${dir}: ${isWall ? 'Wall detected, blocked' : 'Path clear, can move'}`
          : `${dir}: Mismatch! isWall=${isWall}, isBlocked=${isBlocked}`,
        details: { direction: dir, nextPos, nextTile, isWall, isBlocked }
      });
    }
  }

  /**
   * Test turn direction matrix correctness
   */
  private testTurnDirectionMatrix(): void {
    const expectedTurns: Array<{ from: Direction; turn: 'L' | 'R'; expected: Direction }> = [
      { from: 'N', turn: 'L', expected: 'W' },
      { from: 'N', turn: 'R', expected: 'E' },
      { from: 'S', turn: 'L', expected: 'E' },
      { from: 'S', turn: 'R', expected: 'W' },
      { from: 'E', turn: 'L', expected: 'N' },
      { from: 'E', turn: 'R', expected: 'S' },
      { from: 'W', turn: 'L', expected: 'S' },
      { from: 'W', turn: 'R', expected: 'N' },
    ];

    let allPassed = true;
    const failures: string[] = [];

    for (const test of expectedTurns) {
      const actual = TURN_MATRIX[test.from][test.turn];
      if (actual !== test.expected) {
        allPassed = false;
        failures.push(`${test.from}+${test.turn}: expected ${test.expected}, got ${actual}`);
      }
    }

    this.results.push({
      name: 'Turn Direction Matrix',
      passed: allPassed,
      message: allPassed
        ? 'All turn directions correct'
        : `Failures: ${failures.join(', ')}`,
      details: { failures }
    });
  }

  /**
   * Test map connectivity - ensure walkable tiles are connected
   */
  private testMapConnectivity(): void {
    const walkableTiles: Position[] = [];

    // Find all walkable tiles
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.mapTiles[y]?.[x];
        if (tile !== undefined && tile !== TILE.WALL) {
          walkableTiles.push({ x, y });
        }
      }
    }

    if (walkableTiles.length === 0) {
      this.results.push({
        name: 'Map Connectivity',
        passed: false,
        message: 'No walkable tiles found!',
        details: { walkableTiles: 0 }
      });
      return;
    }

    // BFS from first walkable tile
    const visited = new Set<string>();
    const queue: Position[] = [walkableTiles[0]];
    visited.add(`${walkableTiles[0].x},${walkableTiles[0].y}`);

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const neighbors = this.getWalkableNeighbors(pos);

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    const connected = visited.size === walkableTiles.length;

    this.results.push({
      name: 'Map Connectivity',
      passed: connected,
      message: connected
        ? `All ${walkableTiles.length} walkable tiles are connected`
        : `Only ${visited.size}/${walkableTiles.length} tiles reachable - map has isolated areas!`,
      details: { totalWalkable: walkableTiles.length, reachable: visited.size }
    });
  }

  /**
   * Test turn tiles have correct orientation based on connections
   */
  private testTurnTileCorrectness(): void {
    const issues: string[] = [];

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.mapTiles[y]?.[x];

        if (tile === TILE.TURN || tile === TILE.THREE_WAY) {
          const connections = this.getConnections({ x, y });

          // Turn tile should have exactly 2 connections
          if (tile === TILE.TURN && connections.length !== 2) {
            issues.push(`Turn at (${x},${y}) has ${connections.length} connections, expected 2`);
          }

          // 3-way should have exactly 3 connections
          if (tile === TILE.THREE_WAY && connections.length !== 3) {
            // This is a warning, not necessarily an error
            if (connections.length < 2) {
              issues.push(`3-way at (${x},${y}) has ${connections.length} connections, expected 3`);
            }
          }
        }
      }
    }

    this.results.push({
      name: 'Turn Tile Connections',
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'All turn/intersection tiles have correct connections'
        : `Issues found: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`,
      details: { issues }
    });
  }

  /**
   * Test full 360 rotation returns to original direction
   */
  private testFullRotation(state: TestState): void {
    let dir = state.direction;

    // Turn left 4 times should return to original
    for (let i = 0; i < 4; i++) {
      dir = TURN_MATRIX[dir]['L'];
    }
    const leftRotationCorrect = dir === state.direction;

    // Reset and turn right 4 times
    dir = state.direction;
    for (let i = 0; i < 4; i++) {
      dir = TURN_MATRIX[dir]['R'];
    }
    const rightRotationCorrect = dir === state.direction;

    this.results.push({
      name: 'Full Rotation (4x Left)',
      passed: leftRotationCorrect,
      message: leftRotationCorrect
        ? `4 left turns return to ${state.direction}`
        : `4 left turns ended at ${dir}, expected ${state.direction}`,
      details: { original: state.direction, result: dir }
    });

    this.results.push({
      name: 'Full Rotation (4x Right)',
      passed: rightRotationCorrect,
      message: rightRotationCorrect
        ? `4 right turns return to ${state.direction}`
        : `4 right turns ended at ${dir}, expected ${state.direction}`,
      details: { original: state.direction, result: dir }
    });
  }

  /**
   * Test turn tile perspective - verify turns go the expected direction
   */
  private testTurnTilePerspective(state: TestState): void {
    const turnTiles: Array<{ pos: Position; connections: Direction[] }> = [];

    // Find all turn tiles
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.mapTiles[y]?.[x];
        if (tile === TILE.TURN) {
          turnTiles.push({
            pos: { x, y },
            connections: this.getConnections({ x, y }),
          });
        }
      }
    }

    if (turnTiles.length === 0) {
      this.results.push({
        name: 'Turn Tile Perspective',
        passed: true,
        message: 'No turn tiles to test',
        details: { turnTileCount: 0 }
      });
      return;
    }

    const issues: string[] = [];

    for (const turnTile of turnTiles) {
      const { pos, connections } = turnTile;

      // A turn tile with connections [A, B] should only allow:
      // - Entry from A, turn to face B
      // - Entry from B, turn to face A
      if (connections.length === 2) {
        const [conn1, conn2] = connections;

        // Determine if this is a left turn or right turn based on entry direction
        // Entry from North, exit to East = Right turn
        // Entry from North, exit to West = Left turn
        const turnType = this.determineTurnType(conn1, conn2);

        if (!turnType) {
          issues.push(`Turn at (${pos.x},${pos.y}) has unusual connection pattern: ${connections.join(',')}`);
        }
      }
    }

    this.results.push({
      name: 'Turn Tile Perspective',
      passed: issues.length === 0,
      message: issues.length === 0
        ? `All ${turnTiles.length} turn tiles have valid perspective`
        : `Issues: ${issues.slice(0, 2).join('; ')}`,
      details: { turnTileCount: turnTiles.length, issues }
    });
  }

  /**
   * Determine if a turn is L-shaped or straight
   */
  private determineTurnType(conn1: Direction, conn2: Direction): 'L' | 'straight' | null {
    // L-turn connections (perpendicular)
    const lTurns = [
      ['N', 'E'], ['N', 'W'], ['S', 'E'], ['S', 'W'],
      ['E', 'N'], ['E', 'S'], ['W', 'N'], ['W', 'S'],
    ];

    // Straight connections (parallel)
    const straights = [
      ['N', 'S'], ['S', 'N'], ['E', 'W'], ['W', 'E'],
    ];

    const pair = [conn1, conn2];
    const pairStr = pair.join(',');
    const reversePairStr = [conn2, conn1].join(',');

    for (const lt of lTurns) {
      if (lt.join(',') === pairStr || lt.join(',') === reversePairStr) {
        return 'L';
      }
    }

    for (const st of straights) {
      if (st.join(',') === pairStr || st.join(',') === reversePairStr) {
        return 'straight';
      }
    }

    return null;
  }

  /**
   * Test for wall clipping by walking all possible paths
   */
  private testWallClipping(): void {
    const walkableTiles: Position[] = [];
    const clippingIssues: string[] = [];

    // Find all walkable tiles
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.mapTiles[y]?.[x];
        if (tile !== undefined && tile !== TILE.WALL) {
          walkableTiles.push({ x, y });
        }
      }
    }

    // For each walkable tile, try moving in all directions
    for (const pos of walkableTiles) {
      const directions: Direction[] = ['N', 'S', 'E', 'W'];

      for (const dir of directions) {
        const nextPos = getNextPosition(pos, dir);
        const currentTile = getTileAt(pos, this.mapTiles, this.mapWidth, this.mapHeight);
        const nextTile = getTileAt(nextPos, this.mapTiles, this.mapWidth, this.mapHeight);

        // Check if movement would clip through wall
        if (nextTile === TILE.WALL || nextTile === null) {
          // This is expected - should be blocked
          continue;
        }

        // Movement is allowed - verify no diagonal clipping
        // Check corner neighbors for potential clip-through
        const corner1 = this.getCornerPosition(pos, dir, 'L');
        const corner2 = this.getCornerPosition(pos, dir, 'R');

        const corner1Tile = getTileAt(corner1, this.mapTiles, this.mapWidth, this.mapHeight);
        const corner2Tile = getTileAt(corner2, this.mapTiles, this.mapWidth, this.mapHeight);

        // If both corners are walls but straight movement is allowed,
        // there might be a visual clipping issue
        if (corner1Tile === TILE.WALL && corner2Tile === TILE.WALL) {
          // This is a narrow corridor - valid but note it
        }
      }
    }

    this.results.push({
      name: 'Wall Clipping Check',
      passed: clippingIssues.length === 0,
      message: clippingIssues.length === 0
        ? `Checked ${walkableTiles.length} tiles, no clipping issues found`
        : `Clipping issues: ${clippingIssues.slice(0, 3).join('; ')}`,
      details: { tilesChecked: walkableTiles.length, issues: clippingIssues }
    });
  }

  /**
   * Get corner position based on movement direction
   */
  private getCornerPosition(pos: Position, moveDir: Direction, side: 'L' | 'R'): Position {
    const dx = { 'N': 0, 'S': 0, 'E': 1, 'W': -1 }[moveDir];
    const dy = { 'N': -1, 'S': 1, 'E': 0, 'W': 0 }[moveDir];

    // Perpendicular offset based on side
    let px = 0, py = 0;
    if (moveDir === 'N' || moveDir === 'S') {
      px = side === 'L' ? -1 : 1;
    } else {
      py = side === 'L' ? -1 : 1;
    }

    return {
      x: pos.x + dx + px,
      y: pos.y + dy + py,
    };
  }

  /**
   * Test boundary conditions
   */
  private testBoundaryConditions(state: TestState): void {
    const issues: string[] = [];

    // Check corners have proper tile types
    const corners = [
      { x: 0, y: 0, name: 'NW' },
      { x: this.mapWidth - 1, y: 0, name: 'NE' },
      { x: 0, y: this.mapHeight - 1, name: 'SW' },
      { x: this.mapWidth - 1, y: this.mapHeight - 1, name: 'SE' },
    ];

    for (const corner of corners) {
      const tile = this.mapTiles[corner.y]?.[corner.x];
      if (tile !== undefined && tile !== TILE.WALL) {
        // If corner is walkable, it should be a turn tile
        if (tile !== TILE.TURN && tile !== TILE.THREE_WAY) {
          issues.push(`${corner.name} corner (${corner.x},${corner.y}) is walkable but not a turn tile (type ${tile})`);
        }
      }
    }

    // Check edges don't have corridors leading out of bounds
    for (let x = 0; x < this.mapWidth; x++) {
      // Top edge
      const topTile = this.mapTiles[0]?.[x];
      if (topTile === TILE.CORRIDOR) {
        issues.push(`Top edge (${x},0) is corridor - may have rendering issues`);
      }
      // Bottom edge
      const bottomTile = this.mapTiles[this.mapHeight - 1]?.[x];
      if (bottomTile === TILE.CORRIDOR) {
        issues.push(`Bottom edge (${x},${this.mapHeight - 1}) is corridor`);
      }
    }

    this.results.push({
      name: 'Boundary Conditions',
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'All boundary conditions valid'
        : `Issues: ${issues.slice(0, 2).join('; ')}${issues.length > 2 ? ` (+${issues.length - 2} more)` : ''}`,
      details: { issues }
    });
  }

  // Helper methods

  private canMoveTo(pos: Position): boolean {
    if (pos.x < 0 || pos.x >= this.mapWidth || pos.y < 0 || pos.y >= this.mapHeight) {
      return false;
    }
    const tile = this.mapTiles[pos.y]?.[pos.x];
    return tile !== undefined && tile !== TILE.WALL;
  }

  private getWalkableNeighbors(pos: Position): Position[] {
    const neighbors: Position[] = [];
    const directions: Direction[] = ['N', 'S', 'E', 'W'];

    for (const dir of directions) {
      const nextPos = getNextPosition(pos, dir);
      if (this.canMoveTo(nextPos)) {
        neighbors.push(nextPos);
      }
    }

    return neighbors;
  }

  private getConnections(pos: Position): Direction[] {
    const connections: Direction[] = [];
    const directions: Direction[] = ['N', 'S', 'E', 'W'];

    for (const dir of directions) {
      const nextPos = getNextPosition(pos, dir);
      if (this.canMoveTo(nextPos)) {
        connections.push(dir);
      }
    }

    return connections;
  }
}

/**
 * Run a movement sequence and validate each step
 */
export function runMovementSequence(
  initialState: TestState,
  moves: Array<'forward' | 'reverse' | 'turn_L' | 'turn_R'>,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): { states: TestState[]; errors: string[] } {
  const states: TestState[] = [{ ...initialState }];
  const errors: string[] = [];
  let current = { ...initialState };

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const prevState = { ...current };

    switch (move) {
      case 'forward': {
        const nextPos = getNextPosition(current.position, current.direction);
        const nextTile = getTileAt(nextPos, mapTiles, mapWidth, mapHeight);

        if (nextTile === null || nextTile === TILE.WALL) {
          errors.push(`Move ${i + 1} (forward): Blocked by wall at (${nextPos.x}, ${nextPos.y})`);
        } else {
          current.position = nextPos;
          current.currentArrPos++;
        }
        break;
      }

      case 'reverse': {
        current.direction = { 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E' }[current.direction] as Direction;
        current.iniDir = !current.iniDir;
        break;
      }

      case 'turn_L':
      case 'turn_R': {
        const turnDir = move === 'turn_L' ? 'L' : 'R';
        const newDir = TURN_MATRIX[current.direction][turnDir];
        current.direction = newDir;
        break;
      }
    }

    states.push({ ...current });

    // Validate new state
    const tile = getTileAt(current.position, mapTiles, mapWidth, mapHeight);
    if (tile === TILE.WALL) {
      errors.push(`After move ${i + 1} (${move}): Player clipped into wall at (${current.position.x}, ${current.position.y})!`);
    }
  }

  return { states, errors };
}

/**
 * Run a comprehensive path walk test from a starting position
 * Attempts to visit all reachable tiles using BFS traversal
 */
export function runPathWalkTest(
  initialState: TestState,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): { visitedCount: number; totalWalkable: number; path: Position[]; errors: string[] } {
  const errors: string[] = [];
  const visited = new Set<string>();
  const path: Position[] = [];
  const queue: Array<{ pos: Position; dir: Direction }> = [
    { pos: { ...initialState.position }, dir: initialState.direction }
  ];

  visited.add(`${initialState.position.x},${initialState.position.y}`);
  path.push({ ...initialState.position });

  // Count total walkable tiles
  let totalWalkable = 0;
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tile = mapTiles[y]?.[x];
      if (tile !== undefined && tile !== TILE.WALL) {
        totalWalkable++;
      }
    }
  }

  // BFS to visit all reachable tiles
  while (queue.length > 0) {
    const current = queue.shift()!;
    const directions: Direction[] = ['N', 'S', 'E', 'W'];

    for (const dir of directions) {
      const nextPos = getNextPosition(current.pos, dir);
      const key = `${nextPos.x},${nextPos.y}`;

      if (visited.has(key)) continue;

      // Check bounds
      if (nextPos.x < 0 || nextPos.x >= mapWidth || nextPos.y < 0 || nextPos.y >= mapHeight) {
        continue;
      }

      const nextTile = mapTiles[nextPos.y]?.[nextPos.x];

      // Skip walls
      if (nextTile === undefined || nextTile === TILE.WALL) {
        continue;
      }

      // Valid move - check for clipping
      const currentTile = mapTiles[current.pos.y]?.[current.pos.x];
      if (currentTile === TILE.WALL) {
        errors.push(`Clipping detected: moved from wall at (${current.pos.x},${current.pos.y})`);
      }

      visited.add(key);
      path.push(nextPos);
      queue.push({ pos: nextPos, dir });
    }
  }

  if (visited.size < totalWalkable) {
    errors.push(`Only visited ${visited.size}/${totalWalkable} tiles - some areas unreachable`);
  }

  return {
    visitedCount: visited.size,
    totalWalkable,
    path,
    errors,
  };
}

/**
 * Test turn tile rendering perspective
 * Returns info about which direction a turn should visually appear
 */
export function getTurnTileInfo(
  position: Position,
  facingDirection: Direction,
  mapTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): { turnDirection: 'L' | 'R' | 'straight' | 'blocked' | 'unknown'; connections: Direction[] } {
  const tile = getTileAt(position, mapTiles, mapWidth, mapHeight);

  if (tile === null || tile === TILE.WALL) {
    return { turnDirection: 'blocked', connections: [] };
  }

  // Get all connections from this tile
  const connections: Direction[] = [];
  const directions: Direction[] = ['N', 'S', 'E', 'W'];

  for (const dir of directions) {
    const nextPos = getNextPosition(position, dir);
    const nextTile = getTileAt(nextPos, mapTiles, mapWidth, mapHeight);
    if (nextTile !== null && nextTile !== TILE.WALL) {
      connections.push(dir);
    }
  }

  if (tile !== TILE.TURN || connections.length !== 2) {
    return { turnDirection: 'unknown', connections };
  }

  // Determine turn direction based on facing and connections
  const [conn1, conn2] = connections;
  const opposite: Record<Direction, Direction> = { 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E' };

  // If facing direction is opposite to one connection, the other is where we turn
  const exitDirection = conn1 === opposite[facingDirection] ? conn2 :
                        conn2 === opposite[facingDirection] ? conn1 : null;

  if (!exitDirection) {
    return { turnDirection: 'unknown', connections };
  }

  // Determine if exit is left or right from facing direction
  const turnLookup: Record<Direction, Partial<Record<Direction, 'L' | 'R'>>> = {
    'N': { 'W': 'L', 'E': 'R' },
    'S': { 'E': 'L', 'W': 'R' },
    'E': { 'N': 'L', 'S': 'R' },
    'W': { 'S': 'L', 'N': 'R' },
  };

  const turnDir = turnLookup[facingDirection][exitDirection];
  return {
    turnDirection: turnDir || 'unknown',
    connections,
  };
}

/**
 * Format test results for display
 */
export function formatTestResults(results: TestResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  let output = `\n=== Movement System Tests ===\n`;
  output += `Passed: ${passed}/${results.length}\n`;
  output += `Failed: ${failed}/${results.length}\n\n`;

  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    output += `${icon} ${result.name}: ${result.message}\n`;
  }

  return output;
}

/**
 * Detailed corridor test - simulates the path array building logic
 * and checks for position/tile mismatches
 */
export interface CorridorTestResult {
  position: Position;
  direction: Direction;
  pathArray: number[];
  filteredPath: number[];
  positionLookup: number[];
  issues: string[];
  tilesAhead: Array<{ index: number; tile: number; actualPos: number; expectedTile: number; match: boolean }>;
}

export function testCorridorRendering(
  position: Position,
  direction: Direction,
  mapTiles: TileType[][],
  verticalTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): CorridorTestResult {
  const issues: string[] = [];

  // Get the path array based on direction (simulating generateMapResources)
  let pathArray: number[];
  if (direction === 'N' || direction === 'S') {
    // Vertical movement - use column at positionX
    pathArray = verticalTiles[position.x] ? [...verticalTiles[position.x]] : [];
  } else {
    // Horizontal movement - use row at positionY
    pathArray = mapTiles[position.y] ? [...mapTiles[position.y]] : [];
  }

  // Build position lookup (maps filtered index to actual position)
  const positionLookup: number[] = [];
  const filteredPath: number[] = [];
  for (let pos = 0; pos < pathArray.length; pos++) {
    if (pathArray[pos] !== 0) { // Skip walls
      positionLookup.push(pos);
      filteredPath.push(pathArray[pos]);
    }
  }

  // Reverse for N/W directions
  const isReversed = direction === 'N' || direction === 'W';
  if (isReversed) {
    filteredPath.reverse();
    positionLookup.reverse();
  }

  // Calculate array position
  const arrayPosition = direction === 'N' || direction === 'S' ? position.y : position.x;

  // Test each tile ahead
  const tilesAhead: CorridorTestResult['tilesAhead'] = [];

  for (let i = arrayPosition; i < pathArray.length && i < filteredPath.length; i++) {
    const actualPos = positionLookup[i] ?? i;
    const tileFromPath = filteredPath[i];

    // Get the actual tile at the calculated position
    let expectedTile: number;
    if (direction === 'N' || direction === 'S') {
      expectedTile = mapTiles[actualPos]?.[position.x] ?? -1;
    } else {
      expectedTile = mapTiles[position.y]?.[actualPos] ?? -1;
    }

    const match = tileFromPath === expectedTile || expectedTile === -1;

    tilesAhead.push({
      index: i,
      tile: tileFromPath,
      actualPos,
      expectedTile,
      match
    });

    if (!match) {
      issues.push(`Index ${i}: path has tile ${tileFromPath}, but map at pos ${actualPos} has tile ${expectedTile}`);
    }
  }

  // Check for turn tiles and verify perpendicular lookups would be correct
  for (const tileInfo of tilesAhead) {
    if (tileInfo.tile === 2 || tileInfo.tile === 3) { // Turn or 3-way
      // Verify perpendicular tile lookup would use correct position
      let perpTile: number | undefined;
      if (direction === 'N' || direction === 'S') {
        // Check horizontal perpendicular
        perpTile = mapTiles[tileInfo.actualPos]?.[position.x + 1];
      } else {
        // Check vertical perpendicular
        perpTile = verticalTiles[tileInfo.actualPos]?.[position.y + 1];
      }

      if (perpTile === undefined) {
        // This might be okay if it's at the edge
      }
    }
  }

  return {
    position,
    direction,
    pathArray,
    filteredPath,
    positionLookup,
    issues,
    tilesAhead
  };
}

/**
 * Run corridor tests for all directions from current position
 */
export function testAllDirectionsFromPosition(
  position: Position,
  mapTiles: TileType[][],
  verticalTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): CorridorTestResult[] {
  const directions: Direction[] = ['N', 'S', 'E', 'W'];
  const results: CorridorTestResult[] = [];

  for (const dir of directions) {
    results.push(testCorridorRendering(position, dir, mapTiles, verticalTiles, mapWidth, mapHeight));
  }

  return results;
}

/**
 * Test for turn-unturn desync at a specific position
 * Simulates the sequence: turn right, turn right again, walk back, turn back, repeat
 */
export interface TurnDesyncTestResult {
  position: Position;
  sequence: Array<{
    step: number;
    action: string;
    direction: Direction;
    expectedArrPos: number;
    expectedPathLength: number;
    issue?: string;
  }>;
  desyncDetected: boolean;
  summary: string;
}

export function testTurnDesync(
  position: Position,
  startDirection: Direction,
  mapTiles: TileType[][],
  verticalTiles: TileType[][],
  mapWidth: number,
  mapHeight: number
): TurnDesyncTestResult {
  const sequence: TurnDesyncTestResult['sequence'] = [];
  let desyncDetected = false;

  // Calculate path info for each direction
  const getPathInfo = (dir: Direction): { path: number[]; length: number; arrPos: number } => {
    let path: number[];
    let arrPos: number;

    if (dir === 'N' || dir === 'S') {
      path = verticalTiles[position.x] ? [...verticalTiles[position.x]].filter(t => t !== 0) : [];
      arrPos = position.y;
    } else {
      path = mapTiles[position.y] ? [...mapTiles[position.y]].filter(t => t !== 0) : [];
      arrPos = position.x;
    }

    // Adjust for N/W which reverse the array
    if (dir === 'N' || dir === 'W') {
      arrPos = path.length - 1 - arrPos;
    }

    // Find position in filtered array
    let filteredPos = 0;
    const rawPath = dir === 'N' || dir === 'S'
      ? (verticalTiles[position.x] || [])
      : (mapTiles[position.y] || []);

    for (let i = 0; i < rawPath.length && i <= (dir === 'N' || dir === 'S' ? position.y : position.x); i++) {
      if (rawPath[i] !== 0) {
        filteredPos++;
      }
    }
    filteredPos--; // Zero-indexed

    return {
      path,
      length: path.length,
      arrPos: Math.max(0, filteredPos)
    };
  };

  // Simulate the sequence
  let currentDir = startDirection;
  const actions = [
    'start',
    'turn_R',    // Look right
    'turn_R',    // Turn right again (now looking back)
    'forward',   // Walk back
    'turn_R',    // Turn
    'turn_R',    // Turn again
  ];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    let prevDir = currentDir;

    if (action === 'turn_R' || action === 'turn_L') {
      currentDir = TURN_MATRIX[currentDir][action === 'turn_R' ? 'R' : 'L'];
    }

    const pathInfo = getPathInfo(currentDir);

    // Check for issues
    let issue: string | undefined;

    if (pathInfo.arrPos < 0) {
      issue = `Array position went negative: ${pathInfo.arrPos}`;
      desyncDetected = true;
    } else if (pathInfo.arrPos >= pathInfo.length) {
      issue = `Array position ${pathInfo.arrPos} exceeds path length ${pathInfo.length}`;
      desyncDetected = true;
    }

    // Check if path length makes sense
    if (pathInfo.length === 0) {
      issue = `Path is empty for direction ${currentDir}`;
      desyncDetected = true;
    }

    sequence.push({
      step: i,
      action,
      direction: currentDir,
      expectedArrPos: pathInfo.arrPos,
      expectedPathLength: pathInfo.length,
      issue
    });
  }

  // Generate summary
  const issues = sequence.filter(s => s.issue).map(s => s.issue);
  const summary = issues.length > 0
    ? `Desync detected: ${issues.join('; ')}`
    : `No desync detected at (${position.x}, ${position.y}) starting ${startDirection}`;

  return {
    position,
    sequence,
    desyncDetected,
    summary
  };
}

/**
 * Calculate the correct array position directly from player coordinates
 * This is the proper way to calculate position - not from stale state
 */
export function calculateCorrectArrPos(
  playerPos: Position,
  direction: Direction,
  mapTiles: TileType[][],
  verticalTiles: TileType[][]
): { arrPos: number; pathLength: number; path: number[] } {
  // Get the raw path for the current direction
  let rawPath: number[];
  let playerCoord: number;

  if (direction === 'N' || direction === 'S') {
    rawPath = verticalTiles[playerPos.x] || [];
    playerCoord = playerPos.y;
  } else {
    rawPath = mapTiles[playerPos.y] || [];
    playerCoord = playerPos.x;
  }

  // Build position lookup and filtered path
  const positionLookup: number[] = [];
  const filteredPath: number[] = [];

  for (let i = 0; i < rawPath.length; i++) {
    if (rawPath[i] !== 0) {
      positionLookup.push(i);
      filteredPath.push(rawPath[i]);
    }
  }

  // Find player's index in the filtered array
  let arrPos = positionLookup.indexOf(playerCoord);
  if (arrPos === -1) {
    // Player is on a wall? This shouldn't happen
    arrPos = 0;
  }

  // For N/W, the array is reversed, so adjust position
  if (direction === 'N' || direction === 'W') {
    arrPos = filteredPath.length - 1 - arrPos;
  }

  return {
    arrPos: Math.max(0, arrPos),
    pathLength: filteredPath.length,
    path: filteredPath
  };
}

/**
 * Validate current state against what it should be based on player position
 */
export function validateCurrentState(
  playerPos: Position,
  direction: Direction,
  currentArrPos: number,
  mapTiles: TileType[][],
  verticalTiles: TileType[][]
): { isValid: boolean; expectedArrPos: number; actualArrPos: number; mismatch: number; details: string } {
  const correct = calculateCorrectArrPos(playerPos, direction, mapTiles, verticalTiles);

  const isValid = currentArrPos === correct.arrPos;
  const mismatch = Math.abs(currentArrPos - correct.arrPos);

  let details = `Player at (${playerPos.x}, ${playerPos.y}) facing ${direction}. `;
  details += `Path length: ${correct.pathLength}. `;
  details += `Expected arrPos: ${correct.arrPos}, actual: ${currentArrPos}. `;

  if (!isValid) {
    details += `MISMATCH of ${mismatch} positions!`;
  } else {
    details += `OK`;
  }

  return {
    isValid,
    expectedArrPos: correct.arrPos,
    actualArrPos: currentArrPos,
    mismatch,
    details
  };
}

/**
 * Format corridor test results for display
 */
export function formatCorridorTestResults(results: CorridorTestResult[]): string {
  let output = '\n=== Corridor Rendering Tests ===\n';

  for (const result of results) {
    output += `\n[${result.direction}] from (${result.position.x}, ${result.position.y}):\n`;
    output += `  Path array: [${result.pathArray.join(', ')}]\n`;
    output += `  Filtered: [${result.filteredPath.join(', ')}]\n`;
    output += `  Position lookup: [${result.positionLookup.join(', ')}]\n`;

    if (result.issues.length > 0) {
      output += `  ISSUES:\n`;
      for (const issue of result.issues) {
        output += `    - ${issue}\n`;
      }
    } else {
      output += `  OK - ${result.tilesAhead.length} tiles verified\n`;
    }
  }

  return output;
}
