import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { buildFixtureBlueprint } from '../test-fixtures/engine-fixture.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// ZeroCraftBench 跑分对象：每个游戏一份"产新蓝图"的工厂（determinism 需独立两跑）。
// 'fixture' 曾借用 game-f/game-q 真实蓝图当"随手可得的真实数据"（game-q 已随 REQ-RETRO 引擎大扫除
// 2026-08-03 删除；game-f 同批一度删除后 owner 同日改判还原——但借用本就是引擎→游戏目录的越界耦合，
// 与两者是否存在无关）。现换成不挂 games/** 的引擎侧夹具（test-fixtures/engine-fixture.ts，
// 信号/经济/prefab/死亡/流程五类逻辑，真跑得动 Engine）。
export const BENCH_GAMES: Array<{ id: string; build: () => WorldBlueprint }> = [
  { id: 'fixture', build: () => buildFixtureBlueprint() },
  { id: 'demo', build: () => demoBlueprint },
];
