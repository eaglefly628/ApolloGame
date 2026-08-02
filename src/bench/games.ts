import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { buildGameFBlueprint } from '@games/game-f/index.js';
import { buildBlueprint as buildGameQBlueprint } from '@games/game-q/blueprint.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// ZeroCraftBench 跑分对象：每个游戏一份"产新蓝图"的工厂（determinism 需独立两跑）。
export const BENCH_GAMES: Array<{ id: string; build: () => WorldBlueprint }> = [
  { id: 'game-f', build: () => buildGameFBlueprint() },
  { id: 'game-q', build: () => buildGameQBlueprint() },
  { id: 'demo', build: () => demoBlueprint },
];
