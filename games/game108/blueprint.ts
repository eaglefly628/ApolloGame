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
import { eventWhenCapability, effectApplyCapability, matrixDuelCapability, selfRuleCapability, keybindCapability, craftRecipeCapability } from '@zerocraft/engine/skills/tier2/index.js';
import { flowCapability } from '@zerocraft/engine/skills/tier3/index.js';
import {
  HANDS, SIDES, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, PENALTY_PERIOD, PENALTY_HP, CHARGE_PER_ROUND,
  ACT, HP_RES, chargeRes, chargeRelName, chargeEntity, chargeBudgetRes, penaltyDebtRes, lastThrowVar,
  SMOKE_RES, SMOKE_TURNS, SMOKE_FLAG, SMOKE_USES, SMOKE_DURATION,
  type Hand, type Side, type OpponentId,
} from './theme.js';

/** 「该侧已倒下」的 Flag id（**各侧唯一**——全局条件路由靠它认侧）。 */
export const deadFlag = (side: Side): string => `${side}.dead`;

/** 结算门 Flag id【R-108-01】：T3 对决时区开、T4 结算时区关（REQ-108-ENG-06）。 */
export const SETTLE_GATE = 'duel.settle';

/** T1/T2 相位门 Flag（AI 的规则据此只在该时区动手·flow 的 onEnter 开关）。 */
export const CHARGING_GATE = 'duel.charging';
export const THROWING_GATE = 'duel.throwing';

/** 【R-108-04】v3 罚血读秒门：T2 免费段走完仍没出手 → 开；玩家出手/进 T3 → 关。屏上据它换倒计时形态。 */
export const PENALTY_GATE = 'duel.penalty';
/** 【R-108-05】v3 玩家闸门：`duel.next` 按下即置位，T4 据它推进；T1 开场复位。 */
export const NEXT_GATE = 'duel.next.armed';
/**
 * 【R-108-04】「这一侧本回合已提交出招」——罚血的停止条件。
 * **不能靠 `throw.<手>` 信号置**：那个名字玩家与 AI 共用（接缝靠 `Signal.source` 认侧），
 * 而 `effect-apply` 的 `set-flag` 不认 source ⇒ AI 一出手就会把玩家那面旗也点亮、罚血当场失效。
 * 故另拉一条**只有玩家键盘/点击才会走**的信号（见 `playerKeys` 的 `kb:threw:*`）。
 */
export const threwFlag = (side: Side): string => `${side}.threw`;
/** 上面那条玩家专属信号名（`ui.` 那类是表现层本地动作，这条是**世界信号**，只是不进动作词表）。 */
export const PLAYER_THREW = 'p1.threw';

/**
 * 蓄力两条 Effect 的**显式结算序**（【R-108-10】v3）。
 * `effect-apply` 同 tick 命中多条时按 `order` 升序、并列才按实体 id 兜底——
 * 「先按额度加层，再把额度清零」这个先后是**规则的一部分**，靠实体名的字典序兜底太脆
 * （改个实体名就静默反转，蓄力当场恒为 0，且不报错）。故写死成数据。
 */
const ORDER_CHARGE = 10;
const ORDER_SPEND = 20;

/**
 * 罚血读秒那两个状态的等待 tick 数。**不等于 `PENALTY_PERIOD`**：一个周期实际耗
 * `after + 2` 拍 —— 进 `throwPenalty` 那一拍 `elapsed` 从 0 起算（`after` 要等到 `elapsed>=after`
 * 才成立，故比 after 多一拍），`throwPenaltyHit` 自己再占一拍（onEnter 记账后当拍就跳回）。
 * 不减这 2 拍，「1 秒 1 点」实际是 1.033 秒 1 点——单看没感觉，犹豫 30 秒就少罚 1 点，
 * 而验收剧本正是按「秒数 = 点数」写的。已用 flow 时间线实测核过（见测试「罚血周期」）。
 */
const PENALTY_WAIT = PENALTY_PERIOD - 2;

