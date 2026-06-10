import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Flag, Shape, Status } from '@engine/protocol/components.js';
import { buildGameFBlueprint, GAME_F_HERO_IDS, FROZEN } from './blueprint.js';

const A_IDS = GAME_F_HERO_IDS.filter((id) => id.startsWith('a_'));
const B_IDS = GAME_F_HERO_IDS.filter((id) => id.startsWith('b_'));

const alive = (e: Engine, id: string): boolean => e.world.getAllEntities().includes(id);
const hp = (e: Engine, id: string): number => e.world.getComponent<Resource>(id, 'Resource')?.current ?? 0;
const livingCount = (e: Engine, ids: string[]): number => ids.filter((id) => alive(e, id)).length;
const flag = (e: Engine, id: string): boolean => {
  for (const eid of e.world.getAllEntities()) {
    const f = e.world.getComponent<Flag>(eid, 'Flag');
    if (f && f.id === id) return f.active;
  }
  return false;
};

describe('Game F — 自走棋 MVP-0 骨架（纯数据装配，零自走棋代码）', () => {
  it('蓝图可加载且确定（同初值重跑 hash 一致）', () => {
    const run = (): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameFBlueprint());
      for (let i = 0; i < 80; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run());
  });

  it('两队自动对冲互砍：双方都真受伤（aggro + grid-move + timer→event-when→caster→hitbox 涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const hurt = (id: string): boolean => {
      const r = e.world.getComponent<Resource>(id, 'Resource');
      return !alive(e, id) || (!!r && r.current < r.max); // 死了 或 current<max（真掉血）
    };
    for (let i = 0; i < 400; i++) e.world.tick(); // 慢节奏(0.5s/动作)：走位~1.5s 后交火，给足时间
    expect(A_IDS.some(hurt)).toBe(true);
    expect(B_IDS.some(hurt)).toBe(true);
  });

  it('战斗收敛到团灭：一方存活=0 → 其 present Flag 落 false（Zone 判胜负）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    let ended = false;
    for (let i = 0; i < 3000 && !ended; i++) {
      e.world.tick();
      ended = livingCount(e, A_IDS) === 0 || livingCount(e, B_IDS) === 0;
    }
    expect(ended).toBe(true);
    // 收敛后再跑几拍让 zone-occupancy 把 present flag 落定（mortal 销毁与 zone 计数差一拍）。
    for (let i = 0; i < 3; i++) e.world.tick();
    // 团灭那队的 present flag 由 zone-occupancy 落 false（存活=0 → count<阈值）。
    if (livingCount(e, A_IDS) === 0) expect(flag(e, 'team_a_present')).toBe(false);
    if (livingCount(e, B_IDS) === 0) expect(flag(e, 'team_b_present')).toBe(false);
  });

  it('棋子死亡 → 头顶名字子体随之消失（hierarchy-cascade，REQ-F-026）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    expect(alive(e, 'a_guanyu_name')).toBe(true); // 死前名字在
    // 给关羽致命局部伤害 → 死亡。
    e.world.addComponent('a_guanyu', { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(alive(e, 'a_guanyu')).toBe(false); // 棋子销毁
    expect(alive(e, 'a_guanyu_name')).toBe(false); // 名字子体随之消失（不再残留）
    expect(alive(e, 'a_guanyu_hpbar')).toBe(false); // 血条/蓝条子体一并消失（同 cascade 机制）
    expect(alive(e, 'a_guanyu_mpbg')).toBe(false);
  });

  it('蓝条→大招：普攻攒蓝 → 蓝满 EventWhen → Caster 展开各自大招区（每英雄唯一 id，纯数据涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const mp = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === `mp_${id}`) return r.current;
      }
      return -1;
    };
    let guanyuUlt = false;
    for (let i = 0; i < 500; i++) {
      e.world.tick();
      if (e.world.getAllEntities().some((x) => x.startsWith('ult_a_guanyu#'))) guanyuUlt = true;
    }
    expect(mp('a_guanyu')).toBeGreaterThanOrEqual(0); // 蓝条存在
    expect(guanyuUlt).toBe(true); // 关羽攒满蓝放出了大招区
  });

  it('实时血条/蓝条：战斗中 hp 填充条真随掉血缩窄（< 自身满宽轨道）、mp 填充条真随攒蓝充起（REQ-F-029 gauge 接入）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    // 比对自身暗轨道宽（=满宽）而非常量：常量改了测试仍真。
    const w = (id: string): number => e.world.getComponent<Shape>(id, 'Shape')?.width ?? -1;
    let hpShrank = false;
    let mpFilled = false;
    for (let i = 0; i < 400 && !(hpShrank && mpFilled); i++) {
      e.world.tick();
      hpShrank ||= GAME_F_HERO_IDS.some((id) => alive(e, `${id}_hpbar`) && w(`${id}_hpbar`) < w(`${id}_hpbg`));
      mpFilled ||= GAME_F_HERO_IDS.some((id) => alive(e, `${id}_mpbar`) && w(`${id}_mpbar`) > 0);
    }
    expect(hpShrank).toBe(true); // 有人掉血 → 绿条窄于轨道
    expect(mpFilled).toBe(true); // 有人攒蓝 → 蓝条从 0 充起
  });

  it('八阵图冰冻：诸葛亮大招命中 → 敌方棋子 Status 置 FROZEN（hitbox setMask/statusDuration + GridMover.haltStatusMask，REQ-F-030 接入）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    let froze = false;
    for (let i = 0; i < 600 && !froze; i++) {
      e.world.tick();
      froze = B_IDS.some((id) => {
        const st = e.world.getComponent<Status>(id, 'Status');
        return !!st && (st.flags & FROZEN) !== 0;
      });
    }
    expect(froze).toBe(true); // 魏方有人被八阵图冻住（定身/解冻语义由引擎 grid-move 4 测覆盖）
  });
});
