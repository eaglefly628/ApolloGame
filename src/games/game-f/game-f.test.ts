import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Flag, Shape, Status, Transform } from '@engine/protocol/components.js';
import { buildGameFBlueprint, GAME_F_HERO_IDS, FROZEN, TEAM_A } from './blueprint.js';
import { offsetToAxial } from './hex.js';

// 节奏：缺省=玩家档（备战30s）；测试统一快速档维持既有时序断言。
const FAST = { prepTicks: 40, resolutionTicks: 60 };

// 棋子=运行时展开的实例（REQ-F-032 回合重置）：id 形如 `hero_<英雄>#<seq>:main`，
// 名牌/条/大招接线是同模板兄弟实例（REQ-F-033 '@local:' 重映射）→ 测试按前缀/后缀寻址。
const A_HEROES = GAME_F_HERO_IDS.filter((id) => id.startsWith('a_'));
const B_HEROES = GAME_F_HERO_IDS.filter((id) => id.startsWith('b_'));

const alive = (e: Engine, id: string): boolean => e.world.getAllEntities().includes(id);
// 注意：overlap/trigger 碰撞对实体的 id 形如 `overlap:<甲>:<乙>`，乙可能是 ...:main 结尾 → 必须再按 hero_ 前缀过滤。
const mains = (e: Engine): string[] => e.world.getAllEntities().filter((id) => (id.startsWith('hero_') || id.startsWith('mob_')) && id.endsWith(':main')); // 棋子=英雄+野怪（批B：阶段1 全野怪）
const isBSide = (id: string): boolean => id.startsWith('hero_b_') || id.startsWith('mob_'); // B 方=魏将∪野怪
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
      e.load(buildGameFBlueprint(FAST));
      for (let i = 0; i < 80; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run());
  });

  it('备战拍展开：8 槽位 → 8 个复合棋子实例（单位+名牌+血蓝条齐活，REQ-F-032/033）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 20; i++) e.world.tick(); // prep 早段已展开（onEnter 臂旗 → edge 信号 → 槽位 Caster → prefab）
    const r1 = mains(e);
    expect(r1).toHaveLength(7); // 我方 4 + 阶段1「黄巾散兵」敌 3（§4.5 关卡表）
    for (const m of r1) {
      expect(alive(e, childOf(m, 'name'))).toBe(true); // 名牌随模板整体展开
      expect(alive(e, childOf(m, 'hpbar'))).toBe(true); // 血条
      if (m.startsWith('hero_')) expect(alive(e, childOf(m, 'mana'))).toBe(true); // 蓝 sidecar（野怪无大招链）
      const hp = e.world.getComponent<Resource>(m, 'Resource')!;
      expect(hp.current).toBe(hp.max); // 槽位 overrides 写入星级数值，满状态
      expect(hp.max).toBeGreaterThan(1); // 不是模板占位值（overrides 真生效）
    }
  });

  it('两队自动对冲互砍：双方都真受伤（aggro + grid-move + timer→event-when→caster→hitbox 涌现）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
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
    e.load(buildGameFBlueprint(FAST));
    const livingA = (): number => mains(e).filter((id) => id.startsWith('hero_a_')).length;
    const livingB = (): number => mains(e).filter(isBSide).length;
    for (let i = 0; i < 50; i++) e.world.tick(); // 先让回合 1 展开
    let loser = ''; // 先团灭的那队（resolution 的 wipe 随后会把胜方也清掉，只有败方 flag 判定是本测的语义）
    for (let i = 0; i < 3000 && !loser; i++) {
      e.world.tick();
      if (livingA() === 0) loser = 'a';
      else if (livingB() === 0) loser = 'b';
    }
    expect(loser).not.toBe('');
    // 收敛后再跑几拍让 zone-occupancy 把 present flag 落定（mortal 销毁与 zone 计数差一拍）。
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(flag(e, `team_${loser}_present`)).toBe(false);
  });

  it('棋子死亡 → 名牌/条/sidecar 全族随之消失（hierarchy-cascade 经 @local: 重映射的真实父 id）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 50; i++) e.world.tick();
    const m = mainOf(e, 'a_guanyu')!;
    expect(m).toBeTruthy();
    for (const part of ['name', 'hpbar', 'mpbg', 'mana']) expect(alive(e, childOf(m, part))).toBe(true); // 死前全在
    // 给关羽实例致命局部伤害 → 死亡。
    e.world.addComponent(m, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(alive(e, m)).toBe(false); // 棋子销毁
    for (const part of ['name', 'hpbar', 'mpbg', 'mana']) expect(alive(e, childOf(m, part))).toBe(false); // 挂件无残留
  });

  it('蓝条→大招（F-9 完结篇，全 per-instance）：over-time 回蓝 → sidecar SelfRule 蓝满放招清蓝', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const mp = (hero: string): number => {
      const m = mainOf(e, hero);
      if (!m) return -1;
      return e.world.getComponent<Resource>(childOf(m, 'mana'), 'Resource')?.current ?? -1; // 普通 id 'mp'，实例寻址
    };
    let guanyuUlt = false;
    let drained = false;
    for (let i = 0; i < 500; i++) {
      e.world.tick();
      if (e.world.getAllEntities().some((x) => x.startsWith('ult_a_guanyu#'))) {
        guanyuUlt = true;
        if (mp('a_guanyu') === 0) drained = true; // 放招拍清蓝（SelfRule do 同拍 set 0）
      }
    }
    expect(guanyuUlt).toBe(true); // 关羽蓝满放出了大招区
    expect(drained).toBe(true); // 清蓝随放招原子发生
  });

  it('实时血条/蓝条：战斗中 hp 填充条真随掉血缩窄（< 自身满宽轨道）、mp 填充条真随攒蓝充起（REQ-F-029 gauge 接入）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
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
    e.load(buildGameFBlueprint(FAST));
    let froze = false;
    for (let i = 0; i < 600 && !froze; i++) {
      e.world.tick();
      froze = mains(e).some((id) => isBSide(id) && ((e.world.getComponent<Status>(id, 'Status')?.flags ?? 0) & FROZEN) !== 0);
    }
    expect(froze).toBe(true); // 魏方有人被八阵图冻住（定身/解冻语义由引擎 grid-move 4 测覆盖）
  });

  it('回合重置（REQ-F-032/033 接入）：团灭→resolution 清场→prep 重展开满状态新实例；槽位/模板库跨回合持久', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
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
    expect(alive(e, 'slot_a_guanyu_s1')).toBe(true); // 阵容槽位（无 TEAM 位，F-17 后每将×3星级一组）持久
    expect(alive(e, 'slot_s2_2_b_simayi')).toBe(true); // 阶段 2 敌槽同样持久（槽位 id 带序号防同名撞键）
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
    e.load(buildGameFBlueprint(FAST));
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

  it('F-9 同模板多实例普攻不串台：错拍注入第二个关羽 → 一个攻击周期窗（45 拍）内 ≥2 个独立打击区', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    // 先抬人口到 8（F-17 超员自动卖入战拍保最早 level 个——本测要养 5 个我方单位，不抬会被按规则卖掉第 5 个）
    e.world.addComponent('r_level', { type: 'ResourceModify', resourceId: 'level', amount: 4, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 20; i++) e.world.tick(); // 槽位关羽已展开（timer 自 tick~2 起跳）
    // 注入第二个同模板关羽（错拍 20：两实例 timer 相位错开 → 出手拍必然不同）；坐标视觉(3,7)经 odd-r 换算
    const a = offsetToAxial(3, 7);
    e.world.createEntity('req2');
    e.world.addComponent('req2', {
      type: 'SpawnRequest',
      templateId: 'hero_a_guanyu',
      x: 0,
      y: 0,
      overrides: { main: { HexPos: { q: a.q, r: a.r }, Tag: { flags: TEAM_A }, Resource: { current: 5000, max: 5000 } } },
    } as unknown as Resource);
    const seen = new Set<string>();
    for (let i = 20; i < 88; i++) {
      // 窗口止于 88：槽位关羽的第二击在 ~91，窗内每实例至多 1 击 → ≥2 即证两实例各自出手
      e.world.tick();
      for (const id of e.world.getAllEntities()) if (id.startsWith('strike_a_guanyu#')) seen.add(id);
    }
    expect(mains(e).filter((id) => id.startsWith('hero_a_guanyu#'))).toHaveLength(2); // 双关羽都活着
    expect(seen.size).toBeGreaterThanOrEqual(2); // 旧"唯一 id"方案此处必串台（共读首份 timer/同信号齐发）
  });

  it('whenGlobal 阶段门（REQ-F-035/F-9）：关 in_combat 立即停手（目标仍在），重开恢复出手', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 60; i++) e.world.tick(); // 进入战斗（已交火）
    const setCombat = (v: boolean): void => {
      for (const eid of e.world.getAllEntities()) {
        const f = e.world.getComponent<Flag>(eid, 'Flag');
        if (f && f.id === 'in_combat') f.active = v;
      }
    };
    const strikes = (): number => e.world.getAllEntities().filter((id) => id.startsWith('strike_')).length;
    setCombat(false); // 模拟 flow 关门（resolution/prep 即此语义）
    for (let i = 0; i < 3; i++) { e.world.tick(); setCombat(false); } // 旧打击区 2 拍自毁，清残留
    let closed = 0;
    for (let i = 0; i < 60; i++) { e.world.tick(); setCombat(false); closed += strikes(); }
    expect(closed).toBe(0); // 门关：目标仍在也零出手（备战/结算不动手铁律；窗口短于首个大招 ~225 拍，无 ult 干扰）
    setCombat(true);
    let reopened = 0;
    for (let i = 0; i < 50 && !reopened; i++) { e.world.tick(); reopened = strikes(); }
    expect(reopened).toBeGreaterThan(0); // 门开恢复出手
  });

  it('ready 开战（§3.3 操作表）：注入点击信号 → 备战提前结束进 combat（40 拍倒计时兜底仍在）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
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

  it('商店买入核心（F-11/REQ-F-040 + v2 §4.6）：钱不够原子拒单（牌不丢金不动）；付得起则扣金占席、据码入备战席、bought_code 复位', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const play0 = (): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'shop', key: 'play', values: [0] }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    for (let i = 0; i < 50; i++) e.world.tick(); // 回合1基础收入=2金（<3：买不起）
    expect(res('gold')).toBe(2);
    play0();
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(res('gold')).toBe(2); // 拒单：金不动
    expect(res('bench_space')).toBe(9); // 席位不动
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_'))).toBe(false); // 无 marker（牌也不丢，引擎拒单五断言盖）
    // 注资 → 买成：回合1 prep 自动刷新后手牌=[4,1,3,1,2] → 槽0 = 4 = 周瑜
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 2; i++) e.world.tick();
    play0();
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(res('gold')).toBe(9); // 12 - 3
    expect(res('bench_space')).toBe(8); // 占 1 席
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_a_zhouyu#'))).toBe(true); // 据码（自动刷新后槽0=4=周瑜）入席
    expect(res('bought_code')).toBe(0); // 复位（防同码二连买 edge 失效）
  });

  it('商店余三件（F-12/REQ-F-041）：prep 自动刷新换牌；锁店跳过刷新且开战自动解锁；点席卖出返还金+席位', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const hand = (): string => (e.world.getComponent('shop', 'CardPile') as unknown as { hand: number[] }).hand.join(',');
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    // 回合1 prep 自动刷新：袋前 5 [3,1,4,2,2] 被弃、换下一批 → 手牌 ≠ 初发
    for (let i = 0; i < 10; i++) { e.world.tick(); console.log(`t${i + 1} hand=[${hand()}]`); }
    expect(hand()).toBe('4,1,3,1,2'); // 弃 [3,1,4,2,2] 补 deck 第 6-10 张（确定性）
    // 点「锁店」→ 打完回合1 → 回合2 prep 自动刷新被门挡（手牌不变）→ 开战拍自动解锁
    click(96, 170);
    expect(flag(e, 'shop_locked')).toBe(true);
    let guard = 0;
    while (res('round_idx') === 1 && guard++ < 4000) e.world.tick();
    const handAtR2 = hand();
    for (let i = 0; i < 10; i++) e.world.tick(); // 回合2 prep 早段：刷新窗已过
    expect(hand()).toBe(handAtR2); // 锁店生效：没换牌
    let guard2 = 0;
    while (!flag(e, 'in_combat') && guard2++ < 100) e.world.tick(); // 到开战拍
    expect(flag(e, 'shop_locked')).toBe(false); // 开战自动解锁（次序在刷新门判定之后）
    // 手动刷新 $2：注资后点「刷新」→ 扣 2 金 + 换牌（锁着也能花钱换——先验证解锁态即可）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 2; i++) e.world.tick();
    const goldBefore = res('gold');
    const handBefore = hand();
    click(150, 170);
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(res('gold')).toBe(goldBefore - 2); // 原子扣 2 金
    expect(hand()).not.toBe(handBefore); // 真换牌
    // 卖出：先买一个（手牌槽0）→ 点其席位 → marker 没了、金 +2、席位回 9
    const buyGold = res('gold');
    if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'shop', key: 'play', values: [0] }] } as unknown as Resource);
    e.world.tick();
    e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(res('gold')).toBe(buyGold - 3);
    expect(res('bench_space')).toBe(8);
    const marker = e.world.getAllEntities().find((id) => id.startsWith('bench_') && id.endsWith(':seat'))!;
    expect(marker).toBeTruthy();
    const mt = e.world.getComponent<Transform>(marker, 'Transform')!;
    click(mt.x, mt.y); // 点谁卖谁（'@signal-source'）
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(marker)).toBe(false); // 席位销毁
    expect(res('gold')).toBe(buyGold - 3 + 2); // 卖价 2 返还
    expect(res('bench_space')).toBe(9); // 席位归还
  });

  it('MVP-1 尾款（§4.1/§4.3）：买经验$4=+4XP且 xp 阈值升级；连败计数随败累加（连败金 band 与连胜同形）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    for (let i = 0; i < 50; i++) e.world.tick(); // 进战斗（income_armed 已关：避开利息区间带对注资/消费的边沿响应——带宽语义见 finish-list Gotchas）
    expect(res('xp')).toBe(2); // 回合1 prep 自动 +2 XP（§4.3）
    expect(res('level')).toBe(4); // 起始等级=现固定阵容人口
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 30, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 2; i++) e.world.tick();
    const g0 = res('gold');
    for (let k = 0; k < 5; k++) { click(96, 122); for (let i = 0; i < 2; i++) e.world.tick(); } // 买经验 ×5
    expect(res('xp')).toBe(22); // 2 + 5×4
    expect(res('gold')).toBe(g0 - 20); // $4×5 原子扣费
    expect(res('level')).toBe(5); // xp≥20 → 升 5（§4.3 阈值表）
    // 连败计数：杀光我方 → 败方路径 → lose_streak +1（连败金 band 与连胜金同构同测法）
    for (const m of mains(e).filter((id) => id.startsWith('hero_a_'))) {
      e.world.addComponent(m, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' } as unknown as Resource);
    }
    let guard = 0;
    while (res('lose_streak') === 0 && guard++ < 200) e.world.tick();
    expect(res('lose_streak')).toBe(1); // 败 → 连败+1（胜路清零由 flow 同一转移对称保证）
  });

  it('F-16 三件（REQ-F-044/047/048②）：蜀魂羁绊开战锁存 ×1.2；卖出归还牌袋（deck 回长）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const deckLen = (): number => (e.world.getComponent('shop', 'CardPile') as unknown as { deck: number[] }).deck.length;
    const input = (actions: unknown[]): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    // 羁绊：场上蜀将 3（关羽/赵云/诸葛；周瑜=吴不计）→ 开战拍锁存 dmg_scale_a=1.2
    let guard = 0;
    while (!flag(e, 'in_combat') && guard++ < 100) e.world.tick();
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(res('count_shu')).toBe(3); // group-count 按 FACT_SHU 计场上
    expect(res('dmg_scale_a')).toBeCloseTo(1.2); // 蜀魂 ≥3 锁存（prep 复位 ×1，下回合重判）
    // 卖出袋归还：注资买 1（deck 抽 1 补手 → 净 -1）→ 点席卖 → 码归还袋底（净回 +1）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 2; i++) e.world.tick();
    input([{ source: 'shop', key: 'play', values: [0] }]);
    for (let i = 0; i < 6; i++) e.world.tick();
    const afterBuy = deckLen();
    const seat = e.world.getAllEntities().find((id) => id.startsWith('bench_') && id.endsWith(':seat'))!;
    const st = e.world.getComponent<Transform>(seat, 'Transform')!;
    input([{ source: 'test', x: st.x, y: st.y, phase: 'down' }]);
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(seat)).toBe(false); // 席位售出销毁
    expect(deckLen()).toBe(afterBuy + 1); // 码归还袋底（§4.6 有限袋语义保真）
    expect(res('sold_code')).toBe(0); // 引擎自清
  });

  it('开局符文三选一（批D）：点「屯粮」金+10、三卡整组收走（一次性）；不点不影响流程', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(alive(e, 'rune_a')).toBe(true); // 三卡在场
    const g0 = res('gold');
    click(-110, -100); // 选「屯粮」
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(res('gold')).toBe(g0 + 10 + 1); // 生效（+1=备战窗内 2→12 上穿利息 10 档的带宽语义，已知 TUNE 项见 Gotchas）
    expect(alive(e, 'rune_a')).toBe(false); // 整组收走（含被点那张）
    expect(alive(e, 'rune_b')).toBe(false);
    expect(alive(e, 'rune_c')).toBe(false);
  });

  it('主角小小英雄（批C，§4.7）：常驻不参战不被清场；碰法球两清、赏金入账金币后清零', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(alive(e, 'protag')).toBe(true);
    const goldBefore = res('gold');
    // 在主角脚下生成一颗法球（模拟野怪掉落落点重合）→ 双向 hitbox 两清
    e.world.createEntity('lootreq');
    e.world.addComponent('lootreq', { type: 'SpawnRequest', templateId: 'loot_orb', x: 0, y: 120 } as unknown as Resource);
    for (let i = 0; i < 8; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('loot_orb#'))).toBe(false); // 球真结算一次后同拍自毁（044 consumeOnHit）
    expect(res('gold')).toBe(goldBefore + 5); // 赏金入账（loot→valueFrom→gold）
    expect(res('loot')).toBe(0); // 本地袋清零
    // 跑完回合 1 清场 → 主角与名牌仍常驻
    let wiped = false;
    for (let i = 0; i < 4000 && !wiped; i++) { e.world.tick(); wiped = mains(e).length === 0; }
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(alive(e, 'protag')).toBe(true);
    expect(alive(e, 'protag_name')).toBe(true);
  });

  it('野怪回合+法球（批B，一图流）：阶段1 全野怪（黄巾波次）；野怪死亡掉法球；结算清场含未拾法球', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 50; i++) e.world.tick();
    expect(mains(e).filter((m) => m.startsWith('mob_'))).toHaveLength(3); // 阶段1=PVE_WAVES[0] 黄巾×3
    expect(mains(e).filter((m) => m.startsWith('hero_b_'))).toHaveLength(0); // 无 PvP 敌阵（整段野怪化）
    const mob = mains(e).find((m) => m.startsWith('mob_'))!;
    e.world.addComponent(mob, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('loot_orb#'))).toBe(true); // 死亡掉法球（Mortal.dropTemplate）
    let wiped = false;
    for (let i = 0; i < 4000 && !wiped; i++) { e.world.tick(); wiped = mains(e).length === 0; }
    expect(wiped).toBe(true);
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('loot_orb#'))).toBe(false); // 未拾法球随 wipe 清（主角拾取=批C）
  });

  it('商店面板可视可点 + HUD 数字（F-14/F-15，REQ-F-042/043）：5 卡面随镜像重铺；点卡即买；金币数字实时', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const cards = (): string[] => e.world.getAllEntities().filter((id) => id.startsWith('shopcard_') && id.endsWith(':card'));
    const hudGold = (): string => (e.world.getComponent('hud_gold', 'Text') as unknown as { content: string }).content;
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    for (let i = 0; i < 12; i++) e.world.tick(); // 刷新 → 两段脉冲 → 重铺完毕
    expect(cards()).toHaveLength(5); // 5 张在售卡面可见
    expect(hudGold()).toBe('金币 2'); // HUD 数字=回合1收入（text-binding 实时投影）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 20, scope: 'local' } as unknown as Resource);
    for (let i = 0; i < 3; i++) e.world.tick();
    const g0 = res('gold');
    click(-170, 148); // 点第 1 张卡 = buy_slot_1 → playOnSignals 购买
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(res('gold')).toBe(g0 - 3); // 扣金
    expect(res('bench_space')).toBe(8); // 占席
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_') && id.endsWith(':seat'))).toBe(true); // 入席可见
    expect(cards()).toHaveLength(5); // 买走→补牌→镜像变 → 面板整体重铺仍 5 张
    expect(hudGold()).toBe(`金币 ${g0 - 3}`); // HUD 跟跳
  });

  it('L1 run_flow + §4.1/§4.2 表：回合1收入2金；advance 推进；败方按阶段表扣血；round>5 进位换关卡敌阵', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
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

  it('升星合成（F-17/REQ-F-046）：3 同将席位 marker 自动合二星；席位 3→1 自动回账；下回合按 ×1.8 血/×1.5 弹上场；星级卖价', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] } as unknown as Resource);
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] } as unknown as Resource);
    };
    for (let i = 0; i < 10; i++) e.world.tick(); // 回合1 备战（star_a_guanyu 初值 1，本回合已按 1 星部署）
    // 直注 3 张关羽席位 marker（绕过商店牌序的购买路径——merge 只认 PrefabOrigin 家族，与来源无关）
    [-66, -22, 22].forEach((x, i) => {
      e.world.createEntity(`mreq${i}`);
      e.world.addComponent(`mreq${i}`, { type: 'SpawnRequest', templateId: 'bench_a_guanyu', x, y: 178 } as unknown as Resource);
    });
    for (let i = 0; i < 6; i++) e.world.tick();
    // 三连合成：最老 3 个原子换 1 个二星 marker（锚在最老位置 x=-66），★★ 角标随体
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_a_guanyu#'))).toBe(false); // 3 张熔毁
    const b2 = e.world.getAllEntities().filter((id) => id.startsWith('bench2_a_guanyu#') && id.endsWith(':seat'));
    expect(b2).toHaveLength(1);
    expect(e.world.getComponent<Transform>(b2[0], 'Transform')!.x).toBe(-66);
    expect(alive(e, b2[0].replace(/:seat$/, ':star'))).toBe(true);
    expect(res('star_a_guanyu')).toBe(2); // 星级资源跟手（marker 计数 → 升星带）
    expect(res('bench_space')).toBe(8); // 派生回账：3 席熔成 1 席 → 9−1（手工 ± 无此账）
    // 下回合部署带按 star=2 选档：血 ×1.8、普攻换 s2 弹（大招同管道）
    let guard = 0;
    while (res('round_idx') === 1 && guard++ < 4000) e.world.tick();
    for (let i = 0; i < 50; i++) e.world.tick(); // 回合2 备战展开
    const m = mains(e).find((id) => id.startsWith('hero_a_guanyu#'))!;
    expect(m).toBeTruthy();
    const hp = e.world.getComponent<Resource>(m, 'Resource')!;
    expect(hp.max).toBe(Math.round((240 * 18 + 120) * 1.8)); // finalHp(关羽含玉玺) × 1.8 = 7992
    expect((e.world.getComponent(m, 'SelfRule') as unknown as { do: { template: string }[] }).do[0].template).toBe('strike_a_guanyu_s2');
    // 星级卖价（在战斗窗卖：income 窗已关，金额断言不吃利息带宽）：点二星席=sell2 → +8 金、星级回落 1
    let guard2 = 0;
    while (!flag(e, 'in_combat') && guard2++ < 100) e.world.tick();
    const g0 = res('gold');
    click(-66, 178);
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(b2[0])).toBe(false); // 点谁卖谁
    expect(res('gold')).toBe(g0 + 8); // 2星卖价 = 3×3−1（§4.6）
    expect(res('star_a_guanyu')).toBe(1); // 手里没高星了 → 降档带回 1
    expect(res('bench_space')).toBe(9);
  });

  it('摆子拖拽预备（F-18 数据侧）：in_prep 相位门随 flow 启闭；席位 marker 已带 Draggable（系统注册等 REQ-F-050 定序补丁）', () => {
    // drag-place 系统暂缓注册（与 motion-apply 的 Transform RMW 对成 SCC，REQ-F-050 一行 runsBefore 已提主程）。
    // 本测锁数据侧就绪度：门旗生命周期 + marker 自带 Draggable{onlyFlag:'in_prep'}；落地后补拖动交互断言
    // （备战拖到自由落点改 Transform / 战斗期 onlyFlag 拒拖 / 无 snap 不写 HexPos——脚本已在 F-18 回执存档）。
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(flag(e, 'in_prep')).toBe(true); // 备战相位门开（flow prep onEnter 维护）
    e.world.createEntity('mreq');
    e.world.addComponent('mreq', { type: 'SpawnRequest', templateId: 'bench_a_zhaoyun', x: -66, y: 178 } as unknown as Resource);
    for (let i = 0; i < 3; i++) e.world.tick();
    const seat = e.world.getAllEntities().find((id) => id.startsWith('bench_a_zhaoyun#') && id.endsWith(':seat'))!;
    expect(seat).toBeTruthy();
    const d = e.world.getComponent(seat, 'Draggable') as unknown as { onlyFlag: string } | undefined;
    expect(d?.onlyFlag).toBe('in_prep'); // 惰性数据已就位（无系统消费=零开销，解注即活）
    expect(e.world.getComponent(seat, 'HexPos')).toBeFalsy(); // 席上 marker 不带 HexPos：不进占位集/不挡寻路
    let guard = 0;
    while (!flag(e, 'in_combat') && guard++ < 100) e.world.tick();
    expect(flag(e, 'in_prep')).toBe(false); // 开战即关门
  });
});