/** AI 侧的内部信号名——**不进动作词表**（【R-108-70】只管玩家动作），故与玩家的 `charge.<手>` 分开。 */
export const aiChargeSignal = (h: Hand): string => `ai.charge.${h}`;
/** 出招信号玩家与 AI **共用一个名**：接缝靠 `Signal.source` 认侧（见 capability-plan §4）。 */
export const throwSignal = (h: Hand): string => ACT.throw(h);

/** 判定表【R-108-12/13】：石 > 剪 > 布 > 石；伤害按**出手方**该手蓄力线性缩放。 */
function duelMatrix(opponent: OpponentId = 'parrot'): Record<string, unknown> {
  return {
    // 【R-108-32】大师自带改写过的判定表（静态补丁·其余对手无补丁）。
    ...(opponent === 'master' ? { patches: MASTER_PATCHES } : {}),
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

/**
 * 三时区四拍【R-108-01】**v3**：T1 硬倒计时 / T2 免费段 + 罚血读秒 / T3 演出 / T4 玩家闸门。
 *
 * v3 比 v2 多两个状态，它们**不是第五拍**，是 T2 的读秒尾巴（屏上仍写「出招」）：
 *   `throwPenalty`    罚血读秒中（等 1 秒）
 *   `throwPenaltyHit` 罚这 1 点（onEnter 记一笔）→ 立刻回 `throwPenalty`
 * 两态互跳 = **flow 自己就是那口周期时钟**（`flow.elapsed` 每次进状态归零，见 tier3/flow.ts:104-110）。
 * 为什么不用 `Timer`+`EventWhen`：Timer 全程自走、进罚血那一刻对不上相位，
 * 头一次罚血会随机延迟 0–1 秒；而 flow 的 `after` 从进状态那一拍起算，天然对齐。
 */
function duelFlow(): Record<string, unknown> {
  // ⚠ 不能写 `{kind:'resource', id:'hp', …}`——`ConditionExpr` 的 resource 是**全局 id 路由、无 entity 字段**，
  // 而两侧 hp 必须同 id（matrix-duel 的 hpResource 按侧 local 寻址）⇒ 全局条件分不清哪一侧。
  // 解法（**重组·非新缺口**）：各侧挂 `t2-self-rule` 读**自身** hp → 置自身那面**各侧唯一 id** 的 Flag，
  // flow 再按该唯一 flag id 读。见 capability-plan §7 同类根因。
  const hpDown = (side: Side): Record<string, unknown> => ({ kind: 'flag', id: deadFlag(side) });
  /** 玩家已提交出招 —— T2 的收尾条件（罚血读秒也据它停）。 */
  const playerThrew = { kind: 'flag', id: threwFlag('p1') };
  /**
   * 回合复位（T1 开场一次做完）。**必须在这里做，不能在 T4 收尾做**：
   * T4 是玩家闸门，玩家可能盯着结算屏看半分钟——复位放那儿会让「上一回合的欠债/已出手」
   * 提前消失，结算屏就读不出这一波到底发生了什么了。
   */
  const roundReset: Array<Record<string, unknown>> = [
    { kind: 'set-flag', targetId: CHARGING_GATE, value: true },
    { kind: 'set-flag', targetId: THROWING_GATE, value: false },
    { kind: 'set-flag', targetId: PENALTY_GATE, value: false },
    { kind: 'set-flag', targetId: NEXT_GATE, value: false },
    { kind: 'set-flag', targetId: threwFlag('p1'), value: false },
    // 【R-108-10】v3：每回合发一份蓄力额度（双方同规则——AI 也只加一层）。
    ...SIDES.map((s) => ({ kind: 'modify-resource', targetId: chargeBudgetRes(s), op: 'set', value: CHARGE_PER_ROUND })),
    { kind: 'modify-resource', targetId: penaltyDebtRes('p1'), op: 'set', value: 0 },
  ];
  return {
    id: 'duel',
    current: 'charge',
    states: [
      {
        id: 'charge',
        onEnter: roundReset,
        transitions: [{ after: PHASE_TICKS.charge, to: 'throw' }],
      },
      {
        id: 'throw',
        onEnter: [
          { kind: 'set-flag', targetId: CHARGING_GATE, value: false },
          { kind: 'set-flag', targetId: THROWING_GATE, value: true },
          // 额度当场作废：T1 结束就不能再蓄了（【R-108-01】蓄力只在 T1）。
          // 靠"按钮禁用"是治不了的——那只是表现层，键位/脚本照样能发信号。
          ...SIDES.map((s) => ({ kind: 'modify-resource', targetId: chargeBudgetRes(s), op: 'set', value: 0 })),
        ],
        // 【R-108-01】v3：免费段到点**不推进到对决**，转入罚血读秒（【R-108-04】）。
        // 玩家在免费段内出手的，读秒态第一条转移当场成立 ⇒ 一拍就过，罚不到。
        transitions: [{ after: PHASE_TICKS.throw, to: 'throwPenalty' }],
      },
      // ── T2 尾巴：罚血读秒（屏上仍是「出招」这一拍）────────────────────────
      {
        id: 'throwPenalty',
        onEnter: [{ kind: 'set-flag', targetId: PENALTY_GATE, value: true }],
        transitions: [
          { when: playerThrew, to: 'clash' },
          { after: PENALTY_WAIT, to: 'throwPenaltyHit' },
        ],
      },
      {
        id: 'throwPenaltyHit',
        // 记一笔欠债（**全局唯一 id**，故 flow 的 modify-resource 打得中）。
        // 欠债 → 真掉血这一步**尚缺引擎通路**（见 requests.md REQ-108-ENG-07 的 A/B）：
        // 全局 Effect 写不到"指定一侧"的 hp（两侧同 id），故本轮先把账记准、演出照做。
        onEnter: [{ kind: 'modify-resource', targetId: penaltyDebtRes('p1'), op: 'add', value: PENALTY_HP }],
        transitions: [
          { when: playerThrew, to: 'clash' },
          { when: { kind: 'always' }, to: 'throwPenalty' },
        ],
      },
      // clash → settle 至少隔 1 tick：接缝在 Commit 产 intent、下一拍 Update 才结算
      // （capability-plan §5 实现约定 2），同拍收口会漏结算。
      // T3 对决：进来就开结算门（【R-108-01】T3 = 亮拳 → 克制判定 → 伤害演出——
      // 判定与伤害在引擎里是同一次操作，故「揭晓」这一拍就是它落地的那一拍）。
      {
        id: 'clash',
        onEnter: [
          { kind: 'set-flag', targetId: SETTLE_GATE, value: true },
          // 罚血读秒到此为止（进了对决还亮着，结算屏会一直显示「你在被罚」）。
          { kind: 'set-flag', targetId: PENALTY_GATE, value: false },
          // **必须在这里关出招门**：不关的话，结算写完 lastThrow 会让「按 lastThrow 出招」那批
          // edge 规则再次抬升边沿 → 同一回合结算第二次（实测：伤害从 30 变 40 = 30 + 清零后的 10）。
          { kind: 'set-flag', targetId: THROWING_GATE, value: false },
        ],
        transitions: [{ after: PHASE_TICKS.clash, to: 'settle' }],
      },
      // T4 结算：门随即关上——下一回合的提交不该被上一回合开着的门直接结算掉。
      {
        id: 'settle',
        onEnter: [{ kind: 'set-flag', targetId: SETTLE_GATE, value: false }],
        transitions: [
          { when: hpDown('p2'), to: 'p1win' },
          { when: hpDown('p1'), to: 'p2win' },
          // 【R-108-05】v3：**玩家闸门**——点了「下一轮」才进下一回合，**无自动兜底**
          // （owner 2026-08-07：「我们是个单人游戏，没必要去 push 玩家」）。
          // 胜负两条排在前面：血已归零时点不点都该收局，不该卡在结算屏等一次点击。
          { when: { kind: 'flag', id: NEXT_GATE }, to: 'charge' },
        ],
      },
      { id: 'p1win' },
      { id: 'p2win' },
    ],
  };
}

/**
 * 蓄力效果实体【R-108-10】**v3**：一手一侧**两条**——加层 + 花额度。
 *
 * v2 是「每点一次 +1」（`value:1`），owner 2026-08-07 判「那是个 bug」：条款原文一直写着
 * 「T1 往一手存 **+1**」，一回合一层。v3 用**每回合一份额度**表达：
 *   ① `fx:charge:*`  槽 += 额度当前值（`valueFrom`·额度 1 就加 1、额度 0 就加 0）
 *   ② `fx:spend:*`   额度 = 0
 * 于是"同回合第二次点"自然加 0，**不靠禁用按钮**（按钮是表现，键位与脚本绕得过去）。
 * 上限仍由 `Resource.max = CHARGE_CAP` 钳位——满了再点也不会超。
 *
 * ⚠ 两条的先后是**规则**，写成显式 `order`（见 ORDER_CHARGE/ORDER_SPEND 的注释）。
 */
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
          op: 'add',
          value: 0,                                              // valueFrom 在场时不读它（留 0 = 不误导）
          valueFrom: { resourceId: chargeBudgetRes(side) },       // 加多少 = 本回合还剩多少额度
          order: ORDER_CHARGE,
        },
      } as EntityBlueprint;
      out[`fx:spend:${side}:${h}`] = {
        Effect: {
          onSignal: signal,
          kind: 'modify-resource',
          targetId: chargeBudgetRes(side),
          op: 'set',
          value: 0,
          order: ORDER_SPEND,
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
    // 同一个键**再绑一条**玩家专属信号（keybind 逐 KeyBinding 实体匹配，同 key 多绑各发各的，
    // `keybind.ts:84-101`）——罚血的停止条件只能听玩家这一路，听不得 AI 那一路（见 threwFlag 注释）。
    out[`kb:threw:${h}`] = { KeyBinding: { key: throwSignal(h), signal: PLAYER_THREW } } as EntityBlueprint;
  }
  // 【R-108-05】T4 玩家闸门键。**世界动作**（进 InputQueue → Signal → 置闸门旗），
  // 与终局屏那枚「再来一局」同名同键但落点不同：终局由宿主换一个世界（见 game108.ts restart）。
  out['kb:next'] = { KeyBinding: { key: ACT.next, signal: ACT.next } } as EntityBlueprint;
  return out;
}

