// game112 —— 程序化矢量占位（S3 最低标准「成形矢量 SVG」·capability-plan §4.5）。
// 皮肤槽：`cat.<catId>.<state>` / `icon.<hotspot>`。真美术（美术台账）就绪即让位；
// 引擎能力「内嵌 AI 视频播放」（REQ-112-ENG-11）交付后，猫的画面由它接管，本文件只剩回退链末端。
/**
 * 皮肤覆盖表（art-pipeline 口径「有生成图用图·无则回退程序化·兜底不丢」）：
 * 真美术到位后写进这张表（key = 台账 skinKey·值 = 已解析 URL），下面的程序化 SVG 自动让位。
 * 台账推导脚本：`scripts/game112-art-requirements.mjs`（行 = 本文件消费的每个 skinKey）。
 */
export const SKIN_OVERRIDES: Record<string, string> = {};
export const SKIN_KEYS = {
  cat: (catId: string, state: 'rest' | 'notice'): string => `game112/cat/${catId}-${state}`,
  hotspot: (kind: 'orb' | 'table' | 'basket'): string => `game112/icon/${kind}`,
  /** 房间场景背景（猫画面层容器 Panel.skin·猫叠其上）——hall-framework.md §6.1 art-06 定调图槽。 */
  scene: (room: string): string => `game112/scene/${room}`,
} as const;
/** 场景皮：有图给 URL（Panel.skin cover），无图返回 undefined → 回退主题 sunken 面（兜底不丢）。 */
export function sceneSkin(room: string): string | undefined {
  return SKIN_OVERRIDES[SKIN_KEYS.scene(room)];
}
const skin = (key: string, fallback: () => string): string => SKIN_OVERRIDES[key] ?? fallback();

const svg = (body: string, w = 320, h = 240): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

/** 布偶猫剪影（趴姿·蓝眼·重点色）。 */
export function catArt(catId: string, state: 'rest' | 'notice' = 'rest'): string {
  return skin(SKIN_KEYS.cat(catId, state), () => catSvg(state));
}
function catSvg(state: 'rest' | 'notice'): string {
  const eyeOpen = state === 'notice' ? 9 : 5;
  return svg(`
    <ellipse cx="160" cy="200" rx="150" ry="22" fill="#d9c9a8" opacity=".55"/>
    <ellipse cx="170" cy="150" rx="118" ry="62" fill="#f1e9dc"/>
    <ellipse cx="240" cy="160" rx="44" ry="30" fill="#e6dccb"/>
    <path d="M260 150 q50 -40 40 -95 q-8 20 -30 40 q-10 30 -10 55z" fill="#8c6f5a"/>
    <circle cx="112" cy="110" r="54" fill="#f6f0e6"/>
    <path d="M70 84 l-12 -46 l38 24z" fill="#8c6f5a"/><path d="M154 84 l12 -46 l-38 24z" fill="#8c6f5a"/>
    <path d="M62 96 q50 -26 100 0 q-8 22 -50 22 q-42 0 -50 -22z" fill="#a8897a" opacity=".85"/>
    <ellipse cx="94" cy="112" rx="8" ry="${eyeOpen}" fill="#3c6fc2"/><ellipse cx="130" cy="112" rx="8" ry="${eyeOpen}" fill="#3c6fc2"/>
    <ellipse cx="112" cy="130" rx="5" ry="3.5" fill="#d59aa2"/>
    <path d="M112 133 q-6 8 -14 8 M112 133 q6 8 14 8" stroke="#8c6f5a" stroke-width="2" fill="none"/>
    <ellipse cx="80" cy="176" rx="20" ry="10" fill="#f6f0e6"/><ellipse cx="128" cy="180" rx="20" ry="10" fill="#f6f0e6"/>
  `);
}

/** 主厅热点图标（晶球 / 星牌桌 / 玩具篮）。 */
export function hotspotArt(kind: 'orb' | 'table' | 'basket'): string {
  return skin(SKIN_KEYS.hotspot(kind), () => hotspotSvg(kind));
}
function hotspotSvg(kind: 'orb' | 'table' | 'basket'): string {
  if (kind === 'orb') {
    return svg(`<circle cx="48" cy="48" r="34" fill="#c9d6e6"/><circle cx="48" cy="48" r="34" fill="url(#g)"/>
      <defs><radialGradient id="g" cx=".4" cy=".35"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#7d93b8" stop-opacity=".35"/></radialGradient></defs>
      <path d="M26 86 h44 l-6 -10 h-32z" fill="#8c6f5a"/>`, 96, 96);
  }
  if (kind === 'table') {
    return svg(`<rect x="10" y="40" width="76" height="14" rx="4" fill="#8c6f5a"/><rect x="18" y="54" width="8" height="30" fill="#6f5546"/><rect x="70" y="54" width="8" height="30" fill="#6f5546"/>
      <rect x="28" y="22" width="16" height="22" rx="3" fill="#f6f0e6" stroke="#8c6f5a" transform="rotate(-8 36 33)"/>
      <rect x="44" y="20" width="16" height="22" rx="3" fill="#dfe7f2" stroke="#8c6f5a"/>
      <rect x="60" y="22" width="16" height="22" rx="3" fill="#f6f0e6" stroke="#8c6f5a" transform="rotate(8 68 33)"/>`, 96, 96);
  }
  return svg(`<path d="M14 46 h68 l-8 36 h-52z" fill="#c9a97a"/><path d="M14 46 h68" stroke="#8c6f5a" stroke-width="4"/>
    <circle cx="36" cy="36" r="10" fill="#d59aa2"/><path d="M58 40 q10 -22 24 -16" stroke="#7d93b8" stroke-width="4" fill="none"/>`, 96, 96);
}
