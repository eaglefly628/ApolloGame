// game108 **皮肤槽登记表** —— 「这游戏有哪些可替换的美术素材」的单一真相。
//
// ══ 为什么需要这张表（owner 2026-08-08 review：「我只看到 3 张图片，我们这个游戏不可能只有 3 张图片」）══
//
// 台账当时只有 3 行，不是因为这游戏只有 3 张图，而是因为**只有那 3 样是可替换的**：
// 屏上其余视觉全是代码里现画的（`plate()` 被调 46 次，加 `handArt`/`armArt`/`hpBar`/`ring`/`scene`），
// 它们没有皮肤槽 ⇒ 按红线**不许进台账**（无槽 = 孤儿行，生成了也上不了画面）。
// 于是「美术想重画这游戏」在管线上只能重画那三个图标——**这才是那 3 行真正说明的事**。
//
// 这张表把可替换面一次列清，并且**同时被两边读**：
//   · `duel-screen.ts` 按 key 取皮（索引里有真图用真图，没有回退程序化底）
//   · `scripts/game108-art-requirements.mjs` 按同一张表推台账
// 两边同源 ⇒ 加了一个可换面却忘了记账，会被点名测试当场逮住（不再靠人记得）。
//
// ══ 什么该进这张表，什么不该 ══
//
// **该进**：一张静态图能直接顶上去的面——手型图标、亮拳大手、手臂、石板、道具图标、背景。
// **不该进**：**值驱动**的面——血条填充比例、倒计时环的角度、加载条的进度。
//   它们的形状每帧随数值变，一张静态 raster 顶不上去（顶上去就只有一个固定的百分比）。
//   这类要换皮得走「底槽 + 填充色」两件套或 9-slice，**那是另一张单**，不拿它们凑行数充数。
// **也不该进**：对手立绘 —— 它由外部卡片角色（`card-character.ts`）传进来，是**调用方的资产**，
//   不是 game108 自己的美术面；记在这里会变成两处真相。
import type { Hand, Side } from './theme.js';

/** 一个可替换面：key（skinKey 的后半）+ 出图提示词 + 出图尺寸 + 它在屏上是什么。 */
export interface ArtSlot {
  /** 完整 skinKey = `game108/<key>`。台账、索引、`skinMap` 三处同名。 */
  key: string;
  /** 文生图提示词（台账 `desc`·美术平台逐行拼 prompt 用）。 */
  desc: string;
  /** 出图尺寸（台账 `spec`）。 */
  w: number;
  h: number;
  transparent: boolean;
  /** 屏上是什么 + 消费点在哪（台账 `context`·复查人据此核"这一行真有人读"）。 */
  context: string;
  /** 消费槽（台账 `slot`·孤儿审计据此认槽）。**逐素材一个 entity**，见推导脚本里的注释。 */
  entity: string;
}

const HAND_EN: Record<Hand, string> = { rock: 'closed fist', paper: 'open palm', scissors: 'two-finger scissors' };
const SIDE_EN: Record<Side, string> = { p1: 'warm tan skin, gold cuff', p2: 'cool grey-brown skin, crimson cuff' };

export const handIconSlot = (h: Hand): string => `hand-icon-${h}`;
export const gestureSlot = (side: Side, h: Hand): string => `gesture-${side}-${h}`;
export const armSlot = (side: Side): string => `arm-${side}`;
export const SLAB_SLOT = 'slab';
export const SMOKE_SLOT = 'smoke-icon';
export const SCENE_SLOT = 'scene/stage';

const HANDS3: Hand[] = ['rock', 'paper', 'scissors'];
const SIDES2: Side[] = ['p1', 'p2'];