/**
 * 五名对手【R-108-30/32】—— **纯数据的条件规则表**（本目录零 AI 代码）。
 *
 * 【R-108-32】五名对手是**一条教学曲线**，不是五个数值不同的怪：
 *  ① 复读机 parrot  —— 复用上一回合自己出的手。破绽明显·必现。教「对手是有规律的」。
 *  ② 莽夫   brute   —— 偏爱石头（永远蓄石出石，除非上一手是石则继续石）。教「读表演」。
 *  ③ 戏子   actor   —— **蓄一手、出另一手**（蓄上一手的克制手、出上一手）。教「蓄力会说谎」。
 *  ④ 赌徒   gambler —— 血少（≤50）时必满蓄押上一手；血厚时同复读机。教「逆转与孤注」。
 *  ⑤ 大师   master  —— 自带**改写过的判定表**（静态 patches）+ 行为同戏子。总检。
 *
 * 【R-108-30】原文要求「条件加权表·权重经种子 PRNG 抽取」。**本轮五档全部落在"条件"这一半**：
 * 每档的行为都是**确定性规则**，没有用到权重抽取——这不是偷懒，是【R-108-32】的硬要求：
 * 前四档都写明了「破绽」（明显·必现 / 攥拳高频 / 假动作 / 血低时破绽变多），
 * **破绽要可读，行为就不能随机**。设计红线也写死了「AI 必须 3-4 回合内可读，读不出来的 AI =
 * 随机数发生器 = 违反支柱一」。加权抽取留给后续「同权重档位间的平局打散」，届时另查通路。
 *
 * 表达手段（全部现成能力）：读上一手 = `ConditionExpr{kind:'string'}` 读 `lastThrowVar`；
 * 只在对应时区动手 = 与相位门 Flag 取 `and`；代表 p2 发信号 = `EventWhen.source`（ENG-05）。
 */
