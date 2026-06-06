import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// ApolloBench 跑分对象：每个游戏一份"产新蓝图"的工厂（determinism 需独立两跑）。
export const BENCH_GAMES: Array<{ id: string; build: () => WorldBlueprint }> = [
  { id: 'game-a', build: () => buildGameABlueprint(LEVEL_SCROLL) },
  { id: 'game-b', build: () => buildGameBBlueprint() },
  { id: 'game-c', build: () => buildGameCBlueprint() },
  { id: 'demo', build: () => demoBlueprint },
];
