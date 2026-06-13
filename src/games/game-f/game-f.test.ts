import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Flag, Shape, Status, Transform, HexPos, CardPile, SelfRule } from '@engine/protocol/components.js';
import { buildGameFBlueprint, gameFEnemyPreview, GAME_F_HERO_IDS, FROZEN, TEAM_A, TEAM_B, rosterFor } from './blueprint.js';
import { offsetToAxial, project } from './hex.js';

// 节奏：缺省=玩家档（备战30s）；测试统一快速档维持既有时序断言。
const FAST = { prepTicks: 40, resolutionTicks: 60, celebrateTicks: 12 };

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

  it('开局播种+入战拍展开（REQ-F-049 统一架构）：备战=板上 4 可拖 marker、零棋子；开战拍棋子在各自 marker 格成型', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 20; i++) e.world.tick(); // 备战期
    expect(mains(e)).toHaveLength(0); // 棋子开战才成型（备战摆的是 marker 本体）
    const seats = e.world.getAllEntities().filter((id) => id.startsWith('bench_') && id.endsWith(':seat'));
    expect(seats).toHaveLength(4); // 开局播种 4 个在板 marker（与买入 marker 同族、可拖可卖可合成）
    for (const s of seats) expect(e.world.getComponent(s, 'HexPos')).toBeTruthy(); // 在板（哨兵继承 bootcast 的格）
    for (let i = 0; i < 30; i++) e.world.tick(); // FAST prep 40 → 入战拍部署 → prefab 成型
    const r1 = mains(e);
    expect(r1).toHaveLength(7); // 我方 4 + 阶段1「黄巾散兵」敌 3（§4.5 关卡表）
    for (const m of r1) {
      expect(alive(e, childOf(m, 'name'))).toBe(true); // 名牌随模板整体展开
      expect(alive(e, childOf(m, 'hpbar'))).toBe(true); // 血条
      if (m.startsWith('hero_')) expect(alive(e, childOf(m, 'mana'))).toBe(true); // 蓝 sidecar（野怪无大招链）
      const hp = e.world.getComponent<Resource>(m, 'Resource')!;
      expect(hp.current).toBe(hp.max); // overrides 写入星级数值，满状态
      expect(hp.max).toBeGreaterThan(1); // 不是模板占位值（overrides 真生效）
    }
    // 我方棋子的格 = marker 的格（'@origin-hex' 哨兵跟手）
    const guanyuSeat = seats.find((s) => s.startsWith('bench_a_guanyu#'))!;
    const seatHex = e.world.getComponent<HexPos>(guanyuSeat, 'HexPos')!;
    const heroHex = e.world.getComponent<HexPos>(mains(e).find((m) => m.startsWith('hero_a_guanyu#'))!, 'HexPos')!;
    expect([heroHex.q, heroHex.r]).toEqual([seatHex.q, seatHex.r]);
    // REQ-F-056：战斗期 marker 隐藏（消「武将复制、老的没删」幽灵）——seat 持久但 Visibility=false。
    const vis = (id: string): boolean => (e.world.getComponent(id, 'Visibility') as { visible: boolean } | undefined)?.visible ?? true;
    expect(alive(e, guanyuSeat)).toBe(true); // marker 持久（记布阵不删）
    expect(vis(guanyuSeat)).toBe(false); // 战斗期隐藏（只剩会动的战斗棋子可见，无双重显示）
  });

  it('开局符文开战自动收走（用户报「永远在屏幕中央」）+ 商店卡带价签（用户报「没有价格」）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 12; i++) e.world.tick();
    expect(alive(e, 'rune_a')).toBe(true); // 回合1备战：符文三选一在场
    expect(alive(e, 'rune_title')).toBe(true); // 标题说明
    // 商店卡价签：在售大卡有价格子实体（💰3）
    const priceCards = e.world.getAllEntities().filter((id) => id.startsWith('shopcard_') && id.endsWith(':cardprice'));
    expect(priceCards.length).toBeGreaterThan(0);
    // 不点符文 → 开战拍 ph_combat 兜底收走（真打的时候去掉）
    let guard = 0;
    while (!flag(e, 'in_combat') && guard++ < 200) e.world.tick();
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(alive(e, 'rune_a')).toBe(false); // 开战即清
    expect(alive(e, 'rune_title')).toBe(false);
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
    e.world.addComponent(m, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' });
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(alive(e, m)).toBe(false); // 棋子销毁
    for (const part of ['name', 'hpbar', 'mpbg', 'mana']) expect(alive(e, childOf(m, part))).toBe(false); // 挂件无残留
    // 死亡碎裂（打击感批）：Mortal.dropTemplate 在尸位炸出 4 个迷你分身飞散渐隐，lifetime 自清
    expect(e.world.getAllEntities().filter((id) => id.startsWith('death_a_guanyu#')).length).toBe(4);
    for (let i = 0; i < 40; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('death_a_guanyu#'))).toBe(false); // 自清无残留
  });

  it('战后庆祝相位（用户「打完不要瞬间全消失」）：胜方横幅+彩点、幸存棋子留板亮相，停拍后才清场；远程弹道在飞', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const ui = (): string => { for (const x of e.world.getAllEntities()) { const st = e.world.getComponent(x, 'State') as { fsmId: string; current: string } | undefined; if (st && st.fsmId === 'round_ui') return st.current; } return '?'; };
    const vis = (id: string): boolean => (e.world.getComponent(id, 'Visibility') as { visible: boolean } | undefined)?.visible ?? true;
    // 战斗中：远程/法术棋子有真弹道（追踪弹实体在场）
    let sawProj = false;
    let guard = 0;
    while (ui() !== 'celebrate' && guard++ < 4000) {
      e.world.tick();
      sawProj ||= e.world.getAllEntities().some((id) => id.startsWith('proj_'));
    }
    expect(ui()).toBe('celebrate'); // 团灭后先进庆祝亮相，不直接清场
    expect(sawProj).toBe(true); // 法术/远程=追踪弹道（诸葛/周瑜/野怪对手里至少一方射过）
    expect(mains(e).length).toBeGreaterThan(0); // 幸存棋子留板亮相（没瞬间全消失）
    for (let i = 0; i < 3; i++) e.world.tick();
    const won = flag(e, 'won');
    expect(vis(won ? 'banner_win' : 'banner_lose')).toBe(true); // 胜/败横幅亮起
    if (won) expect(e.world.getAllEntities().some((id) => id.startsWith('win_burst#'))).toBe(true); // 金彩喷洒
    let guard2 = 0;
    while (ui() === 'celebrate' && guard2++ < 200) e.world.tick();
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(ui()).toBe('resolution');
    expect(mains(e)).toHaveLength(0); // 亮相结束才清场
    expect(vis('banner_win')).toBe(false); // 横幅随相位收走
    expect(vis('banner_lose')).toBe(false);
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
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_a_guanyu#') && id.endsWith(':seat'))).toBe(true); // 阵容=marker（无 TEAM 位）跨回合持久
    expect(alive(e, 'slot_s2_2_b_simayi')).toBe(true); // 阶段 2 敌槽同样持久（槽位 id 带序号防同名撞键）
    expect(alive(e, 'library')).toBe(true); // 模板库持久
    // resolution + done 握手 → 回 prep（marker 留板）→ 下一开战拍重展开满状态新实例。
    let r2: string[] = [];
    for (let i = 0; i < 4000 && r2.length < 7; i++) { e.world.tick(); r2 = mains(e); }
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
    // 7×8 真盘 + 射程驻足（F-060）后：前排出生即贴脸、法师站射程外——开局阵无人需要走位。
    // 备战期把关羽 marker 拖去后排 (2,7) → 开战后近战必须步行入场，借此采样滑行。
    for (let i = 0; i < 10; i++) e.world.tick();
    const gseat = e.world.getAllEntities().find((id) => id.startsWith('bench_a_guanyu#') && id.endsWith(':seat'))!;
    const gt = e.world.getComponent<Transform>(gseat, 'Transform')!;
    const back = offsetToAxial(2, 7);
    const bp2 = project(back.q, back.r);
    e.world.createEntity('input');
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', key: 'drag', x: gt.x, y: gt.y, values: [bp2.x, bp2.y], phase: 'drag' }] });
    e.world.tick();
    e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    for (let i = 0; i < 39; i++) e.world.tick(); // 入战拍展开
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
    for (let i = 0; i < 50; i++) e.world.tick(); // 入战拍部署完毕（FAST prep 40 + 成型 ~4 拍；超员检查带此前已收口）
    expect(mains(e).some((id) => id.startsWith('hero_a_guanyu#'))).toBe(true);
    // 注入第二个同模板关羽（错拍：两实例 timer 相位差 ~6 拍 → 出手拍必然不同）；坐标视觉(3,7)经 odd-r 换算。
    // 注入在 enforce_cap 检查带（count_team_a≥1 边沿，~tick 46）之后 → 不触保额清场，5 单位合法存活。
    const a = offsetToAxial(3, 7);
    e.world.createEntity('req2');
    e.world.addComponent('req2', {
      type: 'SpawnRequest',
      templateId: 'hero_a_guanyu',
      x: 0,
      y: 0,
      overrides: { main: { HexPos: { q: a.q, r: a.r }, Tag: { flags: TEAM_A }, Resource: { current: 5000, max: 5000 } } },
    });
    const seen = new Set<string>();
    for (let i = 50; i < 140; i++) {
      // 窗口 [50,140)：槽源关羽首击 ~88、注入关羽首击 ~96、槽源二击 ~133——窗内两实例各自出手即证不串台
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
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x: 300, y: 180, phase: 'down' }] });
    e.world.tick(); // 命中 → 信号 → ready=true（同拍 Commit）
    e.world.addComponent('input', { type: 'InputQueue', actions: [] }); // 清空输入（单击语义）
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
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'shop', key: 'play', values: [0] }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    // 起手金 5 → 先降到 2 以验「钱不够原子拒单」（备战期无收入窗，停在 2）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: -3, scope: 'local' });
    for (let i = 0; i < 2; i++) e.world.tick();
    expect(res('gold')).toBe(2); // 2 金 < 3 买不起
    play0();
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(res('gold')).toBe(2); // 拒单：金不动
    expect(res('bench_space')).toBe(9); // 席位不动
    expect(e.world.getAllEntities().filter((id) => id.startsWith('bench_') && id.endsWith(':seat'))).toHaveLength(4); // 无新 marker（只有开局 4 个在板，牌也不丢——引擎拒单五断言盖）
    // 注资 → 买成：等到 r2 备战（结算窗外注资才不蹭利息带）；r2 自动刷新后手牌=[1,3,1] → 槽0 = 1 = 关羽
    let r2guard = 0;
    while (res('round_idx') === 1 && r2guard++ < 4000) e.world.tick();
    for (let i = 0; i < 10; i++) e.world.tick(); // r2 备战早段（刷新已过）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' });
    for (let i = 0; i < 2; i++) e.world.tick();
    const gFunded = res('gold');
    play0();
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(res('gold')).toBe(gFunded - 3); // 原子扣价
    expect(res('bench_space')).toBe(8); // 占 1 席
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_a_guanyu#') && id.endsWith(':seat') && !e.world.getComponent(id, 'HexPos'))).toBe(true); // 据码（r2 刷新后槽0=1=关羽）入**席**（开局在板关羽带格不混；托盘自动落座）
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
    const hand = (): string => e.world.getComponent<CardPile>('shop', 'CardPile')!.hand.join(',');
    const click = (x: number, y: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    // 回合1 prep 自动刷新：初发 [3,1,5] 回袋底、换下一批 → 手牌 ≠ 初发（REQ-F-054 卡池守恒；6 将库牌袋）
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(hand()).toBe('2,6,4'); // 弃 [3,1,5] 回袋底，补 deck 第 4-6 张（确定性，6 将库牌袋）
    // 点「锁店」→ 打完回合1 → 回合2 prep 自动刷新被门挡（手牌不变）→ 开战拍自动解锁
    click(300, 120);
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
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' });
    for (let i = 0; i < 2; i++) e.world.tick();
    const goldBefore = res('gold');
    const handBefore = hand();
    click(300, 150);
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(res('gold')).toBe(goldBefore - 2); // 原子扣 2 金
    expect(hand()).not.toBe(handBefore); // 真换牌
    // 卖出：先买一个（手牌槽0）→ 点其席位 → marker 没了、金 +2、席位回 9
    const buyGold = res('gold');
    if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'shop', key: 'play', values: [0] }] });
    e.world.tick();
    e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(res('gold')).toBe(buyGold - 3);
    expect(res('bench_space')).toBe(8);
    // 买入的 marker 在**席上**（无 HexPos）——开局 4 个 marker 在板上，按无格过滤认准刚买的那张
    const marker = e.world.getAllEntities().find((id) => id.startsWith('bench_') && id.endsWith(':seat') && !e.world.getComponent(id, 'HexPos'))!;
    expect(marker).toBeTruthy();
    const mt = e.world.getComponent<Transform>(marker, 'Transform')!;
    e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', key: 'drag', x: mt.x, y: mt.y, values: [200, 118], phase: 'drag' }] }); // 拖进垃圾桶=卖出（REQ-F-058；点选卖出已停用）
    e.world.tick();
    e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(marker)).toBe(false); // 席位销毁（点谁卖谁 '@signal-source'）
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
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    for (let i = 0; i < 50; i++) e.world.tick(); // 进战斗（income_armed 已关：避开利息区间带对注资/消费的边沿响应——带宽语义见 finish-list Gotchas）
    expect(res('xp')).toBe(2); // 回合1 prep 自动 +2 XP（§4.3）
    expect(res('level')).toBe(4); // 起始等级=现固定阵容人口
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 30, scope: 'local' });
    for (let i = 0; i < 2; i++) e.world.tick();
    const g0 = res('gold');
    for (let k = 0; k < 5; k++) { click(300, 64); for (let i = 0; i < 2; i++) e.world.tick(); } // 买经验 ×5
    expect(res('xp')).toBe(22); // 2 + 5×4
    expect(res('gold')).toBe(g0 - 20); // $4×5 原子扣费
    expect(res('level')).toBe(6); // 阈值下调 8/18/30/44：xp22 → 4+2=6（买经验看得见升级）
    // 连败计数：杀光我方 → 败方路径 → lose_streak +1（连败金 band 与连胜金同构同测法）
    for (const m of mains(e).filter((id) => id.startsWith('hero_a_'))) {
      e.world.addComponent(m, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' });
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
    const deckLen = (): number => e.world.getComponent<CardPile>('shop', 'CardPile')!.deck.length;
    const input = (actions: unknown[]): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    // 羁绊：场上蜀将 4（关羽/赵云/诸葛/张飞，单机纯蜀 vs 魏世界观）→ ≥3 阈值开战拍锁存 dmg_scale_a=1.2
    let guard = 0;
    while (!flag(e, 'in_combat') && guard++ < 100) e.world.tick();
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(res('count_shu')).toBe(4); // group-count 按 FACT_SHU 计场上（纯蜀 4 将）
    expect(res('dmg_scale_a')).toBeCloseTo(1.2); // 蜀魂 ≥3 锁存（prep 复位 ×1，下回合重判）
    // 卖出袋归还：注资买 1（deck 抽 1 补手 → 净 -1）→ 点席卖 → 码归还袋底（净回 +1）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 10, scope: 'local' });
    for (let i = 0; i < 2; i++) e.world.tick();
    input([{ source: 'shop', key: 'play', values: [0] }]);
    for (let i = 0; i < 6; i++) e.world.tick();
    const afterBuy = deckLen();
    const seat = e.world.getAllEntities().find((id) => id.startsWith('bench_') && id.endsWith(':seat') && !e.world.getComponent(id, 'HexPos'))!; // 刚买的在席（开局 4 marker 在板，过滤）
    const st = e.world.getComponent<Transform>(seat, 'Transform')!;
    input([{ source: 'test', key: 'drag', x: st.x, y: st.y, values: [200, 118], phase: 'drag' }]); // 拖进垃圾桶=卖出（REQ-F-058）
    for (let i = 0; i < 6; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(seat)).toBe(false); // 席位售出销毁
    expect(deckLen()).toBe(afterBuy + 1); // 码归还袋底（§4.6 有限袋语义保真）
    expect(res('sold_code')).toBe(0); // 引擎自清
  });

  it('开局符文三选一（批D）：点「屯粮」金+5、三卡整组收走（一次性）；不点不影响流程', () => {
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
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', x, y, phase: 'down' }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(alive(e, 'rune_a')).toBe(true); // 三卡在场
    const g0 = res('gold');
    click(-110, -100); // 选「屯粮」
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(res('gold')).toBe(g0 + 5); // 生效（用户：三选一屯粮 10→5 金；收入/利息窗已移到结算）
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
    e.world.addComponent('lootreq', { type: 'SpawnRequest', templateId: 'loot_orb', x: -150, y: 86 });
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

  it('装备系统（A）：敌将（魏）死掉装备 orb → 主公行囊拾取 → items 累加（开局空、战中掉、入装备栏）', () => {
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
    expect(res('items')).toBe(0); // 开局装备栏空
    // 在主公(行囊)脚下落一个魏将死亡掉落（含装备 orb，仅 B 方掉）→ 行囊（跟随主公）拾取
    e.world.createEntity('eqreq');
    e.world.addComponent('eqreq', { type: 'SpawnRequest', templateId: 'death_b_zhangliao', x: -150, y: 86 });
    for (let i = 0; i < 8; i++) e.world.tick();
    expect(res('items')).toBe(1); // 拾取入账 +1（装备 orb Hitbox→行囊 BAG，consumeOnHit）
    expect(e.world.getAllEntities().some((id) => id.startsWith('death_b_zhangliao#') && id.endsWith(':eorb'))).toBe(false); // orb 同拍自毁
    // 我方（蜀）死亡不掉装备（防自 farm）
    e.world.createEntity('eqreq2');
    e.world.addComponent('eqreq2', { type: 'SpawnRequest', templateId: 'death_a_guanyu', x: -150, y: 86 });
    for (let i = 0; i < 8; i++) e.world.tick();
    expect(res('items')).toBe(1); // 蜀死无装备 orb → 不增
  });

  it('敌人预布阵（B）：英雄关返回敌阵坐标+将名供半透明预览；野怪回合返回空', () => {
    const p2 = gameFEnemyPreview(2, 1); // 阶段2「董卓先锋」=4 魏将
    expect(p2).toHaveLength(4);
    expect(p2.map((f) => f.name)).toContain('张辽');
    expect(p2.every((f) => typeof f.x === 'number' && typeof f.y === 'number')).toBe(true); // 世界坐标供投影
    expect(gameFEnemyPreview(1, 1)).toHaveLength(0); // 阶段1=野怪波，无英雄预览
    expect(gameFEnemyPreview(2, 5)).toHaveLength(0); // r5=野怪波，无英雄预览
    // 选魏阵营翻转：敌方变蜀将
    expect(gameFEnemyPreview(2, 1, 'wei').map((f) => f.name)).toContain('关羽');
  });

  it('蜀 6 将库（C）：roster 含 6 蜀（含商店专属马超/黄忠）；开局只播种原 4 将', () => {
    const shu = rosterFor('shu').filter((h) => h.team === TEAM_A);
    expect(shu).toHaveLength(6);
    expect(shu.map((h) => h.name)).toEqual(['关羽', '赵云', '诸葛亮', '张飞', '马超', '黄忠']);
    expect(shu.filter((h) => h.seed !== false)).toHaveLength(4); // 只原 4 将播种，新增 2 将商店专属
    // 加载实跑：开局在板 marker 仍 4（新增将不播种）
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 12; i++) e.world.tick();
    expect(e.world.getAllEntities().filter((id) => id.startsWith('bench_') && id.endsWith(':seat'))).toHaveLength(4);
  });

  it('野怪回合+法球（批B，一图流）：阶段1 全野怪（黄巾波次）；野怪死亡掉法球；结算清场含未拾法球', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    for (let i = 0; i < 50; i++) e.world.tick();
    expect(mains(e).filter((m) => m.startsWith('mob_'))).toHaveLength(3); // 阶段1=PVE_WAVES[0] 黄巾×3
    expect(mains(e).filter((m) => m.startsWith('hero_b_'))).toHaveLength(0); // 无 PvP 敌阵（整段野怪化）
    const mob = mains(e).find((m) => m.startsWith('mob_'))!;
    e.world.addComponent(mob, { type: 'ResourceModify', resourceId: 'hp', amount: -99999, scope: 'local' });
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('mob_death#') && id.endsWith(':orb'))).toBe(true); // 死亡掉法球+碎裂（mob_death 复合模板）
    let wiped = false;
    for (let i = 0; i < 4000 && !wiped; i++) { e.world.tick(); wiped = mains(e).length === 0; }
    expect(wiped).toBe(true);
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.endsWith(':orb') && id.startsWith('mob_death#'))).toBe(false); // 未拾法球随 wipe 清（Tag LOOT 不看模板名）
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
    // HUD 金币显示已移入 DOM 壳层；canvas 商店卡退役（移出视口），买入走 CardPile.play（DOM 点将台同款路径）。
    const buy = (slot: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'shop', key: 'play', values: [slot] }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    for (let i = 0; i < 12; i++) e.world.tick(); // 刷新 → 两段脉冲 → 重铺完毕
    expect(cards()).toHaveLength(3); // 三大框在售卡面可见（用户钦定小丑牌式）
    expect(res('gold')).toBe(5); // 起手金 5（用户：10 太多）
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: 20, scope: 'local' });
    for (let i = 0; i < 3; i++) e.world.tick();
    const g0 = res('gold');
    buy(0); // 买第 1 张 = CardPile.play(0) → 扣金占席入备战台
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(res('gold')).toBe(g0 - 3); // 扣金
    expect(res('bench_space')).toBe(8); // 占席
    expect(e.world.getAllEntities().some((id) => id.startsWith('bench_') && id.endsWith(':seat'))).toBe(true); // 入席可见
    expect(cards()).toHaveLength(3); // 买走→补牌→镜像变 → 面板整体重铺仍 3 张
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
    for (let i = 0; i < 5; i++) e.world.tick();
    e.world.addComponent('r_gold', { type: 'ResourceModify', resourceId: 'gold', amount: -5, scope: 'local' }); // 归零起手金：本测试单验收入窗（§4.1 表）
    for (let i = 0; i < 45; i++) e.world.tick();
    expect(res('player_hp')).toBe(100); // §3.1 量程（boot 初始化，旧 20 为占位）
    expect(res('round_idx')).toBe(1);
    expect(res('stage_idx')).toBe(1);
    expect(res('gold')).toBe(0); // 本测试归零起手金，单验收入窗
    // 打完回合 1：r1 结算窗发第一笔 2 金 → L1 advance → 回合 2
    let guard = 0;
    while (res('round_idx') === 1 && guard++ < 4000) e.world.tick();
    expect(res('round_idx')).toBe(2);
    expect(res('gold')).toBe(2); // r1 结算：基础收入 2（无利息、无连胜金档）
    for (let i = 0; i < 50; i++) e.world.tick(); // 回合 2 备战（收入要等 r2 结算）
    expect(res('gold')).toBe(2);
    expect(res('player_hp')).toBe(flag(e, 'won') ? 100 : 98); // §4.2 阶段1败=基础0+存活近似2
    // 注入把 round_idx 推到 5（合法 sim 输入），打完该回合验证 >5 进位 banded：stage+1、round=1、敌阵换装
    e.world.addComponent('r_round_idx', { type: 'ResourceModify', resourceId: 'round_idx', amount: 3, scope: 'local' });
    let guard2 = 0;
    while (!(res('round_idx') === 1 && res('stage_idx') === 2) && guard2++ < 4000) e.world.tick();
    expect(res('stage_idx')).toBe(2); // when_stage_up：进位发生
    for (let i = 0; i < 60; i++) e.world.tick(); // 阶段 2 备战（40）→ 入战拍展开
    expect(mains(e).filter((id) => id.startsWith('hero_b_'))).toHaveLength(4); // 关卡表换敌阵：「董卓先锋」4 子全强度
  });

  it('T3/T4 贡献度 + 攻岛进度（单机 scaffold，纯数据 banded）：每波结算累加贡献；攻岛满 100=岛陷落→通关', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    expect(res('contribution')).toBe(0); // 开局零贡献
    expect(res('island_progress')).toBe(0); // 攻岛进度从 0 起
    // 打完回合 1：结算窗（income_armed）按胜负累加贡献（胜=5/败=2，阶段1）。
    for (let i = 0; i < 5; i++) e.world.tick();
    let guard = 0;
    while (res('round_idx') === 1 && guard++ < 4000) e.world.tick();
    expect(res('contribution')).toBeGreaterThan(0); // 一波结算 → 贡献累加（与战斗胜负无关都累）
    if (flag(e, 'won')) expect(res('island_progress')).toBe(20); // 仅胜利波推进攻岛 +20
    // 攻岛进度满 100 → island_taken → run_flow round 态并行转移 victory → run_won（岛陷落通关）。
    e.world.addComponent('r_island', { type: 'ResourceModify', resourceId: 'island_progress', amount: 100, scope: 'local' });
    let g2 = 0;
    while (!flag(e, 'run_won') && g2++ < 4000) e.world.tick();
    expect(flag(e, 'island_taken')).toBe(true); // 岛陷落旗立
    expect(flag(e, 'run_won')).toBe(true); // 通关（与打穿关卡表并行的胜利条件）
  });

  it('升星合成（F-17/REQ-F-046+049 全链）：3 同将 marker 自动合二星（席位回账）；拖上板 → 开战按 ×1.8 血/×1.5 弹成型；星级卖价', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const res = (id: string): number => {
      for (const x of e.world.getAllEntities()) {
        const r = e.world.getComponent<Resource>(x, 'Resource');
        if (r && r.id === id) return r.current;
      }
      return -1;
    };
    const act = (a: Record<string, unknown>): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', ...a }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    const drag = (fx: number, fy: number, tx: number, ty: number): void => act({ key: 'drag', x: fx, y: fy, values: [tx, ty], phase: 'drag' }); // 壳层合成同形
    for (let i = 0; i < 10; i++) e.world.tick(); // 回合1 备战
    // 直注 3 张关羽席位 marker（绕过商店牌序的购买路径——merge 只认 PrefabOrigin 家族，与来源无关）
    [-66, -22, 22].forEach((x, i) => {
      e.world.createEntity(`mreq${i}`);
      e.world.addComponent(`mreq${i}`, { type: 'SpawnRequest', templateId: 'bench_a_guanyu', x, y: 178 });
    });
    for (let i = 0; i < 6; i++) e.world.tick();
    // 三连合成取**最老** 3 个 = 开局在板关羽(seq 最小) + 前 2 张注入席卡 → 锚在最老（板上）→
    // 产物继承其格 = **原地升星**（merge-rule 出身格继承，REQ-F-049；正是金铲铲"场上单位就地升星"观感）。
    const b2all = e.world.getAllEntities().filter((id) => id.startsWith('bench2_a_guanyu#') && id.endsWith(':seat'));
    expect(b2all).toHaveLength(1);
    const b2 = b2all[0];
    const home = offsetToAxial(2, 4); // 关羽经典站位（7×8 盘视觉 2,4）
    const b2hex = e.world.getComponent<HexPos>(b2, 'HexPos')!;
    expect([b2hex.q, b2hex.r]).toEqual([home.q, home.r]); // 板上合成 → 产物留板上原格
    expect(alive(e, b2.replace(/:seat$/, ':star'))).toBe(true); // ★★ 角标随体
    expect(e.world.getAllEntities().filter((id) => id.startsWith('bench_a_guanyu#') && id.endsWith(':seat'))).toHaveLength(1); // 第 3 张注入卡幸存在席
    expect(res('bench_space')).toBe(8); // 派生回账：席上只剩 1 张幸存卡 → 9−1（在板 marker 不占席，F-052 onBoard:false）
    let guard2 = 0;
    while (!flag(e, 'in_combat') && guard2++ < 100) e.world.tick();
    for (let i = 0; i < 10; i++) e.world.tick(); // 入战拍成型
    const gys = mains(e).filter((id) => id.startsWith('hero_a_guanyu#'));
    expect(gys).toHaveLength(1); // 在板的二星出兵；席上幸存的一星不出兵（requireHexPos 门）
    const hp = e.world.getComponent<Resource>(gys[0], 'Resource')!;
    expect(hp.max).toBe(Math.round((240 * 18 + 120) * 1.8)); // finalHp(关羽含玉玺) × 1.8 = 7992（二星数值烘在模板族）
    expect(e.world.getComponent<SelfRule>(gys[0], 'SelfRule')!.do[0].template).toBe('strike_a_guanyu_s2');
    // 星级卖价（战斗窗卖：income 窗已关，金额断言不吃利息带宽）：点板上二星席=sell2 → +8 金（棋子本回合继续打）
    const g0 = res('gold');
    const p = project(home.q, home.r);
    drag(p.x, p.y, 200, 118); // 板上二星拖进垃圾桶=卖出（任何相位可卖，REQ-F-058）
    for (let i = 0; i < 5; i++) e.world.tick();
    expect(e.world.getAllEntities().includes(b2)).toBe(false); // 点谁卖谁（板上也可卖）
    expect(res('gold')).toBe(g0 + 8); // 2星卖价 = 3×3−1（§4.6）
  });

  it('开局选阵营=魏（REQ-F-061）：我方变魏将(a_zhangliao 下半场)、敌方变蜀将(b_guanyu 上半场)；蓝图确定可加载', () => {
    const WEI = { ...FAST, playerFaction: 'wei' as const };
    const run = (): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameFBlueprint(WEI));
      for (let i = 0; i < 80; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run()); // 选魏一局同样确定（同初值重跑 hash 一致）
    const wr = rosterFor('wei');
    const ids = wr.map((h) => h.id);
    expect(ids).toContain('a_zhangliao'); // 魏将上位我方(a_)
    expect(ids).toContain('b_guanyu'); // 蜀将下位敌方(b_)
    expect(ids).not.toContain('a_guanyu'); // 关羽不再我方
    const zl = wr.find((h) => h.id === 'a_zhangliao')!;
    expect(zl.team).toBe(TEAM_A);
    expect(zl.r).toBeGreaterThanOrEqual(4); // 我方在下半场 r4-7（站位镜像）
    const gy = wr.find((h) => h.id === 'b_guanyu')!;
    expect(gy.team).toBe(TEAM_B);
    expect(gy.r).toBeLessThanOrEqual(3); // 敌方在上半场 r0-3
    // 选魏一局棋子真展开（开战拍我方魏将成型）
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(WEI));
    for (let i = 0; i < 80; i++) e.world.tick();
    expect(e.world.getAllEntities().some((id) => id.startsWith('hero_a_zhangliao#'))).toBe(true);
  });

  it('摆子拖拽（F-18/REQ-F-045+049+050 全量）：备战拖上板吸附格=出兵点、人口限额拒超、战斗期锁拖', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameFBlueprint(FAST));
    const drag = (fx: number, fy: number, tx: number, ty: number): void => {
      if (!e.world.getAllEntities().includes('input')) e.world.createEntity('input');
      e.world.addComponent('input', { type: 'InputQueue', actions: [{ source: 'test', key: 'drag', x: fx, y: fy, values: [tx, ty], phase: 'drag' }] });
      e.world.tick();
      e.world.addComponent('input', { type: 'InputQueue', actions: [] });
    };
    const pos = (id: string): Transform => e.world.getComponent<Transform>(id, 'Transform')!;
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(flag(e, 'in_prep')).toBe(true); // 备战相位门开（flow prep onEnter 维护）
    e.world.createEntity('mreq');
    e.world.addComponent('mreq', { type: 'SpawnRequest', templateId: 'bench_a_zhaoyun', x: 0, y: 0 });
    e.world.createEntity('mreq2');
    e.world.addComponent('mreq2', { type: 'SpawnRequest', templateId: 'bench_a_zhuge', x: 0, y: 0 });
    for (let i = 0; i < 3; i++) e.world.tick();
    const seat = e.world.getAllEntities().find((id) => id.startsWith('bench_a_zhaoyun#') && id.endsWith(':seat') && !e.world.getComponent(id, 'HexPos'))!;
    const seat2 = e.world.getAllEntities().find((id) => id.startsWith('bench_a_zhuge#') && id.endsWith(':seat') && !e.world.getComponent(id, 'HexPos'))!;
    // 托盘自动落座（REQ-F-055）：两张新卡按 id 序占 0/1 号槽（出生点无谓，托盘收口）
    expect([pos(seat).x, pos(seat).y]).toEqual([-176, 118]);
    expect([pos(seat2).x, pos(seat2).y]).toEqual([-132, 118]);
    // 席内拖拽互换：把 0 号拖到 1 号槽上 → 两席对调
    drag(-176, 118, -132, 118);
    expect([pos(seat).x, pos(seat2).x]).toEqual([-132, -176]);
    // 人口限额：开局 4 marker 在板 = level 4 满员 → 第 5 个拖上板整次拒绝（弹回席位）
    const a55 = offsetToAxial(5, 5);
    const c55 = project(a55.q, a55.r);
    drag(-132, 118, c55.x, c55.y);
    expect(e.world.getComponent(seat, 'HexPos')).toBeFalsy(); // 拒单
    expect([pos(seat).x, pos(seat).y]).toEqual([-132, 118]); // 托盘弹回原槽（地上不留单位）
    // 腾位（拖开局赵云 marker 下板）后再上 → 放行 + 吸附格写 HexPos + Transform=格投影
    const zhaoSeat = e.world.getAllEntities().find((id) => id.startsWith('bench_a_zhaoyun#') && id.endsWith(':seat') && id !== seat && e.world.getComponent(id, 'HexPos'))!;
    expect(zhaoSeat).toBeTruthy();
    const zt = pos(zhaoSeat);
    drag(zt.x, zt.y, 0, -200); // 拖出板（落点选板上方，避开左右两侧垃圾桶；失格即回席，托盘自动落座）
    expect(e.world.getComponent(zhaoSeat, 'HexPos')).toBeFalsy(); // 回席（板外落点移除 HexPos）
    e.world.tick();
    expect(e.world.getComponent(zhaoSeat, 'TraySeat')).toBeTruthy(); // 托盘把回席者捡进空槽
    drag(-132, 118, c55.x, c55.y);
    const hex = e.world.getComponent<HexPos>(seat, 'HexPos')!;
    expect([hex.q, hex.r]).toEqual([a55.q, a55.r]); // 吸附格
    expect(pos(seat).x).toBeCloseTo(c55.x, 5); // 投影贴格
    expect(e.world.getComponent(seat, 'TraySeat')).toBeFalsy(); // 上板让座
    // 战斗期锁拖（onlyFlag 门）
    let guard = 0;
    while (!flag(e, 'in_combat') && guard++ < 100) e.world.tick();
    expect(flag(e, 'in_prep')).toBe(false); // 开战即关门
    drag(c55.x, c55.y, -110, 118);
    const hex2 = e.world.getComponent<HexPos>(seat, 'HexPos')!;
    expect([hex2.q, hex2.r]).toEqual([a55.q, a55.r]); // 战斗期拖拽被拒：格不变
  });
});
