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

/** 猫的当下姿态（j1-state 状态机 `pose.<cat>`·陪伴动作写它·投影读它换台词/画面·不进档）。 */
export type CatPose = 'rest' | 'lookup' | 'settled';
export const CAT_POSES: readonly CatPose[] = ['rest', 'lookup', 'settled'];
export const poseFsm = (cat: string): string => `pose.${cat}`;

// ── 星尾馆十房（hall-framework v3·巡游版·导航/馆图/房间页单一真相）───────────────
//   owner 2026-09-28：巡游版本 · 所有按钮内嵌在画面里（门 = 去相邻房·物件 = 活动入口·猫 = 呼唤）· 猫有固定「猫位」。
//   坐标系 = 舞台 SCENE_W×SCENE_H（房间画 1680×1200 等比缩到 1000×714·px 左上角 + 宽高）。
export const SCENE_W = 1000;
export const SCENE_H = 714;
export type RoomId = 'hall' | 'orbs' | 'cardroom' | 'gallery' | 'playroom' | 'sunroom' | 'pantry' | 'attic' | 'garden' | 'shopfront';
export interface SceneRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** 画里的门/通道：去相邻房。与 `adjacent` 一一对应（测试钉死）。 */
export interface RoomDoor extends SceneRect { readonly to: RoomId; readonly label: string }
/** 画里可点的物件 = 活动入口（只复用已接线的 UI 动作·不造空入口）。 */
export interface RoomObject extends SceneRect { readonly id: string; readonly label: string; readonly action: string; readonly arg?: string }
/** 猫在房间里的 render-only 往返路线；行程由房间标定，周期统一 12 秒以同步方向行走、真实转身和停留。 */
export interface CatPatrol { readonly dx: number; readonly ms: number }
export interface RoomSpec {
  readonly id: RoomId;
  readonly number: number;
  readonly name: string;
  readonly subtitle: string;
  readonly scene: string;
  readonly adjacent: readonly RoomId[];
  /** 00 馆图上的像素热区（馆图在 UI 中固定渲为 960×540）。 */
  readonly mapRect: SceneRect;
  /** 猫在这间房的固定位置与投影尺寸（舞台坐标·各房按景深独立标定，不能全馆等大）。 */
  readonly catSpot: SceneRect;
  /** 从猫位向右缓慢巡游再返回；各房避开门与物件单独标定。 */
  readonly catPatrol: CatPatrol;
  readonly doors: readonly RoomDoor[];
  readonly objects: readonly RoomObject[];
}

