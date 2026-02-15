// Weighted spawn queue to make ambush testing easier (more rats).
const SPAWN_QUEUE: number[] = [1, 1, 1, 1, 0, 2, 1, 0];

export const pickSpawnEnemyType = (): number => {
  return SPAWN_QUEUE[Math.floor(Math.random() * SPAWN_QUEUE.length)];
};
