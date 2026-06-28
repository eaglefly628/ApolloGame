// art-textures.ts —— Game G 程序化美术底纹（纯数据·零外部素材·零依赖·符合「游戏=数据」）。
//
// 用代码生成「无缝平铺 SVG 图案」→ base64 data-URI，喂引擎 Panel.bgTexture / PlayingCard 等。
// 为什么 base64：引擎 texLayer 会剥 URL 里的 ' " ( ) \ 空白 防注入；base64 字母表(A-Za-z0-9+/=)不含这些 → 能安全穿过。
// 风格令牌走 fill/stroke 入参，便于双皮（玄铁金 / 锦霞）换色。换图 = 换数据，不碰引擎。

/** 把 SVG 源串编码成可平铺的 base64 data-URI（浏览器 btoa / Node Buffer 双兜底）。 */
function svgUri(svg: string): string {
  const b64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

/** 古钱币锁子纹（四角 + 中心圆相扣 + 菱·铜钱方孔意象）·无缝 64×64 平铺。金线低透·压在绿呢/面板上不抢正文。 */
export function coinLatticeTile(stroke = '#e8cd82', opacity = 0.1, size = 64): string {
  const r = size * 0.1875; // 12/64
  const c = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<g fill="none" stroke="${stroke}" stroke-width="1.2" opacity="${opacity}">` +
    `<circle cx="0" cy="0" r="${r}"/><circle cx="${size}" cy="0" r="${r}"/>` +
    `<circle cx="0" cy="${size}" r="${r}"/><circle cx="${size}" cy="${size}" r="${r}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}"/>` +
    `<rect x="${c - 4}" y="${c - 4}" width="8" height="8" transform="rotate(45 ${c} ${c})"/>` +
    `</g></svg>`;
  return svgUri(svg);
}

/** 主页绿呢牌桌底纹（玄铁金钱币纹·subtle）。 */
export const FELT_BROCADE = coinLatticeTile('#e8cd82', 0.09, 64);