export const ROOMS: readonly RoomSpec[] = [
  {
    id: 'hall', number: 1, name: '主厅', subtitle: '暖灯下，雪团在旧木桌边等你。', scene: 'hall',
    adjacent: ['orbs', 'cardroom', 'playroom', 'garden'], mapRect: { x: 395, y: 268, w: 170, h: 123 },
    catSpot: { x: 328, y: 353, w: 154, h: 141 },
    catPatrol: { dx: 118, ms: 12000 },
    doors: [
      { to: 'garden', label: '月庭', x: 70, y: 250, w: 150, h: 240 },
      { to: 'orbs', label: '晶球厅', x: 80, y: 36, w: 120, h: 86 },
      { to: 'playroom', label: '玩具间', x: 272, y: 228, w: 70, h: 74 },
      { to: 'cardroom', label: '星牌室', x: 906, y: 300, w: 88, h: 220 },
    ],
    objects: [
      { id: 'reception', label: '前台登记', action: 'registration.open', x: 18, y: 512, w: 160, h: 74 },
      { id: 'orbs', label: '忆光晶球', action: 'orbs.open', x: 768, y: 200, w: 84, h: 80 },
      { id: 'table', label: '星牌桌', action: 'table.open', x: 690, y: 424, w: 176, h: 72 },
      { id: 'toys', label: '玩具篮', action: 'toys.open', x: 862, y: 452, w: 116, h: 86 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 468, y: 330, w: 176, h: 66 },
    ],
  },
  {
    id: 'orbs', number: 2, name: '晶球厅', subtitle: '记忆在珠光蓝与烟紫之间缓慢发亮。', scene: 'orbs',
    adjacent: ['hall', 'gallery'], mapRect: { x: 148, y: 137, w: 168, h: 122 },
    catSpot: { x: 93, y: 458, w: 126, h: 116 },
    catPatrol: { dx: 112, ms: 12000 },
    doors: [
      { to: 'hall', label: '主厅', x: 845, y: 200, w: 142, h: 290 },
      { to: 'gallery', label: '回忆廊', x: 6, y: 250, w: 86, h: 200 },
    ],
    objects: [
      { id: 'orbs', label: '看看晶球', action: 'orbs.open', x: 224, y: 260, w: 66, h: 76 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 358, y: 370, w: 240, h: 62 },
    ],
  },
  {
    id: 'cardroom', number: 3, name: '星牌室', subtitle: '低矮的牌桌正合猫爪，牌规仍在慢慢推敲。', scene: 'cardroom',
    adjacent: ['hall', 'pantry'], mapRect: { x: 583, y: 268, w: 168, h: 123 },
    catSpot: { x: 376, y: 398, w: 146, h: 133 },
    catPatrol: { dx: 104, ms: 12000 },
    doors: [
      { to: 'hall', label: '主厅', x: 40, y: 150, w: 176, h: 278 },
      { to: 'pantry', label: '茶水间', x: 906, y: 300, w: 88, h: 220 },
    ],
    objects: [
      { id: 'table', label: '星牌桌', action: 'table.open', x: 540, y: 358, w: 316, h: 120 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 690, y: 494, w: 146, h: 60 },
    ],
  },
  {
    id: 'gallery', number: 4, name: '回忆廊', subtitle: '墙上的片段不会催你，想看时再靠近。', scene: 'gallery',
    adjacent: ['orbs', 'sunroom', 'attic'], mapRect: { x: 395, y: 137, w: 170, h: 122 },
    catSpot: { x: 196, y: 475, w: 122, h: 111 },
    catPatrol: { dx: 86, ms: 12000 },
    doors: [
      { to: 'orbs', label: '晶球厅', x: 54, y: 190, w: 142, h: 298 },
      { to: 'sunroom', label: '月光窗厅', x: 576, y: 278, w: 98, h: 92 },
      { to: 'attic', label: '回忆阁楼', x: 824, y: 190, w: 166, h: 288 },
    ],
    objects: [
      { id: 'picture', label: '翻开回忆', action: 'memory.open', x: 378, y: 165, w: 88, h: 110 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 414, y: 414, w: 122, h: 52 },
    ],
  },
  {
    id: 'playroom', number: 5, name: '玩具间', subtitle: '纸箱、抓柱和空中步道都按猫的尺度搭好。', scene: 'playroom',
    adjacent: ['hall'], mapRect: { x: 395, y: 400, w: 170, h: 123 },
    catSpot: { x: 700, y: 395, w: 160, h: 146 },
    catPatrol: { dx: 76, ms: 12000 },
    doors: [{ to: 'hall', label: '主厅', x: 0, y: 226, w: 172, h: 204 }],
    objects: [
      { id: 'toys', label: '玩具篮', action: 'toys.open', x: 380, y: 368, w: 146, h: 86 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 538, y: 296, w: 252, h: 74 },
    ],
  },
  {
    id: 'sunroom', number: 6, name: '月光窗厅', subtitle: '月光落在低窗软垫上，适合安静待一会儿。', scene: 'sunroom',
    adjacent: ['gallery'], mapRect: { x: 643, y: 137, w: 169, h: 122 },
    catSpot: { x: 624, y: 338, w: 119, h: 109 },
    catPatrol: { dx: 92, ms: 12000 },
    doors: [{ to: 'gallery', label: '回忆廊', x: 54, y: 196, w: 136, h: 280 }],
    objects: [{ id: 'seat', label: '陪它看月亮', action: 'cat.sit', x: 524, y: 412, w: 296, h: 60 }],
  },
  {
    id: 'pantry', number: 7, name: '茶水间', subtitle: '猫爪能拉开的抽屉里，藏着杯印与旧日气味。', scene: 'pantry',
    adjacent: ['cardroom'], mapRect: { x: 768, y: 268, w: 167, h: 123 },
    catSpot: { x: 625, y: 382, w: 138, h: 126 },
    catPatrol: { dx: 84, ms: 12000 },
    doors: [{ to: 'cardroom', label: '星牌室', x: 48, y: 131, w: 166, h: 308 }],
    objects: [{ id: 'counter', label: '轻声叫它', action: 'cat.greet', x: 280, y: 296, w: 196, h: 130 }],
  },
  {
    id: 'attic', number: 8, name: '回忆阁楼', subtitle: '旧箱和睡窝安静收着尚未讲完的故事。', scene: 'attic',
    adjacent: ['gallery'], mapRect: { x: 395, y: 20, w: 170, h: 118 },
    catSpot: { x: 126, y: 485, w: 110, h: 101 },
    catPatrol: { dx: 72, ms: 12000 },
    doors: [{ to: 'gallery', label: '回忆廊', x: 744, y: 300, w: 250, h: 234 }],
    objects: [
      { id: 'orb', label: '看看旧回忆', action: 'memory.open', x: 492, y: 190, w: 50, h: 50 },
      { id: 'seat', label: '陪它坐坐', action: 'cat.sit', x: 408, y: 296, w: 94, h: 74 },
    ],
  },
  {
    id: 'garden', number: 9, name: '月庭', subtitle: '花径接着馆门，琥珀灯链沿猫步道伸向夜色。', scene: 'garden',
    adjacent: ['shopfront', 'hall'], mapRect: { x: 209, y: 268, w: 167, h: 123 },
    catSpot: { x: 567, y: 495, w: 116, h: 106 },
    catPatrol: { dx: 126, ms: 12000 },
    doors: [
      { to: 'hall', label: '主厅', x: 678, y: 131, w: 120, h: 226 },
      { to: 'shopfront', label: '星砂铺', x: 354, y: 148, w: 102, h: 92 },
    ],
    objects: [{ id: 'seat', label: '在月庭坐坐', action: 'cat.sit', x: 808, y: 522, w: 156, h: 72 }],
  },
  {
    id: 'shopfront', number: 10, name: '星砂铺', subtitle: '猫主理人的小铺子，抽屉和货架都在爪高。', scene: 'shopfront',
    adjacent: ['garden'], mapRect: { x: 24, y: 268, w: 167, h: 121 },
    catSpot: { x: 570, y: 406, w: 132, h: 121 },
    catPatrol: { dx: 96, ms: 12000 },
    doors: [{ to: 'garden', label: '月庭', x: 60, y: 296, w: 180, h: 122 }],
    objects: [{ id: 'shopdoor', label: '看看小铺', action: 'shop.open', x: 684, y: 226, w: 90, h: 240 }],
  },
];
export const ROOM_IDS: readonly RoomId[] = ROOMS.map((r) => r.id);
export const roomOf = (id: string): RoomSpec | undefined => ROOMS.find((r) => r.id === id);

