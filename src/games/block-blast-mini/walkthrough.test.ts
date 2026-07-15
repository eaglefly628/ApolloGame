// block-blast-mini · S4 玩法关走查（八阶段流程板机器门·每次全库 vitest 自动重演）
// 游戏=纯数据 manifest（public/games/block-blast-mini/manifest.json·零游戏层代码）；
// 本文件只是测试：读真 manifest → parseManifest → 真引擎跑核心循环（放置/消行/计分/HUD/拖拽/补形/判负）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest } from '../../assembly/manifest.js';
import { Engine } from '../../runtime/engine.js';
import type { BlockGrid, PlaceBlockIntent, Resource, Flag, Text, InputQueue } from '@engine/protocol/components.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = JSON.parse(readFileSync(resolve(ROOT, 'public/games/block-blast-mini/manifest.json'), 'utf8'));

// 深拷贝原始 manifest（测试各自改盘面·互不污染）。
const cloneRaw = (): typeof RAW => JSON.parse(JSON.stringify(RAW));

function boot(raw: unknown = cloneRaw()): Engine {
  const e = new Engine({ tickRate: 60 });
  e.load(parseManifest(raw));
  return e;
}
const grid = (e: Engine): BlockGrid => e.world.getComponent<BlockGrid>('board', 'BlockGrid')!;
const score = (e: Engine): number => e.world.getComponent<Resource>('res-score', 'Resource')!.current;
let intentSeq = 0;
function intent(e: Engine, slot: number, col: number, row: number): void {
  const id = `t-intent-${intentSeq++}`;
  e.world.createEntity(id);
  e.world.addComponent(id, { type: 'PlaceBlockIntent', slot, col, row } as PlaceBlockIntent);
}

describe('block-blast-mini · S3 语义复验（manifest → 引擎）', () => {
  it('真 manifest 装载 + 空跑 2 tick 不抛；棋盘 8×8 全空、托盘 3 槽、分数 0', () => {
    const e = boot();
    e.world.tick();
    e.world.tick();
    const g = grid(e);
    expect(g.cols).toBe(8);
    expect(g.cells).toHaveLength(64);
    expect(g.cells.every((v) => v === -1)).toBe(true);
    expect(g.tray).toHaveLength(3);
    expect(score(e)).toBe(0);
  });
});

describe('block-blast-mini · 核心循环', () => {
  it('放置：单格落 (0,0) → 格被填、槽用掉、计分链 +1、HUD 文字跟着变', () => {
    const e = boot();
    intent(e, 0, 0, 0); // 托盘槽0=single
    e.world.tick(); // 放置 + 发 ResourceModify
    expect(grid(e).cells[0]).toBeGreaterThanOrEqual(0);
    expect(grid(e).tray[0]).toBe(-1);
    e.world.tick(); // resource-apply 结算（一拍延迟）
    expect(score(e)).toBe(1); // 1 格 × cellScore 1
    e.world.tick(); // text-binding 投影
    expect(e.world.getComponent<Text>('hud-score', 'Text')!.content).toBe('分数 1');
  });

  it('消行：行0 已填 7 格 + 放最后一格 → 整行清空、得分 = 1格 + 1行×10 = 11', () => {
    const raw = cloneRaw();
    for (let c = 0; c < 7; c++) raw.entities.board.BlockGrid.cells[c] = 0x123456; // 预填行0 前7格
    const e = boot(raw);
    intent(e, 0, 7, 0); // single 补 (7,0)
    e.world.tick();
    expect(grid(e).cells.slice(0, 8).every((v) => v === -1)).toBe(true); // 行0 清空
    e.world.tick();
    expect(score(e)).toBe(11);
  });

  it('非法放置（压已占格）→ 整次拒绝：盘面/托盘/分数全不动', () => {
    const raw = cloneRaw();
    raw.entities.board.BlockGrid.cells[0] = 0x123456;
    const e = boot(raw);
    intent(e, 0, 0, 0); // single 压 (0,0) 已占
    e.world.tick();
    e.world.tick();
    expect(grid(e).cells[0]).toBe(0x123456);
    expect(grid(e).tray[0]).toBe(0); // 槽没消耗
    expect(score(e)).toBe(0);
  });

  it('拖拽全链：InputQueue 注入 drag（托盘块→棋盘格）→ 吸附 → 落子（与真实玩家同一路径）', () => {
    const e = boot();
    // piece-0 在 (140,430)；格(2,0) 中心=(60+2*40, 60)=(140,60)
    e.world.createEntity('t-q');
    e.world.addComponent('t-q', {
      type: 'InputQueue',
      actions: [{ source: 'p1', key: 'drag', x: 140, y: 430, values: [140, 60], phase: 'drag' }],
    } as InputQueue);
    e.world.tick();
    expect(grid(e).cells[2]).toBeGreaterThanOrEqual(0); // 格(2,0)=idx2 被填
    expect(grid(e).tray[0]).toBe(-1);
  });

  it('托盘补形：3 槽用完自动补满 3 个；同 seed 两局补形完全一致（确定性）', () => {
    const play = (): number[] => {
      const e = boot();
      intent(e, 0, 0, 0); e.world.tick(); // single → (0,0)
      intent(e, 1, 0, 2); e.world.tick(); // duo-h → (0,2)(1,2)
      intent(e, 2, 4, 4); e.world.tick(); // sq-2x2 → (4,4)…
      return [...grid(e).tray];
    };
    const t1 = play();
    const t2 = play();
    expect(t1).toHaveLength(3);
    expect(t1.every((s) => s >= 0)).toBe(true); // 补满
    expect(t1).toEqual(t2); // 同 seed 同补形
  });

  it('终局：盘面无相邻空位 + 托盘全是多格形状 → game_over 旗被置真', () => {
    const raw = cloneRaw();
    const cells = raw.entities.board.BlockGrid.cells;
    for (let i = 0; i < 64; i++) cells[i] = (Math.floor(i / 8) + i) % 2 === 0 ? -1 : 0x123456; // 棋盘格纹：空位互不四邻
    raw.entities.board.BlockGrid.tray = [1, 2, 3]; // duo-h/duo-v/tri-h 全放不下
    const e = boot(raw);
    e.world.tick();
    expect(e.world.getComponent<Flag>('flag-over', 'Flag')!.active).toBe(true);
  });

  it('未终局不误报：同盘面但托盘有单格 → 旗保持 false', () => {
    const raw = cloneRaw();
    const cells = raw.entities.board.BlockGrid.cells;
    for (let i = 0; i < 64; i++) cells[i] = (Math.floor(i / 8) + i) % 2 === 0 ? -1 : 0x123456;
    raw.entities.board.BlockGrid.tray = [0, 1, 2]; // 槽0=single 还能落
    const e = boot(raw);
    e.world.tick();
    expect(e.world.getComponent<Flag>('flag-over', 'Flag')!.active).toBe(false);
  });
});
