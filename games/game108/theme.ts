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

/** 三时区四拍的 tick 时长（【R-108-01】3/3/2/1 秒 × TPS）。 */
export const TPS = 60;
export const PHASE_TICKS = {
  charge: 3 * TPS,   // T1 蓄力（公开）
  throw: 3 * TPS,    // T2 出招（隐藏·同时）
  clash: 2 * TPS,    // T3 对决
  settle: 1 * TPS,   // T4 结算
} as const;

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
  lang: 'ui.lang',
} as const;

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
