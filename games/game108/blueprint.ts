// game108《拳律 / Rule of Three》—— 对局世界 = **纯数据**（WorldBlueprint）。本目录零专属系统代码。
//
//   三时区四拍 = t3-flow（`FlowTransition.after` 的 tick 门）【R-108-01】
//   蓄力 +1    = UI/AI 信号 → t2-effect-apply{modify-resource} 打各侧唯一槽 id【R-108-10】
//   出招       = t2-matrix-duel 的 intentSignals 接缝（两侧共用信号名·靠 Signal.source 认侧）【R-108-11/70】
//   判定与伤害 = t2-matrix-duel 查表 + payoff.perSide 缩放（10 + 出手方该手蓄力 × 10）【R-108-12/13】
//   出过即清零 = t2-matrix-duel 的 clearOnSettle 结算副作用（只清各自出过的那只手）【R-108-14】
//   记本回合的手 = lastThrowVar → StringVar，供超时顺延与 AI 抄上一手取用【R-108-02/30】
//   胜负       = t3-flow 读 hp【R-108-15】
// 能力总览：docs/design/game108/capability-plan.md；规则语义：gdd.md（条款 R-108-NN）。
import type { WorldBlueprint, EntityBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import { resourceCapability, flagCapability, stringVariableCapability, randomCapability } from '@zerocraft/engine/atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability, matrixDuelCapability, selfRuleCapability, keybindCapability } from '@zerocraft/engine/skills/tier2/index.js';
import { flowCapability } from '@zerocraft/engine/skills/tier3/index.js';
import {
  HANDS, SIDES, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, ACT, HP_RES, chargeRes, chargeRelName, chargeEntity, lastThrowVar,
  type Hand, type Side,
} from './theme.js';

/** 「该侧已倒下」的 Flag id（**各侧唯一**——全局条件路由靠它认侧）。 */
export const deadFlag = (side: Side): string => `${side}.dead`;

/** 结算门 Flag id【R-108-01】：T3 对决时区开、T4 结算时区关（REQ-108-ENG-06）。 */
export const SETTLE_GATE = 'duel.settle';

/** T1/T2 相位门 Flag（AI 的规则据此只在该时区动手·flow 的 onEnter 开关）。 */
export const CHARGING_GATE = 'duel.charging';
export const THROWING_GATE = 'duel.throwing';

/** AI 侧的内部信号名——**不进动作词表**（【R-108-70】只管玩家动作），故与玩家的 `charge.<手>` 分开。 */
export const aiChargeSignal = (h: Hand): string => `ai.charge.${h}`;
/** 出招信号玩家与 AI **共用一个名**：接缝靠 `Signal.source` 认侧（见 capability-plan §4）。 */
export const throwSignal = (h: Hand): string => ACT.throw(h);

/** 判定表【R-108-12/13】：石 > 剪 > 布 > 石；伤害按**出手方**该手蓄力线性缩放。 */
function duelMatrix(): Record<string, unknown> {
  return {
    hpResource: HP_RES,
    throws: [...HANDS],
    beats: { rock: ['scissors'], paper: ['rock'], scissors: ['paper'] },
    payoff: Object.fromEntries(HANDS.map((h) => [h, {
      // perSide 相对名 → 运行期拼 `<出手方>.charge.<手>`，与 theme.chargeRes 严丝合缝（有点名测试钉死）。
      damage: { base: DMG_BASE, scaleByResource: chargeRelName(h), perSide: true, step: DMG_STEP },
    }])),
    tie: { selfDamage: TIE_SELF_DAMAGE },
    intentSignals: Object.fromEntries(HANDS.map((h) => [h, throwSignal(h)])),
    // 【R-108-01】结算门：只有进了 T3 对决时区才结算（REQ-108-ENG-06）。
    // 不设门的话双方一提交就立刻扣血 ⇒ 你出招那一刻血条就掉、槽就清，
    // **「亮拳」那 2 秒变成播放已经发生过的事**——而亮拳是本作的情绪核（§13 演出）。
    settleWhenFlag: SETTLE_GATE,
    clearOnSettle: 'charge',      // 【R-108-14】只清各自出过的那只手
    lastThrowVar: 'lastThrow',    // 【R-108-02/30】记本回合的手
    resolvedSignal: 'duel.resolved',
  };
}

/** 三时区四拍【R-108-01】：按 tick 门线性推进；settle 里判胜负【R-108-15】。 */
function duelFlow(): Record<string, unknown> {
  // ⚠ 不能写 `{kind:'resource', id:'hp', …}`——`ConditionExpr` 的 resource 是**全局 id 路由、无 entity 字段**，
  // 而两侧 hp 必须同 id（matrix-duel 的 hpResource 按侧 local 寻址）⇒ 全局条件分不清哪一侧。
  // 解法（**重组·非新缺口**）：各侧挂 `t2-self-rule` 读**自身** hp → 置自身那面**各侧唯一 id** 的 Flag，
  // flow 再按该唯一 flag id 读。见 capability-plan §7 同类根因。
  const hpDown = (side: Side): Record<string, unknown> => ({ kind: 'flag', id: deadFlag(side) });
  return {
    id: 'duel',
    current: 'charge',
    states: [
      {
        id: 'charge',
        onEnter: [
          { kind: 'set-flag', targetId: CHARGING_GATE, value: true },
          { kind: 'set-flag', targetId: THROWING_GATE, value: false },
        ],
        transitions: [{ after: PHASE_TICKS.charge, to: 'throw' }],
      },
      {
        id: 'throw',
        onEnter: [
          { kind: 'set-flag', targetId: CHARGING_GATE, value: false },
          { kind: 'set-flag', targetId: THROWING_GATE, value: true },
        ],
        transitions: [{ after: PHASE_TICKS.throw, to: 'clash' }],
      },
      // clash → settle 至少隔 1 tick：接缝在 Commit 产 intent、下一拍 Update 才结算
      // （capability-plan §5 实现约定 2），同拍收口会漏结算。
      // T3 对决：进来就开结算门（【R-108-01】T3 = 亮拳 → 克制判定 → 伤害演出——
      // 判定与伤害在引擎里是同一次操作，故「揭晓」这一拍就是它落地的那一拍）。
      {
        id: 'clash',
        onEnter: [{ kind: 'set-flag', targetId: SETTLE_GATE, value: true }],
        transitions: [{ after: PHASE_TICKS.clash, to: 'settle' }],
      },
      // T4 结算：门随即关上——下一回合的提交不该被上一回合开着的门直接结算掉。
      {
        id: 'settle',
        onEnter: [{ kind: 'set-flag', targetId: SETTLE_GATE, value: false }],
        transitions: [
          { when: hpDown('p2'), to: 'p1win' },
          { when: hpDown('p1'), to: 'p2win' },
          { after: PHASE_TICKS.settle, to: 'charge' },
        ],
      },
      { id: 'p1win' },
      { id: 'p2win' },
    ],
  };
}

/** 蓄力 +1 的效果实体【R-108-10】：一手一侧一条，targetId = 各侧唯一槽 id。 */
function chargeEffects(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const side of SIDES) {
    for (const h of HANDS) {
      const signal = side === 'p1' ? ACT.charge(h) : aiChargeSignal(h);
      out[`fx:charge:${side}:${h}`] = {
        Effect: {
          onSignal: signal,
          kind: 'modify-resource',
          targetId: chargeRes(side, h),
          value: 1,
          op: 'add', // 上限由 Resource.max 钳位【R-108-10】——满了再点也不会超
        },
      } as EntityBlueprint;
    }
  }
  return out;
}

