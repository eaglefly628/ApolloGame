// game108 守卫测试 —— **钉死策划条款**（docs/design/game108/gdd.md）。
// S3 阶段只覆盖「数值与词表不漂移」；玩法闭环的对账走 S4 验收剧本（GD 写·PE 不许改）。
import { describe, it, expect } from 'vitest';
import {
  HANDS, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, PENALTY_PERIOD, PENALTY_HP, CHARGE_PER_ROUND,
  TPS, ACT, UI_ACT, SIDES, HP_RES, chargeRes, chargeRelName, chargeEntity, chargeBudgetRes, penaltyDebtRes,
  STYLE_MID, STYLE_MAX, MOOD_FSM, READ_RES, READ_MID, READ_LOW, READ_HIGH, FINISH_HP, THROW_LAG,
  BLUFF_FLAG, SILENT_FLAG, type Memory,
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

  it('【R-108-01】v3 四拍：T1 硬 4.5 秒 · T2 免费 5 秒 · T3 演出 1.5 秒 · T4 无时长（玩家闸门）', () => {
    // T1 由 2.5 → 4.5 秒（owner 2026-08-08 试玩改判：「浮上来以后给我大概 3~4 秒」）。
    // **这条要连着下面那条一起看**：真正能挑手的窗口 = 总时长 − 升起 − 收场，
    // 只钉总时长会让"演出再长一点"把可操作窗口悄悄吃光而测试照绿。
    expect(PHASE_TICKS.charge).toBe(4.5 * TPS);
    expect(PHASE_TICKS.throw).toBe(5 * TPS);
    expect(PHASE_TICKS.clash).toBe(1.5 * TPS);
    // 【R-108-05】T4 **不是"零秒"，是没有时长**：由玩家点「下一轮」收尾，不设自动兜底。
    // 写死成 0 就是让读表的地方（宿主的倒计时环）一眼看出"这一拍没有钟"。
    expect(PHASE_TICKS.settle).toBe(0);
    // ⚠ v2 那条「一回合 9 秒 → 一场 60-90 秒」的断言随 v3 作废（gdd §5 已划掉）——
    // T2 软超时 + T4 玩家闸门之后单局时长由玩家掌握，钉它等于钉一个不存在的承诺。
  });

  it('【R-108-08】T1 里**真正能挑手的窗口** ≥ 3 秒（owner 2026-08-08：「浮上来以后给我大概 3~4 秒」）', () => {
    // 升起 380ms + 三张错开 110ms；收场 = 粒子 600ms + 回落 380ms（都照设计定稿）。
    const RISE = 380 + 2 * 55, OUTRO = 600 + 380;
    const pickMs = (PHASE_TICKS.charge / TPS) * 1000 - RISE - OUTRO;
    expect(pickMs).toBeGreaterThanOrEqual(3000);
    // 也别长到回到「纯等」（owner 2026-08-07 嫌 5 秒里有 4.7 秒空等，那次判词的教训还在）。
    expect(pickMs).toBeLessThanOrEqual(4000);
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
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Engine } from '@zerocraft/engine/runtime/engine.js';

const ACCEPT_DIR = join(process.cwd(), 'docs/design/game108/acceptance');
import type { Resource, GameFlow, StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint, throwSignal, aiChargeSignal, deadFlag, DECIDE_GATE, READ_GATE, THROWING_GATE, MASTER_PATCHES } from './blueprint.js';
import { ART_SLOTS, skinKeyOf, SCENE_SLOT } from './art-slots.js';
import { SCENE_BG_SKIN } from './game108.js';

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
import { buildDuelScreen, emptyView, screenActions, loadPct, type DuelView } from './duel-screen.js';
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

  it('启动屏：加载**没走完就点不动**，走完了才有那唯一一个 `ui.` 出口（owner 2026-08-08）', () => {
    const loading: DuelView = { ...emptyView(), notStarted: true, bootMs: 0 };
    const ready: DuelView = { ...emptyView(), notStarted: true, bootMs: 60_000 };
    // 加载中：整屏没有任何出口。挂了 action 就等于"进度条是装饰、随时能跳过"，那条就白画了。
    expect(screenActions(loading)).not.toContain(UI_ACT.start);
    expect(loadPct(0)).toBe(0);
    expect(loadPct(60_000)).toBe(1);
    // 走完：PRESS ANY KEY —— 整屏就是那枚键。
    const acts = screenActions(ready);
    expect(acts).toContain(UI_ACT.start);
    // 开局是**宿主的局生命周期**，世界不需要知道玩家什么时候准备好 —— 所以它必须是 `ui.` 那一类。
    expect(UI_ACT.start.startsWith('ui.')).toBe(true);
    // 还没开局时屏上不该有对局动作（点了也没世界在跑，等于死键）。
    for (const h of HANDS) expect(acts).not.toContain(ACT.charge(h));
    for (const v of [loading, ready]) expect(validateLayoutNode(buildDuelScreen(v))).toEqual([]);
  });

  it('加载进度**量化**（每帧换新贴图会让 mountUI 每帧重建面板、PNG 重请一轮）', () => {
    // 本仓踩过一次：逐帧生成 data-URI 皮 → `networkidle` 永不落停、探针全线超时。
    const seen = new Set(Array.from({ length: 400 }, (_, i) => loadPct(i * 5)));
    expect(seen.size).toBeLessThanOrEqual(21);           // 0.00 … 1.00 共 21 挡
    expect(loadPct(0)).toBe(0);
    expect(loadPct(1e9)).toBe(1);                        // 单调封顶，不会溢出成 >1
    let prev = -1;
    for (let ms = 0; ms <= 3000; ms += 17) { const p = loadPct(ms); expect(p).toBeGreaterThanOrEqual(prev); prev = p; }
  });

  it('玩法说明：菜单里有入口，说明屏闭集合法（owner 2026-08-08）', () => {
    const open = screenActions({ ...emptyView(), menuOpen: true });
    expect(open).toContain(UI_ACT.help);
    const helpView: DuelView = { ...emptyView(), menuOpen: true, helpOpen: true };
    expect(validateLayoutNode(buildDuelScreen(helpView))).toEqual([]);
    // 说明本身也不许要求玩家记东西或心算（§0 验收铁律）——所以正文里不该出现公式/百分号。
    const texts: string[] = [];
    const walk = (n: LayoutNode): void => {
      const tx = (n.props as { text?: string } | undefined)?.text;
      if (typeof tx === 'string' && n.id.startsWith('help-')) texts.push(tx);
      for (const c of n.children ?? []) walk(c);
    };
    walk(buildDuelScreen(helpView));
    expect(texts.length).toBeGreaterThan(6);
    for (const x of texts) expect(x).not.toMatch(/[%×＝=]|\d+\s*\/\s*\d+/);
  });

  it('【R-108-21】烟雾**看得见**：三样都在（粒子雾 / 罩雾 / 对手「看不见」标）', () => {
    // owner 2026-08-08 报「烟雾完全没有效果」。这条钉的是**演出那一半**；
    // 规则那一半（AI 真读不到）等 gdd §9.0 的 A/B/C 裁完再做，**现在不许假装已生效**。
    const ids: string[] = [];
    const walk = (n: LayoutNode): void => { ids.push(n.id); for (const c of n.children ?? []) walk(c); };
    const off = { ...emptyView() };
    walk(buildDuelScreen(off));
    expect(ids).not.toContain('smoke-fx');
    ids.length = 0;
    const on: DuelView = { ...emptyView(), smoke: { uses: 1, hidden: true } };
    walk(buildDuelScreen(on));
    expect(ids).toContain('smoke-fx');       // 粒子雾
    expect(ids).toContain('smoke-veil');     // 我方三槽罩雾
    expect(ids).toContain('smoke-blind');    // 对手「看不见」标
    expect(validateLayoutNode(buildDuelScreen(on))).toEqual([]);
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

  it('【R-108-33】不许赖皮：大师**在玩家出手之前**就已定手，玩家再出也改不了它', () => {
    // 这条是硬红线，而且**最容易在改动中被静默破坏**——一旦 AI 的触发条件从「进 T2 那一拍」
    // 挪到别处，它就可能读到玩家的 DuelIntent 再决定，玩家永远输，且没有任何报错。
    const e = new Engine(); e.load(buildBlueprint('master'));
    until(e, 'throw');
    const aiHand = (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw;
    expect(aiHand).toBeTruthy();                       // 进 T2 那一拍它就定了
    expect(e.world.getComponent('p1', 'DuelIntent')).toBeUndefined();   // 此刻玩家还没出手
    tap(e, ACT.throw('paper'));
    for (let i = 0; i < 5; i++) e.world.tick();
    expect((e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw).toBe(aiHand);  // 不许改
  });

  it('【R-108-30】v4 只挂第五档：前四档的规则实体一个没换（判 A 的落点）', () => {
    for (const o of ['parrot', 'brute', 'actor', 'gambler'] as const) {
      const ids = Object.keys(buildBlueprint(o).entities);
      expect(ids.some((i) => i.startsWith('master:'))).toBe(false);
      expect(ids.some((i) => i.startsWith('ai:throw:'))).toBe(true);
    }
    const m = Object.keys(buildBlueprint('master').entities);
    expect(m.some((i) => i.startsWith('master:throw:'))).toBe(true);
    expect(m.some((i) => i.startsWith('ai:throw:'))).toBe(false);
    // 台账**所有档都记**（不记就学不到），只是前四档不读。
    for (const o of ['parrot', 'master'] as const) {
      expect(Object.keys(buildBlueprint(o).entities)).toContain('style:p1');
    }
  });

  it('【R-108-30】v4 维度一：出招记进跨局台账，且**只记玩家那一路**（AI 出手不算你的习惯）', () => {
    const e = fresh();
    until(e, 'throw');
    tap(e, ACT.throw('rock'));
    // 【R-108-33】入账在**结算那一拍**（T3 揭晓），不是出手当拍——出手当拍记就等于把
    // 「玩家已经出了什么」喂回大师同一个 T2 的输入里。故这里必须打到 clash 才读。
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(res(e, 'hist:rock')).toBe(0);                    // ← 还没结算，台账不许动
    until(e, 'clash'); e.world.tick();
    expect(res(e, 'hist:rock')).toBe(1);
    // 复读机这一回合也出了石（【R-108-30】），要是台账听的是共用的 `throw.rock`，这里会是 2。
    expect(res(e, 'hist:paper')).toBe(0);
    expect(res(e, 'hist:scissors')).toBe(0);
  });

  it('【R-108-30】v4 赌性指针：出刚蓄的那只 +1、出别的 −1', () => {
    const gamble = (chargeHand: string, throwHand: string): number => {
      const e = fresh();
      tap(e, ACT.charge(chargeHand as never)); e.world.tick();
      until(e, 'throw');
      tap(e, ACT.throw(throwHand as never));
      until(e, 'clash'); e.world.tick();                    // 【R-108-33】赌性指针同样在结算才动
      return res(e, 'style:p1');
    };
    expect(gamble('rock', 'rock')).toBe(STYLE_MID + 1);      // 蓄什么出什么 = 赌
    expect(gamble('rock', 'paper')).toBe(STYLE_MID - 1);     // 蓄一手出另一手 = 诈
  });

  it('【R-108-21】烟雾对大师**真生效**：雾中它只剩长期记忆，读不到我这一回合的槽', () => {
    /**
     * 打到定手窗，返回大师定的那只手。`smoke` 为真时先放烟雾。
     *
     * ⚠ 这个夹具**必须让两条路给出不同答案**，否则断言是假的：
     * v4 那版让「满蓄石」与「兜底石」都指向石，两条路都出布 ⇒ 换成 v5 后当场变成
     * `expect('paper').not.toBe('paper')`。教训（第四次撞同一形状）：**尺子不能照着被测物做**。
     * 现在的夹具：**这一回合**满蓄剪（雾能遮）、**长期习惯**是石（雾遮不住）——
     *   无雾 → 读剪 → 出石；有雾 → 只剩记忆 → 读石 → 出布。答案不同，断言才有信息量。
     */
    const masterPick = (smoke: boolean): string => {
      const e = new Engine(); e.load(buildBlueprint('master', { hist: { rock: 9, paper: 1, scissors: 1 }, style: STYLE_MID, read: 5 }));
      const r = e.world.getComponent<Resource>('slot:p1:scissors', 'Resource')!;
      e.world.addComponent('slot:p1:scissors', { ...r, current: CHARGE_CAP });
      if (smoke) { tap(e, ACT.smoke); e.world.tick(); }
      until(e, 'throw');
      return (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw ?? '';
    };
    // ⚠ 克星按**大师自己那张反转表**算（石吃布·布吃剪·剪吃石·`MASTER_PATCHES`）：
    // 想吃剪要出布，想吃石要出剪。拿标准表的直觉写这两行 = 把 bug 钉进测试
    // （2026-08-08 实测踩过：大师算错表，整局 100:0 输给"一直出同一只手"）。
    expect(masterPick(false)).toBe('paper');   // 看得见满蓄的剪 → 出布吃它
    expect(masterPick(true)).toBe('scissors'); // 雾里只剩「他老出石」这条记忆 → 出剪吃石
  });

  // ── 【R-108-34】v5：大师的心态机 + 蓄力动机（owner 2026-08-08）──────────────────
  /** 打到定手窗之后，返回大师这一回合的手。`prep` 在 T1 中段跑（骰子已落、蓄力已定）。 */
  const masterRound = (mem: Memory | undefined, prep?: (e: Engine) => void): { hand: string; e: Engine } => {
    const e = new Engine(); e.load(buildBlueprint('master', mem));
    for (let i = 0; i < 5; i++) e.world.tick();          // 心态 → 骰子 → 蓄力，三级各占一拍
    prep?.(e);
    until(e, 'throw');
    return { hand: (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw ?? '', e };
  };
  const setFlag = (e: Engine, eid: string, id: string, active: boolean): void => {
    e.world.addComponent(eid, { type: 'Flag', id, active } as never);
  };
  const setRes = (e: Engine, eid: string, v: number): void => {
    const r = e.world.getComponent<Resource>(eid, 'Resource')!;
    e.world.addComponent(eid, { ...r, current: v });
  };
  const flagOn = (e: Engine, eid: string): boolean => (e.world.getComponent(eid, 'Flag') as { active: boolean } | undefined)?.active === true;

  it('【R-108-34】蓄力 ≠ 出手：诈唬那一回合，大师**出的不是它蓄的那只**', () => {
    // 长期记忆说玩家爱出石 ⇒ 它蓄布（吃石）。这是它的"公开宣告"。
    const mem: Memory = { hist: { rock: 9, paper: 0, scissors: 0 }, style: STYLE_MID, read: READ_MID };
    const honest = masterRound(mem, (e) => setFlag(e, 'flag:bluffing', BLUFF_FLAG, false));
    const bluff = masterRound(mem, (e) => setFlag(e, 'flag:bluffing', BLUFF_FLAG, true));
    // 大师表里吃石要出**剪**（不是标准表的布）——见 blueprint 的 M_COUNTER 注释。
    expect(flagOn(honest.e, 'flag:plan:scissors')).toBe(true);   // 两局都蓄剪（宣告一样）
    expect(flagOn(bluff.e, 'flag:plan:scissors')).toBe(true);
    expect(honest.hand).toBe('scissors');                        // 真蓄：蓄什么出什么 → 重拳
    // 诈蓄：出的是**判读那只手本身**（石）。玩家若照着它的布槽反制（出剪吃布），正好被石吃掉；
    // 代价是这一手没蓄力，只有 10 点伤害——这就是诈唬要付的钱。
    expect(bluff.hand).toBe('rock');
    expect(bluff.hand).not.toBe(honest.hand);                 // owner 的原话：「蓄力也不代表一定要出那个东西」
  });

  it('【R-108-34】沉默那一回合它**一格都不蓄**——什么都不告诉你也是一手', () => {
    const e = new Engine(); e.load(buildBlueprint('master'));
    e.world.tick(); e.world.tick();                            // 心态定 → 骰子落
    setFlag(e, 'flag:silent', SILENT_FLAG, true);
    for (let i = 0; i < 6; i++) e.world.tick();
    for (const h of HANDS) expect(res(e, `slot:p2:${h}`)).toBe(0);
    for (const h of HANDS) expect(flagOn(e, `flag:plan:${h}`)).toBe(false);
    // 但它照样出手（沉默的是蓄力，不是出招）——不然玩家永远等不到结算。
    until(e, 'throw');
    expect((e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw).toBeTruthy();
  });

  it('【R-108-34】心态机四态按条件切换（收割优先 · 其余按读准度分档）', () => {
    const moodAfter = (read: number, p1hp: number): string => {
      const e = new Engine(); e.load(buildBlueprint('master', { hist: { rock: 0, paper: 0, scissors: 0 }, style: STYLE_MID, read }));
      const hp = e.world.getComponent<Resource>('p1', 'Resource')!;
      e.world.addComponent('p1', { ...hp, current: p1hp });
      e.world.tick(); e.world.tick();
      return (e.world.getComponent('mood:p2', 'State') as { current: string } | undefined)?.current ?? '';
    };
    expect(moodAfter(READ_MID, HP_MAX)).toBe('probe');          // 读准度中游 = 试探
    expect(moodAfter(READ_HIGH, HP_MAX)).toBe('press');         // 读得准 = 押重拳
    expect(moodAfter(READ_LOW, HP_MAX)).toBe('bluff');          // 被读穿 = 打心理战
    // 收割**压过**上面三条：玩家见底时它不管读得准不准，一律停止花招。
    expect(moodAfter(READ_LOW, FINISH_HP)).toBe('finish');
    expect(moodAfter(READ_HIGH, FINISH_HP)).toBe('finish');
  });

  it('【R-108-34】押重拳的心态（press/finish）**出的就是蓄的那只**——它要的是伤害', () => {
    const mem: Memory = { hist: { rock: 9, paper: 0, scissors: 0 }, style: STYLE_MID, read: READ_HIGH };
    const { hand, e } = masterRound(mem, (ee) => setFlag(ee, 'flag:bluffing', BLUFF_FLAG, false));
    expect((e.world.getComponent('mood:p2', 'State') as { current: string } | undefined)?.current).toBe('press');
    expect(flagOn(e, 'flag:plan:scissors')).toBe(true);
    expect(hand).toBe('scissors');
    expect(res(e, 'slot:p2:scissors')).toBeGreaterThan(0);      // 蓄的那只真有层 ⇒ 真是重拳
  });

  it('【R-108-34】回顾：它赢了读准度 +1、被读穿 −1（「对历史数据的回顾」那一半）', () => {
    const play = (playerHand: string): number => {
      const e = new Engine(); e.load(buildBlueprint('master'));
      until(e, 'throw');
      tap(e, ACT.throw(playerHand as never));
      until(e, 'clash'); e.world.tick(); e.world.tick();
      return res(e, 'read:p2');
    };
    // 大师开局判读「他会出石」→ 按**它自己的表**出剪（剪吃石）。
    // 玩家真出石 = 它读对了（+1）；玩家出布 = 布吃剪，它被吃了（−1）；同手 = 平局不动。
    expect(play('rock')).toBe(READ_MID + 1);
    expect(play('paper')).toBe(READ_MID - 1);
    expect(play('scissors')).toBe(READ_MID);
  });

  it('【R-108-34】跨局记忆真的灌得进去（owner：「本地可以把玩家的数据落地」）', () => {
    const e = new Engine();
    e.load(buildBlueprint('master', { hist: { rock: 3, paper: 40, scissors: 1 }, style: 17, read: 9 }));
    expect(res(e, 'hist:paper')).toBe(40);
    expect(res(e, 'style:p1')).toBe(17);
    expect(res(e, 'read:p2')).toBe(9);
    // 灌进去要**真影响决策**，不然只是个摆设：布是压倒性冠军 ⇒ 它蓄剪、出剪。
    for (let i = 0; i < 5; i++) e.world.tick();
    // 布是压倒性冠军 ⇒ 它蓄「吃布的手」= **石**（大师表：石吃布）。
    expect(flagOn(e, 'flag:plan:rock')).toBe(true);
  });

  it('【R-108-34】两手同时满蓄时**只点亮一面判读旗**（否则出招信号打架，出哪只手由实体名字典序定）', () => {
    // 这不是洁癖：玩家攒两手满蓄是六个回合的事。v4 的「某手满 3」两条会同拍成立，
    // 两个出招信号同拍发出、接缝后写覆盖 ⇒ 规则优先级由 id 字典序决定，测不出来也不报错。
    const e = new Engine(); e.load(buildBlueprint('master'));
    for (const h of ['rock', 'paper'] as const) {
      const r = e.world.getComponent<Resource>(`slot:p1:${h}`, 'Resource')!;
      e.world.addComponent(`slot:p1:${h}`, { ...r, current: CHARGE_CAP });
    }
    until(e, 'throw');
    expect(HANDS.filter((h) => flagOn(e, `flag:read:${h}`))).toHaveLength(1);
    expect((e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw).toBeTruthy();
  });

  it('【S6】皮肤槽登记表 ↔ 美术台账**逐行对得上**（owner 2026-08-08：「我只看到 3 张图片」）', () => {
    /**
     * owner review 逮到的那件事：台账只有 3 行 —— 不是因为这游戏只有 3 张图，
     * 而是因为**只有那 3 样是可替换的**，其余视觉都是代码里现画的、没有皮肤槽，
     * 按红线不许进台账。于是「美术想重画这游戏」在管线上只能重画那三个图标。
     *
     * 修法是把可替换面真正打开（`art-slots.ts`），而这条测试防它再退回去：
     * **登记表与台账必须逐行对得上**——加了可换面忘了记账、或台账留着没人读的孤儿行，都当场红。
     */
    const led = JSON.parse(readFileSync(join(process.cwd(), 'public/games/game108/art/art-ledger.json'), 'utf8')) as
      { rows: { skinKey: string; status: string }[] };
    const inLedger = new Set(led.rows.filter((r) => r.status !== 'retired').map((r) => r.skinKey));
    const declared = new Set(ART_SLOTS.map((a) => skinKeyOf(a.key)));
    expect([...declared].filter((k) => !inLedger.has(k))).toEqual([]);   // 声明了却没记账
    expect([...inLedger].filter((k) => !declared.has(k))).toEqual([]);   // 记了账却没人声明（孤儿）
    expect(declared.size).toBeGreaterThanOrEqual(14);                    // 3 行那次的下限护栏
  });

  it('【S6】每个皮肤槽**真的有人读**——喂一张假皮进去，屏上必须出现它（防孤儿行）', () => {
    /**
     * 台账红线是「只列**有真实消费槽**的行」。光靠上一条（表↔台账对得上）挡不住
     * 「表里写了、屏上没接」——那样生成出来的图照样上不了画面（换了没反应）。
     * 判据做成**可证伪的**：给每个 key 灌一个哨兵 URL，然后在真渲染出来的树里找它。
     */
    const sentinel = (k: string): string => `SENTINEL://${k}`;
    const skins = Object.fromEntries(ART_SLOTS.map((a) => [skinKeyOf(a.key), sentinel(skinKeyOf(a.key))]));
    // 走遍会用到不同素材的相位（亮拳只在对决/结算出现·石板只在非蓄力拍常驻…）。
    // ⚠ 手工挑几个 view 是不够的：第一版漏了「p1 出布」那一格，`gesture-p1-paper` 当场判成孤儿。
    //   亮拳素材是 **双方 × 三手 = 6 种**，就**穷举 6 种**——夹具的覆盖面要跟着素材的维度走，
    //   不跟着我随手想到的几个画面走。
    const views: DuelView[] = [
      { ...emptyView(), skins },
      { ...emptyView(), skins, phase: 'throw' },
      ...HANDS.map((h) => ({ ...emptyView(), skins, phase: 'clash' as const, shown: { p1: h, p2: h } })),
    ];
    const painted = new Set<string>();
    for (const v of views) {
      const json = JSON.stringify(buildDuelScreen(v));
      for (const a of ART_SLOTS) if (json.includes(sentinel(skinKeyOf(a.key)))) painted.add(a.key);
    }
    // ⚠ 这里**曾经有个后门**：我给背景开了 `painted.add(SCENE_SLOT)` 豁免，理由是"它由 mountHost 消费"。
    // 那正是尺子照着被测物做——真渲染截图当场打脸：屏上可见的背景是 `stageBg()` 画的那张，
    // wrapper 底色只是兜底层。**豁免掉的那一格恰好就是接错的那一格**。后门已拆，它现在照常参与判定。
    // wrapper 那一路（`mountHost({sceneBgSkin})`）另外核键名对得上即可。
    expect(SCENE_BG_SKIN).toBe(skinKeyOf(SCENE_SLOT));
    const orphans = ART_SLOTS.map((a) => a.key).filter((k) => !painted.has(k));
    expect(orphans).toEqual([]);
  });

  it('【S6】台账每一行都**看得见现状**——不是真图就必须有程序化预览 + 一句实话（owner 2026-08-08）', () => {
    /**
     * owner review：「占位符，但是我看不到原来的样子。哪怕你用矢量画一个样子出来我也知道。」
     * 病根：那 12 行标着 needs-art、墙上一律通用占位块，可**游戏里明明正画着它们**。
     * 于是「替换」变成盲替——美术不知道要顶掉什么，owner 看不出这行指屏上哪一块。
     *
     * 判据三条，缺一即红：① 有 servedPath ② 文件真的在盘上（不是写了个路径就算数）
     * ③ 有一句现状说明。另外**钉死 placeholder ≠ mock**：mock 永不上画面、不可 approve，
     * 把预览错标成 mock 会让整条美术线判断失据。
     */
    const led = JSON.parse(readFileSync(join(process.cwd(), 'public/games/game108/art/art-ledger.json'), 'utf8')) as
      { rows: { no: string; skinKey: string; status: string; gen?: { servedPath?: string; source?: string; style?: string; mock?: boolean } }[] };
    const blind: string[] = [];
    for (const r of led.rows) {
      if (r.status === 'retired') continue;
      const sp = r.gen?.servedPath;
      if (!sp) { blind.push(`${r.no} 没有可看的图`); continue; }
      // servedPath 是站点绝对路径 → 映回 public/ 下的真实文件
      if (!existsSync(join(process.cwd(), 'public', sp.replace(/^\//, '')))) blind.push(`${r.no} 的图不在盘上：${sp}`);
      if (!r.gen?.style) blind.push(`${r.no} 没有现状说明`);
      if (r.gen?.mock === true) blind.push(`${r.no} 标成了 mock（mock 永不上画面·不可 approve）`);
      if (r.status !== 'filled' && r.status !== 'approved' && r.gen?.source !== 'procedural-preview') {
        blind.push(`${r.no} 不是真图却也不是程序化预览：source=${r.gen?.source}`);
      }
    }
    expect(blind).toEqual([]);
  });

  it('【R-108-01】v4：**一出手就走**，不再把免费段跑满（owner 2026-08-08：「出手后不用等了。等半秒吧」）', () => {
    /**
     * v3 是「免费 5 秒**跑满**才走」：你 0.5 秒挑完手，剩下 4.5 秒只能盯着倒计时——
     * 正是 owner 2026-08-07 嫌弃过的那种空等，在 T2 原样复发了一次。
     * **这条以前一条测试都没有**（改完 63 条全绿，没有一条红）——所以节奏可以被悄悄改坏。
     * 判据不写死"多少拍"，写**两件玩家真感觉得到的事**：① 出手当拍就离开免费段
     * ② 从出手到揭晓远短于免费段本身。
     */
    const e = fresh();
    until(e, 'throw');
    const atThrow = e.world.getComponent<GameFlow>('flow', 'GameFlow')!.elapsed;
    expect(atThrow).toBeLessThan(PHASE_TICKS.throw / 2);   // 确实是"刚进 T2 就出手"，不是拖到尾巴
    tap(e, ACT.throw('rock'));
    e.world.tick();
    expect(phase(e)).toBe('throwLag');                     // ① 出手当拍就离开免费段

    let n = 0;
    while (!phase(e).startsWith('clash') && n < 2000) { e.world.tick(); n++; }
    expect(phase(e)).toBe('clash');
    // ② 定拍就是半秒那一档（留一拍余量给 after 门），且**远小于**免费段。
    expect(n).toBeGreaterThanOrEqual(THROW_LAG);
    expect(n).toBeLessThanOrEqual(THROW_LAG + 3);
    expect(n).toBeLessThan(PHASE_TICKS.throw / 4);
    expect(THROW_LAG).toBe(Math.round(0.5 * TPS));         // 半秒 = owner 的判词原文
  });

  it('【R-108-01】v4 免费段那 5 秒**没变**，它只是改管一件事：不出手能白拖多久', () => {
    // 一出手就走 ≠ 免费段缩短了。拖着不出手的人照旧有 5 秒白拖，到点才落罚血读秒
    // （【R-108-04】）。两个数各管一头——合并它们会让"手快的人"和"拖延的人"共用一个旋钮。
    expect(PHASE_TICKS.throw).toBe(5 * TPS);
    const e = fresh();
    until(e, 'throw');
    for (let i = 0; i < PHASE_TICKS.throw + 2; i++) e.world.tick();
    expect(phase(e)).toMatch(/^throwPenalty/);             // 全程不点 → 仍然是罚血读秒接手
    // 再拖两秒：欠账真的开始涨（光看相位名不够——罚血停摆过一次，见 flag:penaltyTick 那笔）。
    for (let i = 0; i < 2 * PENALTY_PERIOD + 4; i++) e.world.tick();
    expect(res(e, 'debt:p1')).toBeGreaterThanOrEqual(2);
  });

  it('【R-108-33】A 闸独立咬合：大师的判读/出招规则必须挂在**只亮一拍**的窗口上（REQ-108-PE-01）', () => {
    /**
     * **为什么这条是结构断言而不是行为断言**（主程 2026-08-08 复查门实测带出）：
     * 把定手窗改回整段 T2 都开着的 `THROWING_GATE`，60 条测试**一条都不红**——
     * 因为 v5 把台账推迟到了结算（B 闸），⑤ 定手读的四样输入（判读旗 / 计划旗 / 骰子 / 心态）
     * 在 T2 里已经**没有一样动得了**。两道闸同路冗余 ⇒ A 闸现为零覆盖的裸防御，
     * 将来谁动账期，A 就无人看守（正是它存在的那一天）。
     *
     * 我的第一版"撤修验红"给出过 A 转红的结论——那是**在 v5 重写之前**跑的，v5 之后失效了。
     * 教训：**撤修验红的结论跟着代码走，不跟着记忆走**；改完结构要重跑一遍。
     *
     * 行为测不到，就测结构——被保护的性质本来就是结构性的：
     * 「AI 的决策面只准开一拍」。断言写成"必须含定手窗旗 + 不许含整段 T2 的门"，
     * 改回 `THROWING_GATE` 两条都红。
     */
    const leaves = (c: unknown): Record<string, unknown>[] => {
      if (c === null || typeof c !== 'object') return [];
      const n = c as Record<string, unknown>;
      if (Array.isArray(n.of)) return (n.of as unknown[]).flatMap(leaves);
      if (n.of !== undefined) return leaves(n.of);
      return [n];
    };
    const ents = buildBlueprint('master').entities as Record<string, Record<string, unknown>>;
    const gated = (prefix: string, must: string): void => {
      const rules = Object.entries(ents).filter(([k]) => k.startsWith(prefix));
      expect([prefix, rules.length]).toEqual([prefix, HANDS.length]);
      for (const [id, e] of rules) {
        const ls = leaves((e.EventWhen as { when: unknown }).when);
        const has = (flagId: string): boolean => ls.some((l) => l.kind === 'flag' && l.id === flagId && l.equals !== false);
        expect([id, '挂了一拍窗', has(must)]).toEqual([id, '挂了一拍窗', true]);
        // 整段 T2 都开着的那道门**绝不许**出现在 AI 的决策条件里——它就是赖皮事故的触发面。
        expect([id, '没认整段 T2 的门', has(THROWING_GATE)]).toEqual([id, '没认整段 T2 的门', false]);
      }
    };
    gated('master:read:', READ_GATE);
    gated('master:throw:', DECIDE_GATE);

    // 「只亮一拍」也不能只写在注释里：两个窗口态必须是**无条件立刻走**的过渡态。
    // 谁给它们加个 `after`，窗口就变宽了，而上面那两条结构断言照绿。
    const flow = (ents['flow'].GameFlow ?? ents['flow'].Flow) as { states: { id: string; transitions?: unknown[] }[] };
    for (const id of ['lockIn', 'lockIn2']) {
      const st = flow.states.find((x) => x.id === id);
      expect([id, st?.transitions]).toEqual([id, [{ when: { kind: 'always' }, to: id === 'lockIn' ? 'lockIn2' : 'throw' }]]);
    }
  });

  it('【R-108-33】两扇窗在整个 T2 全程是关的（玩家一路骚扰也开不出第二次决策）', () => {
    const e = new Engine(); e.load(buildBlueprint('master'));
    until(e, 'throw');
    const open = (eid: string): boolean => (e.world.getComponent(eid, 'Flag') as { active: boolean } | undefined)?.active === true;
    const stuck = (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw;
    for (let i = 0; i < PHASE_TICKS.throw - 5; i++) {
      // 一路乱按蓄力（T2 里额度已作废，但 `p1.charged.*` 旗照样点得亮——判读链的输入之一）
      if (i % 31 === 0) tap(e, ACT.charge(HANDS[(i / 31) % 3 as 0 | 1 | 2]));
      e.world.tick();
      if (open(`gate:decide`) || open(`gate:read`)) throw new Error(`第 ${i} 拍窗口又开了`);
    }
    expect((e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw).toBe(stuck);
  });

  it('【R-108-34】大师算克星用的是**它自己那张被改写过的表**（两表不许各走各的）', () => {
    /**
     * **2026-08-08 sim 实测逮到的真 bug**：`MASTER_PATCHES` 把判定表**整环反转**了
     * （石吃布·布吃剪·剪吃石），而 v4/v5 的决策链一直按**标准表**算克星
     * ⇒ 它每次"反制"出的恰恰是自己表里的败手。整局 sim：玩家只要一直出同一只手，
     * **大师 100:0 一滴血不掉地输光**；更阴的是 ⑥ 回顾也用标准表判胜负，
     * **它每输一局读准度还 +1**（自我认知与战果完全相反，零报错）。
     *
     * 守法不是把正确答案再抄一遍——那样两处会一起错。**判据从 `MASTER_PATCHES` 现推**：
     * 让大师读到某只手，它出的那只必须在**补丁表里**吃得掉这只手。
     * 改表不改脑（或改脑不改表）当场红。
     */
    const beatsOf = (h: string): string[] =>
      (MASTER_PATCHES as { kind: string; throw: string; beats: string[] }[])
        .find((p) => p.kind === 'beats' && p.throw === h)?.beats ?? [];
    // 补丁表必须仍是一条完整的三元环（不是本条要测的东西，但塌了下面的判据就没意义）
    expect(HANDS.flatMap(beatsOf).sort()).toEqual([...HANDS].sort());

    for (const prey of HANDS) {
      // 用**跨局记忆**把玩家的统计冠军钉成 prey ⇒ 大师的判读必然是 prey。
      const hist = Object.fromEntries(HANDS.map((h) => [h, h === prey ? 9 : 0])) as Record<typeof HANDS[number], number>;
      const e = new Engine(); e.load(buildBlueprint('master', { hist, style: STYLE_MID, read: READ_MID }));
      until(e, 'throw');
      const read = HANDS.filter((h) => (e.world.getComponent(`flag:read:${h}`, 'Flag') as { active: boolean } | undefined)?.active);
      expect([prey, '判读', read]).toEqual([prey, '判读', [prey]]);
      const hand = (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw ?? '';
      expect([prey, '出的手在它自己表里吃得掉判读的那只', beatsOf(hand)]).toEqual([prey, '出的手在它自己表里吃得掉判读的那只', [prey]]);
    }
  });

  it('【R-108-34】骰子走引擎种子 PRNG：同一颗种子跑两遍，逐回合结果**完全一致**', () => {
    // 游戏层禁裸 Math.random（硬红线）。这条同时也是"随机不许破坏确定性/录放"的看门狗。
    const run = (): string[] => {
      const e = new Engine(); e.load(buildBlueprint('master'));
      const out: string[] = [];
      for (let r = 0; r < 8; r++) {
        until(e, 'throw');
        out.push(`${flagOn(e, 'flag:bluffing') ? 'B' : '-'}${flagOn(e, 'flag:silent') ? 'S' : '-'}`);
        tap(e, ACT.throw('rock'));
        until(e, 'settle'); tap(e, ACT.next); until(e, 'charge');
      }
      return out;
    };
    const a = run();
    expect(a).toEqual(run());
    // ⚠ **别让这条测试变成空转**：骰子一次都没中的话两遍都是 '----'，断言照绿而随机根本没被测到。
    // 故同时钉住「这 8 回合里骰子确实中过」——中不中是种子决定的定值，不是概率。
    expect(a.join('')).toMatch(/[BS]/);
  });

  it('验收剧本里「跨过 T1」的等待拍数 ≥ T1 真实长度（剧本写死字面量·常量一改就静默假绿）', () => {
    // **这条是 2026-08-08 交的学费**：T1 由 2.5→4.5 秒时，12 本剧本里的 `tick: 145~182`
    // 一个都没跟着改 ⇒ 整套验收当场变红，而门禁（scoped-gate）不跑验收，**没人看见**。
    // 剧本格式是闭集 JSONC（步骤只有 signal/tick/expect，没有"等到某相位"），
    // 所以字面量躲不掉；躲不掉就得有人守着——守的人在这里，读的是常量不是剧本。
    const files = readdirSync(ACCEPT_DIR).filter((f) => f.endsWith('.scenario.jsonc'));
    expect(files.length).toBeGreaterThan(0);
    // 落进 T2 需要：T1 的 after 门（270 拍·从 0 起跳要 elapsed>=after 故多一拍）+ 定手窗两拍。
    const needed = PHASE_TICKS.charge + 3;
    const offenders: string[] = [];
    for (const f of files) {
      const raw = readFileSync(join(ACCEPT_DIR, f), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n"]*$/gm, '')   // 去行注释
        .replace(/,(\s*[}\]])/g, '$1');                               // 去尾逗号
      const steps = (JSON.parse(raw) as { steps: Record<string, unknown>[] }).steps;
      // **判据取自剧本自己**：跟着剧本走一遍，记住"上一次断言时人在哪一拍"，
      // 只挑「上次还在 T1 → 等一段 → 断言已在 T2」这一种形状。
      // 两版走偏都记在这儿当路标：① 拿"tick > 100 就算跨相位"当启发式，冤枉了 T2 内部
      // 那些等待（在第 3 秒出手、再拖 4 秒罚血）；② 只看"下一步断言 flow==throw"，
      // 又冤枉了「已经在 T2、等 3 拍确认还在 T2」。**判据必须是相位的"从哪来"，不是数字大小。**
      let at = 'charge';                       // 剧本一律从 T1 开局
      steps.forEach((st, i) => {
        const exp = Array.isArray(st.expect) ? (st.expect as Record<string, unknown>[]) : [];
        const asserted = exp.find((e) => e.sv === 'flow')?.eq;
        if (typeof asserted === 'string') {
          const prev = steps[i - 1];
          if (at === 'charge' && asserted === 'throw' && typeof prev?.tick === 'number' && prev.tick < needed) {
            offenders.push(`${f}: tick ${prev.tick} < ${needed}`);
          }
          at = asserted;
        }
      });
    }
    expect(offenders).toEqual([]);
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
