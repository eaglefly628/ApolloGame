import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import type { AssetIndex } from '@assets/index.js';
import { GAME_A_ASSETS } from '../games/game-a/index.js';
import { MATERIALS, GARMENTS, ACCESSORIES } from '../games/game-c/index.js';
import gameBManifestRaw from '../games/game-b/assets/asset-manifest.json';

// ═══════════════════════════════════════════════════════════════
//  资产透视 · 统一模型 (Asset Browser model — pure, no DOM/React)
//
//  把每个游戏"这局要哪些美术、填了没、谁在用"摊成一份统一 StudioAsset[]：
//   · game-a → GAME_A_ASSETS 声明清单(内联 SVG 占位)，usedBy 扫蓝图 textureKey。
//   · game-b → asset-manifest.json 槽位(背景/立绘/BGM + variants)，usedBy=requiredBy(场景)。
//   · game-c → 材料/衣服/配饰即"内容资产"(emoji 占位 + 爱诗 AIGP 提示词)，usedBy 指向真实实体。
//   · 其它   → 通用扫描 textureKey/clipId。
//  再和 assets/index.json 对照，让 tbf/filled 状态权威。供 UI 做分类/收缩/搜索/双击定位。
// ═══════════════════════════════════════════════════════════════

export type StudioAssetStatus = 'filled' | 'tbf' | 'placeholder' | 'missing';

export interface StudioAsset {
  id: string;
  /** 分类用（按此分组）：texture/background/character_portrait/bgm/material/garment/accessory… */
  type: string;
  name: string;
  description: string;
  status: StudioAssetStatus;
  /** 搜索 + 过滤用关键词。 */
  tags: string[];
  /** 双击定位目标：实体 id（可跳数据树）或场景 id（game-b，仅展示）。 */
  usedBy: string[];
  variants?: string[];
}

// ── game-b 清单形状（局部声明，仅取用到的字段）──
interface GameBSlot {
  id: string;
  category: string;
  name: string;
  description: string;
  requiredBy?: string[];
  consistencyGroup?: string;
  status?: string;
  variants?: Array<{ key: string; description: string }>;
}
interface GameBManifest {
  styleAnchor?: { id: string; description: string };
  slots: GameBSlot[];
}
const gameBManifest = gameBManifestRaw as unknown as GameBManifest;

function entitiesReferencing(bp: WorldBlueprint, key: string): string[] {
  const ids: string[] = [];
  for (const [eid, comps] of Object.entries(bp.entities)) {
    for (const data of Object.values(comps as Record<string, unknown>)) {
      const d = data as Record<string, unknown>;
      if (d.textureKey === key || d.clipId === key) ids.push(eid);
    }
  }
  return ids;
}

function gameAAssets(bp: WorldBlueprint): StudioAsset[] {
  return GAME_A_ASSETS.map((a) => {
    const dims = a.kind === 'texture' ? `${a.width ?? '?'}×${a.height ?? '?'}` : a.kind;
    const sizeTag = a.kind === 'texture' ? `${a.width ?? 0}x${a.height ?? 0}` : a.kind;
    return {
      id: a.key,
      type: a.kind,
      name: a.key,
      description: `内联 SVG 占位 · ${dims}`,
      status: 'placeholder' as StudioAssetStatus,
      tags: ['inline-svg', a.kind, sizeTag],
      usedBy: entitiesReferencing(bp, a.key),
    };
  });
}

function gameBAssets(): StudioAsset[] {
  const anchor = gameBManifest.styleAnchor?.id;
  return gameBManifest.slots.map((s) => ({
    id: s.id,
    type: s.category,
    name: s.name,
    description: s.description,
    status: (s.status === 'filled' ? 'filled' : 'placeholder') as StudioAssetStatus,
    tags: [s.category, s.consistencyGroup, anchor, ...(s.variants?.map((v) => v.key) ?? [])].filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    ),
    usedBy: s.requiredBy ?? [],
    variants: s.variants?.map((v) => v.key),
  }));
}

function hex(tint: number): string {
  return `#${(tint & 0xffffff).toString(16).padStart(6, '0')}`;
}

