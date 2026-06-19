import type { AssetManager } from './asset-manager.js';
import type { TextureDescriptor, AtlasDescriptor, SpriteSheetDescriptor, Rect } from './asset-types.js';

// 原始资产存储索引（`assets/index.json`）的读取/校验/桥接。
//
// 分层：这是**最底层 raw 存储**的索引（按类型的叶子资产，无逻辑）。
// 游戏逻辑只引用稳定 `id`；本模块把 `filled` 的条目桥接进 AssetManager 供运行时绘制，
// `tbf`（待填充）条目不注册 → 运行时解析不到 → 渲染层退化为占位。
// 确定性安全：全在表现层，不碰 world / snapshot / hash。
//
// v2（资源库重构）：条目增加可选 category/tags/source/license/provenance —— 全部向后兼容，
// 由资源库浏览器消费、导入器写入（溯源 = 导入方式/原始文件名/归一化 profile）。

export type AssetType = 'texture' | 'mesh' | 'material' | 'sound' | 'animation' | 'video' | 'font';
export const ASSET_TYPES: readonly AssetType[] = [
  'texture',
  'mesh',
  'material',
  'sound',
  'animation',
  'video',
  'font',
];

/** TBF 生命周期（raw 存储层的最小子集；语义槽位层可细分为 placeholder/approved）。 */
export type AssetStatus = 'tbf' | 'filled';

export interface AssetIndexEntry {
  readonly id: string;
  readonly type: AssetType;
  readonly description: string;
  readonly status: AssetStatus;
  /** 相对 `assets/` 的文件路径；status='filled' 时必填，'tbf' 时缺省。 */
  readonly path?: string;
  readonly spec?: Readonly<Record<string, unknown>>;
  /** 类型下的子分类（资源库分类法，如 texture 的 'icon.item'/'background'）。 */
  readonly category?: string;
  /** 检索标签。 */
  readonly tags?: readonly string[];
  /** 来源标识（如 'import'、'FreeArtLib'、'手动'）。 */
  readonly source?: string;
  /** 许可（如 'CC0'）。 */
  readonly license?: string;
  /** 画风（ArtStyle：'pixel'|'cartoon.ink'|...；导入器按来源标，缺省视为 pixel）。 */
  readonly style?: string;
  /** 导入溯源：{ method, originalFile, importedAt, ... }（自由结构，仅作留痕）。 */
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface AssetIndex {
  readonly version: number;
  readonly assets: readonly AssetIndexEntry[];
}

function fail(msg: string): never {
  throw new Error(`asset-index: ${msg}`);
}

/** 校验并归一化原始 JSON → AssetIndex。结构非法即抛错（构建期早失败）。 */
export function parseAssetIndex(raw: unknown): AssetIndex {
  if (typeof raw !== 'object' || raw === null) fail('根必须是对象');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== 'number') fail('version 必须是数字');
  if (!Array.isArray(obj.assets)) fail('assets 必须是数组');

