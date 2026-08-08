// game108 守卫测试 —— **钉死策划条款**（docs/design/game108/gdd.md）。
// S3 阶段只覆盖「数值与词表不漂移」；玩法闭环的对账走 S4 验收剧本（GD 写·PE 不许改）。
import { describe, it, expect } from 'vitest';
import {
  HANDS, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, PENALTY_PERIOD, PENALTY_HP, CHARGE_PER_ROUND,
  TPS, ACT, UI_ACT, SIDES, HP_RES, chargeRes, chargeRelName, chargeEntity, chargeBudgetRes, penaltyDebtRes,
} from './theme.js';

describe('game108 · 数值钉死（GDD §5）', () => {
  it('【R-108-15】双方血量一律 100（难度不靠血条）', () => {
    expect(HP_MAX).toBe(100);
  });

  it('【R-108-10】蓄力上限 3', () => {
    expect(CHARGE_CAP).toBe(3);
  });

  it('【R-108-13】伤害 = 10 + 蓄力 × 10 → 10/20/30/40', () => {
    const dmg = (charge: number): number => DMG_BASE + charge * DMG_STEP;
    expect([0, 1, 2, 3].map(dmg)).toEqual([10, 20, 30, 40]);
    // 满蓄一击 = 四成血；三次满蓄命中必死（GDD §5 设计理由）。
    expect(dmg(CHARGE_CAP) * 3).toBeGreaterThanOrEqual(HP_MAX);
  });

  it('【R-108-15】平局双方不掉血', () => {
    expect(TIE_SELF_DAMAGE).toBe(0);
  });

  it('【R-108-01】v3 四拍：T1 硬 2.5 秒 · T2 免费 5 秒 · T3 演出 1.5 秒 · T4 无时长（玩家闸门）', () => {
    expect(PHASE_TICKS.charge).toBe(2.5 * TPS);
    expect(PHASE_TICKS.throw).toBe(5 * TPS);
    expect(PHASE_TICKS.clash).toBe(1.5 * TPS);
    // 【R-108-05】T4 **不是"零秒"，是没有时长**：由玩家点「下一轮」收尾，不设自动兜底。
    // 写死成 0 就是让读表的地方（宿主的倒计时环）一眼看出"这一拍没有钟"。
    expect(PHASE_TICKS.settle).toBe(0);
    // ⚠ v2 那条「一回合 9 秒 → 一场 60-90 秒」的断言随 v3 作废（gdd §5 已划掉）——
    // T2 软超时 + T4 玩家闸门之后单局时长由玩家掌握，钉它等于钉一个不存在的承诺。
  });

  it('【R-108-04】罚血定值：每 1 秒扣 1 点（owner 2026-08-07：「一格血就是 1 点，1 秒钟 1 点」）', () => {
    expect(PENALTY_PERIOD).toBe(1 * TPS);
    expect(PENALTY_HP).toBe(1);
    // 犹豫 10 秒 = 10 点 = 一次无蓄力命中的代价——罚得到，但罚不死（gdd【R-108-04】设计理由）。
    expect((10 * TPS / PENALTY_PERIOD) * PENALTY_HP).toBe(DMG_BASE);
  });

  it('【R-108-10】v3 一回合最多给一只手 +1 层（上限仍 3 ⇒ 满蓄仍需攒 3 回合）', () => {
    expect(CHARGE_PER_ROUND).toBe(1);
    expect(CHARGE_CAP / CHARGE_PER_ROUND).toBe(3);
  });
});

