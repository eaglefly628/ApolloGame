// game108《拳律 / Rule of Three》—— 数值与词表（**纯数据·单一真相**）。
// 每个常量都对应 GDD v2 的一条条款；**改数值不改条款号**（gdd.md 头注）。
// 策划真相 = docs/design/game108/gdd.md；能力口径 = capability-plan.md。
import { apolloOnyx } from '@zerocraft/engine/ui/components/apollo-kit.js';
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';

/** 三手（【R-108-12】克制关系的定义域）。第四手 void 由遗物「第四指」以 add-throw 补丁增设。 */
export const HANDS = ['rock', 'paper', 'scissors'] as const;
export type Hand = (typeof HANDS)[number];

export const HAND_CN: Record<Hand, string> = { rock: '石', paper: '布', scissors: '剪' };
export const HAND_ICON: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

// ── 数值（GDD §5 v2 首版·待 S4 用 sim 调）────────────────────────────────
export const HP_MAX = 100;          // 【R-108-15】双方一律 100·难度不靠血条
export const CHARGE_CAP = 3;        // 【R-108-10】蓄力上限
export const DMG_BASE = 10;         // 【R-108-13】伤害 = DMG_BASE + 蓄力 × DMG_STEP
export const DMG_STEP = 10;         //             → 10 / 20 / 30 / 40
export const TIE_SELF_DAMAGE = 0;   // 【R-108-15】平局双方不掉血（清零由 §R-108-14 承担）

/**
 * 三时区四拍的 tick 时长（【R-108-01】**v3**·gdd §5b 七个数由 owner 2026-08-07 定完）。
 *
 * ⚠ **T1 由 2.5 秒改判 4.5 秒（owner 2026-08-08 试玩后改口）**：
 * 「蓄力时间太短了，没看清楚就没了。**要浮上来以后给我大概 3~4 秒**。」
 * 2.5 秒那次判词是在**还没有升起/注水/粒子演出**时下的（当时嫌「4.7 秒纯等」）；
 * 现在这一拍首尾各被演出吃掉一截，真正能挑手的窗口只剩 ~1 秒。算法：
 *   总时长 − 升起(380ms + 错开 110ms) − 收场(粒子 600ms + 回落 380ms) = 可挑手窗口
 *   4.5s − 0.49s − 0.98s ≈ **3.0 秒**，而「卡片浮在空中」的整段 ≈ 3.6 秒 —— 落在 owner 说的 3~4 秒里。
 * 改这个数会连带改验收剧本里所有 T1 的等待拍数（剧本用的是常量不是字面量，改这里即可）。
 *
 * v3 改的是「每一拍**由什么结束**」，不是「谁赢」：
 *   T1 charge  硬倒计时 **4.5 秒**到点 → T2（原 2.5 秒·owner 2026-08-08 改判，见上）
 *   T2 throw   **免费 5 秒**；到点**不强制推进**，转入罚血读秒（【R-108-04】），罚到玩家出手为止
 *   T3 clash   演出播完 **1.5 秒** → T4
 *   T4 settle  **玩家点「下一轮」才推进**（【R-108-05】·**不设自动兜底**）
 *
 * ⚠ `settle: 0` 不是"零秒"、是**没有时长**——T4 由闸门收尾，屏上那圈倒计时环这一拍不该出现。
 * 读这张表的地方（宿主 `readView`）据此判「有没有倒计时」，别写成 `?? charge` 兜底：
 * 兜底会让结算屏画出一圈倒计时的环，玩家以为再不点就自动过了。
 */
export const TPS = 60;
export const PHASE_TICKS = {
  charge: Math.round(4.5 * TPS),  // 270 —— T1 蓄力（公开·硬倒计时）
  throw: 5 * TPS,                 // 300 —— T2 出招（隐藏·同时）**免费段**
  clash: Math.round(1.5 * TPS),   // 90  —— T3 对决演出
  settle: 0,                      //  0  —— T4 结算：玩家闸门，无时长
} as const;