  const seen = new Set<string>();
  const assets: AssetIndexEntry[] = obj.assets.map((a, i) => {
    if (typeof a !== 'object' || a === null) fail(`assets[${i}] 必须是对象`);
    const e = a as Record<string, unknown>;
    if (typeof e.id !== 'string' || e.id.length === 0) fail(`assets[${i}].id 必须是非空字符串`);
    if (seen.has(e.id)) fail(`重复的资产 id "${e.id}"`);
    seen.add(e.id);
    if (typeof e.type !== 'string' || !ASSET_TYPES.includes(e.type as AssetType))
      fail(`assets[${i}] "${e.id}".type 非法：${String(e.type)}`);
    if (typeof e.description !== 'string') fail(`assets[${i}] "${e.id}".description 必须是字符串`);
    if (e.status !== 'tbf' && e.status !== 'filled')
      fail(`assets[${i}] "${e.id}".status 必须是 tbf|filled`);
    if (e.status === 'filled' && (typeof e.path !== 'string' || e.path.length === 0))
      fail(`assets[${i}] "${e.id}" 已 filled 但缺 path`);
    if (e.spec !== undefined && (typeof e.spec !== 'object' || e.spec === null))
      fail(`assets[${i}] "${e.id}".spec 必须是对象`);
    for (const f of ['category', 'source', 'license', 'style'] as const)
      if (e[f] !== undefined && typeof e[f] !== 'string') fail(`assets[${i}] "${e.id}".${f} 必须是字符串`);
    if (e.tags !== undefined && (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string')))
      fail(`assets[${i}] "${e.id}".tags 必须是字符串数组`);
    if (e.provenance !== undefined && (typeof e.provenance !== 'object' || e.provenance === null))
      fail(`assets[${i}] "${e.id}".provenance 必须是对象`);
    return {
      id: e.id,
      type: e.type as AssetType,
      description: e.description,
      status: e.status,
      path: typeof e.path === 'string' ? e.path : undefined,
      spec: e.spec as Record<string, unknown> | undefined,
      category: e.category as string | undefined,
      tags: e.tags as string[] | undefined,
      source: e.source as string | undefined,
      license: e.license as string | undefined,
      style: e.style as string | undefined,
      provenance: e.provenance as Record<string, unknown> | undefined,
    };
  });

  return { version: obj.version, assets };
}

/** 待填充清单（status='tbf'）—— 填充工具/预览器的工作面入口。 */
export function pendingAssets(index: AssetIndex): AssetIndexEntry[] {
  return index.assets.filter((a) => a.status === 'tbf');
}

/** 已填充清单。 */
export function filledAssets(index: AssetIndex): AssetIndexEntry[] {
  return index.assets.filter((a) => a.status === 'filled');
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

/** spec.sheet 的形状（导入器·精灵表切割写入）：等分网格参数。 */
export interface SheetSpec {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly columns: number;
  readonly count: number;
}

function sheetSpecOf(spec: Readonly<Record<string, unknown>> | undefined): SheetSpec | undefined {
  const s = spec?.sheet as Partial<SheetSpec> | undefined;
  if (!s || typeof s !== 'object') return undefined;
  if (
    typeof s.frameWidth !== 'number' ||
    typeof s.frameHeight !== 'number' ||
    typeof s.columns !== 'number' ||
    typeof s.count !== 'number'
  )
    return undefined;
  return s as SheetSpec;
}

/**
 * 把已 `filled` 的 `texture` 条目注册进 AssetManager（运行时即可按 id 绘制）。
 * 其它类型（mesh/sound/…）当前仅在索引中登记，运行时消费端后续增量接入。
 * `baseUrl` 一般为资产根（如 `/assets/`），拼到条目 path 前。
 * 形态判定：spec.frames → atlas（命名子矩形）；spec.sheet → sprite-sheet（等分网格）；否则整图 texture。
 */
export function registerAssetIndex(manager: AssetManager, index: AssetIndex, baseUrl = ''): void {
  // 防御性拼接：baseUrl 非空且不以 '/' 结尾时补一个，避免 "assets/tex" + "hero.png" = "assets/texhero.png"（Gemini code review）。
  const sep = baseUrl && !baseUrl.endsWith('/') ? '/' : '';
  for (const e of index.assets) {
    if (e.status !== 'filled' || e.type !== 'texture' || !e.path) continue;
    const src = baseUrl + sep + e.path;
    const frames = e.spec?.frames as Record<string, Rect> | undefined;
    const sheet = sheetSpecOf(e.spec);
    let descriptor: TextureDescriptor | AtlasDescriptor | SpriteSheetDescriptor;
    if (frames && typeof frames === 'object') {
      descriptor = { kind: 'atlas', key: e.id, src, frames };
    } else if (sheet) {
      descriptor = { kind: 'sprite-sheet', key: e.id, src, ...sheet };
    } else {
      descriptor = { kind: 'texture', key: e.id, src, width: numOrUndef(e.spec?.width), height: numOrUndef(e.spec?.height) };
    }
    manager.register(descriptor);
  }
}