export const ART_SLOTS: readonly ArtSlot[] = [
  // ── ① 手型图标 ×3（已是 owner 定稿切图·三处复用）────────────────────────────
  ...HANDS3.map((h) => ({
    key: handIconSlot(h),
    desc: `front-facing ${HAND_EN[h]} hand icon, cartoon, thick ink outline, cream skin, transparent background`,
    w: 220, h: 245, transparent: true,
    context: `招式卡 96×104 / 我方蓄力槽 56×62 / 对手蓄力条 28×34 三处复用的「${h}」手型图标`,
    entity: `duel-screen:hand-icon-${h}`,
  })),
  // ── ② **亮拳大手** ×6（双方 × 三手）──────────────────────────────────────────
  //    揭晓那一刻全屏最大的东西 = 本作的情绪核（§13 演出）。现在是程序矢量画的。
  //    双方分开出图是**规则要求**：玩家必须一眼看出「哪只是我的」（自证第 8 问·归属）。
  ...SIDES2.flatMap((side) => HANDS3.map((h) => ({
    key: gestureSlot(side, h),
    desc: `dramatic ${HAND_EN[h]} thrusting toward viewer, foreshortened, ${SIDE_EN[side]}, thick ink outline, cartoon, transparent background`,
    w: 512, h: 512, transparent: true,
    context: `T3 揭晓的亮拳大手（${side} 的「${h}」·屏上最大的一件·情绪核）`,
    entity: `duel-screen:gesture-${side}-${h}`,
  }))),
  // ── ③ 手臂 ×2（接在大手下面·跟着侧走）───────────────────────────────────────
  ...SIDES2.map((side) => ({
    key: armSlot(side),
    desc: `bare forearm with rolled sleeve, ${SIDE_EN[side]}, thick ink outline, cartoon, vertical, transparent background`,
    w: 256, h: 512, transparent: true,
    context: `亮拳大手下面的手臂（${side}·与大手同侧同色）`,
    entity: `duel-screen:arm-${side}`,
  })),
  // ── ④ 判定表石板（常驻台面中央·【R-108-40】规则可视化的载体）──────────────────
  {
    key: SLAB_SLOT,
    desc: 'carved stone tablet, weathered grey rock, thick ink outline, cartoon, chipped edges, blank face for text overlay',
    w: 512, h: 384, transparent: true,
    context: '判定表石板底（文字仍走 LayoutNode 叠在皮上·凿改时换这张图）',
    entity: 'duel-screen:slab',
  },
  // ── ⑤ 烟雾道具图标（【R-108-20】）──────────────────────────────────────────
  {
    key: SMOKE_SLOT,
    desc: 'smoke bomb pellet with curling grey smoke puff, cartoon, thick ink outline, transparent background',
    w: 192, h: 192, transparent: true,
    context: '底栏烟雾键上的道具图标',
    entity: 'duel-screen:smoke-icon',
  },
  // ── ⑥ 舞台背景（`mountHost` 背景皮肤槽·有图叠图/无图回退程序化底）──────────────
  {
    key: SCENE_SLOT,
    desc: 'dim underground fist-dueling hall, warm lantern pools, deep shadow, out-of-focus crowd silhouettes, painterly cartoon, no text',
    w: 1920, h: 1080, transparent: false,
    context: '对局舞台底（`mountHost({sceneBgSkin})`·无图时回退纯色 #171310）',
    entity: 'host-scene',
  },
] as const;

/** 完整 skinKey = `<slug>/<key>` —— 前缀必须是 `game108/`：基座件 `pickArtOverrides` 只收这个命名空间。 */
export const skinKeyOf = (slot: string): string => `game108/${slot}`;

/**
 * **取皮**：索引里有真图就用真图，否则回退程序化底。
 *
 * 这一层是红线「游戏侧消费必须读台账/skinMap·禁只读硬编码路径」的落点——
 * 少了它，创作台把图换进索引了、游戏里照样不上画面（「换了没反应」那个病）。
 * `skins` 为空（没有美术目录 / 还没加载完）→ 全部回退，观感与今天逐像素相同。
 */
export const pickSkin = (skins: Record<string, string> | undefined, slot: string, fallback: string): string =>
  skins?.[skinKeyOf(slot)] ?? fallback;
