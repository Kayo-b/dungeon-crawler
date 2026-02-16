export type MapDirection = 'up' | 'down';

interface MapTransitionRule {
  depth: number;
  up?: string;
  down?: string;
  door?: string;
}

const MAP_TRANSITION_RULES: Record<string, MapTransitionRule> = {
  'level1': { depth: 1, down: 'level2-grid', door: 'level1-annex' },
  'level1-annex': { depth: 1, down: 'level2-grid-annex', door: 'level1' },

  'level2-grid': { depth: 2, up: 'level1', down: 'level3-small', door: 'level2-grid-annex' },
  'level2-grid-annex': { depth: 2, up: 'level1-annex', down: 'level3-small-annex', door: 'level2-grid' },

  'level3-small': { depth: 3, up: 'level2-grid', down: 'level4-large' },
  'level3-small-annex': { depth: 3, up: 'level2-grid-annex', down: 'level4-large-annex' },

  'level4-large': { depth: 4, up: 'level3-small', door: 'level4-large-annex' },
  'level4-large-annex': { depth: 4, up: 'level3-small-annex', door: 'level4-large' },
};

export const getMapDepth = (mapId: string): number => {
  return MAP_TRANSITION_RULES[mapId]?.depth ?? 1;
};

export const getDoorTargetMap = (mapId: string): string | undefined => {
  return MAP_TRANSITION_RULES[mapId]?.door;
};

export const getStairsTargetMap = (mapId: string, direction: MapDirection): string | undefined => {
  const rule = MAP_TRANSITION_RULES[mapId];
  if (!rule) return undefined;
  return direction === 'up' ? rule.up : rule.down;
};

