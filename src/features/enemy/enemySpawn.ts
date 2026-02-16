// Weighted enemy type queues by dungeon depth.
// 0 = Skell, 1 = Ratazana, 2 = Skell Archer.
const DEPTH_SPAWN_QUEUES: Record<number, number[]> = {
  1: [1, 1, 1, 1, 0, 0, 2],
  2: [1, 1, 0, 0, 0, 2, 2],
  3: [0, 0, 2, 2, 2, 1, 0],
  4: [2, 2, 2, 0, 0, 2, 1],
};

export const pickSpawnEnemyTypeForDepth = (depth: number): number => {
  const normalizedDepth = Math.max(1, Math.floor(depth || 1));
  const queue = DEPTH_SPAWN_QUEUES[normalizedDepth] || DEPTH_SPAWN_QUEUES[4];
  return queue[Math.floor(Math.random() * queue.length)];
};

export const pickSpawnEnemyType = (): number => {
  return pickSpawnEnemyTypeForDepth(1);
};
