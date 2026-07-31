// Game C · 平台角色卡桥接线（REQ-CHARCARD·手册 docs/playbooks/character-card.md §⑤）。
//
// SessionIn 席位草稿 → normalizeCharacterCard（**requireAdult:true 必开**·姨太题材成年硬闸不得省）→
//   可用则投影 toSeatCard{id,name,avatar} 供席位显示 + persona 文本群做展示层「台词/AI 风味」（长度截断）；
//   不可用（isCardUsable=false·如未成年确认）一律**退内置默认卡**、并把 issues 上报宿主。
// 终局 SessionOut 以 **card.id** 键控（顺位/筹码/事件摘要 + passthrough 原样带回）。
//
// 红线（手册）：**纯确定性**（零网络/零时钟/零随机）；媒体/DataUrl 只作显示、不进 sim hash/美术台账；
//   卡文本=外部不可信输入（本层负责长度截断·渲染层再转义）。牌风/立绘档/语音包=游戏侧附加数据·不入共享卡。
import {
  normalizeCharacterCard, toSeatCard, isCardUsable,
  type PlatformCharacterDraft, type ZeroCraftCharacterCard, type SeatCard, type CardIssue,
} from '../../services/character-card/index.js';
import { STORY_OPPONENTS } from './theme.js';

/** 平台会话入参（对面席位的角色卡草稿 + OssKey 解析器）。 */
export interface GameCSessionIn {
  /** 对手席草稿·**按对手序**（index 0 = 座 1·1 = 座 2…）；缺/坏 → 退内置默认卡。 */
  seats?: (PlatformCharacterDraft | null | undefined)[];
  /** OssKey→url 解析器（纯函数·仅 OssKey 媒体源用·无则该源弃 + warn）。 */
  resolveOssKey?: (key: string) => string;
}

/** 单席解析结果（游戏侧投影：规范卡 + 席位卡 + 来源标记 + 收敛问题）。 */
export interface SeatCharacter {
  seat: number;              // 席位号（1..N-1·对手）
  card: ZeroCraftCharacterCard; // 规范卡（对账/SessionOut 用·id 稳定）
  seatCard: SeatCard;        // {id,name,avatar}·席位显示投影
  fromDraft: boolean;        // true=平台卡 / false=内置默认（无草稿或坏卡回退）
  issues: CardIssue[];       // 收敛问题（warn/error·宿主上报）
}

/** 内置默认卡（无草稿 / 坏卡回退·剧情局对手·成年默认 true·无 persona 台词=避免与 UI 语言不一致）。 */
function defaultCard(seat: number): ZeroCraftCharacterCard {
  const d = STORY_OPPONENTS.find((o) => o.seat === seat);
  return {
    id: `builtin-c-${seat}`, name: d?.name ?? `对手${seat}`, kind: 'opponent',
    media: {}, persona: { catchphrases: [] }, tags: [], adultConfirmed: true, passthrough: {},
  };
}

/** 解析对手席角色卡（座 1..count-1）。requireAdult 恒开；坏卡退默认并带 issues。纯函数。 */
export function resolveSeatCharacters(count: number, session?: GameCSessionIn): SeatCharacter[] {
  const out: SeatCharacter[] = [];
  for (let seat = 1; seat < count; seat++) {
    const draft = session?.seats?.[seat - 1];
    if (draft) {
      const res = normalizeCharacterCard(draft, { requireAdult: true, resolveOssKey: session?.resolveOssKey });
      if (isCardUsable(res)) {
        out.push({ seat, card: res.card, seatCard: toSeatCard(res.card), fromDraft: true, issues: res.issues });
        continue;
      }
      // 不可用（成年硬闸/空名等）→ 退内置默认卡·保留 issues 供宿主上报。
      const dc = defaultCard(seat);
      out.push({ seat, card: dc, seatCard: toSeatCard(dc), fromDraft: false, issues: res.issues });
    } else {
      const dc = defaultCard(seat);
      out.push({ seat, card: dc, seatCard: toSeatCard(dc), fromDraft: false, issues: [] });
    }
  }
  return out;
}

/** persona → 展示层台词/风味（口头禅优先 → 开场白 → 性格·**长度截断**·外部不可信输入）。无则 undefined。 */
export function personaFlavor(card: ZeroCraftCharacterCard, maxLen = 40): string | undefined {
  const p = card.persona;
  const raw = (p.catchphrases[0] ?? p.opening ?? p.personality ?? '').trim();
  if (!raw) return undefined;
  const oneLine = raw.replace(/\s+/g, ' ');
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen - 1)}…` : oneLine;
}

/** 终局单席结算（宿主提供·顺位/筹码/是否出局）。 */
export interface SeatOutcome { placement: number; chips: number; eliminated: boolean; }
/** SessionOut：以 card.id 键控的终局回传（passthrough 原样带回·对账）。 */
export interface GameCSessionOut {
  results: Record<string, { seat: number; placement: number; chips: number; eliminated: boolean; passthrough: Record<string, unknown> }>;
}
/** 组装 SessionOut（键=card.id·手册④ id 对账；passthrough 原样带回·只透传不消费）。 */
export function buildSessionOut(chars: readonly SeatCharacter[], outcomeOf: (seat: number) => SeatOutcome): GameCSessionOut {
  const results: GameCSessionOut['results'] = {};
  for (const ch of chars) {
    const o = outcomeOf(ch.seat);
    results[ch.card.id] = { seat: ch.seat, placement: o.placement, chips: o.chips, eliminated: o.eliminated, passthrough: ch.card.passthrough };
  }
  return { results };
}
