// game108 ·「对手 = 传入的卡片角色」（owner 2026-08-07 定方向）——**纯数据**。
//
// 原口径【R-108-32】是「五名内置对手 = 一条教学曲线」，玩家一关一关往上打。
// owner 改了定位：**这不是冲关游戏，是约会游戏**——
//   「对手是我们传进来的卡片角色……不叫敌人，是自己的约会对象」
//   「跟这个人比赛，不是去冲哪个关或 BOSS，而是**他的情绪是什么、他今天的心情是什么**」
//   「**卡片的心情就是它的 AI**」
//
// 于是「难度」这个轴被换成了「心情」这个轴：**心情 → 出招性格**是一张查表，
// 内置那五套出招规律不再是"五个关卡"，而是**五种心情的行为实现**（一个没浪费，只是换了语义）。
// 这正是数据驱动的形状：换心情 = 改一个字段，不写任何代码。
//
// ⚠ **更正（2026-08-07·我先前说错过一次）**：卡片契约**是有的**——
//   `src/services/character-card/`（`normalizeCharacterCard` / `toSeatCard` / `isCardUsable`），
//   手册 `docs/playbooks/character-card.md`，a/b/c 三个游戏已在用。我之前只查了 REQ-DIALOGUE 里
//   那段被悬置的「DokiWorld 数值双向契约」，就下了"没有契约"的结论——**漏查了 services 这一层**。
//   现在按手册接：平台卡 → `normalizeCharacterCard` → 取 name / 头像 → 本作的 `CardCharacter`。
//
// 唯一**平台卡里没有**的是 `mood`：那是「他**今天**的心情」，是**本次对局的参数**，不是角色属性
//   （同一个人今天上头、明天精明）。所以 mood 由会话侧传入，不从卡里读。
import { normalizeCharacterCard, isCardUsable, type PlatformCharacterDraft, type NormalizeOptions, type CardIssue } from '@zerocraft/engine/services/character-card/index.js';
import { OPPONENT_CN, type OpponentId } from './theme.js';

/** 心情（闭集）——**这就是 AI**。 */
export const MOODS = ['stubborn', 'reckless', 'playful', 'moody', 'sharp'] as const;
export type Mood = (typeof MOODS)[number];

/** 传进来的卡片角色（约会对象）。 */
export interface CardCharacter {
  /** 卡片 id（真 schema 到手前只用于日志/存档键）。 */
  id: string;
  /** 屏上显示的名字：顶栏身份牌 + 对手蓄力条的标签都取它（**不再是「复读机」这种内置名**）。 */
  name: string;
  /** 画像（已解析图 URL）。缺省 = 屏上退化成名字首字，不留空白。 */
  portrait?: string;
  /** 今天的心情 → 决定它怎么出拳。 */
  mood: Mood;
}

/**
 * 心情 → 内置出招规律（`blueprint.ts opponentRules` 的五套之一）。
 * **一一对应，不是难度梯度**——五种心情各有一条可读的破绽，玩家读的是"人"不是"关"。
 */
export const MOOD_AI: Record<Mood, OpponentId> = {
  stubborn: 'parrot',   // 执拗：一根筋，认准一手反复出
  reckless: 'brute',    // 上头：横冲直撞，只挑伤害最高的打
  playful: 'actor',     // 玩心：爱演爱骗，蓄一手出另一手
  moody: 'gambler',     // 阴晴不定：忽冷忽热，读不出规律
  sharp: 'master',      // 精明：会读你的习惯，还会改判定表
};

/** 心情的显示名（中文；英文见 `strings.ts`）。 */
export const MOOD_CN: Record<Mood, string> = {
  stubborn: '执拗', reckless: '上头', playful: '玩心', moody: '阴晴不定', sharp: '精明',
};

/**
 * 没有卡片传进来时的兜底角色（本机跑 / 探针 / 试玩用）。
 * 用内置名做名字，好让「名字来自角色数据」这条通路在没有卡片时也是活的——
 * 屏上不许再出现写死的 `OPPONENT_CN['parrot']`。
 */
export const DEFAULT_CARD: CardCharacter = {
  id: 'builtin:parrot',
  name: OPPONENT_CN['parrot'],
  mood: 'stubborn',
};

/**
 * 平台角色卡 → 本作的对局角色（**走引擎的卡桥，不自己解析平台字段**·手册 `character-card.md`）。
 *
 * - `name` / `id` 由桥收敛（空名 = 坏卡 → `usable:false`，调用方该拒绝开局）；
 * - 画像取 `media.avatarUrl`，没有就退 `imageUrl`；两个都没有 → 不填，屏上退化成名字首字（不空白）；
 * - `mood` **不从卡里读**（见文件头）：由会话侧给，缺省"执拗"。
 * - `issues` 原样带出来给调用方决定要不要上报（桥的纪律是"绝不炸、记 warn"）。
 *
 * ⚠ 成年硬闸 `requireAdult`：a/b/c 三个姨太题材游戏是**必开**的。本作是约会向但非成人向，
 * 默认不开；要不要开由接入方按题材定（`opts` 透传）。
 */
export function fromPlatformCard(
  draft: PlatformCharacterDraft,
  mood: Mood = 'stubborn',
  opts: NormalizeOptions = {},
): { card: CardCharacter; usable: boolean; issues: CardIssue[] } {
  const res = normalizeCharacterCard(draft, opts);
  const art = res.card.media.avatarUrl ?? res.card.media.imageUrl;
  return {
    card: {
      id: res.card.id,
      name: res.card.name,
      ...(art ? { portrait: art } : {}),
      mood,
    },
    usable: isCardUsable(res),
    issues: res.issues,
  };
}
