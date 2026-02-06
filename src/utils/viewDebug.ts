// View Debugging System
// Tracks rendered tiles vs expected tiles to identify rendering mismatches

import { Direction, TileType } from '../types/map';

/**
 * Information about a rendered tile
 */
export interface RenderedTileInfo {
  index: number;           // Index in the rendered array
  tileType: TileType;      // The tile type from map data
  expectedVisual: 'corridor' | 'turnLeft' | 'turnRight' | 'threeWay' | 'fourWay' | 'wall' | 'door' | 'stairs' | 'deadEnd';
  actualVisual: string;    // What image resource is being used
  mapPosition: { x: number; y: number };  // Actual position in map
  perpendicular: {         // What's to the left and right
    left: TileType | null;
    right: TileType | null;
  };
  issue?: string;          // Description of any detected issue
}

/**
 * Complete view state for debugging
 */
export interface ViewDebugState {
  playerPosition: { x: number; y: number };
  playerDirection: Direction;
  currentArrPos: number;
  iniDir: boolean;
  pathArray: TileType[];           // The raw path tiles
  filteredPath: TileType[];        // Path with walls removed
  positionLookup: number[];        // Maps filtered indices to actual positions
  renderedTiles: RenderedTileInfo[];
  issues: string[];                // List of detected problems
}

/**
 * Tile image name detection from resource object
 */
export function getTileImageName(resource: any): string {
  if (!resource) return 'undefined';

  // Try to extract name from require path
  const str = String(resource);

  if (str.includes('corridor')) return 'corridor';
  if (str.includes('turn-left') || str.includes('turnTileLeft')) return 'turnLeft';
  if (str.includes('turn') && !str.includes('three')) return 'turnRight';
  if (str.includes('three') || str.includes('3way')) return 'threeWay';
  if (str.includes('wall') || str.includes('brick')) return 'wall';
  if (str.includes('door')) return 'door';
  if (str.includes('stair')) return 'stairs';

  // For numeric resources (require returns a number)
  if (typeof resource === 'number') {
    return `resource#${resource}`;
  }

  return 'unknown';
}

/**
 * Get the turn direction lookup based on player facing direction
 */
export function getPerpendicularDirections(facing: Direction): { left: Direction; right: Direction } {
  switch (facing) {
    case 'N': return { left: 'W', right: 'E' };
    case 'S': return { left: 'E', right: 'W' };
    case 'E': return { left: 'N', right: 'S' };
    case 'W': return { left: 'S', right: 'N' };
  }
}

/**
 * Get tile at position from map
 */
function getTileAt(
  x: number,
  y: number,
  mapTiles: TileType[][],
  width: number,
  height: number
): TileType | null {
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  return mapTiles[y]?.[x] ?? null;
}

/**
 * Get perpendicular tiles (what's to the left and right of a position)
 */
export function getPerpendicularTiles(
  x: number,
  y: number,
  facing: Direction,
  mapTiles: TileType[][],
  width: number,
  height: number
): { left: TileType | null; right: TileType | null } {
  const dirs = getPerpendicularDirections(facing);

  let leftX = x, leftY = y, rightX = x, rightY = y;

  switch (dirs.left) {
    case 'N': leftY--; break;
    case 'S': leftY++; break;
    case 'E': leftX++; break;
    case 'W': leftX--; break;
  }

  switch (dirs.right) {
    case 'N': rightY--; break;
    case 'S': rightY++; break;
    case 'E': rightX++; break;
    case 'W': rightX--; break;
  }

  return {
    left: getTileAt(leftX, leftY, mapTiles, width, height),
    right: getTileAt(rightX, rightY, mapTiles, width, height),
  };
}

/**
 * Determine what visual should be shown for a tile
 */
