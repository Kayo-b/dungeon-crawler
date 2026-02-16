// Map Registry
// Central location for all map configurations

import { MapConfig, MapState } from '../../types/map';
import { loadMap, validateMap } from '../../utils/mapLoader';

// Import map JSON files
import level1 from './level1.json';
import level2Grid from './level2-grid.json';
import level3Small from './level3-small.json';
import level4Large from './level4-large.json';

const level1Annex: MapConfig = {
  ...(level1 as MapConfig),
  id: 'level1-annex',
  name: 'The Beginning Annex',
  description: 'A side-wing connected by doors on the same dungeon floor.',
  startPosition: { x: 7, y: 0 },
  startDirection: 'S',
};

const level2GridAnnex: MapConfig = {
  ...(level2Grid as MapConfig),
  id: 'level2-grid-annex',
  name: 'The Grid Annex',
  description: 'A connected branch of level 2 accessed through doors.',
  startPosition: { x: 7, y: 7 },
  startDirection: 'W',
};

const level3SmallAnnex: MapConfig = {
  ...(level3Small as MapConfig),
  id: 'level3-small-annex',
  name: 'The Box Annex',
  description: 'An alternate route through level 3 for annex branch transitions.',
  startPosition: { x: 3, y: 3 },
  startDirection: 'N',
};

const level4LargeAnnex: MapConfig = {
  ...(level4Large as MapConfig),
  id: 'level4-large-annex',
  name: 'The Labyrinth Annex',
  description: 'A deep side area linked through doors at the same floor depth.',
  startPosition: { x: 11, y: 0 },
  startDirection: 'W',
};

// Type assertion for JSON imports
const maps: Record<string, MapConfig> = {
  'level1': level1 as MapConfig,
  'level1-annex': level1Annex,
  'level2-grid': level2Grid as MapConfig,
  'level2-grid-annex': level2GridAnnex,
  'level3-small': level3Small as MapConfig,
  'level3-small-annex': level3SmallAnnex,
  'level4-large': level4Large as MapConfig,
  'level4-large-annex': level4LargeAnnex,
};

// Map metadata for selection UI
export interface MapInfo {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  difficulty?: string;
}

/**
 * Get list of all available maps
 */
export function getMapList(): MapInfo[] {
  return Object.values(maps).map(config => ({
    id: config.id,
    name: config.name,
    description: config.description || '',
    width: config.width,
    height: config.height,
    difficulty: config.metadata?.difficulty,
  }));
}

/**
 * Get a map configuration by ID
 */
export function getMapConfig(id: string): MapConfig | undefined {
  return maps[id];
}

/**
 * Load and prepare a map by ID
 */
export function getMap(id: string): MapState {
  const config = maps[id];
  if (!config) {
    throw new Error(`Map not found: ${id}`);
  }
  return loadMap(config);
}

/**
 * Get the default/first map
 */
export function getDefaultMap(): MapState {
  return getMap('level1');
}

/**
 * Validate all maps on startup (for debugging)
 */
export function validateAllMaps(): void {
  console.log('[MapRegistry] Validating all maps...');

  for (const [id, config] of Object.entries(maps)) {
    const result = validateMap(config);
    if (result.valid) {
      console.log(`  [OK] ${id}: ${config.name} (${config.width}x${config.height})`);
    } else {
      console.error(`  [FAIL] ${id}:`, result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn(`  [WARN] ${id}:`, result.warnings);
    }
  }
}

// Export individual maps for direct access
export { level1, level1Annex, level2Grid, level2GridAnnex, level3Small, level3SmallAnnex, level4Large, level4LargeAnnex };

// Export all maps
export default maps;
