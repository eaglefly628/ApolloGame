// Game I 展示台 · 跨页共用：ControlsState · 调参台 · 子编号器 · 段标题 · 贴图常量
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { uiTextureUrl, SKIN_METAL, SKIN_WOOD, SKIN_STONE, SKIN_SCROLL, BTN_BLUE, BTN_GREEN, BTN_RED, BTN_YELLOW, BTN_GREY, BTN_ROUND, BTN_GLOSSY, BTN_GHOST, CARD_JOKER, CARD_FLOWER } from '../ui-assets.js';
import { MODULE_NO } from './modules.js';

// 自定义画选中态的交互控件值（必须进 state·点击改值 + 局部更新才会动）。
export interface ControlsState {
  flag: boolean; sound: boolean; speed: string; view: string; qty: number; rating: number; city: string;
  muted: boolean; reverb: boolean; vol: number; pan: number;
  /** 现场调参台（REQ-DEMO-调参台）：sim 模块的离散可调档（key→选中档·如 'l.sun'→'high'）。空=各参走蓝图缺省档。 */
  tune: Record<string, string>;
}

export const INITIAL_CONTROLS: ControlsState = { flag: true, sound: true, speed: '1', view: 'grid', qty: 3, rating: 3, city: '', muted: false, reverb: false, vol: 70, pan: 0, tune: {} };

/** 一个可现场调节的离散参数（闭集档·Segmented 呈现·选中档编码进 value=`key:档`）。 */
export interface TuneSpec { key: string; label: string; def: string; opts: Array<{ v: string; label: string }>; }

/** 「现场调参台」面板：一排 Segmented，客户点档即改蓝图数据→渲染器实时换画（数据即渲染的活证）。 */
export function tuneDeck(id: string, specs: TuneSpec[], c: ControlsState): LayoutNode {
  return {
    type: 'Panel', id: `${id}-tune`, props: { bg: 'jade', title: '🎛 现场调参台 · 改数据即改渲染（无一行代码）' },
    layout: { direction: 'column', gap: 8, padding: 12 },
    children: specs.map((s): LayoutNode => ({
      type: 'Panel', id: `${id}-tr-${s.key}`, props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 10 },
      children: [
        { type: 'Label', id: `${id}-tl-${s.key}`, props: { text: s.label, size: 'sm', color: 'sub' }, layout: { width: 96 } },
        { type: 'Segmented', id: `${id}-ts-${s.key}`, props: {
          value: `${s.key}:${c.tune[s.key] ?? s.def}`,
          options: s.opts.map((o) => ({ value: `${s.key}:${o.v}`, label: o.label })),
          action: 'tune3d',
        } },
      ],
    })),
  };
}

// 自包含演示图：内联 data-URI SVG（纯数据·不依赖外部资源文件），用于 Image 控件展示。
export const DEMO_IMG =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22100%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2322d3ee%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%237c3aed%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22160%22%20height%3D%22100%22%20fill%3D%22url(%23g)%22%2F%3E%3Ctext%20x%3D%2280%22%20y%3D%2258%22%20font-size%3D%2222%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22bold%22%3EZEROCRAFT%3C%2Ftext%3E%3C%2Fsvg%3E';

// ── 段落标题小工具（统一风格：阔字距小标签）──────────────────
// 子效果编号（owner：进模块后每个子效果/控件都要能按号找到，好跟美术说「换哪个」）：
// 每个 sectionTitle 前缀 `#<主编号>-<子序>`（主编号=MODULE_NO·子序=该模块内递增）。稳定顺序 = 显示顺序。
let _secPrefix = '0';
let _secNo = 0;

export function beginSections(moduleId: string | null): void { _secPrefix = String((moduleId && MODULE_NO.get(moduleId)) || 0); _secNo = 0; }

/** 当前模块内下一个子编号（`<主>-<子>`）。给非 sectionTitle 的可编号子项（如字体墙每款字）也可取。 */
export function nextSubNo(): string { _secNo += 1; return `${_secPrefix}-${_secNo}`; }

