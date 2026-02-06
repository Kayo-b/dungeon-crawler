// Direction Utilities
// Clean helper functions for direction calculations

import { Direction, Position, TileType } from '../../types/map';

/**
 * Turn direction lookup table
 * Given a facing direction and turn direction (L/R), returns new facing direction
 */
export const TURN_MATRIX: Record<Direction, Record<'L' | 'R', Direction>> = {
  'N': { 'L': 'W', 'R': 'E' },
  'S': { 'L': 'E', 'R': 'W' },
  'E': { 'L': 'N', 'R': 'S' },
  'W': { 'L': 'S', 'R': 'N' },
};

/**
 * Opposite direction lookup
 */
export const OPPOSITE: Record<Direction, Direction> = {
  'N': 'S',
  'S': 'N',
  'E': 'W',
  'W': 'E',
};

/**
 * Movement vectors for each direction
 */
export const MOVE_VECTOR: Record<Direction, Position> = {
  'N': { x: 0, y: -1 },
  'S': { x: 0, y: 1 },
  'E': { x: 1, y: 0 },
  'W': { x: -1, y: 0 },
};

/**
 * Check if direction is vertical (N/S) or horizontal (E/W)
 */
export function isVertical(dir: Direction): boolean {
  return dir === 'N' || dir === 'S';
}

export function isHorizontal(dir: Direction): boolean {
  return dir === 'E' || dir === 'W';
}

/**
 * Get the new direction after turning
 */
export function getTurnDirection(facing: Direction, turn: 'L' | 'R'): Direction {
  return TURN_MATRIX[facing][turn];
}

/**
 * Get the opposite direction (for reversing)
 */
export function getOppositeDirection(dir: Direction): Direction {
  return OPPOSITE[dir];
}

/**
 * Get the position after moving one step in a direction
 */
export function getNextPosition(pos: Position, dir: Direction): Position {
  const vector = MOVE_VECTOR[dir];
  return {
    x: pos.x + vector.x,
    y: pos.y + vector.y,
  };
}

/**
 * Get perpendicular directions (left and right of current facing)
 */
export function getPerpendicularDirections(facing: Direction): { left: Direction; right: Direction } {
  return {
    left: TURN_MATRIX[facing]['L'],
    right: TURN_MATRIX[facing]['R'],
  };
}

/**
 * Check if two directions are opposite
 */
export function areOpposite(dir1: Direction, dir2: Direction): boolean {
  return OPPOSITE[dir1] === dir2;
}

/**
 * Check if two directions are perpendicular
 */
export function arePerpendicular(dir1: Direction, dir2: Direction): boolean {
  return (isVertical(dir1) && isHorizontal(dir2)) ||
         (isHorizontal(dir1) && isVertical(dir2));
}

/**
 * Get direction name for display
 */
export function getDirectionName(dir: Direction): string {
  const names: Record<Direction, string> = {
    'N': 'North',
    'S': 'South',
    'E': 'East',
    'W': 'West',
  };
  return names[dir];
}

/**
 * Get direction symbol for display
 */
export function getDirectionSymbol(dir: Direction): string {
  const symbols: Record<Direction, string> = {
    'N': '^',
    'S': 'v',
    'E': '>',
    'W': '<',
  };
  return symbols[dir];
}

/**
 * Rotate direction 90 degrees clockwise
 */
export function rotateClockwise(dir: Direction): Direction {
  return TURN_MATRIX[dir]['R'];
}

/**
 * Rotate direction 90 degrees counter-clockwise
 */
export function rotateCounterClockwise(dir: Direction): Direction {
  return TURN_MATRIX[dir]['L'];
}

/**
 * Calculate the turn direction needed to go from one direction to another
 * Returns 'L', 'R', 'reverse', or 'none'
 */
export function calculateTurnNeeded(from: Direction, to: Direction): 'L' | 'R' | 'reverse' | 'none' {
  if (from === to) return 'none';
  if (OPPOSITE[from] === to) return 'reverse';
  if (TURN_MATRIX[from]['L'] === to) return 'L';
  if (TURN_MATRIX[from]['R'] === to) return 'R';
  return 'none';
}
