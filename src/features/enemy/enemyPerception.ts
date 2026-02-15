import { Direction } from '../../types/map';
import data from '../../data/characters.json';

export type EnemyVisibilityMode = 'distance' | 'ambush';
export type EnemyAttackStyle = 'melee' | 'ranged';
export type EnemyDisposition = 'hostile' | 'neutral' | 'friendly';

export interface EnemyBehavior {
  visibilityMode: EnemyVisibilityMode;
  visibilityRange: number;
  attackStyle: EnemyAttackStyle;
  attackRange: number;
  playerEngageRange: number;
  firstStrike: boolean;
  disposition: EnemyDisposition;
}

export interface EnemyWithPosition {
  positionX: number;
  positionY: number;
  health?: number;
  visibilityMode?: EnemyVisibilityMode;
  visibilityRange?: number;
  attackStyle?: EnemyAttackStyle;
  attackRange?: number;
  playerEngageRange?: number;
  firstStrike?: boolean;
  disposition?: EnemyDisposition;
}

const DEFAULT_BEHAVIOR: EnemyBehavior = {
  visibilityMode: 'distance',
  visibilityRange: 4,
  attackStyle: 'melee',
  attackRange: 1,
  playerEngageRange: 1,
  firstStrike: false,
  disposition: 'hostile',
};

const normalizeBehavior = (raw: unknown): EnemyBehavior => {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_BEHAVIOR;
  }

  const behaviorObj = raw as Partial<EnemyBehavior>;
  const mode = behaviorObj.visibilityMode === 'ambush' || behaviorObj.visibilityMode === 'distance'
    ? behaviorObj.visibilityMode
    : DEFAULT_BEHAVIOR.visibilityMode;
  const range = typeof behaviorObj.visibilityRange === 'number' && behaviorObj.visibilityRange >= 0
    ? behaviorObj.visibilityRange
    : DEFAULT_BEHAVIOR.visibilityRange;
  const attackStyle = behaviorObj.attackStyle === 'ranged' || behaviorObj.attackStyle === 'melee'
    ? behaviorObj.attackStyle
    : DEFAULT_BEHAVIOR.attackStyle;
  const attackRange = typeof behaviorObj.attackRange === 'number' && behaviorObj.attackRange >= 0
    ? behaviorObj.attackRange
    : DEFAULT_BEHAVIOR.attackRange;
  const playerEngageRange = typeof behaviorObj.playerEngageRange === 'number' && behaviorObj.playerEngageRange >= 0
    ? behaviorObj.playerEngageRange
    : DEFAULT_BEHAVIOR.playerEngageRange;
  const firstStrike = typeof behaviorObj.firstStrike === 'boolean'
    ? behaviorObj.firstStrike
    : DEFAULT_BEHAVIOR.firstStrike;
  const disposition =
    behaviorObj.disposition === 'hostile' ||
    behaviorObj.disposition === 'neutral' ||
    behaviorObj.disposition === 'friendly'
      ? behaviorObj.disposition
      : DEFAULT_BEHAVIOR.disposition;

  return {
    visibilityMode: mode,
    visibilityRange: range,
    attackStyle,
    attackRange,
    playerEngageRange,
    firstStrike,
    disposition,
  };
};

const ENEMY_BEHAVIORS_BY_TYPE: Record<number, EnemyBehavior> = ((data as any).enemies || []).reduce(
  (acc: Record<number, EnemyBehavior>, enemy: any, index: number) => {
    acc[index] = normalizeBehavior(enemy?.behavior);
    return acc;
  },
  {}
);

export const getEnemyBehaviorForType = (enemyType: number): EnemyBehavior => {
  return ENEMY_BEHAVIORS_BY_TYPE[enemyType] || DEFAULT_BEHAVIOR;
};

export const getPlayerEngageRange = (playerClass: string | undefined): number => {
  if (playerClass === 'caster') return 3;
  if (playerClass === 'ranger') return 2;
  return 1;
};

export const getEnemyDistanceInFacingDirection = (
  playerX: number,
  playerY: number,
  direction: Direction,
  enemyX: number,
  enemyY: number
): number | null => {
  if (enemyX === playerX && enemyY === playerY) {
    return 0;
  }

  switch (direction) {
    case 'N':
      return enemyX === playerX && enemyY < playerY ? playerY - enemyY : null;
    case 'S':
      return enemyX === playerX && enemyY > playerY ? enemyY - playerY : null;
    case 'E':
      return enemyY === playerY && enemyX > playerX ? enemyX - playerX : null;
    case 'W':
      return enemyY === playerY && enemyX < playerX ? playerX - enemyX : null;
    default:
      return null;
  }
};

export const isEnemyOccludedByCloserEnemy = (
  targetEnemyId: number,
  enemies: Array<EnemyWithPosition | undefined>,
  playerX: number,
  playerY: number,
  direction: Direction
): boolean => {
  const targetEnemy = enemies[targetEnemyId];
  if (!targetEnemy || (targetEnemy.health ?? 1) <= 0) {
    return false;
  }

  const targetDistance = getEnemyDistanceInFacingDirection(
    playerX,
    playerY,
    direction,
    targetEnemy.positionX ?? 0,
    targetEnemy.positionY ?? 0
  );

  if (targetDistance === null || targetDistance <= 0) {
    return false;
  }

  for (let i = 0; i < enemies.length; i++) {
    if (i === targetEnemyId) continue;
    const enemy = enemies[i];
    if (!enemy || (enemy.health ?? 1) <= 0) continue;

    const distance = getEnemyDistanceInFacingDirection(
      playerX,
      playerY,
      direction,
      enemy.positionX ?? 0,
      enemy.positionY ?? 0
    );

    if (distance !== null && distance >= 0 && distance < targetDistance) {
      return true;
    }
  }

  return false;
};

export const isEnemyVisibleToPlayer = (
  enemy: EnemyWithPosition,
  playerX: number,
  playerY: number,
  direction: Direction
): boolean => {
  const distance = getEnemyDistanceInFacingDirection(
    playerX,
    playerY,
    direction,
    enemy.positionX ?? 0,
    enemy.positionY ?? 0
  );

  if (distance === null) {
    return false;
  }

  if ((enemy.visibilityMode || DEFAULT_BEHAVIOR.visibilityMode) === 'ambush') {
    return distance === 0;
  }

  const visibilityRange = enemy.visibilityRange ?? DEFAULT_BEHAVIOR.visibilityRange;
  return distance <= visibilityRange;
};

export const isEnemyCombatReachable = (
  enemy: EnemyWithPosition,
  playerX: number,
  playerY: number,
  direction: Direction,
  playerClass: string | undefined
): boolean => {
  const distance = getEnemyDistanceInFacingDirection(
    playerX,
    playerY,
    direction,
    enemy.positionX ?? 0,
    enemy.positionY ?? 0
  );

  if (distance === null) {
    return false;
  }

  if ((enemy.visibilityMode || DEFAULT_BEHAVIOR.visibilityMode) === 'ambush') {
    return distance === 0;
  }

  if ((enemy.attackStyle || DEFAULT_BEHAVIOR.attackStyle) === 'ranged') {
    const requiredRange = enemy.playerEngageRange ?? DEFAULT_BEHAVIOR.playerEngageRange;
    return distance <= requiredRange;
  }

  return distance <= getPlayerEngageRange(playerClass);
};
