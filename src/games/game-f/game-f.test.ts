import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Flag, Shape, Status, Transform } from '@engine/protocol/components.js';
import { buildGameFBlueprint, GAME_F_HERO_IDS, FROZEN } from './blueprint.js';

// 棋子=运行时展开的实例（REQ-F-032 回合重置）：id 形如 `hero_<英雄>#<seq>:main`，
// 名牌/条/大招接线是同模板兄弟实例（REQ-F-033 '@local:' 重映射）→ 测试按前缀/后缀寻址。
const A_HEROES = GAME_F_HERO_IDS.filter((id) => id.startsWith('a_'));
const B_HEROES = GAME_F_HERO_IDS.filter((id) => id.startsWith('b_'));

const alive = (e: Engine, id: string): boolean => e.world.getAllEntities().includes(id);
// 注意：overlap/trigger 碰撞对实体的 id 形如 `overlap:<甲>:<乙>`，乙可能是 ...:main 结尾 → 必须再按 hero_ 前缀过滤。
const mains = (e: Engine): string[] => e.world.getAllEntities().filter((id) => id.startsWith('hero_') && id.endsWith(':main'));
const mainOf = (e: Engine, hero: string): string | undefined => mains(e).find((id) => id.startsWith(`hero_${hero}#`));
const childOf = (mainId: string, part: string): string => mainId.replace(/:main$/, `:${part}`);
const flag = (e: Engine, id: string): boolean => {
  for (const eid of e.world.getAllEntities()) {
    const f = e.world.getComponent<Flag>(eid, 'Flag');
    if (f && f.id === id) return f.active;
  }
  return false;
};

