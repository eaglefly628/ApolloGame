// ═══════════════════════════════════════════════════════════════
//  AI 原生编辑器 · 项目索引模型（纯逻辑·无 DOM·可单测）
//  设计：docs/design/ai-native-editor-2026-11-01.md
//
//  owner 2026-11-01 判 B：项目结构 = **编辑器侧索引** `project.json`，引擎/manifest 格式一字不动。
//  每个资产 = 一个有稳定 id 的条目（关卡、UI 屏、数据表、美术、动作、3D 模型……一视同仁），
//  id 用 `/` 分段 → 树形就是 id 的前缀结构（不另存文件夹表，免两份真相）。
//  人在树上「指认」一个资产 = 给 AI 的上下文；AI 改文件，编辑器只负责看懂、指认、调数值（乙）。
// ═══════════════════════════════════════════════════════════════

/** 资产类型闭集。file 类落在项目目录内（path）；ref 类指向外部平台/资产库（不复制素材）。 */
export const ASSET_TYPES = ['scene', 'ui', 'table', 'doc', 'image', 'model', 'motion', 'audio'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
/** 必须有项目内文件的类型（编辑器能读、能预览、能调数值）。 */
export const FILE_TYPES: readonly AssetType[] = ['scene', 'ui', 'table', 'doc'];

export interface AssetRef {
  /** 外部平台 id（与 .zerocraft/platforms.json 同名，如 motion / asset3d）或 `artlib`（美术库 key）。 */
  platform: string;
  /** 平台内的精确 id（动作 clip id、模型 key…）。 */
  id: string;
}

export interface ProjectAsset {
  /** 稳定 id：小写段 + `/` 分隔，如 `scenes/level-1`、`ui/hud`。树形由它推出。 */
  id: string;
  type: AssetType;
  /** 显示名（缺省 = id 末段）。 */
  name?: string;
  /** 项目目录内相对路径（file 类必填）。 */
  path?: string;
  /** 外部引用（image/model/motion/audio 可用 ref 代替 path）。 */
  ref?: AssetRef;
}

export interface ProjectIndex {
  schema: 1;
  /** = 库目录 slug（new<n>）。 */
  id: string;
  name: string;
  /** 打开项目时默认选中的场景资产 id。 */
  entry: string;
  assets: ProjectAsset[];
}

/** 新游戏编号：`new<n>`（owner 2026-11-01：新流程一律用新编号，不迁移老游戏）。 */
export const NEW_GAME_RE = /^new[1-9][0-9]*$/;
const ASSET_ID_RE = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;
const PLATFORM_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** 项目内相对路径：只许正斜杠分段、不许回溯/绝对/隐藏段，扩展名限 .json/.md。 */
export function isSafeRelPath(p: unknown): p is string {
  if (typeof p !== 'string' || !p || p.length > 200) return false;
  if (p.startsWith('/') || p.includes('\\')) return false;
  const segs = p.split('/');
  if (segs.some((s) => !s || s === '.' || s === '..' || s.startsWith('.'))) return false;
  return /\.(json|md)$/.test(p);
}

export interface ProjectIssue { path: string; message: string }

/** 校验并规整 project.json。返回问题列表（空 = 通过）；不抛错，编辑器把问题列给人看。 */
export function validateProject(raw: unknown): { project: ProjectIndex | null; issues: ProjectIssue[] } {
  const issues: ProjectIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    bad('', 'project.json 须是对象');
    return { project: null, issues };
  }
  const r = raw as Record<string, unknown>;
  if (r.schema !== 1) bad('schema', '只支持 schema 1');
  if (typeof r.id !== 'string' || !NEW_GAME_RE.test(r.id)) bad('id', 'id 须为 new<n>（如 new1）');
  if (typeof r.name !== 'string' || !r.name.trim()) bad('name', 'name 必填');
  if (!Array.isArray(r.assets)) {
    bad('assets', 'assets 须是数组');
    return { project: null, issues };
  }
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const assets: ProjectAsset[] = [];
  r.assets.forEach((a, i) => {
    const at = `assets[${i}]`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) { bad(at, '须是对象'); return; }
    const x = a as Record<string, unknown>;
    if (typeof x.id !== 'string' || !ASSET_ID_RE.test(x.id)) { bad(`${at}.id`, 'id 须为小写段 + / 分隔'); return; }
    if (seenIds.has(x.id)) { bad(`${at}.id`, `重复 id ${x.id}`); return; }
    if (!ASSET_TYPES.includes(x.type as AssetType)) { bad(`${at}.type`, `type 须为 ${ASSET_TYPES.join('/')}`); return; }
    const type = x.type as AssetType;
    const hasPath = x.path !== undefined;
    const hasRef = x.ref !== undefined;
    if (hasPath && !isSafeRelPath(x.path)) { bad(`${at}.path`, '须为项目内 .json/.md 相对路径'); return; }
    if (hasPath && seenPaths.has(x.path as string)) { bad(`${at}.path`, `多个资产指向同一文件 ${String(x.path)}`); return; }
    if (hasRef) {
      const ref = x.ref as Record<string, unknown> | null;
      if (!ref || typeof ref !== 'object' || typeof ref.platform !== 'string' || !PLATFORM_RE.test(ref.platform)
        || typeof ref.id !== 'string' || !ref.id || ref.id.length > 200) {
        bad(`${at}.ref`, 'ref 须为 {platform, id}'); return;
      }
    }
    if (FILE_TYPES.includes(type)) {
      if (!hasPath || hasRef) { bad(at, `${type} 资产须有 path 且不用 ref`); return; }
    } else if (hasPath === hasRef) { bad(at, `${type} 资产须且只须给 path 或 ref 之一`); return; }
    if (type === 'doc' ? !String(x.path).endsWith('.md') : hasPath && !String(x.path).endsWith('.json')) {
      bad(`${at}.path`, type === 'doc' ? 'doc 须为 .md' : `${type} 须为 .json`); return;
    }
    if (x.name !== undefined && typeof x.name !== 'string') { bad(`${at}.name`, 'name 须为字符串'); return; }
    seenIds.add(x.id);
    if (hasPath) seenPaths.add(x.path as string);
    assets.push({
      id: x.id, type,
      ...(typeof x.name === 'string' && x.name ? { name: x.name } : {}),
      ...(hasPath ? { path: x.path as string } : {}),
      ...(hasRef ? { ref: { platform: (x.ref as AssetRef).platform, id: (x.ref as AssetRef).id } } : {}),
    });
  });
  const entry = typeof r.entry === 'string' ? r.entry : '';
  const entryAsset = assets.find((a) => a.id === entry);
  if (!entryAsset) bad('entry', `entry ${entry || '(空)'} 不在 assets 里`);
  else if (entryAsset.type !== 'scene') bad('entry', 'entry 须指向 scene 资产');
  if (issues.length) return { project: null, issues };
  return { project: { schema: 1, id: r.id as string, name: (r.name as string).trim(), entry, assets }, issues };
}