/**
 * 【R-108-01】v4：**出手之后的定拍**（owner 2026-08-08：「出手后不用等了。等半秒吧」）。
 *
 * v3 的 T2 是「免费 5 秒**跑满**才走」——你 0.5 秒挑完手，剩下 4.5 秒只能盯着倒计时，
 * 而那正是 owner 2026-08-07 嫌弃过的那种空等（v2 的「5 秒里 4.7 秒纯等」原样复发在了 T2）。
 * v4：**玩家一提交就走**，中间只留半秒——这半秒不是等待，是**双方的手都还扣着的那一拍**，
 * 揭晓前的悬念归它。到点进 T3 亮拳（`PHASE_TICKS.clash` 的演出照旧）。
 *
 * ⚠ 免费段 `PHASE_TICKS.throw` **仍是 5 秒**：它现在只管一件事——「不出手能白拖多久」
 * （拖过头进罚血读秒【R-108-04】）。两个数各管一头，别合并。
 */
export const THROW_LAG = Math.round(0.5 * TPS);

/** 【R-108-04】超时罚血：免费段用完后**每 1 秒扣 1 点**，直到该侧提交出招。 */
export const PENALTY_PERIOD = 1 * TPS;
export const PENALTY_HP = 1;

/**
 * 【R-108-10】v3：**一回合最多给一只手 +1 层**（上限仍 3，故满蓄仍需攒 3 回合）。
 * 条款原文一直是「往一手存 +1」，v2 实现做成了「每点一次 +1」——owner 2026-08-07 判「那是个 bug」。
 * 实现手段 = 每回合一份「蓄力额度」资源（见 `chargeBudgetRes`），加多少层由额度当前值决定，
 * 加完即把额度清零 ⇒ 同回合再点加 0（**不是禁用按钮**：按钮禁不禁是表现，额度才是规则）。
 */
export const CHARGE_PER_ROUND = 1;

// ── 动作词表（【R-108-70】唯一真相：UI action / data-action / 验收剧本步骤名同一串字符）──
export const ACT = {
  charge: (h: Hand) => `charge.${h}`,
  throw: (h: Hand) => `throw.${h}`,
  smoke: 'smoke.use',
  shardPick: 'shard.pick',
  next: 'duel.next',
} as const;

/**
 * **表现层本地动作**（`ui.` 前缀）——与上面的世界动作是两类，别混。
 * 世界动作经 `ActionSink` 入 `InputQueue` → 变成 `Signal` 参与仿真（进 hash / 录放 / lockstep）；
 * `ui.*` 只由宿主的本地 handler 消费（换语言这种纯显示设置），**永远不进世界**。
 * 验收剧本只用世界动作；`ui.*` 不出现在剧本里。
 */
