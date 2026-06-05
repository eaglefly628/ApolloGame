import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { buildGameCBlueprint } from './blueprint.js';
import { GARMENTS, garmentFlagId, LOOK_FSM } from './theme.js';
import type { Resource, Flag, State, ResourceModify } from '@engine/protocol/components.js';

// ─────────────────────────────────────────────────────────────────
//  Game C 数据装配验证：缝纫店升级链（Condition→Event→Effect）在**现成能力**上跑通。
//  这里**模拟**未来三消棋盘(REQ-C-001)的产出——直接把 ResourceModify 当数据灌进材料资源，
//  断言「攒够材料 → 解锁衣服 flag + 推进外观状态」整条链按预期点亮。零游戏系统代码。
// ─────────────────────────────────────────────────────────────────

function load() {
  const engine = new Engine();
  engine.load(buildGameCBlueprint());
  return engine;
}

// 把一笔材料产出作为数据灌进世界（模拟未来三消棋盘的消除掉落）。
// 直接挂到该材料自己的资源实体 `mat_<id>` 上（同实体局部匹配 → resource-apply 结算 → 当帧消费）。
// 不新建实体 → 世界实体集恒等于蓝图 → 确定性快照可比对。一帧只灌一种材料一次。
function gain(engine: Engine, id: string, amount: number) {
  engine.world.addComponent(`mat_${id}`, { type: 'ResourceModify', resourceId: id, amount } as ResourceModify);
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

describe('Game C · 缝纫物语 blueprint（纯数据装配）', () => {
  it('蓝图加载：6 材料 + 针线币 + 每件衣服一条解锁链', () => {
    const engine = load();
    expect(res(engine, 'cloth')?.current).toBe(0);
    expect(res(engine, 'coin')?.current).toBe(0);
    // 初始所有衣服未解锁。
    for (const g of GARMENTS) expect(flag(engine, garmentFlagId(g))?.active).toBe(false);
    // 初始外观 = 基础练习服。
    const st = engine.world.getComponent<State>('girl', 'State');
    expect(st?.fsmId).toBe(LOOK_FSM);
    expect(st?.current).toBe('look_base');
  });

  it('攒够材料 → 解锁第 1 档「初心围裙」并推进外观（Condition→Event→Effect）', () => {
    const engine = load();
    const apron = GARMENTS[0]; // 需 cloth>=10, thread>=6
    // 模拟若干次消除掉落（数据），跨过阈值。
    gain(engine, 'cloth', 12);
    gain(engine, 'thread', 8);
    // 跑几个 tick 让 resource-apply → event-when(信号) → effect-apply(置 flag + set-state) 合龙。
    for (let i = 0; i < 4; i++) engine.world.tick();

    expect(res(engine, 'cloth')!.current).toBe(12);
    expect(res(engine, 'thread')!.current).toBe(8);
    expect(flag(engine, garmentFlagId(apron))!.active).toBe(true);
    expect(engine.world.getComponent<State>('girl', 'State')!.current).toBe(apron.lookId);
  });

  it('材料不足时高档衣服保持锁定（阈值门控）', () => {
    const engine = load();
    // 只够第 1 档，远不够第 5 档「星夜晚礼服」。
    gain(engine, 'cloth', 12);
    gain(engine, 'thread', 8);
    for (let i = 0; i < 4; i++) engine.world.tick();

    const gala = GARMENTS[GARMENTS.length - 1];
    expect(flag(engine, garmentFlagId(gala))!.active).toBe(false);
  });

  it('解锁是上升沿一次性的：解锁后材料继续增加不重复触发，flag 稳定为真', () => {
    const engine = load();
    gain(engine, 'cloth', 50);
    gain(engine, 'thread', 40);
    for (let i = 0; i < 4; i++) engine.world.tick();
    const apron = GARMENTS[0];
    expect(flag(engine, garmentFlagId(apron))!.active).toBe(true);
    // 再加更多，多跑几帧，flag 仍为真（edge 不抖动、不回落）。
    gain(engine, 'cloth', 30);
    for (let i = 0; i < 4; i++) engine.world.tick();
    expect(flag(engine, garmentFlagId(apron))!.active).toBe(true);
  });

  it('确定性：同样的材料投放序列两次运行得到一致快照', () => {
    const run = () => {
      const engine = load();
      gain(engine, 'cloth', 24);
      gain(engine, 'button', 12);
      for (let i = 0; i < 6; i++) engine.world.tick();
      return engine.hash();
    };
    expect(run()).toBe(run());
  });
});
