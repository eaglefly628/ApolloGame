// game108 守卫测试 —— **钉死策划条款**（docs/design/game108/gdd.md）。
// S3 阶段只覆盖「数值与词表不漂移」；玩法闭环的对账走 S4 验收剧本（GD 写·PE 不许改）。
import { describe, it, expect } from 'vitest';
import {
  HANDS, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, PENALTY_PERIOD, PENALTY_HP, CHARGE_PER_ROUND,
  TPS, ACT, UI_ACT, SIDES, HP_RES, chargeRes, chargeRelName, chargeEntity, chargeBudgetRes, penaltyDebtRes,
  STYLE_MID, STYLE_MAX,
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

  it('开始屏：没点开始前只有一个出口，且它是 `ui.` 本地动作不是世界动作（owner 2026-08-08）', () => {
    const v: DuelView = { ...emptyView(), notStarted: true };
    const acts = screenActions(v);
    expect(acts).toContain(UI_ACT.start);
    // 开局是**宿主的局生命周期**，世界不需要知道玩家什么时候准备好 —— 所以它必须是 `ui.` 那一类。
    expect(UI_ACT.start.startsWith('ui.')).toBe(true);
    // 还没开局时屏上不该有对局动作（点了也没世界在跑，等于死键）。
    for (const h of HANDS) expect(acts).not.toContain(ACT.charge(h));
    expect(validateLayoutNode(buildDuelScreen(v))).toEqual([]);
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

  it('【R-108-21】烟雾对大师**真生效**：雾中它读不到我的满蓄（这才是烟雾的规则那一半）', () => {
    /** 打到 T2，返回大师定的那只手。`smoke` 为真时先放烟雾。 */
    const masterPick = (smoke: boolean): string => {
      const e = new Engine(); e.load(buildBlueprint('master'));
      // 直接把石槽灌满 = 最响的宣告（决策链第 1 条）。
      const r = e.world.getComponent<Resource>('slot:p1:rock', 'Resource')!;
      e.world.addComponent('slot:p1:rock', { ...r, current: CHARGE_CAP });
      if (smoke) { tap(e, ACT.smoke); e.world.tick(); }
      until(e, 'throw');
      return (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw ?? '';
    };
    // 没雾：它看得见石满 3 → 出布吃石。
    expect(masterPick(false)).toBe('paper');
    // 有雾：那一条读不到 ⇒ 它**不会**再吃石（退回习惯/兜底）。
    expect(masterPick(true)).not.toBe('paper');
  });

  it('【R-108-33】不许赖皮·第二道：T2 里再按蓄力键也**骗不动**大师（定手窗只有一拍）', () => {
    // 这一条钉的是 `DECIDE_GATE` 本身，**与上一条互不覆盖**：
    // 上一条走的是"台账入账推迟到结算"这道闸；本条走的是台账管不到的那个口子——
    // `fx:chargedflag` 听的是 `charge.<手>` 信号且**没有相位门**（Effect 没有 when），
    // 所以玩家在 T2 里照样能把 `p1.charged.<手>` 点亮（槽不会涨，额度已清零，但旗会亮）。
    // 大师的第 ② 条（赌徒型 → 吃他刚蓄的那只）正读这面旗：
    // 只要它的触发条件还挂在整段 T2 都开着的 `THROWING_GATE` 上，这就是一次新的上升沿 ⇒ 当场改手。
    const e = new Engine(); e.load(buildBlueprint('master'));
    // 先把玩家标成赌徒型，好让第 ② 条有资格命中。
    const st = e.world.getComponent<Resource>('style:p1', 'Resource')!;
    e.world.addComponent('style:p1', { ...st, current: STYLE_MAX });
    until(e, 'throw');
    const locked = (e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw;
    expect(locked).toBeTruthy();
    // T2 里疯按蓄力：布亮起 ⇒ 若定手窗失效，第 ② 条会让大师改出剪刀吃布。
    tap(e, ACT.charge('paper'));
    for (let i = 0; i < 5; i++) e.world.tick();
    expect((e.world.getComponent('flag:charged:paper', 'Flag') as { active: boolean } | undefined)?.active).toBe(true);  // 口子确实在
    expect((e.world.getComponent('p2', 'DuelIntent') as { throw: string } | undefined)?.throw).toBe(locked);             // 但改不动它
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