export const UI_ACT = {
  menu: 'ui.menu',      // 开/合设置菜单
  lang: 'ui.lang',      // 中 / EN
  bgm: 'ui.bgm',        // 背景音乐开关
  sfx: 'ui.sfx',        // 音效开关
  voice: 'ui.voice',    // 角色配音开关
  // 开局键（owner 2026-08-08 试玩：「这一局刚开始时候，我还没有点开始，它就直接三个牌飞上来了。
  // 我觉得我们第一次进入游戏还是要有一个开始这个按钮」）。
  // **是 `ui.` 不是世界动作**：世界不需要知道「玩家什么时候准备好」——那是宿主的局生命周期
  //（同「再来一局」那条分界）。而且它还兼一件事：浏览器要求**真实用户手势之后**才准出声，
  // 这一点正好是整局的第一个手势，BGM 从这里起。
  start: 'ui.start',
  help: 'ui.help',      // 玩法说明（owner 2026-08-08：「我们这游戏少了个说明文档，需要在这个菜单里加一下」）
  // 终局屏「换个游戏玩」推荐位（REQ-DOKI-APPS·owner 2026-08-16 判）——点一格 = 请宿主拉起那个 App。
  // **是 `ui.` 不是世界动作**：拉起隔壁 App 是宿主的事，世界不该知道（进了世界就进 hash/录放/lockstep）。
  // 哪一格靠 `actionArg` 带 appId（闭集里只多这一个动作名，不给每个 App 造一个动作·【R-108-70】）。
  appPick: 'ui.app.pick',
  // 【SDK 演示台】owner 2026-08-17：「我想实践一下所有 SDK 的功能……做一个 demonstration」。
  // 一块能在**真 DokiWorld 网页里逐个按**的自检面板：每行一个模块，右边一枚「试一下」。
  // 同样是 `ui.` 而非世界动作——它整块与对局规则无关，进世界就会污染 hash/录放/lockstep。
  sdk: 'ui.sdk',            // 开/合演示台
  sdkTry: 'ui.sdk.try',     // 试某一个模块（哪一个靠 actionArg 带 key·同 appPick 那条口径）
} as const;

/** 【SDK 演示台】九个模块的 key —— **与 manifest.runtime.extensions 同名**（面板按这张表逐行画）。 */
/**
 * SDK 演示台的行 = 我们**关心**的能力（不等于我们**声明**的能力）。
 *
 * 2026-08-18 按 SDK 3.0 样例仓重排：能不能拿到某个扩展由**拉起这个 App 的 Host profile**
 * 决定（不是 App 的 kind）。Game 会被两台 Host 拉起，各给一套：
 *   · Chat Game Host        → character/storage/speech/persona/dialogue/media/progress ✔
 *   · World Nested App Host → 只有 checkpoint/progress/resize
 *   · apps / episode        → **只有 World Page Host 有**，Game 无论怎么声明都拿不到
 * 后两个仍留在台上，正是为了让「拿不到」这件事**看得见**——从台上删掉它们，
 * 下一个人只会重新发明一次「声明了为什么不通」（2026-08-17 那五个超时就是这么来的）。
 */
export const SDK_MODULES = [
  'character', 'storage', 'speech', 'persona', 'dialogue', 'media', 'progress',
  'apps', 'episode', 'game-result',
] as const;
export type SdkModule = (typeof SDK_MODULES)[number];

/** 每个能力由**哪台 Host** 提供（样例仓 README「Host capability profile」表·2026-08-18 快照）。 */
export const SDK_HOST_PROFILE: Record<SdkModule, string> = {
  character: 'Chat Game', storage: 'Chat Game', speech: 'Chat Game', persona: 'Chat Game',
  dialogue: 'Chat Game', media: 'Chat Game', progress: 'Chat Game / Nested',
  apps: 'World Page 专属', episode: 'World Page 专属',
  'game-result': '输出契约·非扩展',
};

// ── 世界里的 id 约定 ───────────────────────────────────────────────────
export const SIDES = ['p1', 'p2'] as const;
export type Side = (typeof SIDES)[number];

/** 血量资源 id（两侧各挂一份同 id·matrix-duel 的 hpResource 按侧 local 寻址）。 */
export const HP_RES = 'hp';

/**
 * 蓄力槽的 **Resource id** = `<侧>.charge.<手>`（capability-plan §5 实现约定 1）。
 * 判定表里只填**相对名** `charge.<手>` + `perSide:true`，由 `t2-matrix-duel` 运行期拼出本 id。
 * 这是「按侧取值」的唯一正解——靠「各侧唯一 id」治不了（表只能填一个），实测证伪见 requests.md。
 */
export const chargeRes = (side: Side, hand: Hand): string => `${side}.charge.${hand}`;
export const chargeRelName = (hand: Hand): string => `charge.${hand}`;
/** 蓄力槽的**实体** id（一实体一组件：侧实体那份 Resource 已被 hp 占，槽必须另居实体）。 */
export const chargeEntity = (side: Side, hand: Hand): string => `slot:${side}:${hand}`;