describe('game108 · 动作词表钉死（【R-108-70】UI/剧本同源）', () => {
  it('三手的蓄力与出招动作名逐字符合词表', () => {
    expect(HANDS.map(ACT.charge)).toEqual(['charge.rock', 'charge.paper', 'charge.scissors']);
    expect(HANDS.map(ACT.throw)).toEqual(['throw.rock', 'throw.paper', 'throw.scissors']);
  });

  it('其余三个动作名逐字符合词表', () => {
    expect(ACT.smoke).toBe('smoke.use');
    expect(ACT.shardPick).toBe('shard.pick');
    expect(ACT.next).toBe('duel.next');
  });

  it('动作名互不重复（一个信号只能对应一件事）', () => {
    const all = [...HANDS.map(ACT.charge), ...HANDS.map(ACT.throw), ACT.smoke, ACT.shardPick, ACT.next];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('game108 · 蓄力槽 id 约定（capability-plan §5 实现约定 1）', () => {
  it('槽的 Resource id = <侧>.charge.<手>，且相对名与之对齐', () => {
    // t2-matrix-duel 的 perSide 缩放在运行期拼 `<出手方>.<相对名>`——两者必须严丝合缝，
    // 拼错就是「取不到 → 静默退化成 base」，正是 REQ-108-ENG-01 打回过的那类静默错。
    for (const side of SIDES) {
      for (const hand of HANDS) {
        expect(`${side}.${chargeRelName(hand)}`).toBe(chargeRes(side, hand));
      }
    }
  });

  it('六条槽两两不同名（同 id 会被引擎点名硬抛）', () => {
    const ids = SIDES.flatMap((s) => HANDS.map((h) => chargeRes(s, h)));
    expect(ids).toHaveLength(6); // 【R-108-03】双方各三
    expect(new Set(ids).size).toBe(6);
  });

  it('槽必须另居实体：槽实体 id 不得与侧实体撞（一实体一组件·侧实体那份已被 hp 占）', () => {
    for (const side of SIDES) {
      for (const hand of HANDS) {
        expect(chargeEntity(side, hand)).not.toBe(side);
      }
    }
    expect(HP_RES).toBe('hp');
  });
});

// ── S3 骨架关：引擎吃得下 + 空跑（机器门）+ 条款走查 ────────────────────────
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Resource, GameFlow, StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint, throwSignal, aiChargeSignal, deadFlag } from './blueprint.js';

const res = (e: Engine, eid: string): number => e.world.getComponent<Resource>(eid, 'Resource')?.current ?? -1;
const slot = (e: Engine, side: string, h: string): number => res(e, `slot:${side}:${h}`);
const phase = (e: Engine): string => e.world.getComponent<GameFlow>('flow', 'GameFlow')!.current;

function fresh(): Engine { const e = new Engine(); e.load(buildBlueprint()); return e; }

/** 走真实通路发信号：把 EventWhen 挂在**该侧实体**上 → Signal.source = 该侧（接缝据此认侧）。 */
function fire(e: Engine, side: string, signal: string, tag: string): void {
  const fid = `${side}_${tag}`;
  e.world.addComponent(side, { type: 'EventWhen', signal, when: { kind: 'flag', id: fid }, mode: 'edge', armed: false } as never);
  const fe = `flag:${fid}`;
  if (!e.world.hasComponent(fe, 'Flag')) e.world.createEntity(fe);
  e.world.addComponent(fe, { type: 'Flag', id: fid, active: true } as never);
}

describe('game108 · S3 骨架关（机器门：引擎吃得下 + 空跑）', () => {
  it('真引擎装载 + 空跑 2 tick 不炸', () => {
    const e = fresh();
    expect(() => { e.world.tick(); e.world.tick(); }).not.toThrow();
  });

  it('装配面齐：判定表 / 流程 / 双方 / 六条槽 / 种子 / 蓄力效果', () => {
    const ids = Object.keys(buildBlueprint().entities);
    expect(ids).toContain('duel');
    expect(ids).toContain('flow');
    expect(ids).toContain('seed');            // 种子 PRNG（禁裸 Math.random 的落点）
    expect(ids.filter((i) => i.startsWith('slot:'))).toHaveLength(6);   // 【R-108-03】
    expect(ids.filter((i) => i.startsWith('fx:charge:'))).toHaveLength(6);
    for (const side of SIDES) { expect(ids).toContain(side); expect(ids).toContain(`var:${side}`); }
  });

  it('起手态照策划：双方 100 血、六条槽全 0、相位 = charge', () => {
    const e = fresh();
    for (const side of SIDES) {
      expect(res(e, side)).toBe(HP_MAX);                                  // 【R-108-15】
      for (const h of HANDS) expect(slot(e, side, h)).toBe(0);            // 【R-108-03】
    }
    expect(phase(e)).toBe('charge');                                      // 【R-108-01】
  });
});

describe('game108 · S3 条款走查（真引擎驱动·用【R-108-70】动作名）', () => {
  it('蓄力 +1 只打自己那条槽，**一回合就一层**（连点无效）【R-108-10】v3', () => {
    const e = fresh();
    for (let i = 0; i < 5; i++) { fire(e, 'p1', ACT.charge('rock'), `c${i}`); e.world.tick(); e.world.tick(); }
    // v2 这里断言的是 `CHARGE_CAP`（连点即满）——owner 2026-08-07 判「那是个 bug」。
    // 条款原文一直是「T1 往一手存 +1」：点五次也只有一层。
    expect(slot(e, 'p1', 'rock')).toBe(CHARGE_PER_ROUND);
    expect(slot(e, 'p1', 'paper')).toBe(0);           // 没蓄的不动
    // ⚠ 不能断言「p2 的石不动」——对手①复读机现在会**自己**蓄石（【R-108-30】·纯数据规则）。
    // 改断言它**没碰**的那两只手：这仍然守住了原意「玩家的信号没串到对面去」，
    // 而且不会因为对面开始有行为就假红。
    expect(slot(e, 'p2', 'paper')).toBe(0);
    expect(slot(e, 'p2', 'scissors')).toBe(0);
  });

  it('一整回合闭环：蓄 1 → 双方出招 → 伤害按侧缩放 + 出过即清零 + 记本回合的手', () => {
    const e = fresh();
    // **跟真 AI 打**：对手①复读机会自己蓄石、出石（【R-108-30】），不再手动指定它出什么
    // ——手动指定会被它自己的出招覆盖（它在进出招时区那一拍才发），测出来的是假的。
    // v3：一回合只能蓄一层 ⇒ 玩家蓄布 ×1 出布，布克石 ⇒ 10+1×10 = 20。
    fire(e, 'p1', ACT.charge('paper'), 'c1'); e.world.tick(); e.world.tick();
    expect(slot(e, 'p1', 'paper')).toBe(1);

    // 出招走**真实通路**（`tap` = 屏上点击 → InputQueue → keybind）。v3 起这条路还兼着
    // 「玩家本回合已出手」那面旗（罚血的停止条件·见 blueprint threwFlag 注释）——
    // 用 `fire` 手挂 EventWhen 绕过 keybind 的话，世界会认为你**还没出手**，一直卡在罚血读秒。
    tap(e, ACT.throw('paper'));
    // 【R-108-01】结算门（REQ-108-ENG-06）：提交完**不会当拍结算**——要等 flow 走进 T3 对决时区
    // 才开门。本测试原先断言「3 拍后就掉血」，那正是条款禁止的（提交那刻血就掉 ⇒ 亮拳变成
    // 播放已发生的事）。v3 的 T2 没有固定长度（免费 5 秒 + 罚血读秒），所以**跑到相位变成 clash
    // 为止**、不写死拍数——写死秒数的等待正是 v3 一改节奏就会集体假红的那类断言。
    for (let i = 0; i < 900 && phase(e) !== 'clash'; i++) e.world.tick();
    expect(phase(e)).toBe('clash');
    // 门在进 clash 那一拍（Commit）才 arm，结算在**下一拍**的 Update ⇒ 停在开门那一拍还没结算。
    e.world.tick(); e.world.tick(); e.world.tick();

    expect(res(e, 'p2')).toBe(HP_MAX - (DMG_BASE + 1 * DMG_STEP)); // 【R-108-13】10+1×10=20
    expect(res(e, 'p1')).toBe(HP_MAX);                              // 胜方不掉血
    expect(slot(e, 'p1', 'paper')).toBe(0);                         // 【R-108-14】出过即清零
    expect(slot(e, 'p1', 'rock')).toBe(0);                          // 没出的手原样保留（这里本就是 0）
    const lt = (side: string): string => e.world.getComponent<StringVar>(`var:${side}`, 'StringVar')!.value;
    expect(lt('p1')).toBe('paper');                                 // 【R-108-02/30】
    expect(lt('p2')).toBe('rock');                                  // 复读机出的石
  });

  it('血量归零 → 该侧 dead flag 置位（按侧判定·两侧走两条不同的路）【R-108-15】', () => {
    // v3 起两侧不再对称：p1 那格 SelfRule 让给了罚血（只有自治规则扣得到本侧 hp），
    // 死亡判定挪到 `watch:p1`（whenGlobal 读全局 hp）；p2 照旧读自身 hp。
    const dead = (e: Engine, side: string): boolean =>
      (e.world.getComponent(side === 'p1' ? 'watch:p1' : side, 'Flag') as unknown as { active: boolean }).active;
    const kill = (e: Engine, side: string): void => {
      const hp = e.world.getComponent<Resource>(side, 'Resource')!;
      e.world.addComponent(side, { ...hp, current: 0 });
      e.world.tick(); e.world.tick();
    };
    const a = fresh(); kill(a, 'p2');
    expect(dead(a, 'p2')).toBe(true);
    const b = fresh(); kill(b, 'p1');
    expect(dead(b, 'p1')).toBe(true);
    expect(deadFlag('p2')).toBe('p2.dead');
  });

  it('【R-108-15】`watch:p1` 只盯 p1 —— 打死 p2 不许把玩家判死（全局 id 路由的要害）', () => {
    // 这条钉的是 watch:p1 那条 whenGlobal 的隐含依赖：`{resource id:'hp'}` 取的是
    // **世界里第一个 id='hp' 的 Resource**，装配序保证它恒是 p1。
    // 哪天有人把 SIDES 倒过来、或在 p1 之前插进第三个挂 hp 的实体，这条当场红——
    // 不然表现是「打死对手的同时自己也判负」，而且不报错。
    const e = fresh();
    const hp = e.world.getComponent<Resource>('p2', 'Resource')!;
    e.world.addComponent('p2', { ...hp, current: 0 });
    for (let i = 0; i < 4; i++) e.world.tick();
    expect((e.world.getComponent('watch:p1', 'Flag') as unknown as { active: boolean }).active).toBe(false);
    expect((e.world.getComponent('p2', 'Flag') as unknown as { active: boolean }).active).toBe(true);
  });
});

// ── S3 对局屏：闭集校验 + 动作词表对账（ui-playbook 黄金流程 step 5）──────────
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildDuelScreen, emptyView, screenActions, type DuelView } from './duel-screen.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { t } from './strings.js';

describe('game108 · 对局屏（LayoutNode 纯数据）', () => {
  it('validateLayoutNode 零 issue（闭集合法）', () => {
    const issues = validateLayoutNode(buildDuelScreen(emptyView()));
    expect(issues).toEqual([]);
  });

  it('屏上每个世界动作都出自【R-108-70】动作词表——UI 与验收剧本同源', () => {
    const vocab = new Set<string>([
      ...HANDS.map(ACT.charge), ...HANDS.map(ACT.throw), ACT.smoke, ACT.shardPick, ACT.next,
    ]);
    const used = screenActions(emptyView());
    expect(used.length).toBeGreaterThan(0);
    // `ui.*` = 表现层本地动作（换语言这类纯显示设置·只由宿主 handler 消费·永不进世界），
    // 与世界动作是两类。这里分流：世界动作必须逐字在词表里；`ui.*` 单独验它**不在**词表里
    // ——两边都不许互相混进去（混进去 = 语言切换会进 hash/录放/lockstep，两端不同语言就判不一致）。
    for (const a of used) {
      if (a.startsWith('ui.')) expect(vocab.has(a)).toBe(false);
      else expect(vocab.has(a)).toBe(true);
    }
  });

  it('表现层本地动作只有 `ui.` 前缀那一类，且世界词表里一个都没有', () => {
    // 菜单合着时屏上只有菜单键；音乐/音效/配音/语言四个开关在菜单**打开**后才在屏上。
    const closed = screenActions(emptyView()).filter((a) => a.startsWith('ui.'));
    expect(closed).toEqual([UI_ACT.menu]);
    const open = screenActions({ ...emptyView(), menuOpen: true }).filter((a) => a.startsWith('ui.'));
    for (const k of [UI_ACT.menu, UI_ACT.bgm, UI_ACT.sfx, UI_ACT.voice, UI_ACT.lang]) expect(open).toContain(k);
    // 世界动作与 `ui.*` 不许互相混：混进去 = 语言/音量会进 hash、录放、lockstep，两端设置不同就判不一致。
    const world = new Set<string>([...HANDS.map(ACT.charge), ...HANDS.map(ACT.throw), ACT.smoke, ACT.shardPick, ACT.next]);
    for (const a of open) expect(world.has(a)).toBe(false);
  });

  it('蓄力时区：槽满的那只手键禁用且不带 action【R-108-10】', () => {
    const v = emptyView();
    v.charge.p1.rock = CHARGE_CAP;
    const acts = screenActions(v);
    expect(acts).not.toContain(ACT.charge('rock'));   // 满 → 无 action（不可点·不产生信号）
    expect(acts).toContain(ACT.charge('paper'));      // 没满 → 照常
  });

  // ── v3 演出的四个新屏态（gdd §3b）。每个都过一遍闭集校验：
  //    这些态只在跑起来的某几百毫秒里出现，肉眼走查抓不到，但闭集违规会当场把整块面板画没。
  it('v3 四个新屏态一律闭集合法（放大选牌 / 注水 / 罚血读秒 / 结算闸门）', () => {
    const base = emptyView();
    const views: Array<[string, DuelView]> = [
      ['T1 放大中', { ...base, elapsedMs: 120 }],
      ['T1 注水', { ...base, elapsedMs: 900, charged: { hand: 'rock', atMs: 700 } }],
      ['T1 缩回射粒子', { ...base, elapsedMs: PHASE_TICKS.charge / TPS * 1000 - 100, charged: { hand: 'paper', atMs: 400 } }],
      ['T2 罚血读秒', { ...base, phase: 'throw', phaseLeft: 0, phaseSec: 0, elapsedMs: 300, penalty: { active: true, debt: 4 } }],
      ['T3 挨打震动', {
        ...base, phase: 'clash', elapsedMs: 80, outcome: { winner: 'p2', damage: 40 },
        shown: { p1: 'rock', p2: 'paper' },
        before: { hp: { p1: 100, p2: 100 }, charge: { p1: { rock: 3, paper: 0, scissors: 0 }, p2: { rock: 0, paper: 0, scissors: 0 } } },
        hp: { p1: 60, p2: 100 },
      }],
      ['T4 等玩家点', { ...base, phase: 'settle', phaseLeft: 0, phaseSec: 0, awaitNext: true, outcome: { winner: 'p1', damage: 20 }, shown: { p1: 'paper', p2: 'rock' } }],
    ];
    for (const [name, v] of views) expect([name, validateLayoutNode(buildDuelScreen(v))]).toEqual([name, []]);
  });

  it('【R-108-05】T4 才画「下一轮」键，且它发的是词表里的 `duel.next`', () => {
    const settle: DuelView = { ...emptyView(), phase: 'settle', phaseLeft: 0, phaseSec: 0, awaitNext: true };
    expect(screenActions(settle)).toContain(ACT.next);
    // 别的拍不该有——结算之外冒出一枚「下一轮」= 玩家可以跳过出招（【R-108-01】当场破）。
    expect(screenActions(emptyView())).not.toContain(ACT.next);
  });

  it('【R-108-04】罚血读秒时倒计时环换成欠债读数，相位牌换成「拖延中」', () => {
    const pen: DuelView = { ...emptyView(), phase: 'throw', phaseLeft: 0, phaseSec: 0, elapsedMs: 200, penalty: { active: true, debt: 7 } };
    const texts: string[] = [];
    const walk = (n: LayoutNode): void => {
      const tx = (n.props as { text?: string } | undefined)?.text;
      if (typeof tx === 'string') texts.push(tx);
      for (const c of n.children ?? []) walk(c);
    };
    walk(buildDuelScreen(pen));
    // 设计定稿 v3：欠数进**画面正中的欠账牌**（132px 大字），不塞进 78px 的倒计时环。
    expect(texts).toContain('7');
    expect(texts).toContain(t('zh', 'penalty.text'));    // 「超时了 · 每思考 1 秒罚 1 滴血」
    expect(texts).toContain(t('zh', 'penalty.owe'));     // 「已欠」
    // 这一句是稿子专门用来把罚血与挨打分开的，缺了就等于没做到那条要求。
    expect(texts).toContain(t('zh', 'penalty.foot'));    // 「出手即停 · 这不是他打的」
    expect(texts).not.toContain('出招');                  // 相位牌换成「超时」
  });

  it('【R-108-05】T4 不画倒计时环（画一圈停在 0.0 秒 = 骗玩家"时间到了"）', () => {
    const ids: string[] = [];
    const walk = (n: LayoutNode): void => { ids.push(n.id); for (const c of n.children ?? []) walk(c); };
    walk(buildDuelScreen({ ...emptyView(), phase: 'settle', phaseLeft: 0, phaseSec: 0, awaitNext: true }));
    expect(ids).not.toContain('phase-ring');
    walk(buildDuelScreen(emptyView()));
    expect(ids).toContain('phase-ring');                 // 有钟的拍照旧画
  });

  it('【R-108-06】震动幅度随掉血量（掉 10 和掉 40 不能一个抖法）', () => {
    const at = (damage: number): number => {
      const v: DuelView = { ...emptyView(), phase: 'clash', elapsedMs: 40, outcome: { winner: 'p2', damage }, hp: { p1: 100 - damage, p2: 100 } };
      const root = buildDuelScreen(v);
      return Math.abs(root.layout?.x ?? 0) + Math.abs(root.layout?.y ?? 0);
    };
    expect(at(10)).toBeGreaterThan(0);
    expect(at(40)).toBeGreaterThan(at(10));
    expect(at(0)).toBe(0);                               // 没掉血不抖
  });
});

// ── REQ-108-ENG-04：玩家动作走**真实输入通路**打到世界（UI action → InputQueue → keybind → Signal）──
// 之前的走查用 `fire()` 手挂 EventWhen 到侧实体上，那是**测试专用捷径**，证不了玩家真点得动。
// 这一组走玩家那条路：入队 InputQueue 动作名（= 屏上 Button.action 的同一串字符【R-108-70】）。
import type { InputQueue, RawInputData, Signal } from '@zerocraft/engine/engine/protocol/components.js';

/**
 * 模拟玩家点屏一次：动作名入队 → **走一拍** → 排空队列。
 * 排空是要害：真 `QueuedInputSource` 每拍把队列交给引擎后就排空，手写的 InputQueue 组件**不会**，
 * 连着 tick 两拍就会把一次点击算成两次（本测试首版正是这么把「蓄 2」测成了 3·已实证）。
 */
function tap(e: Engine, action: string): void {
  const acts: RawInputData[] = [{ source: 'p1', key: action, phase: 'action' }];
  if (!e.world.hasComponent('global-input', 'InputQueue')) e.world.createEntity('global-input');
  e.world.addComponent('global-input', { type: 'InputQueue', actions: acts } as InputQueue);
  e.world.tick();  // keybind 本拍产 Signal
  e.world.addComponent('global-input', { type: 'InputQueue', actions: [] } as InputQueue);
}

describe('game108 · 玩家动作真实通路（REQ-108-ENG-04·owner 判 A）', () => {
  it('接线齐：六个动作各有一个 kb 实体，且出招三键代发到 p1【R-108-70】', () => {
    const ents = buildBlueprint().entities as Record<string, { KeyBinding?: { key: string; signal: string; source?: string } }>;
    for (const h of HANDS) {
      // 蓄力键不代发（走 effect-apply 全局 targetId 路由，与 source 无关）。
      expect(ents[`kb:charge:${h}`]!.KeyBinding).toEqual({ key: ACT.charge(h), signal: ACT.charge(h) });
      // 出招键必须代发到 p1——接缝按 Signal.source 认侧，kb 实体不是对局侧。
      expect(ents[`kb:throw:${h}`]!.KeyBinding).toEqual({ key: ACT.throw(h), signal: ACT.throw(h), source: 'p1' });
    }
  });

  it('点蓄力键 → 自己那条槽 +1（走 InputQueue·非手挂组件）【R-108-10】', () => {
    const e = fresh();
    tap(e, ACT.charge('rock')); e.world.tick();
    expect(slot(e, 'p1', 'rock')).toBe(1);
    expect(slot(e, 'p2', 'paper')).toBe(0);  // 复读机只碰石·没碰的两只手仍为 0（玩家信号没串台）
    expect(slot(e, 'p2', 'scissors')).toBe(0);
  });

  it('点出招键 → 信号代发到 p1，接缝据此挂上该侧 DuelIntent（**ENG-04 的要害**）', () => {
    const e = fresh();
    tap(e, ACT.throw('rock'));
    // ① keybind 产的信号，source 是 p1 而不是 kb 实体
    const s = e.world.getComponent<Signal>('kb:throw:rock', 'Signal')!;
    expect(s).toMatchObject({ name: ACT.throw('rock'), source: 'p1' });
    // ② 接缝认出了侧，把意图挂到 p1 上（不代发的话这里会是 undefined——静默失效）
    e.world.tick();
    expect(e.world.getComponent('p1', 'DuelIntent')).toMatchObject({ throw: 'rock' });
  });

  it('玩家全程只点屏：蓄 1 → 出招 → 对面真掉 20 血【R-108-13】（端到端闭环）', () => {
    const e = fresh();
    for (let i = 0; i < 2; i++) { tap(e, ACT.charge('paper')); e.world.tick(); }
    expect(slot(e, 'p1', 'paper')).toBe(1);         // 【R-108-10】v3：点两次也只有一层

    tap(e, ACT.throw('paper'));                     // 玩家这一侧全程只"点屏"；对手是真 AI
    // 结算门要到 T3 才开（【R-108-01】·REQ-108-ENG-06）。等到相位真进 clash，不写死拍数。
    for (let i = 0; i < 900 && phase(e) !== 'clash'; i++) e.world.tick();
    e.world.tick(); e.world.tick(); e.world.tick();

    expect(res(e, 'p2')).toBe(HP_MAX - (DMG_BASE + 1 * DMG_STEP)); // 10 + 1×10 = 20
    expect(res(e, 'p1')).toBe(HP_MAX);
    expect(slot(e, 'p1', 'paper')).toBe(0);                         // 【R-108-14】出过即清零
  });
});

// ── v3 节奏案的四条新条款（gdd §3 / §3b / §5b·owner 2026-08-07 定完）─────────
describe('game108 · v3 节奏（【R-108-01/02/04/05/10】）', () => {
  /** 跑到某个相位（**不写死拍数**——v3 的 T2/T4 没有固定长度）。 */
  const until = (e: Engine, want: string, cap = 2000): void => {
    for (let i = 0; i < cap && phase(e) !== want; i++) e.world.tick();
    e.world.tick();   // 再走一拍：flow 是**下一拍**才跑新状态的 onEnter（tier3/flow.ts:104-110）
  };

  it('【R-108-10】额度用完就加不动，下一回合自动补回来（跨回合才攒得到 2 层）', () => {
    const e = fresh();
    tap(e, ACT.charge('paper')); e.world.tick();
    expect(slot(e, 'p1', 'paper')).toBe(1);
    expect(res(e, 'budget:p1')).toBe(0);                 // 额度花完
    tap(e, ACT.charge('paper')); e.world.tick();
    expect(slot(e, 'p1', 'paper')).toBe(1);              // 同回合再点：不动

    // 出剪（不出布 ⇒ 布那一层留着·【R-108-14】只清出过的手），走完一整回合回到 T1。
    tap(e, ACT.throw('scissors'));
    until(e, 'settle');
    tap(e, ACT.next); until(e, 'charge');
    expect(res(e, 'budget:p1')).toBe(CHARGE_PER_ROUND);  // 新回合补回额度
    tap(e, ACT.charge('paper')); e.world.tick();
    expect(slot(e, 'p1', 'paper')).toBe(2);              // 第二回合才叠到第二层
  });

  it('【R-108-01】T1 之外蓄不了力（额度在进 T2 那一拍作废·不靠禁用按钮）', () => {
    const e = fresh();
    until(e, 'throw');
    tap(e, ACT.charge('rock')); e.world.tick();
    expect(slot(e, 'p1', 'rock')).toBe(0);
  });

  it('【R-108-04】T2 免费 5 秒内出手不罚；拖过去每 1 秒欠 1 点，出手即停', () => {
    const e = fresh();
    until(e, 'throw');
    for (let i = 0; i < PHASE_TICKS.throw + 10; i++) e.world.tick();   // 免费段整段耗光
    expect(res(e, 'debt:p1')).toBe(0);                                 // 免费段内一点都不罚
    for (let i = 0; i < 3 * PENALTY_PERIOD; i++) e.world.tick();
    expect(res(e, 'debt:p1')).toBe(3 * PENALTY_HP);                    // 拖 3 秒 = 欠 3 点
    tap(e, ACT.throw('rock'));
    const at = res(e, 'debt:p1');
    until(e, 'clash');
    expect(res(e, 'debt:p1')).toBe(at);                                // 出手即停，不再涨
  });

  it('【R-108-04】罚血**真扣血**：拖 N 秒 = 自己掉 N 点，对手一点不掉', () => {
    const e = fresh();
    until(e, 'throw');
    for (let i = 0; i < PHASE_TICKS.throw + 10; i++) e.world.tick();   // 烧完免费段
    expect(res(e, 'p1')).toBe(HP_MAX);                                  // 免费段内不罚
    for (let i = 0; i < 4 * PENALTY_PERIOD; i++) e.world.tick();
    // 台账与血量必须**同步**——只对台账断言的话，「屏上写着欠 4 点、血条纹丝不动」这种
    // 最难查的假象照样全绿（接线第一版漏建节拍旗实体，正是这个形状）。
    expect(res(e, 'debt:p1')).toBe(4 * PENALTY_HP);
    expect(res(e, 'p1')).toBe(HP_MAX - 4 * PENALTY_HP);
    expect(res(e, 'p2')).toBe(HP_MAX);                                  // 只罚拖的那一侧
  });

  it('【R-108-04+15】一直不出手会被罚死，且**不会卡在读秒里**（血归零即收局）', () => {
    const e = fresh();
    until(e, 'throw');
    // 免费 5 秒 + 罚 100 秒 = 血罚光。不加「血归零即收局」那条转移的话，
    // 血 clamp 在 0、玩家又没出手 ⇒ 永远出不去读秒态 = 死局（点不动、也不结束）。
    for (let i = 0; i < PHASE_TICKS.throw + 110 * PENALTY_PERIOD; i++) e.world.tick();
    expect(res(e, 'p1')).toBe(0);
    expect(phase(e)).toBe('p2win');
  });

  it('【R-108-02】v3 作废「超时顺延」：T2 全程不点 = 不会有人替你提交', () => {
    const e = fresh();
    // 先打完一回合让 p1.lastThrow 有值（v2 正是靠它顺延的）。
    tap(e, ACT.throw('rock')); until(e, 'settle'); tap(e, ACT.next); until(e, 'charge');
    expect(e.world.getComponent<StringVar>('var:p1', 'StringVar')!.value).toBe('rock');
    until(e, 'throw');
    for (let i = 0; i < PHASE_TICKS.throw + 5 * PENALTY_PERIOD; i++) e.world.tick();
    // 顺延还在的话，这里早就替玩家挂上 DuelIntent 并结算完了；v3 该一直卡在罚血读秒。
    expect(e.world.getComponent('p1', 'DuelIntent')).toBeUndefined();
    expect(res(e, 'debt:p1')).toBeGreaterThan(0);
  });

  it('【R-108-05】T4 是纯玩家闸门：不点就一直停在结算，点了才进下一回合', () => {
    const e = fresh();
    tap(e, ACT.throw('rock'));
    until(e, 'settle');
    const r = res(e, 'round');
    for (let i = 0; i < 20 * TPS; i++) e.world.tick();    // 干等 20 秒
    expect(phase(e)).toBe('settle');                      // **没有自动兜底**
    tap(e, ACT.next);
    until(e, 'charge');
    expect(phase(e)).toBe('charge');
    expect(res(e, 'round')).toBe(r);                      // 回合数在结算那一拍就 +1 过了，闸门不重复计
  });

  it('蓄力额度的资源 id 不得与 `charge.` 同前缀（会撞进 clearOnSettle 的清零面）', () => {
    // 判定表的 `clearOnSettle:'charge'` 按相对名拼 `<侧>.charge.<手>`——额度用同前缀就会被
    // 结算副作用一起清掉，表现是"蓄力恒为 0"且**零报错**（v3 第一版就是这么写的，实测踩过）。
    for (const s of SIDES) {
      expect(chargeBudgetRes(s).startsWith(`${s}.charge`)).toBe(false);
      expect(penaltyDebtRes(s).startsWith(`${s}.charge`)).toBe(false);
      expect(chargeBudgetRes(s)).not.toBe(penaltyDebtRes(s));
    }
  });
});
