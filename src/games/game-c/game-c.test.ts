import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { buildGameCBlueprint } from './blueprint.js';
import { GARMENTS, ACCESSORIES, garmentFlagId, accessoryFlagId, LOOK_FSM, SHOP_LEVEL_ID } from './theme.js';
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

describe('Game C · v0.2 数据深化（缝纫店等级 / 高定多步门控 / 配饰）', () => {
  it('每解锁一件衣服 → 缝纫店等级 +1（effect-apply modify-resource）', () => {
    const engine = load();
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBe(0);
    gain(engine, 'cloth', 12);
    gain(engine, 'thread', 8);
    for (let i = 0; i < 4; i++) engine.world.tick();
    // 解锁了「初心围裙」一件 → 店铺 1 级。
    expect(flag(engine, garmentFlagId(GARMENTS[0]))!.active).toBe(true);
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBe(1);
  });

  it('高定衣被 shop_level 门控：只有顶级材料、店铺没升级 → 仍锁定', () => {
    const engine = load();
    const couture = GARMENTS.find((g) => g.id === 'couture')!;
    // 只灌高定材料，但不灌能解锁其它衣服的料 → 没有衣服解锁 → shop_level 0。
    gain(engine, 'sequin', 120);
    gain(engine, 'lace', 70);
    gain(engine, 'ribbon', 60);
    for (let i = 0; i < 8; i++) engine.world.tick();
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBeLessThan(4);
    expect(flag(engine, garmentFlagId(couture))!.active).toBe(false); // 材料够但店铺没到 4 级
  });

  it('多步涌现：攒齐所有材料 → 5 件基础衣解锁(店铺升到 5) → 下游高定再解锁', () => {
    const engine = load();
    const couture = GARMENTS.find((g) => g.id === 'couture')!;
    for (const [id, amt] of Object.entries({
      cloth: 200, thread: 100, button: 60, ribbon: 80, lace: 100, sequin: 120,
    })) gain(engine, id, amt);
    for (let i = 0; i < 12; i++) engine.world.tick();
    // 5 件基础衣 + 高定。
    for (const g of GARMENTS) expect(flag(engine, garmentFlagId(g))!.active).toBe(true);
    expect(res(engine, SHOP_LEVEL_ID)!.current).toBe(GARMENTS.length); // 每件 +1
    // 外观推进到高定。
    expect(engine.world.getComponent<State>('girl', 'State')!.current).toBe(couture.lookId);
  });

  it('配饰是与衣服并行的独立解锁线，可叠加', () => {
    const engine = load();
    for (const [id, amt] of Object.entries({
      cloth: 60, ribbon: 30, lace: 20, button: 30, sequin: 20,
    })) gain(engine, id, amt);
    for (let i = 0; i < 4; i++) engine.world.tick();
    // 全部 4 个配饰应解锁。
    for (const a of ACCESSORIES) expect(flag(engine, accessoryFlagId(a))!.active).toBe(true);
  });

  it('确定性：含店铺升级 + 高定多步 + 配饰的完整链，两次运行快照一致', () => {
    const run = () => {
      const engine = load();
      for (const [id, amt] of Object.entries({
        cloth: 200, thread: 100, button: 60, ribbon: 80, lace: 100, sequin: 120,
      })) gain(engine, id, amt);
      for (let i = 0; i < 12; i++) engine.world.tick();
      return engine.hash();
    };
    expect(run()).toBe(run());
  });
});
