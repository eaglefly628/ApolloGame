// Game A ·《掼蛋夜宴》—— 角色卡消费层（REQ-CHARCARD·平台角色卡桥的游戏侧接入）。
//
// 平台的 SessionIn 尚未接线（game-runner 只传 {exit}）：本作先用**内置默认卡**（名字=SEATS 原名·显示零变），
// 并**已就绪**接收平台草稿（可选 sessionIn 覆盖某席）。收敛/取优/成年硬闸全走共享 service，游戏层零解释器。
//
// 红线（同 docs/playbooks/character-card.md）：**纯确定性**（零时钟/零随机·同输入深等输出）；
//   姨太题材 → 每次 normalize **必开 `requireAdult: true`**（不得省）；卡文本=外部不可信输入（展示层截断）；
//   媒体/DataUrl 只作宿主展示·不入 sim/hash。
import {
  normalizeCharacterCard,
  toSeatCard,
  isCardUsable,
  type PlatformCharacterDraft,
  type ApolloCharacterCard,
  type SeatCard,
} from '../../services/character-card/index.js';
import { SEATS } from './rules.js';
import { type SeatId } from './guandan-session.js';

// 四席 id（绑定 SEATS 唯一真相·迭代顺序 hero→partner→west→east 恒定=确定性）。
const SEAT_IDS: readonly SeatId[] = SEATS.map((s) => s.id);

/**
 * 内置默认角色卡草稿（平台未接线时的兜底·四席全成年确认）。
 * **名字必须 === SEATS 原名**（hero 例外：SEATS 用代词「你」·此处用玩家人格名「夜阑君」，
 *   与 hud 主菜单玩家铭牌一致；席位显示名的代词本地化仍由 displayName 走 t(seat.you)）。
 * personality = 该席性格标签串（沈玉薇 沉稳护家 / 林曼笙 锋利好胜 / 顾念念 跳脱爱起哄）；
 * opening/catchphrases = 短句人设台词（内容红线·干净不露骨·仅点性格）。
 */
export const DEFAULT_SEAT_DRAFTS: Record<SeatId, PlatformCharacterDraft> = {
  hero: {
    id: 'hero',
    name: '夜阑君',
    adultConfirmed: true,
    personality: '从容 · 掌局',
    opening: '夜宴既开，落座从容。',
    catchphrases: ['稳中求胜。', '静观其变。'],
  },
  partner: {
    id: 'partner',
    name: '沈玉薇',
    adultConfirmed: true,
    personality: '沉稳 · 护家',
    opening: '牌局如持家，我替你稳住阵脚。',
    catchphrases: ['稳着来，有我在。', '这一手，交给我垫后。'],
  },
  west: {
    id: 'west',
    name: '林曼笙',
    adultConfirmed: true,
    personality: '锋利 · 好胜',
    opening: '既然上桌，就别怪我不留情面。',
    catchphrases: ['这局，我志在必得。', '想赢我？再多练几年。'],
  },
  east: {
    id: 'east',
    name: '顾念念',
    adultConfirmed: true,
    personality: '跳脱 · 爱起哄',
    opening: '快开牌快开牌，我最爱这份热闹啦！',
    catchphrases: ['嘻嘻，看我的～', '来嘛来嘛，把气氛炒起来！'],
  },
};

/** game-a 侧 SessionIn（平台入局态·可选覆盖某席草稿 + OssKey 解析器）。尚未接线=当前恒 undefined。 */
export interface GameASessionIn {
  seats?: Partial<Record<SeatId, PlatformCharacterDraft>>;
  resolveOssKey?: (key: string) => string;
}

/**
 * 解出四席规范卡（纯确定性·同输入深等输出）。
 * 每席：优先取 sessionIn 提供的平台草稿，否则用内置默认；经 service 收敛（必开成年硬闸）——
 * 平台卡可用则用之，不可用（如成年闸未过）则**回退内置默认卡**（默认卡恒可用）。
 */
export function resolveSeatCards(sessionIn?: GameASessionIn): Record<SeatId, ApolloCharacterCard> {
  const out = {} as Record<SeatId, ApolloCharacterCard>;
  for (const id of SEAT_IDS) {
    const draft = sessionIn?.seats?.[id] ?? DEFAULT_SEAT_DRAFTS[id];
    const res = normalizeCharacterCard(draft, {
      id,
      requireAdult: true,
      resolveOssKey: sessionIn?.resolveOssKey,
    });
    if (isCardUsable(res)) {
      out[id] = res.card;
    } else {
      // 平台卡不可用（成年闸/空名等）→ 回退内置默认（默认恒可用·requireAdult 仍开）。
      out[id] = normalizeCharacterCard(DEFAULT_SEAT_DRAFTS[id], { id, requireAdult: true }).card;
    }
  }
  return out;
}

/** v1 席位投影 {id,name,avatar?}（游戏侧填铭牌/头像·既有 hud 零改动契约）。 */
export function seatDisplay(card: ApolloCharacterCard): SeatCard {
  return toSeatCard(card);
}

/**
 * 人设展示行（席位闲时问候气泡）：取 opening，退 catchphrases[0]，再退空串。
 * **截断到 max 字**（超出裁 max 字 + '…'）——卡文本=外部不可信输入·防超长撑破 UI（红线）。
 */
export function seatFlavor(card: ApolloCharacterCard, max = 24): string {
  const line = card.persona.opening ?? card.persona.catchphrases[0] ?? '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

/** 单席终局态（顺位 1..4 + 阵营 0/1）。 */
export interface SeatOutcome {
  rank: number;
  team: number;
}

/** SessionOut 单席条目（键控为 card.id·passthrough 原样回带对账）。 */
export interface SeatSessionOut {
  seatId: SeatId;
  rank: number;
  team: number;
  passthrough: Record<string, unknown>;
}

/**
 * 构造 SessionOut（终局回传·**以 card.id 键控**·carrying card.passthrough 原样回带）。
 * 纪律见手册 ④：id 稳定=对账唯一硬要求。两席同 card.id（默认 id=席位 id 故唯一）→ 后者覆盖·可接受。
 * 纯确定性：迭代 SEAT_IDS 恒定顺序。
 */
export function buildSessionOut(
  cards: Record<SeatId, ApolloCharacterCard>,
  outcomes: Record<SeatId, SeatOutcome>,
): Record<string, SeatSessionOut> {
  const out: Record<string, SeatSessionOut> = {};
  for (const id of SEAT_IDS) {
    const card = cards[id];
    const oc = outcomes[id];
    if (!card || !oc) continue;
    out[card.id] = { seatId: id, rank: oc.rank, team: oc.team, passthrough: card.passthrough };
  }
  return out;
}