function gameCAssets(): StudioAsset[] {
  const out: StudioAsset[] = [];
  for (const m of MATERIALS) {
    out.push({
      id: m.id,
      type: 'material',
      name: `${m.glyph} ${m.name}`,
      description: m.blurb,
      status: 'placeholder',
      tags: ['material', 'tile', m.glyph, hex(m.tint)],
      usedBy: [`mat_${m.id}`],
    });
  }
  for (const g of GARMENTS) {
    out.push({
      id: g.id,
      type: 'garment',
      name: `${g.icon} ${g.name}`,
      description: g.aishePrompt, // 爱诗(AIGP)视频提示词即此衣服的"生成式美术"
      status: 'placeholder',
      tags: ['garment', 'aigp', `tier${g.tier}`, ...g.requires.map((r) => r.material)],
      usedBy: [`flag_${g.id}`, `btn_${g.id}`], // v0.3：解锁 flag + 缝制按钮（均为真实实体）
    });
  }
  for (const a of ACCESSORIES) {
    out.push({
      id: a.id,
      type: 'accessory',
      name: `${a.icon} ${a.name}`,
      description: a.promptFragment,
      status: 'placeholder',
      tags: ['accessory', 'aigp', a.slot, ...a.requires.map((r) => r.material)],
      usedBy: [], // 配饰为设计内容，v0.3 蓝图尚未接线 → 无对应实体可定位
    });
  }
  return out;
}

// 通用扫描（无声明清单的游戏，如 demo）：从实体里扒 textureKey/clipId。
function scanBlueprintAssets(bp: WorldBlueprint): StudioAsset[] {
  const fields: Array<[string, string]> = [
    ['textureKey', 'texture'],
    ['clipId', 'sound'],
  ];
  const map = new Map<string, { type: string; usedBy: Set<string> }>();
  for (const [eid, comps] of Object.entries(bp.entities)) {
    for (const data of Object.values(comps as Record<string, unknown>)) {
      const d = data as Record<string, unknown>;
      for (const [f, type] of fields) {
        const v = d[f];
        if (typeof v === 'string' && v.length > 0) {
          let e = map.get(v);
          if (!e) map.set(v, (e = { type, usedBy: new Set() }));
          e.usedBy.add(eid);
        }
      }
    }
  }
  return [...map.entries()].map(([id, v]) => ({
    id,
    type: v.type,
    name: id,
    description: '',
    status: 'placeholder' as StudioAssetStatus,
    tags: [v.type],
    usedBy: [...v.usedBy].sort(),
  }));
}

// 和 assets/index.json 对照：命中则 index 的 tbf/filled 状态权威，补描述。
function crossRef(list: StudioAsset[], index: AssetIndex | null): StudioAsset[] {
  if (!index) return list;
  const byId = new Map(index.assets.map((a) => [a.id, a]));
  return list.map((a) => {
    const hit = byId.get(a.id);
    if (!hit) return a;
    return {
      ...a,
      status: hit.status,
      description: a.description || hit.description,
      tags: a.tags.includes(hit.type) ? a.tags : [...a.tags, hit.type],
    };
  });
}

export function studioAssets(
  gameId: string,
  bp: WorldBlueprint,
  index: AssetIndex | null,
): StudioAsset[] {
  let list: StudioAsset[];
  switch (gameId) {
    case 'game-a':
      list = gameAAssets(bp);
      break;
    case 'game-b':
      list = gameBAssets();
      break;
    case 'game-c':
      list = gameCAssets();
      break;
    default:
      list = scanBlueprintAssets(bp);
  }
  return crossRef(list, index);
}

export interface AssetGroup {
  type: string;
  assets: StudioAsset[];
}

/** 按类型分组（组内按 id 排序，组按类型名排序）。供 UI 收缩排列。 */
export function groupByType(assets: readonly StudioAsset[]): AssetGroup[] {
  const map = new Map<string, StudioAsset[]>();
  for (const a of assets) {
    let g = map.get(a.type);
    if (!g) map.set(a.type, (g = []));
    g.push(a);
  }
  return [...map.entries()]
    .map(([type, as]) => ({ type, assets: as.slice().sort((x, y) => x.id.localeCompare(y.id)) }))
    .sort((x, y) => x.type.localeCompare(y.type));
}

/** tag/文本搜索：命中 id/name/description/type/tags/usedBy 任一即保留。 */
export function filterAssets(assets: readonly StudioAsset[], query: string): StudioAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return assets.slice();
  return assets.filter((a) =>
    [a.id, a.name, a.description, a.type, ...a.tags, ...a.usedBy].some((s) =>
      s.toLowerCase().includes(q),
    ),
  );
}
