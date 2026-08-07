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
/** house 主题（capability-plan §4.6：起手传 house 主题，不自写皮）。 */
export const DUEL_THEME: UITheme = apolloOnyx;

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

// 竖屏超休闲舞台尺寸（**单一真相**）：mountHost 的 field 与对局屏根 Panel 的定尺同取这两个数——
// 不同源就是 2026-08-07 真渲染目击到的那个病：field 720×1280、屏 456×788 → 屏缩在 field 左上角，
// 下半截整片死白。同 casual-hud 口径。
export const VIEW_W = 456;
export const VIEW_H = 788;
