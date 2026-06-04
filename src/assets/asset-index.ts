import type { AssetManager } from './asset-manager.js';
import type { TextureDescriptor } from './asset-types.js';

// 原始资产存储索引（`assets/index.json`）的读取/校验/桥接。
//
// 分层：这是**最底层 raw 存储**的索引（按类型的叶子资产，无逻辑）。
// 游戏逻辑只引用稳定 `id`；本模块把 `filled` 的条目桥接进 AssetManager 供运行时绘制，
// `tbf`（待填充）条目不注册 → 运行时解析不到 → 渲染层退化为占位。
// 确定性安全：全在表现层，不碰 world / snapshot / hash。

export type AssetType = 'texture' | 'mesh' | 'material' | 'sound' | 'animation' | 'video';
export const ASSET_TYPES: readonly AssetType[] = [
  'texture',
  'mesh',
  'material',
  'sound',
  'animation',
  'video',
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
    return {
      id: e.id,
      type: e.type as AssetType,
      description: e.description,
      status: e.status,
      path: typeof e.path === 'string' ? e.path : undefined,
      spec: e.spec as Record<string, unknown> | undefined,
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

/**
 * 把已 `filled` 的 `texture` 条目注册进 AssetManager（运行时即可按 id 绘制）。
 * 其它类型（mesh/sound/…）当前仅在索引中登记，运行时消费端后续增量接入。
 * `baseUrl` 一般为资产根（如 `/assets/`），拼到条目 path 前。
 */
export function registerAssetIndex(manager: AssetManager, index: AssetIndex, baseUrl = ''): void {
  for (const e of index.assets) {
    if (e.status !== 'filled' || e.type !== 'texture' || !e.path) continue;
    const descriptor: TextureDescriptor = {
      kind: 'texture',
      key: e.id,
      src: baseUrl + e.path,
      width: numOrUndef(e.spec?.width),
      height: numOrUndef(e.spec?.height),
    };
    manager.register(descriptor);
  }
}
