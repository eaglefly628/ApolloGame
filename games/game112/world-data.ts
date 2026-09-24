// game112《星尾会客厅》—— L0 数据表（纯数据·零逻辑）。
// 口径：docs/design/game112/capability-plan.md §3（每张表的解释器都是注册能力）。
// 所有 id 全局唯一 `<量>.<catId>`（events-logic.md「全局 id 路由」坑）。
// 🟡 = 待 owner 定（牌规 / 逗猫重设计），S3 只留接口位。
// ⚠ 数值口径：GDD 只定了「无惩罚·心光只增·兴致当次临时」等**方向**，没有具体数字——本文件里的阈值/增量/价格
//   全是 S3 占位（S4 手感调校面·随对齐单迭代·非 GDD 出处），改数不改结构。
import type { DialogueGraph } from '@zerocraft/engine/skills/tier3/index.js';

export const GAME_ID = 'game112';
export const SEED_DEFAULT = 112;
/** 宿主 tick 节拍（ms）。sim 只数 tick，不读墙钟。 */
export const TICK_MS = 200;

// ── 猫档案（GDD §6.1）──────────────────────────────────────────────────────
export interface CatCard {
  readonly id: string;
  readonly name: string;
  readonly breed: string;
  /** 牌桌性格（cat-ai.md §1.1·🟡 牌规待定，先留档位）。 */
  readonly cardPersona: 'cautious' | 'competitive' | 'playful' | 'sleepy';
  /** 主厅一句话（表现层文案·非逻辑）。 */
  readonly hallLine: string;
  /** 兴致档 → 情绪短语（GDD：主厅只显示名字 + 一个情绪短语）。阈值查表不是逻辑。 */
  readonly moodPhrases: readonly { readonly min: number; readonly text: string }[];
}

export const CATS: readonly CatCard[] = [
  {
    id: 'xuetuan',
    name: '雪团',
    breed: '布偶',
    cardPersona: 'cautious',
    hallLine: '它趴在旧木桌边，尾巴尖偶尔动一下。',
    moodPhrases: [
      { min: 70, text: '今天有点想玩' },
      { min: 40, text: '安静地待着' },
      { min: 0, text: '有点困了' },
    ],
  },
];
export const ACTIVE_CAT = 'xuetuan';
export const catOf = (id: string): CatCard | undefined => CATS.find((c) => c.id === id);

// ── 资源 id（一实体一 Resource）────────────────────────────────────────────
export const STARDUST = 'stardust';
export type RelationKey = 'closeness' | 'ease' | 'heartlight' | 'mood';
export interface RelationSpec {
  readonly key: RelationKey;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly start: number;
  /** 是否进局外存档（兴致 = 当次临时·不持久化·GDD §6.2）。 */
  readonly persist: boolean;
}
export const RELATIONS: readonly RelationSpec[] = [
  { key: 'closeness', name: '亲近', min: 0, max: 100, start: 0, persist: true },
  { key: 'ease', name: '安心', min: 0, max: 100, start: 20, persist: true },
  { key: 'heartlight', name: '心光', min: 0, max: 999, start: 0, persist: true },
  { key: 'mood', name: '兴致', min: 0, max: 100, start: 60, persist: false },
];
export const relId = (key: RelationKey, cat: string): string => `${key}.${cat}`;
/** 兴致自然变化：每 period 拍 -1（t2-over-time·duration 0 = 永续）。 */
export const MOOD_DRIFT = { amountPerTick: -1, period: 40 } as const;

// ── 陪伴动作（GDD §4.1 / §9.1·首版只按动作判·触摸分区 🟡 随逗猫重设计）──────
export interface CareAction {
  readonly id: string;
  /** UI 动作名 = keybind key（机器键·对应 menu-flow §13 的玩家可见标签；§13 只写中文标签，机器键以 ui.ts UI_ACTIONS 为真相）。 */
  readonly key: string;
  readonly label: string;
  readonly sub: string;
  readonly effects: readonly { readonly res: string; readonly amount: number }[];
}
export const CARE_ACTIONS: readonly CareAction[] = [
  {
    id: 'greet', key: 'cat.greet', label: '轻声呼唤', sub: '它会抬头看你一眼',
    effects: [{ res: relId('closeness', ACTIVE_CAT), amount: 2 }, { res: relId('mood', ACTIVE_CAT), amount: 6 }, { res: STARDUST, amount: 1 }],
  },
  {
    id: 'sit', key: 'cat.sit', label: '陪它坐坐', sub: '什么都不做也可以',
    effects: [{ res: relId('heartlight', ACTIVE_CAT), amount: 2 }, { res: relId('ease', ACTIVE_CAT), amount: 2 }, { res: STARDUST, amount: 2 }],
  },
];