// ── 猫档案（GDD §6.1）──────────────────────────────────────────────────────
export interface CatCard {
  readonly id: string;
  readonly name: string;
  readonly breed: string;
  /** 牌桌性格（cat-ai.md §1.1·🟡 牌规待定，先留档位）。 */
  readonly cardPersona: 'cautious' | 'competitive' | 'playful' | 'sleepy';
  /** 主厅一句话（表现层文案·非逻辑）——姿态 rest 时用。 */
  readonly hallLine: string;
  /** 陪伴动作后的姿态台词（姿态机 `pose.<cat>`·八问第 2 问「操作要有画面确认」·S4 第 2 轮）。 */
  readonly poseLines: Readonly<Record<Exclude<CatPose, 'rest'>, string>>;
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
    poseLines: {
      lookup: '它听见了你，尾巴尖轻轻晃了一下。',
      settled: '它安静地陪着你，胸前的毛轻轻起伏。',
    },
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
  /** 动作后猫进入的姿态（Effect set-state → 姿态机）。 */
  readonly pose: Exclude<CatPose, 'rest'>;
}
export const CARE_ACTIONS: readonly CareAction[] = [
  {
    id: 'greet', key: 'cat.greet', label: '轻声呼唤', sub: '它会轻轻晃一下尾巴', pose: 'lookup',
    effects: [{ res: relId('closeness', ACTIVE_CAT), amount: 2 }, { res: relId('mood', ACTIVE_CAT), amount: 6 }, { res: STARDUST, amount: 1 }],
  },
  {
    id: 'sit', key: 'cat.sit', label: '陪它坐坐', sub: '什么都不做也可以', pose: 'settled',
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

// ── 「只看它」沉浸模式（menu-flow §1.3 常驻 HUD 的「隐藏/显示 UI」钮）────────────────
//   重组而非缺口（S4 复查 r4 指正）：一个 Flag + 两个 key（set-flag true/false），
//   界面各块挂 `visibleWhen:'!ui.stageOnly'`、猫画面层挂一枚 `visibleWhen:'ui.stageOnly'` 的「显示界面」钮，
//   由 ui/components `resolveBindings` 按 Flag 剔子树——零新控件·零游戏层 if/else 重建树。不进档。
export const STAGE_ONLY_FLAG = 'ui.stageOnly';
export const STAGE_HIDE_KEY = 'ui.hide';
export const STAGE_SHOW_KEY = 'ui.show';
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
