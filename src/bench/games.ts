import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { buildGameFBlueprint } from '../games/game-f/index.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// ApolloBench 跑分对象：每个游戏一份"产新蓝图"的工厂（determinism 需独立两跑）。
export const BENCH_GAMES: Array<{ id: string; build: () => WorldBlueprint }> = [
  { id: 'game-f', build: () => buildGameFBlueprint() },
  { id: 'demo', build: () => demoBlueprint },
];