export function sectionTitle(id: string, text: string): LayoutNode {
  // 编号做成独立高亮前缀 span（金色·好扫），后接原标题。
  // color 用 sub 不用 dim：daylight 亮皮下 dim 段题 ratio 2.89 < 3.0 硬地板（REQ-UIFX 修好空审计后首次实测·全 tab 系统性）。
  const no = nextSubNo();
  return { type: 'Label', id, props: { size: 'xs', color: 'sub', bold: true, spans: [{ text: `#${no}  `, color: 'gold', bold: true }, { text, color: 'sub' }] } };
}

export function divider(id: string): LayoutNode {
  return { type: 'Divider', id, props: {} };
}

// 平铺点阵贴图（自包含 SVG data-URI）：用 fill-opacity 而非 rgba()，避开 texLayer 的 ()'" 净化；
// encodeURIComponent 把空格/引号/尖括号全转 %XX → 过得了净化。配 bgTexture/bgScroll 即得「贴图底 + 滚动」。
const DOT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="1.6" fill="#9cd2c5" fill-opacity="0.30"/></svg>';

export const TEXTURE_URI = `data:image/svg+xml,${encodeURIComponent(DOT_SVG)}`;

// 带透明色的贴图（不透明金片 + 大片透明间隙）：铺在 bg:'transparent' 面上 → 间隙透见身后（see-through 演示）。
const ALPHA_TILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><rect x="5" y="5" width="24" height="24" rx="7" fill="#ffd86b"/></svg>';

export const ALPHA_TILE_URI = `data:image/svg+xml,${encodeURIComponent(ALPHA_TILE_SVG)}`;

// 贴图按钮皮 = **登记进本地资产索引的正规资产**（资产手册 §6·owner 2026-07-07「入库」）：按 key 引用 → uiTextureUrl 解析成
// 站点绝对 URL 喂 Button.skin（已解析 URL·同 Image.src 约定）。真相在 public/games/game-i/art/index.json；不再内联 data-URI 硬编码。
export const SKIN_METAL_URL = uiTextureUrl(SKIN_METAL);

export const SKIN_WOOD_URL = uiTextureUrl(SKIN_WOOD);

export const SKIN_STONE_URL = uiTextureUrl(SKIN_STONE);

export const SKIN_SCROLL_URL = uiTextureUrl(SKIN_SCROLL);

// vendored 真美术素材（Kenney UI Pack·CC0）
export const BTN_BLUE_URL = uiTextureUrl(BTN_BLUE);

export const BTN_GREEN_URL = uiTextureUrl(BTN_GREEN);

export const BTN_RED_URL = uiTextureUrl(BTN_RED);

export const BTN_YELLOW_URL = uiTextureUrl(BTN_YELLOW);

export const BTN_GREY_URL = uiTextureUrl(BTN_GREY);

export const BTN_ROUND_URL = uiTextureUrl(BTN_ROUND);

export const BTN_GLOSSY_URL = uiTextureUrl(BTN_GLOSSY);

export const BTN_GHOST_URL = uiTextureUrl(BTN_GHOST);

// 贴图=一张卡的按钮（fluentui 卡牌·MIT）
export const CARD_JOKER_URL = uiTextureUrl(CARD_JOKER);

export const CARD_FLOWER_URL = uiTextureUrl(CARD_FLOWER);

// vendored 卡通插画（undraw·MIT·内容丰富的彩色卡通场景）
export const CARTOON_ASTRO = uiTextureUrl('tex/cartoon-astronaut');

export const CARTOON_CAT = uiTextureUrl('tex/cartoon-cat');

export const CARTOON_DOG = uiTextureUrl('tex/cartoon-dog');

export const CARTOON_CAMP = uiTextureUrl('tex/cartoon-camping');

export const CARTOON_GAME = uiTextureUrl('tex/cartoon-gaming');

export const CARTOON_MUSIC = uiTextureUrl('tex/cartoon-music');

export const CARTOON_BDAY = uiTextureUrl('tex/cartoon-birthday');

export const CARTOON_ROBOT = uiTextureUrl('tex/cartoon-robot');

export const CARTOON_TRAVEL = uiTextureUrl('tex/cartoon-travel');