/**
 * 玩家动作接线【R-108-70】：UI 的 `action` → InputQueue → t2-keybind → Signal。
 * 一动作一个专属 `kb:*` 实体（房屋范式·game-f/game101/game-103 同款·一实体一组件挤不下多份）。
 *
 * **出招三键必须填 `source: 'p1'`**（REQ-108-ENG-04·owner 2026-08-07 判 A）：
 * matrix-duel 的出招接缝**按 `Signal.source` 认侧**（`matrix-duel.ts:848`），而 kb 实体不是对局侧
 * ⇒ 不代发就永远认不到人，玩家点了没反应还不报错。
 * 蓄力三键**不填**：它们走 `t2-effect-apply` 的全局 `targetId` 路由（按信号名分侧），与 source 无关。
 */
function playerKeys(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const h of HANDS) {
    out[`kb:charge:${h}`] = { KeyBinding: { key: ACT.charge(h), signal: ACT.charge(h) } } as EntityBlueprint;
    out[`kb:throw:${h}`] = { KeyBinding: { key: throwSignal(h), signal: throwSignal(h), source: 'p1' } } as EntityBlueprint;
  }
  return out;
}

/**
 * 对手 ①【复读机】【R-108-30/32】—— **纯数据的条件加权表**（本目录零 AI 代码）。
 *
 * 行为：**复用上一回合自己出过的那只手**（首回合没有上一手 → 出石开局）。
 * 这是教学曲线的第一课：「对手是有规律的」——玩家读两回合就该看出来，然后用克制它的手赢。
 * 【R-108-32】要求破绽「明显·必现」，所以这一档**刻意不随机**。
 *
 * 怎么表达成数据（全部现成能力，零游戏层 system）：
 *  · **读上一手** = `ConditionExpr{kind:'string', id:'p2.lastThrow'}` 读 `lastThrowVar` 写下的那份
 *    （`clearOnSettle`/`lastThrowVar` 是 REQ-108-ENG-03 收进解释器的结算副作用）。
 *  · **只在对应时区动手** = 与相位门 Flag 取 `and`（flow 的 `onEnter` 开关它）。
 *  · **代表 p2 发信号** = `EventWhen.source: 'p2'`（REQ-108-ENG-05）——接缝按 `Signal.source` 认侧，
 *    不代发就永远认不到人（一实体一组件也挤不下三手，故一手一个规则实体）。
 *  · `mode:'edge'` = 每进一次该时区只发一次（离开时区条件回落自动复位）。
 *
 * 后续四名对手（莽夫/戏子/赌徒/Boss）要**按权重抽**，那需要种子 PRNG 的抽取通路——
 * 本轮先把「AI 能对打」这条通路打通并被验收剧本钉死，加权档另查。
 */