// ── 星砂杂货铺（GDD §12.4·不卖关系）────────────────────────────────────────
export interface ShopItem {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly kind: 'toy' | 'decor' | 'cardskin';
  /** 展示「它会怎样改变互动」而非只展示属性（ui-visual-handoff §7.8）。 */
  readonly blurb: string;
}
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'feather', name: '羽毛杆', price: 30, kind: 'toy', blurb: '空中与地面混合，它会追、伏击、扑。' },
  { id: 'paperbag', name: '纸袋', price: 20, kind: 'toy', blurb: '它会把这里当伏击点，也会把牌藏进去。' },
  { id: 'cushion', name: '软垫', price: 40, kind: 'decor', blurb: '被很多猫睡过的那种，它会陷进去。' },
  { id: 'cardback-moon', name: '月相牌背', price: 50, kind: 'cardskin', blurb: '星牌桌的牌背换成月相。' },
];
export const itemCount = (id: string): string => `item.${id}`;
export const ownFlag = (id: string): string => `own.${id}`;
export const placedFlag = (id: string): string => `placed.${id}`;
export const buyKey = (id: string): string => `shop.buy.${id}`;
export const placeKey = (id: string): string => `decor.place.${id}`;
export const shopItemOf = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id);

// ── 回忆章节（GDD §11.1 五要素·三段式）────────────────────────────────────
export interface Chapter {
  readonly id: string;
  readonly cat: string;
  readonly title: string;
  readonly hint: string;
  readonly unlockHeartlight: number;
  /** 是否敏感（GDD §2.3：高情绪内容播放前给控制权）。 */
  readonly sensitive: boolean;
  readonly start: string;
  readonly nodes: DialogueGraph;
}
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'xuetuan-1', cat: 'xuetuan', title: '旧木桌上的杯印', hint: '桌角有一圈杯印，它总把前爪搭在那儿。',
    unlockHeartlight: 10, sensitive: false, start: 'n1',
    nodes: {
      n1: { kind: 'line', speaker: '旁白', text: '桌角那一圈杯印，是很久以前留下的。雪团每次坐下，前爪都会搭在那儿。', next: 'n2' },
      n2: { kind: 'line', speaker: '旁白', text: '从前有个人，每天早上在这张桌子边喝一杯热的东西。杯子从来不放杯垫。', next: 'n3' },
      n3: {
        kind: 'choice', speaker: '旁白', prompt: '你想——',
        options: [
          { text: '把自己的杯子也放在那儿', next: 'n4a' },
          { text: '只是看着它', next: 'n4b' },
        ],
      },
      n4a: { kind: 'line', speaker: '旁白', text: '雪团看了看你的杯子，又看了看你，把前爪搭了上去。', next: null },
      n4b: { kind: 'line', speaker: '旁白', text: '它没有动。过了一会儿，尾巴尖轻轻拍了一下桌面。', next: null },
    },
  },
];
export const chapterFlag = (id: string): string => `chapter.${id}.unlocked`;
export const chapterFsm = (id: string): string => `chapter.${id}`;
export const chapterUnlockSignal = (id: string): string => `unlock:chapter.${id}`;
export const chapterOf = (id: string): Chapter | undefined => CHAPTERS.find((c) => c.id === id);

// ── 离线「田螺姑娘」小事件（GDD §3.4·只有装饰模板）────────────────────────
export const OFFLINE_TIERS = ['short', 'long', 'days'] as const;
export type OfflineTier = (typeof OFFLINE_TIERS)[number];
export const offlineKey = (t: OfflineTier): string => `offline.${t}`;
export const offlineSignal = (t: OfflineTier): string => `offline:${t}`;
export const OFFLINE_ACK_KEY = 'offline.ack';
/** 离线小事件实体的 Tag 位（ack 时 destroy-tagged 批量回收）。 */
export const OFFLINE_TAG = 1 << 3;
export interface OfflineEvent { readonly id: string; readonly text: string; readonly weight: Readonly<Record<OfflineTier, number>> }
/** 每档权重不同：短暂离开只见小动静；隔天回来才见「睡过你的位置」（0 = 该档抽不到）。 */
export const OFFLINE_EVENTS: readonly OfflineEvent[] = [
  { id: 'bag-hid-cards', text: '它趁你不在，把三张牌藏进了纸袋。', weight: { short: 2, long: 3, days: 2 } },
  { id: 'toy-on-table', text: '玩具被叼到了桌边，歪着。', weight: { short: 3, long: 3, days: 1 } },
  { id: 'slept-on-seat', text: '你常坐的位置上，有一小圈压平的毛。', weight: { short: 0, long: 2, days: 5 } },
  { id: 'coaster-flipped', text: '杯垫被打翻了，它若无其事地在舔毛。', weight: { short: 2, long: 2, days: 2 } },
];
/** 离开多久算哪一档（宿主用墙钟算·sim 只见 key）。 */
export function offlineTierOf(elapsedMs: number): OfflineTier | undefined {
  const min = elapsedMs / 60000;
  if (min < 5) return undefined;
  if (min < 120) return 'short';
  if (min < 60 * 24) return 'long';
  return 'days';
}

// ── 🟡 星爪牌接口位（牌规待 owner 对定·REQ-112-GAME-01）────────────────────
export const TABLE_PLACEHOLDER = '星爪牌的规则还在对，牌桌先留着。';