/** 「本回合出了哪只手」的 StringVar id —— 供【R-108-14】出过即清零的 6 条静态规则取用。 */
export const lastThrowVar = (side: Side): string => `${side}.lastThrow`;

/**
 * 【R-108-10】v3 蓄力额度的 **Resource id**：每回合 T1 开场置 `CHARGE_PER_ROUND`，
 * 蓄力 Effect 用 `valueFrom` 读它当加层数，紧接着的第二条 Effect 把它清零。
 * **绝不与 `charge.` 同前缀**——判定表的 `clearOnSettle:'charge'` 按相对名拼 `<侧>.charge.<手>`，
 * 同前缀会撞进清零面（v3 第一版就是这么写的，实测蓄力恒为 0）。
 */
export const chargeBudgetRes = (side: Side): string => `${side}.budget`;

/** 【R-108-04】本回合已欠的罚血点数（**per-round**·T1 开场清零）。屏上「你已经欠了多少」读它。 */
export const penaltyDebtRes = (side: Side): string => `${side}.debt`;

/**
 * 【R-108-04】罚血的**节拍旗**（全局 id·flow 每秒点亮一拍）。
 * 该侧的 `SelfRule` 用 `whenGlobal` 读它 → `do.modify-resource` 扣**自身**那份 hp，
 * 这是「全局条件 → 按侧扣血」在现有能力里的正解（主程 2026-08-07 回驳单的等价写法）。
 *
 * ⚠ **不带 `once`**：`once` 的 armed 复位只看 `when`（自身）不看 `whenGlobal`
 * （`whenGlobal` 为假是 continue 整条跳过·armed 不动），节拍放 `whenGlobal` 里会「罚第一次就再也不复位」。
 * 改用 level 模式 + **旗只亮一拍**（`throwPenaltyHit` 进态点亮 → 下一拍 `throwPenalty` 熄灭），
 * 于是「一秒一点」由 flow 的两态互跳保证，不依赖 armed 语义。
 */
export const penaltyTickFlag = (side: Side): string => `${side}.penaltyTick`;

// ── 【R-108-30】v4 · 大师的两个维度（owner 2026-08-08 判 A：**只挂第五档**）────────
/** 维度一：玩家每只手**跨局**出过多少次（宿主持久化·装载时写进蓝图初值）。 */
export const histRes = (hand: Hand): string => `p1.hist.${hand}`;
/**
 * 维度一之二：**赌性指针**。起手 `STYLE_MID`，出了刚蓄的那只 +1、出了别的 −1，钳在 0..STYLE_MAX。
 * `>= STYLE_GAMBLER` 判赌徒型，否则均匀型。
 * **一个数就够**：存比率要么得心算、要么得两条资源做除法，而 `ConditionExpr` 只会比大小。
 */
export const STYLE_RES = 'p1.style';
export const STYLE_MAX = 20;
export const STYLE_MID = 10;
export const STYLE_GAMBLER = 12;
/** 本回合玩家蓄的是哪只手 / 出的是哪只手（旗·T1 开场清）。大师的「二次思考」读它们。 */
export const chargedFlag = (hand: Hand): string => `p1.charged.${hand}`;
export const threwHandFlag = (hand: Hand): string => `p1.threwHand.${hand}`;
/** 玩家专属的**逐手**出招信号（只有真点/真按键才会走·AI 那一路不走）。 */
export const playerThrewHand = (hand: Hand): string => `p1.threw.${hand}`;
/**
 * **入账信号**（【R-108-33】）：玩家出了 `hand` 这一手，在**结算那一拍**才记进台账。
 *
 * 为什么不在出手当拍记：台账（`p1.hist.*` / `p1.style`）是大师的**输入**，
 * 出手当拍就动 = 大师在同一个 T2 里读到了「玩家已经出了什么」的二手信息 ⇒ 赖皮。
 * 台账语义本来也是「已打完的回合」，落在结算才对。
 */