function opponentRules(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const lastIs = (h: Hand | ''): Record<string, unknown> => ({ kind: 'string', id: lastThrowVar('p2'), equals: h });
  for (const h of HANDS) {
    // 上一手是 h（首回合 lastThrow='' → 只有石那条的 or 分支命中）→ T1 蓄 h、T2 出 h。
    const repeats = h === 'rock'
      ? { kind: 'or', of: [lastIs('rock'), lastIs('')] }   // 开局默认出石（确定性·非随机）
      : lastIs(h);
    out[`ai:charge:${h}`] = {
      EventWhen: {
        signal: aiChargeSignal(h), mode: 'edge', armed: false,
        when: { kind: 'and', of: [{ kind: 'flag', id: CHARGING_GATE }, repeats] },
      },
    } as EntityBlueprint;
    out[`ai:throw:${h}`] = {
      EventWhen: {
        signal: throwSignal(h), mode: 'edge', armed: false,
        source: 'p2',                                       // ← REQ-108-ENG-05：接缝据此认侧
        when: { kind: 'and', of: [{ kind: 'flag', id: THROWING_GATE }, repeats] },
      },
    } as EntityBlueprint;
  }
  return out;
}

export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    duel: { DuelMatrix: duelMatrix() } as EntityBlueprint,
    flow: { GameFlow: duelFlow() } as EntityBlueprint,
    // 种子 PRNG：AI 抽招 / 破绽概率门一律走它——游戏层禁裸 Math.random（红线）。
    seed: { RandomSeed: { seed: 108 } } as EntityBlueprint,
    // 结算门旗（flow 的 onEnter 开关它·matrix-duel 的 Commit 接缝读它）。
    gate: { Flag: { id: SETTLE_GATE, active: false } } as EntityBlueprint,
    'gate:charging': { Flag: { id: CHARGING_GATE, active: true } } as EntityBlueprint,
    'gate:throwing': { Flag: { id: THROWING_GATE, active: false } } as EntityBlueprint,
    ...opponentRules(),
    ...chargeEffects(),
    ...playerKeys(),
  };

  // 双方：血量各挂一份**同 id**（matrix-duel 的 hpResource 按侧 local 寻址）【R-108-15】。
  for (const side of SIDES) {
    entities[side] = {
      Resource: { id: HP_RES, current: HP_MAX, min: 0, max: HP_MAX },
      Flag: { id: deadFlag(side), active: false },
      // 读自身 hp（不是全局 id）→ 置自身那面唯一 flag：这是「按侧判定」在现有能力里的正解。
      SelfRule: {
        when: { kind: 'resource', id: HP_RES, cmp: 'lte', value: 0 },
        do: [{ kind: 'set-flag', targetId: deadFlag(side), value: true }],
        once: true,
      },
    } as EntityBlueprint;
    entities[`var:${side}`] = { StringVar: { id: lastThrowVar(side), value: '' } } as EntityBlueprint;
    // 六条蓄力槽【R-108-03】：一实体一组件 → 槽必须另居实体（侧实体那份已被 hp 占）。
    for (const h of HANDS) {
      entities[chargeEntity(side, h)] = {
        Resource: { id: chargeRes(side, h), current: 0, min: 0, max: CHARGE_CAP },
      } as EntityBlueprint;
    }
  }

  return {
    capabilities: [
      resourceCapability, flagCapability, stringVariableCapability, randomCapability,
      eventWhenCapability, effectApplyCapability, keybindCapability,
      matrixDuelCapability, selfRuleCapability,
      flowCapability,
    ],
    entities,
  };
}
