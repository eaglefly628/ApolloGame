import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Flag } from '@engine/protocol/components.js';
import { buildGameFBlueprint, GAME_F_HERO_IDS } from './blueprint.js';

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

  it('两队自动对冲互砍：双方都掉血（aggro+steering + timer→event-when→caster→hitbox 涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 120; i++) e.world.tick();
    // 普攻链跑通 → 双方都已交火、有人掉血或阵亡。
    const aHurt = A_IDS.some((id) => !alive(e, id) || hp(e, id) < 90);
    const bHurt = B_IDS.some((id) => !alive(e, id) || hp(e, id) < 90);
    expect(aHurt).toBe(true);
    expect(bHurt).toBe(true);
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
});