export const playerCounted = (hand: Hand): string => `p1.counted.${hand}`;

// ── 【R-108-34】大师 v5：心态机 + 蓄力动机（owner 2026-08-08）────────────────
/**
 * **大师为什么蓄力**（owner 原话：「你要思考一下这个 AI 它为什么会蓄力？它蓄力也不代表一定要出那个东西」）。
 *
 * v4 的大师蓄力毫无动机——照抄自己上一手，纯装饰。v5 把蓄力还原成它在本作里**本来的含义**：
 * 蓄力 = **一笔公开的投资**。加的是伤害（10→40），付的是情报（对面看得见你押在哪只手上）。
 * 于是「蓄哪只手」与「出哪只手」变成两个独立决策，中间隔着一枚骰子：
 *
 *   · **真蓄**（不诈唬）—— 蓄 X 出 X。押中就是重拳；但对面照着你的槽反制就吃亏。
 *   · **诈蓄**（诈唬）  —— 蓄 X 出**别的**。伤害只有 10，换的是「对面被你的槽骗走一手」。
 *
 * 骰子按**心态**给不同的概率（下表），心态本身是一台**真状态机**（`State` + `set-state`·数据）。
 * 这样玩家看见「它蓄了石」时，脑子里跑的是一道真正的题：这是重拳还是鱼饵？
 * ——这正是本作要的那口博弈，只是这次由 AI 也发一次牌。
 */
export const MOOD_FSM = 'ai.mood';
export type Mood = 'probe' | 'press' | 'bluff' | 'finish';
export const MOODS: readonly Mood[] = ['probe', 'press', 'bluff', 'finish'] as const;
/**
 * **读准度**（`p2.read`·0..10·起手 5·**跨局落地**）——「对历史数据的回顾」那一半。
 * 每回合结算后按胜负 ±1：它赢 = 读对了 +1，它输 = 被读穿了 −1，平局不动。
 * 这不是难度旋钮，是**它对自己的判断**：读得准就敢押重拳（press），
 * 被人连着看穿就改打心理战（bluff）。玩家因此能感到「它在适应我」。
 */
export const READ_RES = 'p2.read';
export const READ_MAX = 10;
export const READ_MID = 5;
export const READ_LOW = 3;          // ≤ 这个数 = 被读穿了 → 心理战
export const READ_HIGH = 8;         // ≥ 这个数 = 手感来了 → 施压
/**
 * **收割线**：玩家血 ≤ 这个数 → 心态切 `finish`，从不诈唬、必押重拳（它要的是那 40 点）。
 *
 * ⚠ 读的是**玩家的**血，不是它自己的——不是设计偏好，是**引擎的寻址事实**：
 * `ConditionExpr{kind:'resource'}` 是全局 id 路由、无 entity 字段，而两侧 hp 必须同 id
 * （matrix-duel 按侧 local 寻址）⇒ 全局条件读到的永远是**第一个**挂 hp 的实体 = p1
 * （这条已由「玩家侧死亡看守 `watch:p1`」的点名测试钉住）。p2 想读自己的血只能靠它那格
 * `SelfRule`，而那格已经给了死亡判定，**一实体一组件挤不下第二条**。
 *
 * 于是换了个**更好读**的触发：不是「它快死了所以孤注」，而是「**你快死了所以它不玩了**」。
 * 玩家的体验更直接——血一见底，对面立刻停止花招、开始抡重拳。
 */
