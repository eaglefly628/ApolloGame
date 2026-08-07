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

// ── 美术库贴图覆盖（owner 07-14「game211 全面台账化替换」·与 portraits 覆盖同一模式）──
// 台账行生成真图 → fill 别名登记进 game211 本地索引 → mount 载入注册到这里；
// 消费点（牌桌/背景板/硬币面）先查覆盖、未命中回退程序化——真图未到=观感零字节变化。
const _texOverrides = new Map<string, string>();

/** 登记贴图覆盖（{ 'game211/tex/felt-brocade': url, … }）。只收非空 URL。 */
export function registerTextureOverrides(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) if (v) _texOverrides.set(k, v);
}
/** 查某贴图槽当前真图 URL；无覆盖=null（消费点回退程序化）。 */
export function textureOverrideUri(key: string): string | null {
  return _texOverrides.get(key) ?? null;
}
/** 清空覆盖（测试用·保帧回归确定性）。 */
export function clearTextureOverridesForTest(): void { _texOverrides.clear(); }
export function textureOverrideCount(): number { return _texOverrides.size; }

/** 牌桌呢面贴图（台账槽 game211/tex/felt-brocade）：真图覆盖优先·回退程序化钱币纹。 */
export function feltBrocadeUri(): string {
  return textureOverrideUri('game211/tex/felt-brocade') ?? FELT_BROCADE;
}

/** 套装图标查询（批32 owner「很多图标统一风格升级」）：台账 game211/icon/<token> 行出真图后，
 *  界面 emoji 记号（🪙💎⚡🀄…）逐槽换成套装美术图标（Button.icon/Tag.icon/Label span.img 消费）。
 *  无覆盖=null → 消费点保留原 emoji（观感零变）。token 词表见台账 ICON_ROWS（34 枚·统一风格锚）。 */
export function iconUri(token: string): string | null {
  return textureOverrideUri(`game211/icon/${token}`);
}

/** 地支 branch → 套装图标 token（台账 game211/icon/zodiac-*·12 生肖·批32）。 */
export const ZODIAC_ICON_TOKEN: Record<string, string> = {
  子: 'zodiac-rat', 丑: 'zodiac-ox', 寅: 'zodiac-tiger', 卯: 'zodiac-rabbit', 辰: 'zodiac-dragon', 巳: 'zodiac-snake',
  午: 'zodiac-horse', 未: 'zodiac-goat', 申: 'zodiac-monkey', 酉: 'zodiac-rooster', 戌: 'zodiac-dog', 亥: 'zodiac-pig',
};
/** 生肖图标查询：branch（子丑寅…）→ 真图 URL 或 null（回退 emoji/文字）。 */
export function zodiacIconUri(branch: string): string | null {
  const tok = ZODIAC_ICON_TOKEN[branch];
  return tok ? iconUri(tok) : null;
}