const BEATEN_BY: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

function opponentRules(who: OpponentId): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const lastIs = (h: Hand | ''): Record<string, unknown> => ({ kind: 'string', id: lastThrowVar('p2'), equals: h });
  const openingIsRock = (h: Hand): Record<string, unknown> =>
    h === 'rock' ? { kind: 'or', of: [lastIs('rock'), lastIs('')] } : lastIs(h);

  /** 该档在「上一手 = prev」时，蓄哪只手 / 出哪只手。 */
  const plan = (prev: Hand): { charge: Hand; throw: Hand } => {
    switch (who) {
      case 'brute':   return { charge: 'rock', throw: 'rock' };                       // 偏爱石头·永远石
      case 'actor':                                                                    // 蓄一手、出另一手
      case 'master':  return { charge: BEATEN_BY[prev], throw: prev };                // 蓄"克制上一手的手"当假动作，实际出上一手
      case 'gambler': return { charge: prev, throw: prev };                            // 押上一手（血低时靠满蓄放大·见 §赌徒）
      default:        return { charge: prev, throw: prev };                            // 复读机
    }
  };

  for (const h of HANDS) {
    const when = openingIsRock(h);
    const p = plan(h);
    out[`ai:charge:${h}`] = {
      EventWhen: {
        signal: aiChargeSignal(p.charge), mode: 'edge', armed: false,
        when: { kind: 'and', of: [{ kind: 'flag', id: CHARGING_GATE }, when] },
      },
    } as EntityBlueprint;
    out[`ai:throw:${h}`] = {
      EventWhen: {
        signal: throwSignal(p.throw), mode: 'edge', armed: false,
        source: 'p2',                                       // ← REQ-108-ENG-05：接缝据此认侧
        when: { kind: 'and', of: [{ kind: 'flag', id: THROWING_GATE }, when] },
      },
    } as EntityBlueprint;
  }
  return out;
}