export const FINISH_HP = 30;
/** 各心态的**诈唬概率 / 沉默概率**（分子，分母 `ODDS_DEN`）。沉默 = 这回合干脆不蓄，什么也不告诉你。 */
export const ODDS_DEN = 10;
export const BLUFF_ODDS: Record<Mood, number> = { probe: 3, press: 2, bluff: 7, finish: 0 };
export const SILENT_ODDS: Record<Mood, number> = { probe: 3, press: 0, bluff: 0, finish: 0 };
/** 本回合大师的骰子结果与计划（每回合 T1 开场清）。 */
/**
 * 【R-108-32】v2 前四档的**性格骰**（owner 2026-08-15 试玩：「AI 永远只会出锤子」的修复件之一）。
 * 莽夫用它决定偶尔扑一下、赌徒用它忽冷忽热；复读机/戏子不看它（它们的变化来自玩家的手）。
 * 与大师那两枚骰同源同律：走引擎种子 PRNG、只碰「表演选择」不碰「读得准不准」。
 */
export const WILD_FLAG = 'p2.wild';
export const WILD_ODDS = 3;          // 3/10（分母 ODDS_DEN）——莽夫十回合里约三回不按套路
export const BLUFF_FLAG = 'p2.bluffing';
export const SILENT_FLAG = 'p2.silent';
export const MOOD_SET_FLAG = 'p2.moodSet';   // 心态已定（骰子等它，免得拿上回合的心态摇）
export const DICE_DONE_FLAG = 'p2.diceDone'; // 骰子已摇（蓄力等它，免得在沉默判出来之前就蓄了）
export const planFlag = (hand: Hand): string => `p2.plan.${hand}`;
/** 大师对「玩家这一手会出什么」的判读结果（定手窗第一拍算出、第二拍消费）。 */
export const readFlag = (hand: Hand): string => `p2.read.${hand}`;

/** 跨局落地的玩家画像（宿主存 localStorage·开局灌回世界）。**只存公开可复现的数**。 */
export interface Memory { hist: Record<Hand, number>; style: number; read: number }
export const MEMORY_KEY = 'game108.memory.v1';

/**
 * 读画像（宿主用·同 `loadLang` 口径：读不到就当新玩家）。
 * **逐字段校验 + 钳位**：localStorage 是玩家能直接改的，一个 NaN 灌进 `Resource.current`
 * 就是整局条件比较全部为假、AI 一手不出且零报错。宁可当没读到。
 */
export const loadMemory = (): Memory | undefined => {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return undefined;
    const o = JSON.parse(raw) as Partial<Memory>;
    const n = (v: unknown, lo: number, hi: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;
    return {
      hist: Object.fromEntries(HANDS.map((h) => [h, n(o.hist?.[h], 0, 99999)])) as Record<Hand, number>,
      style: n(o.style, 0, STYLE_MAX),
      read: n(o.read, 0, READ_MAX),
    };
  } catch { return undefined; }
};
export const saveMemory = (m: Memory): void => {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* 无 localStorage（探针/SSR）→ 本次会话内仍生效 */ }
};

/**
 * 「玩法说明已经看过了」（owner 2026-08-15 试玩：「刚出来的时候是要先跳一下玩法说明，
 * 如果说玩家可以选跳过，这还是要有的」）。
 *
 * **只存一个布尔**：说明屏的内容全在 `strings.ts`，这里存的是"要不要自动弹"这一位。
 * 读不到 = 新玩家 = 弹（与 `loadMemory` 同口径：localStorage 是玩家能改的，
 * 读坏了宁可按"新玩家"走——多看一遍说明是无害的，漏看才是缺陷）。
 */
export const HELP_SEEN_KEY = 'game108.helpSeen.v1';
export const loadHelpSeen = (): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(HELP_SEEN_KEY) === '1';
  } catch { return false; }
};
export const saveHelpSeen = (): void => {
  try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch { /* 同 saveMemory：没得存就本次会话内生效 */ }
};