export function getExpectedVisual(
  tileType: TileType,
  perpendicular: { left: TileType | null; right: TileType | null },
  iniDir: boolean
): 'corridor' | 'turnLeft' | 'turnRight' | 'threeWay' | 'fourWay' | 'wall' | 'door' | 'stairs' | 'deadEnd' {
  // Wall
  if (tileType === 0) return 'wall';

  // Corridor
  if (tileType === 1) return 'corridor';

  // Door
  if (tileType === 5) return 'door';

  // Stairs
  if (tileType === 6 || tileType === 7) return 'stairs';

  // Dead End
  if (tileType === 8) return 'deadEnd';

  // Four-way
  if (tileType === 4) return 'fourWay';

  const hasLeft = perpendicular.left !== null && perpendicular.left !== 0;
  const hasRight = perpendicular.right !== null && perpendicular.right !== 0;

  // Three-way or turn with both directions
  if (tileType === 3) {
    if (hasLeft && hasRight) return 'threeWay';
    if (hasRight && !hasLeft) return 'turnRight';
    if (hasLeft && !hasRight) return 'turnLeft';
    return 'threeWay'; // Default for 3-way
  }

  // Turn (type 2)
  if (tileType === 2) {
    // If only one direction has a path, use that direction
    if (hasRight && !hasLeft) return 'turnRight';
    if (hasLeft && !hasRight) return 'turnLeft';

    // Both or neither - use iniDir
    return iniDir ? 'turnRight' : 'turnLeft';
  }

  return 'corridor';
}

/**
 * Analyze the current view and detect issues
 */
export function analyzeView(
  playerX: number,
  playerY: number,
  facing: Direction,
  currentArrPos: number,
  iniDir: boolean,
  mapTiles: TileType[][],
  verticalTiles: TileType[][],
  width: number,
  height: number,
  renderedResources: any[]
): ViewDebugState {
  const issues: string[] = [];
  const renderedTiles: RenderedTileInfo[] = [];

  // Get the path array based on direction
  const isVertical = facing === 'N' || facing === 'S';
  const pathArray = isVertical
    ? (verticalTiles[playerX] || [])
    : (mapTiles[playerY] || []);

  // Filter out walls
  const filteredPath = pathArray.filter(t => t !== 0);

  // Build position lookup
  const positionLookup: number[] = [];
  for (let pos = 0; pos < pathArray.length; pos++) {
    if (pathArray[pos] !== 0) {
      positionLookup.push(pos);
    }
  }

  // Reverse for N/W directions
  let orderedPath = [...filteredPath];
  let orderedLookup = [...positionLookup];
  if (facing === 'N' || facing === 'W') {
    orderedPath = orderedPath.reverse();
    orderedLookup = orderedLookup.reverse();
  }

  // Check if current position is valid
  if (currentArrPos < 0) {
    issues.push(`Array position is negative: ${currentArrPos}`);
  }
  if (currentArrPos >= orderedPath.length) {
    issues.push(`Array position ${currentArrPos} exceeds path length ${orderedPath.length}`);
  }

  // Analyze each rendered tile
  for (let i = currentArrPos; i < orderedPath.length && i - currentArrPos < renderedResources.length; i++) {
    const tileType = orderedPath[i];
    const actualMapPos = orderedLookup[i] ?? i;
    const resourceIdx = i - currentArrPos;
    const resource = renderedResources[resourceIdx];

    // Calculate actual X,Y in map
    let mapX: number, mapY: number;
    if (isVertical) {
      mapX = playerX;
      mapY = actualMapPos;
    } else {
      mapX = actualMapPos;
      mapY = playerY;
    }

    // Get perpendicular tiles at this position
    const perp = getPerpendicularTiles(mapX, mapY, facing, mapTiles, width, height);

    // Determine expected visual
    const expectedVisual = getExpectedVisual(tileType, perp, iniDir);
    const actualVisual = getTileImageName(resource);

    const tileInfo: RenderedTileInfo = {
      index: i,
      tileType,
      expectedVisual,
      actualVisual,
      mapPosition: { x: mapX, y: mapY },
      perpendicular: perp,
    };

    // Check for mismatches
    if (expectedVisual !== actualVisual) {
      // Allow some known fallbacks
      const isValidFallback =
        (expectedVisual === 'fourWay' && actualVisual === 'threeWay') ||
        (expectedVisual === 'door' && actualVisual === 'corridor') ||
        (expectedVisual === 'stairs' && actualVisual === 'corridor') ||
        (expectedVisual === 'deadEnd' && actualVisual === 'wall');

      if (!isValidFallback) {
        tileInfo.issue = `Expected ${expectedVisual}, got ${actualVisual}`;
        issues.push(`Tile ${i} at (${mapX},${mapY}): expected ${expectedVisual}, rendered ${actualVisual}`);
      }
    }

    // Check for undefined resources
    if (!resource || actualVisual === 'undefined') {
      tileInfo.issue = 'Resource is undefined!';
      issues.push(`Tile ${i} at (${mapX},${mapY}): resource is undefined (may cause black screen)`);
    }

    renderedTiles.push(tileInfo);
  }

  // Check for potential issues
  if (renderedResources.length === 0 && orderedPath.length > currentArrPos) {
    issues.push('No tiles rendered but path has walkable tiles');
  }

  // Check if player position is on a wall
  const playerTile = getTileAt(playerX, playerY, mapTiles, width, height);
  if (playerTile === 0) {
    issues.push(`Player is on a wall tile at (${playerX}, ${playerY})!`);
  }
  if (playerTile === null) {
    issues.push(`Player is outside map bounds at (${playerX}, ${playerY})!`);
  }

  return {
    playerPosition: { x: playerX, y: playerY },
    playerDirection: facing,
    currentArrPos,
    iniDir,
    pathArray,
    filteredPath: orderedPath,
    positionLookup: orderedLookup,
    renderedTiles,
    issues,
  };
}

