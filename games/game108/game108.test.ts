// game108 守卫测试 —— **钉死策划条款**（docs/design/game108/gdd.md）。
// S3 阶段只覆盖「数值与词表不漂移」；玩法闭环的对账走 S4 验收剧本（GD 写·PE 不许改）。
import { describe, it, expect } from 'vitest';
import {
  HANDS, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, TPS, ACT, SIDES, HP_RES, chargeRes, chargeRelName, chargeEntity,
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

  it('【R-108-01】三时区四拍 = 3/3/2/1 秒', () => {
    expect(PHASE_TICKS.charge).toBe(3 * TPS);
    expect(PHASE_TICKS.throw).toBe(3 * TPS);
    expect(PHASE_TICKS.clash).toBe(2 * TPS);
    expect(PHASE_TICKS.settle).toBe(1 * TPS);
    // 一回合 ≈ 9 秒 → 6-10 回合落在 60-90 秒（GDD §5 时长口径）。
    const roundSec = (PHASE_TICKS.charge + PHASE_TICKS.throw + PHASE_TICKS.clash + PHASE_TICKS.settle) / TPS;
    expect(roundSec).toBe(9);
    expect(roundSec * 6).toBeGreaterThanOrEqual(54);
    expect(roundSec * 10).toBeLessThanOrEqual(90);
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
  it('蓄力 +1 只打自己那条槽，且封顶 3【R-108-10】', () => {
    const e = fresh();
    for (let i = 0; i < 5; i++) { fire(e, 'p1', ACT.charge('rock'), `c${i}`); e.world.tick(); e.world.tick(); }
    expect(slot(e, 'p1', 'rock')).toBe(CHARGE_CAP);   // 封顶
    expect(slot(e, 'p1', 'paper')).toBe(0);           // 没蓄的不动
    // ⚠ 不能断言「p2 的石不动」——对手①复读机现在会**自己**蓄石（【R-108-30】·纯数据规则）。
    // 改断言它**没碰**的那两只手：这仍然守住了原意「玩家的信号没串到对面去」，
    // 而且不会因为对面开始有行为就假红。
    expect(slot(e, 'p2', 'paper')).toBe(0);
    expect(slot(e, 'p2', 'scissors')).toBe(0);
  });

  it('一整回合闭环：蓄 2 → 双方出招 → 伤害按侧缩放 + 出过即清零 + 记本回合的手', () => {
    const e = fresh();
    // **跟真 AI 打**：对手①复读机会自己蓄石、出石（【R-108-30】），不再手动指定它出什么
    // ——手动指定会被它自己的出招覆盖（它在进出招时区那一拍才发），测出来的是假的。
    // 玩家蓄布 ×2 出布：布克石 ⇒ 10+2×10 = 30，与原用例同数同条款。
    fire(e, 'p1', ACT.charge('paper'), 'c1'); e.world.tick(); e.world.tick();
    fire(e, 'p1', ACT.charge('paper'), 'c2'); e.world.tick(); e.world.tick();
    expect(slot(e, 'p1', 'paper')).toBe(2);

    fire(e, 'p1', throwSignal('paper'), 't1');
    // 【R-108-01】结算门（REQ-108-ENG-06）：提交完**不会当拍结算**——要等 flow 走进 T3 对决时区
    // 才开门。本测试原先断言「3 拍后就掉血」，那正是条款禁止的（提交那刻血就掉 ⇒ 亮拳变成
    // 播放已发生的事）。跑到 T3：起手 charge 180 + throw 180 = 360 拍进 clash。
    for (let i = 0; i < 360; i++) e.world.tick();
    expect(phase(e)).toBe('clash');
    // 门在进 clash 那一拍（Commit）才 arm，结算在**下一拍**的 Update ⇒ 停在开门那一拍还没结算。
    e.world.tick(); e.world.tick(); e.world.tick();

    expect(res(e, 'p2')).toBe(HP_MAX - (DMG_BASE + 2 * DMG_STEP)); // 【R-108-13】10+2×10=30
    expect(res(e, 'p1')).toBe(HP_MAX);                              // 胜方不掉血
    expect(slot(e, 'p1', 'paper')).toBe(0);                         // 【R-108-14】出过即清零
    expect(slot(e, 'p1', 'rock')).toBe(0);                          // 没出的手原样保留（这里本就是 0）
    const lt = (side: string): string => e.world.getComponent<StringVar>(`var:${side}`, 'StringVar')!.value;
    expect(lt('p1')).toBe('paper');                                 // 【R-108-02/30】
    expect(lt('p2')).toBe('rock');                                  // 复读机出的石
  });

  it('血量归零 → 该侧 dead flag 置位（按侧判定走 self-rule·非全局条件）【R-108-15】', () => {
    const e = fresh();
    const hp = e.world.getComponent<Resource>('p2', 'Resource')!;
    e.world.addComponent('p2', { ...hp, current: 0 });
    e.world.tick(); e.world.tick();
    const flagOf = (side: string): boolean =>
      (e.world.getComponent(side, 'Flag') as unknown as { active: boolean }).active;
    expect(flagOf('p2')).toBe(true);
    expect(flagOf('p1')).toBe(false); // 只认自己那侧
    expect(deadFlag('p2')).toBe('p2.dead');
  });
});

// ── S3 对局屏：闭集校验 + 动作词表对账（ui-playbook 黄金流程 step 5）──────────
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildDuelScreen, emptyView, screenActions } from './duel-screen.js';

describe('game108 · 对局屏（LayoutNode 纯数据）', () => {
  it('validateLayoutNode 零 issue（闭集合法）', () => {
    const issues = validateLayoutNode(buildDuelScreen(emptyView()));
    expect(issues).toEqual([]);
  });

  it('屏上每个 action 都出自【R-108-70】动作词表——UI 与验收剧本同源', () => {
    const vocab = new Set<string>([
      ...HANDS.map(ACT.charge), ...HANDS.map(ACT.throw), ACT.smoke, ACT.shardPick, ACT.next,
    ]);
    const used = screenActions(emptyView());
    expect(used.length).toBeGreaterThan(0);
    for (const a of used) expect(vocab.has(a)).toBe(true);
  });

  it('蓄力时区：槽满的那只手键禁用且不带 action【R-108-10】', () => {
    const v = emptyView();
    v.charge.p1.rock = CHARGE_CAP;
    const acts = screenActions(v);
    expect(acts).not.toContain(ACT.charge('rock'));   // 满 → 无 action（不可点·不产生信号）
    expect(acts).toContain(ACT.charge('paper'));      // 没满 → 照常
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

  it('玩家全程只点屏：蓄 2 → 出招 → 对面真掉 30 血【R-108-13】（端到端闭环）', () => {
    const e = fresh();
    for (let i = 0; i < 2; i++) { tap(e, ACT.charge('paper')); e.world.tick(); }
    expect(slot(e, 'p1', 'paper')).toBe(2);

    tap(e, ACT.throw('paper'));                     // 玩家这一侧全程只"点屏"；对手是真 AI
    // 结算门要到 T3 才开（【R-108-01】·REQ-108-ENG-06）。
    for (let i = 0; i < 360; i++) e.world.tick();

    expect(res(e, 'p2')).toBe(HP_MAX - (DMG_BASE + 2 * DMG_STEP)); // 10 + 2×10 = 30
    expect(res(e, 'p1')).toBe(HP_MAX);
    expect(slot(e, 'p1', 'paper')).toBe(0);                         // 【R-108-14】出过即清零
  });
});