// ── UI ────────────────────────────────────────────────────────────────
/**
 * 对局屏主题 —— **按设计定稿的令牌表改配**（`design-tokens.ts` 是逐字抄稿的那份）。
 *
 * 为什么不是直接用 house 主题：稿子是**明亮卡通**（青草地 + 奶油面 + 墨描边），
 * house 的 `apolloOnyx` 是暗金属，两者不是一路。仍从 apolloOnyx 起手（继承字体栈/间距等），
 * 只覆盖颜色令牌 —— 这是「有明确美术方向」的那条口子（`docs/playbooks/ui.md` 华丽起手第一步）。
 *
 * ⚠ **11 个文字色令牌要装下稿子的 14 种用色，装不下**（闭集是有代价的·偏差逐条在案）。
 * 映射按"用得最多的那处"定，各令牌的实际担当：
 *   text=#fff8e7 亮奶油字（深色条/彩色牌面上）· ink=#3f2b1e 墨字（奶油面上）
 *   dim=#7a6553 奶油面上的次级 · sub=#8c7a68 深色条上的三级
 *   jade=#7defd6 我方亮色（血量数字/标签）· mine=#23b5a0 我方主色
 *   foe=#ff9a8a 对手亮色 · danger=#e0483f 对手主色 · warn=#ff5a45 告警（倒计时最后三分之一/挨打）
 *   gold=#ffc93c 金 · ok=#a8720b **金面上的深金字**（借 ok 槽装 gold-deep·稿子里这色只此一用）
 */
export const DUEL_THEME: UITheme = {
  ...apolloOnyx,
  pageBg: '#d9f1ff', bg0: '#3f2b1e', bg1: '#fff6e2', bg2: '#f4e2c4', bg3: '#cfc3b0',
  line: '#3f2b1e',
  text: '#fff8e7', sub: '#8c7a68', dim: '#7a6553',
  jade: '#7defd6', jadeWash: 'rgba(35,181,160,.16)', jadeLine: '#23b5a0',
  gold: '#ffc93c',
  ok: '#a8720b', okWash: 'rgba(255,201,60,.2)',
  warn: '#ff5a45', warnWash: 'rgba(255,90,69,.2)',
  danger: '#e0483f',
  mine: '#23b5a0', foe: '#ff9a8a',
  ink: '#3f2b1e',
  texture: '', wash: '', panelTexture: '',
};

/** 烟雾【R-108-20/21/22】：次数资源 id / 生效回合数 / 隐藏旗 id。 */
export const SMOKE_RES = (side: Side): string => `${side}.smoke`;
export const SMOKE_TURNS = (side: Side): string => `${side}.smokeTurns`;
export const SMOKE_FLAG = (side: Side): string => `${side}.hidden`;
export const SMOKE_USES = 2;      // 一局两发
export const SMOKE_DURATION = 2;  // 遮 2 回合，第 3 回合起全曝光

/** 五名对手【R-108-32】= 一条教学曲线，不是五个数值不同的怪。 */
export const OPPONENTS = ['parrot', 'brute', 'actor', 'gambler', 'master'] as const;
export type OpponentId = (typeof OPPONENTS)[number];
export const OPPONENT_CN: Record<OpponentId, string> = {
  parrot: '复读机', brute: '莽夫', actor: '戏子', gambler: '赌徒', master: '拳律大师',
};

// 舞台尺寸（**单一真相**）：mountHost 的 field 与对局屏根 Panel 的定尺同取这两个数——
// 不同源就是 2026-08-07 真渲染目击到的那个病：field 720×1280、屏 456×788 → 屏缩在 field 左上角，
// 下半截整片死白。
//
// **横版 16:9 · 1920×1080**（设计定稿的画布·`design-tokens.ts CANVAS`）：本作的核心是
// 「看着一只手伸出来、摇一摇、出招」——竖屏把中区挤没了，手只能当两个小图标（正好和玩法反了）。
// 横版把中间那条道空出来留给手，其余 UI 全部退到四周。
export const VIEW_W = 1920;
export const VIEW_H = 1080;
