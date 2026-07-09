import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { MatchBoard, BoardCell, Signal, Resource, RandomSeed, Sprite } from '@engine/protocol/components.js';
import { resourceCapability } from '@atom-skills/index.js';
import { match3BoardCapability, findMatches, applyGravity, adjacent } from './match3-board.js';

// ── 纯算法 helper 单测 ──────────────────────────────────────────
describe('match3 helpers — findMatches', () => {
  it('横向 3 连', () => {
    const m = findMatches([0, 0, 0, 1, 2, 1, 2, 1, 2], 3, 3);
    expect([...m].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
  it('纵向 3 连', () => {
    const m = findMatches([0, 1, 2, 0, 2, 1, 0, 1, 2], 3, 3);
    expect([...m].sort((a, b) => a - b)).toEqual([0, 3, 6]);
  });
  it('无连线 → 空', () => {
    expect(findMatches([0, 1, 2, 1, 2, 0, 2, 0, 1], 3, 3).size).toBe(0);
  });
  it('空格 -1 不参与连线', () => {
    expect(findMatches([-1, -1, -1, 0, 1, 2, 0, 1, 2], 3, 3).size).toBe(0);
  });
});

describe('match3 helpers — applyGravity / adjacent', () => {
  it('每列非空块下沉到底，上方补 -1', () => {
    const cells = [0, 1, 2, -1, -1, 5, -1, 7, 8]; // 3x3
    applyGravity(cells, 3, 3);
    // col0: [0,-1,-1] → 底部 0：[-1,-1,0]；col1:[1,-1,7]→[-1,1,7]；col2:[2,5,8]→不变
    expect(cells).toEqual([-1, -1, 2, -1, 1, 5, 0, 7, 8]);
  });
  it('相邻判定（四邻）', () => {
    expect(adjacent(0, 1, 3)).toBe(true); // 同行相邻
    expect(adjacent(0, 3, 3)).toBe(true); // 同列相邻
    expect(adjacent(0, 2, 3)).toBe(false); // 同行隔一
    expect(adjacent(2, 3, 3)).toBe(false); // 跨行不相邻
  });
});

// ── 相位机 + 集成 ──────────────────────────────────────────────
function loadBoard(cells: number[], extra: Partial<MatchBoard> = {}, withResources = false): World {
  const w = new World();
  for (const s of match3BoardCapability.systems) w.addSystem(s);
  if (withResources) for (const s of resourceCapability.systems) w.addSystem(s);
  w.createEntity('board');
  w.addComponent('board', {
    type: 'MatchBoard', cols: 3, rows: 3, kindCount: 3, cells: [...cells],
    kindResource: ['red', 'grn', 'blu'], matAmount: 1, coinResource: 'coin', coinPerTile: 1,
    kindTint: [0xff0000, 0x00ff00, 0x0000ff], kindLabel: ['R', 'G', 'B'],
    phase: 'idle', selIndex: -1, swapA: -1, swapB: -1, stepTimer: 0, stepDelay: 0, selectAction: 'cell',
    ...extra,
  } as MatchBoard);
  w.addComponent('board', { type: 'RandomSeed', seed: 12345, sequence: 0 } as RandomSeed);
  if (withResources) for (const id of ['red', 'grn', 'blu', 'coin']) {
    w.createEntity(`res:${id}`);
    w.addComponent(`res:${id}`, { type: 'Resource', id, current: 0, min: 0, max: 9999 } as Resource);
  }
  return w;
}
const board = (w: World): MatchBoard => w.getComponent<MatchBoard>('board', 'MatchBoard')!;
const resVal = (w: World, id: string): number => w.getComponent<Resource>(`res:${id}`, 'Resource')!.current;

describe('T3 match3-board — 消除产料（接 resource-apply → 升级链）', () => {
  it('clear 按 kindResource 产料+币，被消格置 -1', () => {
    // row0 三个 0（red），无其它连线
    const w = loadBoard([0, 0, 0, 1, 2, 1, 2, 1, 2], { phase: 'match' }, true);
    w.tick(); // match → clear
    w.tick(); // clear：发 ResourceModify + 置 -1 → fall
    expect(board(w).cells.slice(0, 3)).toEqual([-1, -1, -1]);
    expect(board(w).phase).toBe('fall');
    w.tick(); // 下一拍 resource-apply 结算（R10 修订：一拍延迟·断四系统环）
    expect(resVal(w, 'red')).toBe(3); // 三格 red 各 +matAmount(1)
    expect(resVal(w, 'coin')).toBe(3); // 三格各 +coinPerTile(1)
  });
});

describe('T3 match3-board — 交换接受 / 回退', () => {
  it('交换后有连线 → 进 clear（接受）', () => {
    const w = loadBoard([0, 0, 0, 1, 2, 1, 2, 1, 2], { phase: 'swapped', swapA: 2, swapB: 5 });
    w.tick();
    expect(board(w).phase).toBe('clear');
  });
  it('交换后无连线 → 回退交换并回 idle（非法步）', () => {
    const w = loadBoard([0, 1, 2, 1, 2, 0, 2, 0, 1], { phase: 'swapped', swapA: 0, swapB: 1 });
    w.tick();
    expect(board(w).phase).toBe('idle');
    expect(board(w).cells.slice(0, 2)).toEqual([1, 0]); // 交换被撤回
    expect(board(w).swapA).toBe(-1);
  });
});

describe('T3 match3-board — 点击选格驱动交换', () => {
  it('两次点相邻格 → 发起交换（idle 选→换→swapped）', () => {
    const w = loadBoard([0, 1, 2, 1, 2, 0, 2, 0, 1]);
    w.createEntity('bc0');
    w.addComponent('bc0', { type: 'BoardCell', boardId: 'board', index: 0 } as BoardCell);
    w.createEntity('bc1');
    w.addComponent('bc1', { type: 'BoardCell', boardId: 'board', index: 1 } as BoardCell);

    // tick1：点 bc0（idx0）→ 选中
    w.addComponent('bc0', { type: 'Signal', name: 'cell', source: 'bc0' } as Signal);
    w.tick();
    expect(board(w).selIndex).toBe(0);

    // tick2：点 bc1（idx1，与 0 相邻）→ 交换、转 swapped
    w.removeComponent('bc0', 'Signal');
    w.addComponent('bc1', { type: 'Signal', name: 'cell', source: 'bc1' } as Signal);
    w.tick();
    expect(board(w).phase).toBe('swapped');
    expect(board(w).swapA).toBe(0);
    expect(board(w).swapB).toBe(1);
    expect(board(w).cells.slice(0, 2)).toEqual([1, 0]); // 0/1 已交换
  });
});

describe('T3 match3-board — 全流程终止 + 确定性', () => {
  function runToIdle(w: World): MatchBoard {
    for (let i = 0; i < 100 && board(w).phase !== 'idle'; i++) w.tick();
    return board(w);
  }
  it('连锁结算最终回到 idle，棋盘无空格、无残留连线', () => {
    const w = loadBoard([0, 0, 0, 1, 2, 1, 2, 1, 2], { phase: 'match' });
    const b = runToIdle(w);
    expect(b.phase).toBe('idle');
    expect(b.cells.includes(-1)).toBe(false); // 全部补满
    expect(findMatches(b.cells, b.cols, b.rows).size).toBe(0); // 稳定
  });
  it('同种子 → 补块结果完全一致（确定性/录放安全）', () => {
    const run = (): number[] => {
      const w = loadBoard([0, 0, 0, 1, 2, 1, 2, 1, 2], { phase: 'match' });
      for (let i = 0; i < 100 && board(w).phase !== 'idle'; i++) w.tick();
      return board(w).cells;
    };
    expect(run()).toEqual(run());
  });
});

describe('T3 match3-board — game-j 扩展（movesResource + kindSkinEntities·可选缺省关）', () => {
  it('合法交换（产生连线）扣 1 步；非法步弹回不扣', () => {
    const w = loadBoard([0, 0, 0, 1, 2, 1, 2, 1, 2], { phase: 'swapped', swapA: 2, swapB: 5, movesResource: 'moves' }, true);
    w.createEntity('res:moves');
    w.addComponent('res:moves', { type: 'Resource', id: 'moves', current: 20, min: 0, max: 99 } as Resource);
    w.tick(); // swapped→clear：合法步发 -1
    w.tick(); // 下一拍结算（一拍延迟）
    expect(w.getComponent<Resource>('res:moves', 'Resource')!.current).toBe(19);
    // 非法步：换回 idle·不扣
    const w2 = loadBoard([0, 1, 2, 1, 2, 0, 2, 0, 1], { phase: 'swapped', swapA: 0, swapB: 1, movesResource: 'moves' }, true);
    w2.createEntity('res:moves');
    w2.addComponent('res:moves', { type: 'Resource', id: 'moves', current: 20, min: 0, max: 99 } as Resource);
    w2.tick();
    w2.tick();
    expect(w2.getComponent<Resource>('res:moves', 'Resource')!.current).toBe(20);
  });
  it('kindSkinEntities：BoardCell 的 Sprite.textureKey 按种类同步自皮肤定义实体（空格清空）', () => {
    const w = loadBoard([1, 0, 2, 0, 2, 1, 2, 1, 0], { kindSkinEntities: ['def0', 'def1', 'def2'] });
    for (const [i, key] of [['def0', 'skin/red'], ['def1', 'skin/green'], ['def2', 'skin/blue']] as Array<[string, string]>) {
      w.createEntity(i);
      w.addComponent(i, { type: 'Sprite', textureKey: key, anchorX: 0.5, anchorY: 0.5, zOrder: 0 } as Sprite);
    }
    w.createEntity('bc0');
    w.addComponent('bc0', { type: 'BoardCell', boardId: 'board', index: 0 } as BoardCell);
    w.addComponent('bc0', { type: 'Sprite', textureKey: '', anchorX: 0.5, anchorY: 0.5, zOrder: 0 } as Sprite);
    w.tick();
    expect(w.getComponent<Sprite>('bc0', 'Sprite')!.textureKey).toBe('skin/green'); // cells[0]=1 → def1
    board(w).cells[0] = -1; // 置空 → 清 key（回退 Shape 观感）
    w.tick();
    expect(w.getComponent<Sprite>('bc0', 'Sprite')!.textureKey).toBe('');
  });
});