/**
 * 【R-108-02】**v3 作废了 v2 的「超时顺延」**（owner 2026-08-07）。
 *
 * v2：T2 不点 → 自动替玩家沿用上一回合的手（「不罚玩家、不卡节奏」）。
 * v3：T2 不点 → 走【R-108-04】罚血读秒，**卡到玩家出手为止**；T1 不点 = 这回合就是没蓄力。
 * 理由（owner 原话口径）：玩家有时需要思考，**给思考时间但要付代价**，比「到点替你决定」诚实。
 *
 * 所以这里原本那六条 `carry:*` 规则整组删掉了——留着会与罚血打架：
 * 免费段一到点它就替玩家提交，罚血条件 `threwFlag` 当场成立，**这一条永远罚不到人**。
 * v2 原文查 git 历史（本函数 2026-08-08 前的版本）。
 */

/**
 * 【R-108-20/21/22】烟雾——花一次次数，把自方三条槽对对手遮 2 回合；蓄力照常累积。
 * `t2-craft-recipe`：`smoke.use` 信号 + 扣 1 次次数 → 置隐藏旗；回合数由 `smokeTurns` 资源计，
 * 每次结算（`duel.resolved`）−1，归零时 self-rule 落旗。**全是数据，零游戏层 system。**
 */
function smokeWiring(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  out['smoke:p1'] = {
    CraftRecipe: {
      onSignal: ACT.smoke,
      costs: [{ id: SMOKE_RES('p1'), amount: 1 }],
      gains: [{ id: SMOKE_TURNS('p1'), amount: SMOKE_DURATION }],
      grantsFlag: SMOKE_FLAG('p1'),
    },
  } as EntityBlueprint;
  // 每次结算 −1 回合（duel.resolved 是判定表的 resolvedSignal）。
  out['smoke:tick'] = {
    Effect: { onSignal: 'duel.resolved', kind: 'modify-resource', targetId: SMOKE_TURNS('p1'), value: -1, op: 'add' },
  } as EntityBlueprint;
  // 回合数归零 → 落旗（读自身 → 施自身，按侧不串台）。
  out['smoke:res:p1'] = {
    Resource: { id: SMOKE_TURNS('p1'), current: 0, min: 0, max: SMOKE_DURATION },
    Flag: { id: SMOKE_FLAG('p1'), active: false },
    SelfRule: {
      when: { kind: 'resource', id: SMOKE_TURNS('p1'), cmp: 'lte', value: 0 },
      do: [{ kind: 'set-flag', targetId: SMOKE_FLAG('p1'), value: false }],
    },
  } as EntityBlueprint;
  out['smoke:uses:p1'] = { Resource: { id: SMOKE_RES('p1'), current: SMOKE_USES, min: 0, max: SMOKE_USES } } as EntityBlueprint;
  out['kb:smoke'] = { KeyBinding: { key: ACT.smoke, signal: ACT.smoke } } as EntityBlueprint;
  return out;
}

