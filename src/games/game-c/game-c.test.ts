import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import {
  buildGameCBlueprint,
  BOARD_ENTITY,
  BOARD_COLS,
  BOARD_ROWS,
  SHOP_LEVEL_ENTITY,
  garmentButtonEntity,
} from './blueprint.js';
import { GARMENTS, garmentFlagId, LOOK_FSM, SHOP_LEVEL_ID } from './theme.js';
import { findMatches } from '@skills/tier3/match3-board.js';
import type { Resource, Flag, State, ResourceModify, MatchBoard, Transform, InputQueue } from '@engine/protocol/components.js';

// ─────────────────────────────────────────────────────────────────
//  Game C v0.3 验证：可玩三消棋盘(match3-board) + 主动缝制(craft-recipe) 全用现成能力装配。
//  「攒料(消除) → 主动缝制(够料才扣料解锁+店铺升级) → 换装」整条循环端到端，零游戏系统代码。
// ─────────────────────────────────────────────────────────────────

function load() {
  const engine = new Engine();
  engine.load(buildGameCBlueprint());
  return engine;
}
const getBoard = (engine: Engine) => engine.world.getComponent<MatchBoard>(BOARD_ENTITY, 'MatchBoard')!;

// 把材料产出当数据灌进世界（模拟消除掉落；挂到该材料自己的资源实体）。
function gain(engine: Engine, id: string, amount: number) {
  engine.world.addComponent(`mat_${id}`, { type: 'ResourceModify', resourceId: id, amount } as ResourceModify);
}
// 模拟在世界坐标 (x,y) 处的一次点击（写单例 InputQueue，clickable 命中）。
function clickAt(engine: Engine, x: number, y: number) {
  if (!engine.world.hasComponent('global-input', 'InputQueue')) {
    engine.world.createEntity('global-input');
    engine.world.addComponent('global-input', { type: 'InputQueue', actions: [] } as InputQueue);
  }
  engine.world.getComponent<InputQueue>('global-input', 'InputQueue')!.actions = [{ source: 'p1', x, y, phase: 'down' }];
}
function clearInput(engine: Engine) {
  const q = engine.world.getComponent<InputQueue>('global-input', 'InputQueue');
  if (q) q.actions = [];
}
const res = (engine: Engine, id: string) => {
  for (const [e] of engine.world.query('Resource')) {
    const r = engine.world.getComponent<Resource>(e, 'Resource');
    if (r?.id === id) return r;
  }
  return undefined;
};
const flag = (engine: Engine, id: string) => {
  for (const [e] of engine.world.query('Flag')) {
    const f = engine.world.getComponent<Flag>(e, 'Flag');
    if (f?.id === id) return f;
  }
  return undefined;
};
const clickGarmentButton = (engine: Engine, i: number) => {
  const t = engine.world.getComponent<Transform>(garmentButtonEntity(GARMENTS[i]), 'Transform')!;
  clickAt(engine, t.x, t.y);
};

describe('Game C v0.3 · 蓝图装配（棋盘 + 材料 + 缝制按钮）', () => {
  it('棋盘单例 + cols*rows 视图格 + 每件衣服一个缝制按钮/解锁位', () => {
    const engine = load();
    const b = getBoard(engine);
    expect(b.cells.length).toBe(BOARD_COLS * BOARD_ROWS);
    expect(engine.world.queryEntities('BoardCell').length).toBe(BOARD_COLS * BOARD_ROWS);
    expect(engine.world.queryEntities('CraftRecipe').length).toBe(GARMENTS.length);
    expect(findMatches(b.cells, b.cols, b.rows).size).toBe(0); // 开局无连线
    for (const g of GARMENTS) expect(flag(engine, garmentFlagId(g))?.active).toBe(false);
    expect(res(engine, SHOP_LEVEL_ID)?.current).toBe(0);
  });
});

