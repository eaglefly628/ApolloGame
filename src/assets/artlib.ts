// FreeArtLib（DCSS CC0 32×32 tiles）资产目录：类型 + 检索助手，供所有游戏 ref/copy。
// 索引 assets/FreeArtLib/index.json 由 scripts/build-artlib-index.mjs 生成（从名字派生分类）；
// slot/transparent 语义来自人工看样图（从图像）。标准见 docs/design/art-library-tags.md。
// 助手是纯函数，index 由调用方传入（按需 fetch/import，避免把 ~700KB 强行打进包）。

export type ArtSlot =
  | 'tile' // 不透明可平铺地形 → Tilemap
  | 'sprite.character' // 透明生物/角色精灵 → Sprite.textureKey
  | 'sprite.paperdoll' // 纸娃娃分层（base+body+head+hands 叠合）
  | 'icon.item' // 透明物品图标
  | 'icon.ui' // UI/法术/技能图标
  | 'fx' // 特效/投射物
  | 'decal'; // 血迹/铭牌/旗帜等叠加

export interface ArtAsset {
  id: string; // 稳定 key = cat/sub/subject（变体合一），如 "item/weapon/axe"
  cat: string; // 顶层分类
  sub: string; // 子目录路径（'' = 直属 cat）
  subject: string; // 主题名（去掉 _数字 变体）
  slot: ArtSlot; // 怎么用（看样图定）
  transparent: boolean;
  variants: number; // 变体张数（如 floor 4 张随机平铺）
  sample?: string; // 代表帧文件名（真实存在的首张，变体编号非 0 基连续故须存）
  w?: number;
  h?: number; // 仅 ≠ basePixel(32) 时存
}

export interface ArtLibIndex {
  version: number;
  source: string;
  license: string;
  root: string;
  basePixel: number;
  fileCount: number;
  assetCount: number;
  cats: Record<string, number>;
  slots: Record<string, number>;
  assets: ArtAsset[];
}

/** 一个资产的搜索标签 = cat + sub 各段 + subject 各词 + slot 词根（不入库，现算）。 */
export function artlibTokens(a: ArtAsset): string[] {
  return [
    ...new Set([a.cat, ...a.sub.split('/'), ...a.subject.split('_'), ...a.slot.split('.')].filter(Boolean)),
  ].map((t) => t.toLowerCase());
}

/** 资产所在目录（相对仓库根）：root/cat[/sub]。 */
export function artlibDir(index: ArtLibIndex, a: ArtAsset): string {
  return [index.root, a.cat, a.sub].filter(Boolean).join('/');
}

/**
 * 变体文件 glob 模式：`<dir>/<subject>*.png`。
 * 注意：变体编号非 0 基连续（如 bars_red_1..8 / black_cobalt_1,10）→ 用 glob 找真实文件，
 * 不要假设 0..n-1。variants 字段只给"有几张"。
 */
export function artlibGlob(index: ArtLibIndex, a: ArtAsset): string {
  return `${artlibDir(index, a)}/${a.subject}${a.variants > 1 ? '*' : ''}.png`;
}

/** 代表帧文件路径（相对仓库根）：dir/sample。dev 下加前导 '/' 即可 `<img src>`。 */
export function artlibThumb(index: ArtLibIndex, a: ArtAsset): string {
  return `${artlibDir(index, a)}/${a.sample ?? `${a.subject}.png`}`;
}

/** 按 tag/文本检索（空格分词，全部命中）。可选 slot/cat 过滤。 */
export function searchArtlib(
  index: ArtLibIndex,
  query: string,
  opts: { slot?: ArtSlot; cat?: string } = {},
): ArtAsset[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return index.assets.filter((a) => {
    if (opts.slot && a.slot !== opts.slot) return false;
    if (opts.cat && a.cat !== opts.cat) return false;
    if (!terms.length) return true;
    const hay = artlibTokens(a).join(' ') + ' ' + a.id;
    return terms.every((t) => hay.includes(t));
  });
}