/** 【R-108-32】大师自带改写过的判定表（**静态 patches**·对局开始即生效·每拍重 fold）。 */
const MASTER_PATCHES = [
  // **整环反转**（石←→剪←→布 全反），而不是只让石多克一手——后者会让「石克布」与「布克石」
  // 同时成立，落盘门当场硬抛「同一格定不出胜负」（实测踩过，判词还直接给了修法）。
  { kind: 'beats', throw: 'rock', beats: ['paper'] },
  { kind: 'beats', throw: 'paper', beats: ['scissors'] },
  { kind: 'beats', throw: 'scissors', beats: ['rock'] },
];

export function buildBlueprint(opponent: OpponentId = 'parrot'): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    duel: { DuelMatrix: duelMatrix(opponent) } as EntityBlueprint,
    flow: { GameFlow: duelFlow() } as EntityBlueprint,
    // 种子 PRNG：AI 抽招 / 破绽概率门一律走它——游戏层禁裸 Math.random（红线）。
    seed: { RandomSeed: { seed: 108 } } as EntityBlueprint,
    // 结算门旗（flow 的 onEnter 开关它·matrix-duel 的 Commit 接缝读它）。
    gate: { Flag: { id: SETTLE_GATE, active: false } } as EntityBlueprint,
    // 回合数（玩家视角复核第 5 问：得知道自己打到第几回合了）——每次结算 +1，纯数据。
    round: { Resource: { id: 'round', current: 1, min: 1, max: 99 } } as EntityBlueprint,
    'fx:round': { Effect: { onSignal: 'duel.resolved', kind: 'modify-resource', targetId: 'round', value: 1, op: 'add' } } as EntityBlueprint,
    'gate:charging': { Flag: { id: CHARGING_GATE, active: true } } as EntityBlueprint,
    'gate:throwing': { Flag: { id: THROWING_GATE, active: false } } as EntityBlueprint,
    // ── v3 新增的四面旗 + 两笔账 ─────────────────────────────────────────
    'gate:penalty': { Flag: { id: PENALTY_GATE, active: false } } as EntityBlueprint,
    'gate:next': { Flag: { id: NEXT_GATE, active: false } } as EntityBlueprint,
    // 玩家「本回合已出手」：一实体一组件，故旗与置旗的 Effect 分居两个实体。
    'flag:threw:p1': { Flag: { id: threwFlag('p1'), active: false } } as EntityBlueprint,
    'fx:threw:p1': { Effect: { onSignal: PLAYER_THREW, kind: 'set-flag', targetId: threwFlag('p1'), value: true } } as EntityBlueprint,
    'fx:next': { Effect: { onSignal: ACT.next, kind: 'set-flag', targetId: NEXT_GATE, value: true } } as EntityBlueprint,
    'debt:p1': { Resource: { id: penaltyDebtRes('p1'), current: 0, min: 0, max: 999 } } as EntityBlueprint,
    ...opponentRules(opponent),
    ...smokeWiring(),
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
    // 【R-108-10】v3 蓄力额度：起手就发一份，**不等 T1 的 onEnter**——
    // flow 首帧才跑 `charge` 的 onEnter，起手值留 0 会让第一回合的第一次点击加 0（首局哑一拍）。
    entities[`budget:${side}`] = {
      Resource: { id: chargeBudgetRes(side), current: CHARGE_PER_ROUND, min: 0, max: CHARGE_PER_ROUND },
    } as EntityBlueprint;
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
      eventWhenCapability, effectApplyCapability, keybindCapability, craftRecipeCapability,
      matrixDuelCapability, selfRuleCapability,
      flowCapability,
    ],
    entities,
  };
}
