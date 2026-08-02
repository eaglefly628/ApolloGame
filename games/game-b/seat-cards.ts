// Game B ·《雀宴》—— 角色卡消费层（REQ-CHARCARD·平台角色卡桥的游戏侧接入·照 character-card.md §⑤）。
//
// 平台 SessionIn 尚未全接线（宿主 mount 暂不带席位草稿）：本作**已就绪**接收（可选 sessionIn 覆盖某席），
// 未接时用**内置默认卡**（名字=现有四席名·显示零变）。收敛/取优/成年硬闸全走共享 service，游戏层零解释器。
//
// 红线（同 docs/playbooks/character-card.md）：**纯确定性**（零时钟/零随机·同输入深等输出）；
//   姨太题材 → 每次 normalize **必开 `requireAdult: true`**（不得省·§③）；卡文本=外部不可信输入（展示层截断）；
//   媒体/DataUrl 只作宿主展示·不入 sim/hash；牌风/立绘档/语音包=**游戏侧附加数据·不入共享卡**（§⑤）。
import {
  normalizeCharacterCard,
  toSeatCard,
  isCardUsable,
  type PlatformCharacterDraft,
  type ZeroCraftCharacterCard,
  type SeatCard,
} from '@zerocraft/engine/services/character-card/index.js';

// 四席 id（座 0=主角/南·1=绫/大姨太·2=莉世/二姨太·3=小夜/三姨太·迭代顺序恒定=确定性）。
export type SeatId = 'hero' | 'daiyi' | 'eryi' | 'sanyi';
export const SEAT_IDS: readonly SeatId[] = ['hero', 'daiyi', 'eryi', 'sanyi'];
/** SeatId → 核内数字席位（core seatNames 索引·hero=玩家 0）。 */
export const SEAT_INDEX: Record<SeatId, number> = { hero: 0, daiyi: 1, eryi: 2, sanyi: 3 };

/**
 * 内置默认角色卡草稿（平台未接线时兜底·四席全成年确认）。
 * name === 现有四席名（主角/绫/莉世/小夜）→ 显示零变。personality/opening/catchphrases = 短句人设
 * （内容红线：干净不露骨·仅点性格·女性向基调）；主角=玩家人格（本就不脱·仅点从容）。
 */
export const DEFAULT_SEAT_DRAFTS: Record<SeatId, PlatformCharacterDraft> = {
  hero: {
    id: 'hero', name: '主角', adultConfirmed: true,
    personality: '从容 · 掌局',
    opening: '既已落座，静看这一圈。',
    catchphrases: ['稳中求胜。', '该我了。'],
  },
  daiyi: {
    id: 'daiyi', name: '绫', adultConfirmed: true,
    personality: '端庄 · 沉静',
    opening: '慢慢来，这局有的是耐心。',
    catchphrases: ['且看这张。', '不急，牌会来的。'],
  },
  eryi: {
    id: 'eryi', name: '莉世', adultConfirmed: true,
    personality: '明艳 · 机敏',
    opening: '上了桌，就别怪我认真。',
    catchphrases: ['这张，我要了。', '看清楚了没？'],
  },
  sanyi: {
    id: 'sanyi', name: '小夜', adultConfirmed: true,
    personality: '娇俏 · 跳脱',
    opening: '快开局快开局，等得我都急啦～',
    catchphrases: ['嘻，碰！', '这把看我的～'],
  },
};

/** game-b 侧 SessionIn（平台入局态·可选覆盖某席草稿 + OssKey 解析器）。尚未接线=当前恒 undefined。 */
export interface GameBSessionIn {
  seats?: Partial<Record<SeatId, PlatformCharacterDraft>>;
  resolveOssKey?: (key: string) => string;
}

/**
 * 解出四席规范卡（纯确定性·同输入深等输出）。
 * 每席：优先取 sessionIn 平台草稿，否则内置默认；经 service 收敛（**必开成年硬闸**）——
 * 平台卡可用则用之，不可用（成年闸未过/空名等）则**回退内置默认卡**（默认恒可用·requireAdult 仍开）。
 */
export function resolveSeatCards(sessionIn?: GameBSessionIn): Record<SeatId, ZeroCraftCharacterCard> {
  const out = {} as Record<SeatId, ZeroCraftCharacterCard>;
  for (const id of SEAT_IDS) {
    const draft = sessionIn?.seats?.[id] ?? DEFAULT_SEAT_DRAFTS[id];
    const res = normalizeCharacterCard(draft, { id, requireAdult: true, resolveOssKey: sessionIn?.resolveOssKey });
    out[id] = isCardUsable(res)
      ? res.card
      : normalizeCharacterCard(DEFAULT_SEAT_DRAFTS[id], { id, requireAdult: true }).card; // 兜底默认卡
  }
  return out;
}

/** v1 席位投影 {id,name,avatar?}（游戏侧填铭牌/头像·既有 hud/席名零改动契约）。 */
export function seatDisplay(card: ZeroCraftCharacterCard): SeatCard {
  return toSeatCard(card);
}

/** 四席显示名数组（座序 0..3·喂 core startMatch(seed, seatNames)）。 */
export function seatNamesFrom(cards: Record<SeatId, ZeroCraftCharacterCard>): string[] {
  return SEAT_IDS.map((id) => seatDisplay(cards[id]).name);
}

/**
 * 人设展示行（席位闲时问候/台词气泡·AI 风味）：取 opening，退 catchphrases[0]，再退空串。
 * **截断到 max 字**（超裁 + '…'）——卡文本=外部不可信输入·防超长撑破 UI（红线·展示层截断）。
 */
export function seatFlavor(card: ZeroCraftCharacterCard, max = 24): string {
  const line = card.persona.opening ?? card.persona.catchphrases[0] ?? '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

/** 单席终局态（顺位 1..4 + 点数 + 脱衣件数）。 */
export interface SeatOutcome {
  rank: number;
  score: number;
  stripped: number;
}

/** SessionOut 单席条目（键控为 card.id·passthrough 原样回带对账·§④）。 */
export interface SeatSessionOut {
  seatId: SeatId;
  rank: number;
  score: number;
  stripped: number;
  passthrough: Record<string, unknown>;
}

/**
 * 构造 SessionOut（终局回传·**以 card.id 键控**·carrying card.passthrough 原样回带·§④）。
 * id 稳定=对账唯一硬要求（默认 id=席位 id 故唯一）。纯确定性：迭代 SEAT_IDS 恒定顺序。
 */
export function buildSessionOut(
  cards: Record<SeatId, ZeroCraftCharacterCard>,
  outcomes: Record<SeatId, SeatOutcome>,
): Record<string, SeatSessionOut> {
  const out: Record<string, SeatSessionOut> = {};
  for (const id of SEAT_IDS) {
    const card = cards[id];
    const oc = outcomes[id];
    if (!card || !oc) continue;
    out[card.id] = { seatId: id, rank: oc.rank, score: oc.score, stripped: oc.stripped, passthrough: card.passthrough };
  }
  return out;
}
