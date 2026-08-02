// Game A ·《掼蛋夜宴》—— 视觉常量 + 夜宴系 UITheme + 席位锚点（纯数据·零逻辑）。
// 色锚取自 owner 钦定蓝本 guandan-lite-mockup.html（深夜暖褐底 × 酒红呢桌 × 朱砂 × 米金）；
// 跨夜宴系（a/b/c）色板统一（对齐 game-c GAME_C_THEME·art-data-manual §1）——掼蛋特色=**酒红牌桌**（德州=绿呢）。
// 布局基准=ui-scene-design §1 / 蓝本：横屏 1280×720 逻辑分辨率·固定相机=席位屏幕锚点常量。
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';
import { codeRank, codeSuit, RANK_BIG_JOKER, RANK_SMALL_JOKER } from './rules.js';
import { artUri } from './art-overrides.js';

export const FIELD_W = 1280;
export const FIELD_H = 720;

// 蓝本色锚（截图取色）：暗红夜局底 / 朱砂红强调 / 米金（金钱·标题）/ 暖沙。
export const NIGHT_BG = '#2a0f11';
export const CINNABAR = '#c8352b';
export const GOLD = '#f0c96a';
export const WARM_SAND = '#d8b878';

// 私宅夜局场景底（暖褐夜局径向·真背景图=S6 台账件 A-BG-01·风格锚 modern-manor）。
export const MANOR_BG =
  'radial-gradient(ellipse at 50% 18%, #4a3020 0%, #2e1c14 46%, #1e120c 78%, #160e0a 100%)';
// 酒红牌呢（掼蛋特色·蓝本椭圆桌·真图=S6·风格锚 modern-manor）。
export const FELT_RED =
  'radial-gradient(ellipse at 50% 42%, #6a1f26 0%, #4e151b 52%, #360f14 100%)';
// ── 美术槽位 → 内置回退路径（**单一真相**·台账 skinKey `game-a/<slot>` 逐条对应）──
// 消费经 `art(slot)`：工坊替换真图（art-replace 写 index skinKey 别名·A-023）→ 覆盖优先热替换；
// 未替换→内置占位（**换图即生效·真图未到零字节变化**·Lead 红线）。台账 art-ledger.json skinKey 必与此表键对应。
// 注：牌面 54 张=控件文字画（合蓝本经典白扑克·换整卡 SVG 需 PUI 补卡面贴图槽·见 requests A-024）。
const ART_FALLBACK = {
  'bg/menu': '/games/game-a/art/bg/menu.svg',
  'bg/table': '/games/game-a/art/bg/table.svg',
  'felt/table': '/games/game-a/art/felt/table.svg',
  'icon/coin': '/games/game-a/art/icons/coin.svg',
  'icon/level': '/games/game-a/art/icons/level.svg',
  'icon/tribute': '/games/game-a/art/icons/tribute.svg',
  'icon/menu': '/games/game-a/art/icons/menu.svg',
  'icon/counter': '/games/game-a/art/icons/counter.svg',
  'icon/copy': '/games/game-a/art/icons/copy.svg',
  'fx/win': '/games/game-a/art/fx/win-confetti.svg',
} as const;
/** 按槽解析美术 URL（工坊 skinKey 别名覆盖优先·回退内置占位·换图即生效·**mount 期 loadArtOverrides 后热替换**）。 */
export function art(slot: keyof typeof ART_FALLBACK): string {
  return artUri(`game-a/${slot}`, ART_FALLBACK[slot]);
}
/** 牌呢桌面贴图（felt 覆盖优先叠红呢渐变·图未到=纯渐变兜底）。运行时解析故为函数（非常量·随覆盖热替换）。 */
export function feltTexture(): string {
  return `url('${art('felt/table')}') center/cover no-repeat, ${FELT_RED}`;
}
export const WRAPPER_BG = '#140a0b';

// ── 夜宴系 UITheme（令牌照 art-data-manual §1 色板·跨 a/b/c 统一·换皮改这一份·LayoutNode 数据零改）──
export const GAME_A_THEME: UITheme = {
  bg0: '#160e0a', bg1: '#241812', bg2: '#2c1f16', bg3: '#37271a',
  pageBg: MANOR_BG,
  line: 'rgba(224,180,120,0.30)',
  text: '#f3ece0', sub: '#c3b39c', dim: '#8a7862',
  jade: '#7fd6b0', jadeWash: 'rgba(127,214,176,0.12)', jadeLine: 'rgba(240,201,106,0.42)',
  gold: '#f0c96a',
  ok: '#7fd6b0', okWash: 'rgba(127,214,176,0.14)',
  warn: '#e0b458', warnWash: 'rgba(224,180,88,0.14)',
  danger: '#c8352b',
  ink: '#241009',
  fontUi: "'Noto Sans SC','Source Han Sans SC',system-ui,sans-serif",
  fontMono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  fontSerif: "'Noto Serif SC','Songti SC','Source Han Serif SC',serif",
  // 次级按钮不贴皮（btn-ghost/btn-quiet.svg 220×56·9-slice 16 对紧凑顶栏/工具条小按钮=强制大 min-size→
  // 撑高变方+「菜单」折行·实测回归·A-024 记）；小按钮用引擎原生 kind，金 CTA 用 hero kind（A-022）。
};

// ── 席位屏幕锚点（蓝本布局·%中心·固定相机=固定屏幕常量·四人掼蛋）──────────────────
// 北=队友(牌桌上方居中) / 西·东=对手(牌桌左右外侧) / 主角=底部手牌区(单列不用锚)。
export interface SeatAnchor { id: 'partner' | 'west' | 'east'; xPct: number; yPct: number; }
export const SEAT_ANCHORS: readonly SeatAnchor[] = [
  { id: 'partner', xPct: 50, yPct: 11 },
  { id: 'west', xPct: 7.5, yPct: 40 },
  { id: 'east', xPct: 92.5, yPct: 40 },
] as const;
export const SEAT_W = 130;
export const SEAT_H = 150;
/** 锚点 %（中心）→ 绝对定位左上角 px（1280×720 基准）。 */
export function seatTopLeft(a: SeatAnchor): { x: number; y: number } {
  return { x: Math.round((a.xPct / 100) * FIELD_W - SEAT_W / 2), y: Math.round((a.yPct / 100) * FIELD_H - SEAT_H / 2) };
}

// ── 牌资产 key（本地库 public/games/game-a/art/index.json·vendor 自 PD 货架·§5.1）───
// 两副=同素材引两次；级牌/逢人配高亮=运行时特效叠加，不烤进牌面（§5.1 铁律）。
const RANK_WORDS: Record<number, string> = {
  2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight',
  9: 'nine', 10: 'ten', 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace',
};
const SUIT_WORDS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

/** 牌码 → 本地资产 id（card/<rank>-of-<suit>·王=joker-black/red）。 */
export function cardAssetId(code: number): string {
  const rank = codeRank(code);
  if (rank === RANK_SMALL_JOKER) return 'card/joker-black';
  if (rank === RANK_BIG_JOKER) return 'card/joker-red';
  return `card/${RANK_WORDS[rank]}-of-${SUIT_WORDS[codeSuit(code)]}`;
}
export const CARD_BACK_ID = 'card/back';

/** 资产 id → 站点绝对 URL（本地索引 path 约定·vendor-asset 落盘规律；vendor.test 逐条对账钉死）。 */
export function cardAssetUrl(assetId: string): string {
  const ext = assetId === CARD_BACK_ID ? 'png' : 'svg';
  return `/games/game-a/art/cards/${assetId.slice('card/'.length)}.${ext}`;
}