/**
 * Format view debug state for display
 */
export function formatViewDebug(state: ViewDebugState): string {
  const lines: string[] = [];

  lines.push(`=== VIEW DEBUG ===`);
  lines.push(`Position: (${state.playerPosition.x}, ${state.playerPosition.y}) facing ${state.playerDirection}`);
  lines.push(`ArrPos: ${state.currentArrPos}, iniDir: ${state.iniDir}`);
  lines.push(`Path: [${state.filteredPath.slice(0, 8).join(',')}]${state.filteredPath.length > 8 ? '...' : ''}`);
  lines.push(`Lookup: [${state.positionLookup.slice(0, 8).join(',')}]${state.positionLookup.length > 8 ? '...' : ''}`);
  lines.push('');
  lines.push(`Rendered Tiles (${state.renderedTiles.length}):`);

  for (const tile of state.renderedTiles) {
    const perpStr = `L:${tile.perpendicular.left ?? 'X'} R:${tile.perpendicular.right ?? 'X'}`;
    lines.push(`  [${tile.index}] type=${tile.tileType} at (${tile.mapPosition.x},${tile.mapPosition.y}) ${perpStr}`);
    lines.push(`       expected: ${tile.expectedVisual}, actual: ${tile.actualVisual}`);
    if (tile.issue) {
      lines.push(`       ISSUE: ${tile.issue}`);
    }
  }

  if (state.issues.length > 0) {
    lines.push('');
    lines.push(`ISSUES (${state.issues.length}):`);
    state.issues.forEach(issue => lines.push(`  - ${issue}`));
  }

  return lines.join('\n');
}

/**
 * Quick check for turn direction mismatch
 */
export function checkTurnMismatch(
  x: number,
  y: number,
  facing: Direction,
  tileType: TileType,
  iniDir: boolean,
  renderedImage: string,
  mapTiles: TileType[][],
  width: number,
  height: number
): { hasMismatch: boolean; expected: string; actual: string; reason: string } {
  const perp = getPerpendicularTiles(x, y, facing, mapTiles, width, height);
  const expected = getExpectedVisual(tileType, perp, iniDir);
  const actual = renderedImage.includes('left') ? 'turnLeft' :
                 renderedImage.includes('right') ? 'turnRight' :
                 renderedImage.includes('three') ? 'threeWay' :
                 renderedImage.includes('corridor') ? 'corridor' : 'unknown';

  const hasMismatch = expected !== actual &&
    !((expected === 'turnLeft' || expected === 'turnRight') && actual === 'threeWay');

  const hasLeft = perp.left !== null && perp.left !== 0;
  const hasRight = perp.right !== null && perp.right !== 0;

  let reason = '';
  if (hasMismatch) {
    reason = `Left tile: ${perp.left ?? 'null'}, Right tile: ${perp.right ?? 'null'}. `;
    reason += `hasLeft: ${hasLeft}, hasRight: ${hasRight}. `;
    reason += `iniDir: ${iniDir}`;
  }

  return { hasMismatch, expected, actual, reason };
}
