import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { buildFixtureBlueprint } from '../test-fixtures/engine-fixture.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// ZeroCraftBench 跑分对象：每个游戏一份"产新蓝图"的工厂（determinism 需独立两跑）。
// 'fixture' 曾借用 game-f/game-q 真实蓝图当"随手可得的真实数据"（REQ-RETRO 批①·2026-08-03 两游戏均已
// 删除·借用本就是引擎→游戏目录的越界耦合，decouple-check.mjs 白名单条目）。现换成不挂 games/** 的
// 引擎侧夹具（test-fixtures/engine-fixture.ts，信号/经济/prefab/死亡/流程五类逻辑，真跑得动 Engine）。
export const BENCH_GAMES: Array<{ id: string; build: () => WorldBlueprint }> = [
  { id: 'fixture', build: () => buildFixtureBlueprint() },
  { id: 'demo', build: () => demoBlueprint },
];
