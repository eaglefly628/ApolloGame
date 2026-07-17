// scripts/game-t-balance-sim.conformance.test.ts —— 「零漂移」一致性测试。
//
// level-schema §二.5 铁律: balance-sim 的回合结算不得自写规则副本。本测试对大量随机盘 × 全部相邻交换,
// 同时跑 ①真引擎 capability(World.tick 到 idle) 与 ②sim 的 resolveMove, 断言:
//   · 结算后棋盘 cells 完全一致 (含连锁/重力/补块/特殊棋子·同种子 → 逐格相同);
//   · 各色产料 = sim collected[色]; 果冻资源 = jellyHits; 障碍资源 = blockerHits。
// 任一不等即说明 sim 与引擎口径漂移 → 失败。

import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { MatchBoard, Resource, RandomSeed } from '@engine/protocol/components.js';
import { resourceCapability } from '@atom-skills/index.js';
import { match3BoardCapability, makeCell, cellSpecial, STRIPED_H, STRIPED_V, WRAPPED, COLORBOMB, COLORLESS, adjacent } from '../src/skills/tier3/match3-board.js';
import { randomInt } from '../src/skills/atoms/random/index.js';
import { resolveMove, type Level } from './game-t-balance-sim.js';

interface Case { cols: number; rows: number; kinds: number; cells: number[]; jelly: number[]; blockers: number[]; seed: number }

// 随机盘(可含特殊棋子/果冻/障碍/石块)。同一 caseSeed → 同一盘(确定性)。
function makeCase(caseSeed: number, withLayers: boolean): Case {
  const rs: RandomSeed = { type: 'RandomSeed', seed: caseSeed >>> 0, sequence: 0 } as RandomSeed;
  const cols = 6, rows = 7, kinds = 5;
  const blockers = new Array(cols * rows).fill(0);
  const jelly = new Array(cols * rows).fill(0);
  if (withLayers) {
    for (let i = 0; i < cols * rows; i++) {
      const r = randomInt(rs, 0, 12);
      if (r === 0) blockers[i] = -1;          // 石块
      else if (r === 1) blockers[i] = 1;       // 障碍 1hp
      else if (r === 2) blockers[i] = 2;       // 障碍 2hp
      else if (r <= 4) jelly[i] = randomInt(rs, 1, 3); // 果冻 1/2
    }
  }
  const cells = new Array(cols * rows).fill(0);
  for (let i = 0; i < cols * rows; i++) {
    if (blockers[i] !== 0) { cells[i] = 0; continue; }
    const color = randomInt(rs, 0, kinds);
    const sp = randomInt(rs, 0, 14); // 少量特殊棋子
    if (sp === 0) cells[i] = makeCell(color, STRIPED_H);
    else if (sp === 1) cells[i] = makeCell(color, STRIPED_V);
    else if (sp === 2) cells[i] = makeCell(color, WRAPPED);
    else if (sp === 3) cells[i] = makeCell(COLORLESS, COLORBOMB);
    else cells[i] = color;
  }
  return { cols, rows, kinds, cells, jelly, blockers, seed: caseSeed + 777 };
}

// 用真引擎 capability 跑一步交换 (a,b)，tick 到 idle + 冲刷 resource-apply，回读终盘与资源。
function runEngine(cs: Case, a: number, b: number): { cells: number[]; mat: number[]; jelly: number; blocker: number } {
  const w = new World();
  for (const s of match3BoardCapability.systems) w.addSystem(s);
  for (const s of resourceCapability.systems) w.addSystem(s);
  const kindResource = Array.from({ length: cs.kinds }, (_, i) => `k${i}`);
  w.createEntity('board');
  const cells = cs.cells.slice();
  const tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp; // 预交换(= idle handler)
  w.addComponent('board', {
    type: 'MatchBoard', cols: cs.cols, rows: cs.rows, kindCount: cs.kinds, cells,
    kindResource, matAmount: 1, coinResource: 'coin', coinPerTile: 1,
    kindTint: kindResource.map(() => 0), kindLabel: kindResource.map(() => ''),
    phase: 'swapped', selIndex: -1, swapA: a, swapB: b, stepTimer: 0, stepDelay: 0, selectAction: 'cell',
    stripedOrientation: 'perpendicular',
    jelly: cs.jelly.slice(), blockers: cs.blockers.slice(),
    jellyResource: 'jelly', blockerResource: 'blocker',
  } as MatchBoard);
  w.addComponent('board', { type: 'RandomSeed', seed: cs.seed >>> 0, sequence: 0 } as RandomSeed);
  for (const id of [...kindResource, 'coin', 'jelly', 'blocker']) {
    w.createEntity(`res:${id}`);
    w.addComponent(`res:${id}`, { type: 'Resource', id, current: 0, min: 0, max: 1e9 } as Resource);
  }
  const board = () => w.getComponent<MatchBoard>('board', 'MatchBoard')!;
  for (let i = 0; i < 300 && board().phase !== 'idle'; i++) w.tick();
  for (let i = 0; i < 4; i++) w.tick(); // 冲刷 resource-apply 一拍延迟
  const val = (id: string) => w.getComponent<Resource>(`res:${id}`, 'Resource')!.current;
  return { cells: board().cells.slice(), mat: kindResource.map((id) => val(id)), jelly: val('jelly'), blocker: val('blocker') };
}

function runSim(cs: Case, a: number, b: number) {
  const S = { cells: cs.cells.slice(), jelly: cs.jelly.slice(), blockers: cs.blockers.slice(),
    seed: { type: 'RandomSeed', seed: cs.seed >>> 0, sequence: 0 } as RandomSeed, cols: cs.cols, rows: cs.rows, kinds: cs.kinds };
  const res = resolveMove(S as any, a, b);
  return { S, res };
}

describe('game-t balance-sim ↔ 引擎 capability 一致性(零漂移)', () => {
  for (const withLayers of [false, true]) {
    it(`随机盘${withLayers ? '(含果冻/障碍/石块)' : '(纯色+特殊棋子)'}: 逐交换终盘与产出逐一对齐`, () => {
      let checked = 0;
      for (let cse = 1; cse <= 40; cse++) {
        const cs = makeCase(cse * 131 + (withLayers ? 5000 : 0), withLayers);
        for (let i = 0; i < cs.cols * cs.rows; i++) {
          for (const j of [i + 1, i + cs.cols]) {
            if (j >= cs.cols * cs.rows || !adjacent(i, j, cs.cols)) continue;
            if (cs.blockers[i] !== 0 || cs.blockers[j] !== 0) continue;
            const eng = runEngine(cs, i, j);
            const { S, res } = runSim(cs, i, j);
            expect(S.cells, `case ${cse} swap ${i}-${j} 终盘`).toEqual(eng.cells);
            for (let c = 0; c < cs.kinds; c++) expect(res.collected.get(c) ?? 0, `case ${cse} swap ${i}-${j} 色${c}产料`).toBe(eng.mat[c]);
            expect(res.jellyHits, `case ${cse} swap ${i}-${j} 果冻`).toBe(eng.jelly);
            expect(res.blockerHits, `case ${cse} swap ${i}-${j} 障碍`).toBe(eng.blocker);
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(500);
    });
  }
});