describe('Game F — 自走棋（纯数据装配，零自走棋代码；棋子=每回合重展开的复合预制实例）', () => {
  it('蓝图可加载且确定（同初值重跑 hash 一致，含 prep 展开拍）', () => {
    const run = (): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameFBlueprint());
      for (let i = 0; i < 80; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run());
  });

  it('备战拍展开：8 槽位 → 8 个复合棋子实例（单位+名牌+血蓝条齐活，REQ-F-032/033）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 20; i++) e.world.tick(); // prep 早段已展开（onEnter 臂旗 → edge 信号 → 槽位 Caster → prefab）
    const r1 = mains(e);
    expect(r1).toHaveLength(7); // 我方 4 + 阶段1「黄巾散兵」敌 3（§4.5 关卡表）
    for (const m of r1) {
      expect(alive(e, childOf(m, 'name'))).toBe(true); // 名牌随模板整体展开
      expect(alive(e, childOf(m, 'hpbar'))).toBe(true); // 血条
      expect(alive(e, childOf(m, 'mana'))).toBe(true); // 蓝 sidecar
      const hp = e.world.getComponent<Resource>(m, 'Resource')!;
      expect(hp.current).toBe(hp.max); // 槽位 overrides 写入星级数值，满状态
      expect(hp.max).toBeGreaterThan(1); // 不是模板占位值（overrides 真生效）
    }
  });

  it('两队自动对冲互砍：双方都真受伤（aggro + grid-move + timer→event-when→caster→hitbox 涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const hurt = (hero: string): boolean => {
      const m = mainOf(e, hero);
      if (!m) return true; // 实例没了 = 战死（也算真受伤）
      const r = e.world.getComponent<Resource>(m, 'Resource');
      return !!r && r.current < r.max;
    };
    for (let i = 0; i < 400; i++) e.world.tick(); // 慢节奏(0.5s/动作)：走位~1.5s 后交火，给足时间
    expect(A_HEROES.some(hurt)).toBe(true);
    expect(B_HEROES.some(hurt)).toBe(true);
  });

  it('战斗收敛到团灭：一方存活=0 → 其 present Flag 落 false（Zone 判胜负）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const living = (prefix: string): number => mains(e).filter((id) => id.startsWith(prefix)).length;
    for (let i = 0; i < 50; i++) e.world.tick(); // 先让回合 1 展开
    let loser = ''; // 先团灭的那队（resolution 的 wipe 随后会把胜方也清掉，只有败方 flag 判定是本测的语义）
    for (let i = 0; i < 3000 && !loser; i++) {
      e.world.tick();
      if (living('hero_a_') === 0) loser = 'a';
      else if (living('hero_b_') === 0) loser = 'b';
    }
    expect(loser).not.toBe('');
    // 收敛后再跑几拍让 zone-occupancy 把 present flag 落定（mortal 销毁与 zone 计数差一拍）。
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(flag(e, `team_${loser}_present`)).toBe(false);
  });

  it('棋子死亡 → 名牌/条/sidecar 全族随之消失（hierarchy-cascade 经 @local: 重映射的真实父 id）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 50; i++) e.world.tick();
    const m = mainOf(e, 'a_guanyu')!;
    expect(m).toBeTruthy();
    for (const part of ['name', 'hpbar', 'mpbg', 'mana', 'ultcast']) expect(alive(e, childOf(m, part))).toBe(true); // 死前全在
    // 给关羽实例致命局部伤害 → 死亡。
    e.world.addComponent(m, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(alive(e, m)).toBe(false); // 棋子销毁
    for (const part of ['name', 'hpbar', 'mpbg', 'mana', 'ultcast']) expect(alive(e, childOf(m, part))).toBe(false); // 挂件无残留
  });

  it('蓝条→大招：普攻攒蓝 → 蓝满 EventWhen → Caster 展开各自大招区（每英雄唯一 id，纯数据涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const mp = (hero: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === `mp_${hero}`) return r.current;
      }
      return -1;
    };
    let guanyuUlt = false;
    for (let i = 0; i < 500; i++) {
      e.world.tick();
      if (e.world.getAllEntities().some((x) => x.startsWith('ult_a_guanyu#'))) guanyuUlt = true;
    }
    expect(mp('a_guanyu')).toBeGreaterThanOrEqual(0); // 蓝条资源存在（实例 sidecar 上）
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
      hpShrank ||= GAME_F_HERO_IDS.some((hero) => {
        const m = mainOf(e, hero);
        return !!m && w(childOf(m, 'hpbar')) < w(childOf(m, 'hpbg'));
      });
      mpFilled ||= GAME_F_HERO_IDS.some((hero) => {
        const m = mainOf(e, hero);
        return !!m && w(childOf(m, 'mpbar')) > 0;
      });
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
      froze = mains(e).some((id) => id.startsWith('hero_b_') && ((e.world.getComponent<Status>(id, 'Status')?.flags ?? 0) & FROZEN) !== 0);
    }
    expect(froze).toBe(true); // 魏方有人被八阵图冻住（定身/解冻语义由引擎 grid-move 4 测覆盖）
  });

  it('回合重置（REQ-F-032/033 接入）：团灭→resolution 清场→prep 重展开满状态新实例；槽位/模板库跨回合持久', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 60; i++) e.world.tick();
    const r1 = mains(e);
    expect(r1).toHaveLength(7); // 回合 1 展开（我方 4 + 阶段1 敌 3）
    // 打到一方团灭 → resolution 'wipe' destroy-tagged 双向清场 → 全场 0 子（挂件级联，下面用名牌验）。
    const r1name = childOf(r1[0], 'name');
    let wiped = false;
    for (let i = 0; i < 4000 && !wiped; i++) {
      e.world.tick();
      wiped = mains(e).length === 0;
    }
    expect(wiped).toBe(true);
    expect(alive(e, r1name)).toBe(false); // 名牌等挂件随清场级联，无孤儿
    expect(alive(e, 'slot_a_guanyu')).toBe(true); // 阵容槽位（无 Tag）持久
    expect(alive(e, 'slot_s2_b_simayi')).toBe(true); // 阶段 2 敌槽同样持久（§4.5 关卡表）
    expect(alive(e, 'library')).toBe(true); // 模板库持久
    // resolution 余下 ≤60 拍 + done 握手数拍 → 回 prep 重展开：+75 拍落在下一回合备战期内。
    for (let i = 0; i < 75; i++) e.world.tick();
    const r2 = mains(e);
    expect(r2).toHaveLength(7); // 新一轮（仍阶段1）7 子
    for (const id of r2) expect(r1).not.toContain(id); // prefab.seq 单调 → 实例 id 全新（确定性可重放）
    for (const m of r2) {
      const hp = e.world.getComponent<Resource>(m, 'Resource')!;
      expect(hp.current).toBe(hp.max); // 满状态重开（战斗状态不跨回合）
      expect(alive(e, childOf(m, 'hpbar'))).toBe(true); // 挂件随新实例整族重生
    }
  });

  it('平滑滑行（REQ-F-034 接入）：棋子 Transform 每拍位移 ≤ glideSpeed=0.8（旧为 ~18px/格瞬移），逻辑格照走', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 50; i++) e.world.tick(); // 展开完毕、进入走位
    const m = mainOf(e, 'a_guanyu')!;
    const t = (): Transform => e.world.getComponent<Transform>(m, 'Transform')!;
    let prev = { x: t().x, y: t().y };
    let maxStep = 0;
    let moved = false;
    for (let i = 0; i < 300 && alive(e, m); i++) {
      e.world.tick();
      if (!alive(e, m)) break;
      const cur = t();
      const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      maxStep = Math.max(maxStep, d);
      moved ||= d > 0;
      prev = { x: cur.x, y: cur.y };
    }
    expect(moved).toBe(true); // 真在滑（不是站桩）
    expect(maxStep).toBeLessThanOrEqual(0.81); // 每拍 ≤ glideSpeed → 平滑无瞬移
  });

  it('ready 开战（§3.3 操作表）：注入点击信号 → 备战提前结束进 combat（40 拍倒计时兜底仍在）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(flag(e, 'in_combat')).toBe(false); // 备战中
    // 走真实输入路：InputQueue 指针事件（世界坐标）→ clickable 命中「开战」按钮 → 'ready_btn' Signal → Effect 置 ready。
    // （裸造 Signal 实体行不通：event-when 每拍全局先清后标，外来信号活不到 Commit 的 effect-apply。）
    e.world.createEntity('input');
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x: 240, y: 170, phase: 'down' }] } as unknown as Resource);
    e.world.tick(); // 命中 → 信号 → ready=true（同拍 Commit）
    e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource); // 清空输入（单击语义）
    let entered = false;
    for (let i = 0; i < 15 && !entered; i++) {
      e.world.tick();
      entered = flag(e, 'in_combat');
    }
    expect(entered).toBe(true); // tick ~12-26 已开战 —— 远早于 40 拍兜底（兜底路径由其余测试天然覆盖）
  });

  it('L1 run_flow + §4.1/§4.2 表：回合1收入2金；advance 推进；败方按阶段表扣血；round>5 进位换关卡敌阵', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint());
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    for (let i = 0; i < 50; i++) e.world.tick();
    expect(res('player_hp')).toBe(100); // §3.1 量程（boot 初始化，旧 20 为占位）
    expect(res('round_idx')).toBe(1);
    expect(res('stage_idx')).toBe(1);
    expect(res('gold')).toBe(2); // §4.1 全局回合 1 基础收入 = 2（无利息、无连胜金）
    // 打完回合 1：L2 done 写 round_done → L1 advance round_idx→2 → 回 prep 发第二笔收入
    let guard = 0;
    while (res('round_idx') === 1 && guard++ < 4000) e.world.tick();
    expect(res('round_idx')).toBe(2);
    for (let i = 0; i < 50; i++) e.world.tick(); // 回合 2 备战：第二笔收入已发
    expect(res('gold')).toBe(4); // 2+2（gold<10 无利息；连胜 1 不够 §4.1 连胜金档）
    expect(res('player_hp')).toBe(flag(e, 'won') ? 100 : 98); // §4.2 阶段1败=基础0+存活近似2
    // 注入把 round_idx 推到 5（合法 sim 输入），打完该回合验证 >5 进位 banded：stage+1、round=1、敌阵换装
    e.world.addComponent('r_round_idx', { type: 'ResourceModify', resourceId: 'round_idx', amount: 3, scope: 'local' } as unknown as Resource);
    let guard2 = 0;
    while (!(res('round_idx') === 1 && res('stage_idx') === 2) && guard2++ < 4000) e.world.tick();
    expect(res('stage_idx')).toBe(2); // when_stage_up：进位发生
    for (let i = 0; i < 50; i++) e.world.tick(); // 阶段 2 备战展开
    expect(mains(e).filter((id) => id.startsWith('hero_b_'))).toHaveLength(4); // 关卡表换敌阵：「董卓先锋」4 子全强度
  });
});