describe('Game C v0.3 · 三消棋盘消除 → 产料（match-resolve → resource-apply）', () => {
  it('空跑无输入 → 留在 idle、零产出', () => {
    const engine = load();
    for (let i = 0; i < 10; i++) engine.world.tick();
    expect(getBoard(engine).phase).toBe('idle');
    expect(res(engine, 'cloth')!.current).toBe(0);
  });

  it('消除一组同色 → 对应材料 + 针线币增长', () => {
    const engine = load();
    const b = getBoard(engine);
    b.cells[0] = 0; b.cells[1] = 0; b.cells[2] = 0; // row0 三连 kind0 = 布料 cloth
    b.phase = 'match'; b.stepDelay = 0;
    for (let i = 0; i < 12; i++) engine.world.tick();
    expect(res(engine, 'cloth')!.current).toBeGreaterThanOrEqual(b.matAmount * 3);
    expect(res(engine, 'coin')!.current).toBeGreaterThanOrEqual(15);
  });

  it('点相邻两格 → 发起交换（clickable 命中视图格 → match3 选/换）', () => {
    const engine = load();
    const b = getBoard(engine);
    const cell0 = engine.world.getComponent<Transform>('cell_0', 'Transform')!;
    const cell1 = engine.world.getComponent<Transform>('cell_1', 'Transform')!;
    clickAt(engine, cell0.x, cell0.y); engine.world.tick(); clearInput(engine); // 选中 idx0
    expect(b.selIndex).toBe(0);
    clickAt(engine, cell1.x, cell1.y); engine.world.tick(); clearInput(engine); // 点相邻 idx1 → 交换
    expect(b.phase).toBe('swapped');
    expect(b.swapA).toBe(0); expect(b.swapB).toBe(1);
  });
});

describe('Game C v0.3 · 主动缝制（craft-recipe：够料才成交，原子扣料 + 解锁 + 店铺+1）', () => {
  it('点缝制按钮 + 材料够 → 扣料 + 解锁 + 推进外观 + 缝纫店等级 +1', () => {
    const engine = load();
    const apron = GARMENTS[0]; // 需 cloth10 + thread6
    gain(engine, 'cloth', 12); gain(engine, 'thread', 8);
    engine.world.tick(); // resource-apply 结算掉落
    clickGarmentButton(engine, 0);
    engine.world.tick(); // clickable→Signal(Update) → craft-recipe 成交(Commit)
    expect(flag(engine, garmentFlagId(apron))!.active).toBe(true);
    expect(res(engine, 'cloth')!.current).toBe(2); // 12 - 10
    expect(res(engine, 'thread')!.current).toBe(2); // 8 - 6
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBe(1);
    expect(engine.world.getComponent<State>('girl', 'State')!.current).toBe(apron.lookId);
  });

  it('材料不够 → 整单不动（原子性：不扣料、不解锁）', () => {
    const engine = load();
    gain(engine, 'cloth', 5); // 不够 apron 的 cloth10
    engine.world.tick();
    clickGarmentButton(engine, 0);
    engine.world.tick();
    expect(flag(engine, garmentFlagId(GARMENTS[0]))!.active).toBe(false);
    expect(res(engine, 'cloth')!.current).toBe(5); // 未扣
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBe(0);
  });

  it('端到端：棋盘反复消除攒料 → 主动缝制「初心围裙」成功', () => {
    const engine = load();
    const b = getBoard(engine);
    for (let round = 0; round < 16; round++) {
      b.cells[0] = 0; b.cells[1] = 0; b.cells[2] = 0; // 布料三连
      b.cells[6] = 1; b.cells[7] = 1; b.cells[8] = 1; // 丝线三连
      b.phase = 'match'; b.stepDelay = 0;
      for (let i = 0; i < 10; i++) engine.world.tick();
    }
    expect(res(engine, 'cloth')!.current).toBeGreaterThanOrEqual(10);
    expect(res(engine, 'thread')!.current).toBeGreaterThanOrEqual(6);
    clickGarmentButton(engine, 0);
    engine.world.tick();
    expect(flag(engine, garmentFlagId(GARMENTS[0]))!.active).toBe(true); // 攒够 → 缝制成功
  });
});

describe('Game C v0.3 · 确定性', () => {
  it('同种子棋盘连锁结算两次运行快照一致', () => {
    const run = () => {
      const engine = load();
      const b = getBoard(engine);
      b.cells[0] = 0; b.cells[1] = 0; b.cells[2] = 0;
      b.phase = 'match';
      for (let i = 0; i < 60 && getBoard(engine).phase !== 'idle'; i++) engine.world.tick();
      return engine.hash();
    };
    expect(run()).toBe(run());
  });
});
