// Map Registry
// Central location for all map configurations

import { MapConfig, MapState } from '../../types/map';
import { loadMap, validateMap } from '../../utils/mapLoader';

// Import map JSON files
import level1 from './level1.json';
import level2Grid from './level2-grid.json';
import level3Small from './level3-small.json';
import level4Large from './level4-large.json';

// Type assertion for JSON imports
const maps: Record<string, MapConfig> = {
  'level1': level1 as MapConfig,
  'level2-grid': level2Grid as MapConfig,
  'level3-small': level3Small as MapConfig,
  'level4-large': level4Large as MapConfig,
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
export { level1, level2Grid, level3Small, level4Large };

// Export all maps
export default maps;