export interface AssetTreeNode {
  /** 完整前缀（文件夹）或资产 id（叶子）。 */
  key: string;
  label: string;
  asset?: ProjectAsset;
  children: AssetTreeNode[];
}

/** id 前缀 → 文件夹树。文件夹在前、叶子在后，各自按 label 排序（确定性）。 */
export function buildAssetTree(assets: readonly ProjectAsset[]): AssetTreeNode {
  const root: AssetTreeNode = { key: '', label: '', children: [] };
  for (const a of assets) {
    const segs = a.id.split('/');
    let node = root;
    segs.forEach((seg, i) => {
      const key = segs.slice(0, i + 1).join('/');
      const leaf = i === segs.length - 1;
      let child = node.children.find((c) => c.key === key && (leaf ? c.asset : !c.asset));
      if (!child) {
        child = { key, label: leaf ? (a.name ?? seg) : seg, children: [], ...(leaf ? { asset: a } : {}) };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: AssetTreeNode) => {
    n.children.sort((x, y) => (x.asset ? 1 : 0) - (y.asset ? 1 : 0) || x.label.localeCompare(y.label));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

// ── 场景层级（Hierarchy）：manifest.entities → 实体行；模板/展开原样标注，不在编辑器里展开（AI 改的是源数据）。──

export interface HierarchyRow {
  id: string;
  components: string[];
  template?: string;
  repeat?: number;
}

export function sceneHierarchy(manifest: unknown): HierarchyRow[] {
  const ents = (manifest as { entities?: unknown } | null)?.entities;
  if (!ents || typeof ents !== 'object' || Array.isArray(ents)) return [];
  return Object.entries(ents as Record<string, unknown>).map(([id, raw]) => {
    const e = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
    const rep = e.$repeat as { count?: unknown; items?: unknown } | undefined;
    const repeat = typeof rep?.count === 'number' ? rep.count : Array.isArray(rep?.items) ? rep.items.length : undefined;
    return {
      id,
      components: Object.keys(e).filter((k) => !k.startsWith('$')),
      ...(typeof e.$template === 'string' ? { template: e.$template } : {}),
      ...(repeat !== undefined ? { repeat } : {}),
    };
  });
}

// ── 属性面板（Inspector）：把任意 JSON 摊成「指针 → 值」行。乙档 = 只许改标量的值、不许改结构/类型。──

export type ValueKind = 'number' | 'string' | 'boolean' | 'json';
export type Pointer = (string | number)[];

export interface ValueRow {
  pointer: Pointer;
  /** 显示用：`Transform.x`、`children[1].props.text`。 */
  label: string;
  value: unknown;
  kind: ValueKind;
  /** 乙档可手调（标量）。对象/数组/null 只读。 */
  editable: boolean;
}

export function kindOf(v: unknown): ValueKind {
  if (typeof v === 'number' && Number.isFinite(v)) return 'number';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'boolean') return 'boolean';
  return 'json';
}

/** 深度优先摊平；超过 maxRows 截断（大表别把面板撑爆），maxDepth 以下整块按 json 只读。 */
export function flattenValues(value: unknown, base: Pointer = [], opts: { maxRows?: number; maxDepth?: number } = {}): ValueRow[] {
  const maxRows = opts.maxRows ?? 400;
  const maxDepth = opts.maxDepth ?? 6;
  const rows: ValueRow[] = [];
  const label = (p: Pointer) => p.slice(base.length).reduce<string>((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : k), '');
  const walk = (v: unknown, p: Pointer, depth: number) => {
    if (rows.length >= maxRows) return;
    const isObj = v !== null && typeof v === 'object';
    if (!isObj || depth >= maxDepth) {
      const kind = kindOf(v);
      rows.push({ pointer: p, label: label(p), value: v, kind, editable: kind !== 'json' });
      return;
    }
    const entries: [string | number, unknown][] = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v as Record<string, unknown>);
    if (!entries.length) rows.push({ pointer: p, label: label(p), value: v, kind: 'json', editable: false });
    for (const [k, x] of entries) walk(x, [...p, k], depth + 1);
  };
  walk(value, base, 0);
  return rows;
}

export function getAt(root: unknown, pointer: Pointer): unknown {
  let cur = root;
  for (const k of pointer) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

/** 把输入框文本按原值类型解析；类型对不上返回 null（乙档：不许借手调改类型）。 */
export function coerceEdit(prev: unknown, text: string): { ok: true; value: string | number | boolean } | { ok: false; error: string } {
  const kind = kindOf(prev);
  if (kind === 'number') {
    const n = Number(text.trim());
    return text.trim() !== '' && Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: '须为数字' };
  }
  if (kind === 'boolean') {
    if (text === 'true' || text === 'false') return { ok: true, value: text === 'true' };
    return { ok: false, error: '须为 true / false' };
  }
  if (kind === 'string') return { ok: true, value: text };
  return { ok: false, error: '结构字段只读：请让 AI 改' };
}

// ── 给 AI 的指认上下文：人选中什么，AI 就看见什么（AI 原生交互的核心）。──

export interface Selection {
  asset: ProjectAsset;
  /** 场景里选中的实体 id。 */
  entity?: string;
  /** 属性面板里选中的字段。 */
  pointer?: Pointer;
}

export function selectionContext(project: ProjectIndex, sel: Selection | null): string {
  if (!sel) return `【项目】${project.name}（${project.id}）· 未选中资产`;
  const a = sel.asset;
  const lines = [`【项目】${project.name}（${project.id}）`, `【选中资产】${a.id}（${a.type}${a.path ? ` · 文件 ${a.path}` : ''}${a.ref ? ` · 引用 ${a.ref.platform}:${a.ref.id}` : ''}）`];
  if (sel.entity) lines.push(`【选中实体】${sel.entity}`);
  if (sel.pointer?.length) lines.push(`【选中字段】${sel.pointer.join('.')}`);
  return lines.join('\n');
}
