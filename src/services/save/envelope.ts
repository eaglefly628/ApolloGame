import type { SaveEnvelope, SaveCodec } from './save-port.js';

// ═══════════════════════════════════════════════════════════════
//  信封封装 / 拆封 —— 版本化存档的**核心正确性层**（checksum + schema 迁移链）。
//  与端口解耦：端口只负责「存取整只信封」，本模块负责「封装（算 checksum）/ 拆封（校验 + 迁移）」。
//  确定性：checksum 用规范化序列化 + FNV-1a（纯整数、跨机一致）；savedAt 由宿主注入、绝不取墙钟。
// ═══════════════════════════════════════════════════════════════

// 坏档 / 迁移断裂：读档时**报错不静默**（owner 铁律）。上层据此提示「存档损坏」而非默默丢数据。
export class CorruptSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorruptSaveError';
  }
}

// ── 规范化序列化（对象键排序 → 与字段书写序无关）+ FNV-1a 32bit（自包含，不依赖 net/determinism）──
//
//  铁律：checksum 必须覆盖**真正会被持久化的形态**，不是内存形态。
//  端口落盘必经 `JSON.stringify`（local-save-port.ts）——而 JSON 会改写值域：
//    · 对象里 undefined / 函数 / symbol 值的键 → **整个键消失**
//    · 数组里同类值 → **变 null**（不塌缩长度）
//    · NaN / ±Infinity → **变 null**
//    · 带 toJSON 的对象（Date 等）→ 先取 toJSON() 的结果
//  旧实现按内存形态算（`String(undefined)`→"undefined"、`String(NaN)`→"NaN"），存档经端口
//  往返后重算必然不符 → **合法存档被误判「已损坏或被篡改」而丢档**（迁移链产出
//  `field: undefined` 是最常见姿势）。故此处照 JSON 语义先归一，再算指纹：
//  往返前后同形 → 同指纹；真篡改仍会改变形态 → 仍然报错（防篡改不放水）。
function jsonDropped(v: unknown): boolean {
  return v === undefined || typeof v === 'function' || typeof v === 'symbol';
}
function stable(v: unknown): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 'null'; // NaN / ±Infinity → JSON 落盘为 null
    return Object.is(v, -0) ? '0' : String(v);
  }
  if (jsonDropped(v)) return 'null'; // 仅在数组元素位到达这里（对象键位已在下方跳过）
  if (v === null || typeof v !== 'object') return typeof v === 'string' ? JSON.stringify(v) : String(v);
  const withToJson = v as { toJSON?: () => unknown };
  if (typeof withToJson.toJSON === 'function') return stable(withToJson.toJSON());
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort()
    .filter((k) => !jsonDropped(o[k])) // 这些键 JSON 落盘时整个消失 → 指纹里也必须不存在
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// 完整性指纹：覆盖 schema/gameId/savedAt/data —— 任一字段被篡改/损坏都会变。
export function computeChecksum(schema: number, gameId: string, savedAt: number, data: unknown): string {
  return fnv1a(`${schema}|${gameId}|${savedAt}|${stable(data)}`);
}

/** 封装：把游戏 blob 封进版本化信封（schema/gameId 取自 codec；savedAt 宿主注入；算 checksum）。 */
export function sealEnvelope(data: unknown, codec: SaveCodec, savedAt: number): SaveEnvelope {
  return {
    schema: codec.schema,
    gameId: codec.gameId,
    savedAt,
    checksum: computeChecksum(codec.schema, codec.gameId, savedAt, data),
    data,
  };
}

/**
 * 拆封：校验 checksum（不符→CorruptSaveError·不静默）→ 校验 gameId/schema → 跑迁移链 → 返回当前 schema 的 data。
 *  - checksum 不符（数据损坏/被篡改）→ 抛。
 *  - gameId 不符（串档）→ 抛。
 *  - env.schema > codec.schema（来自更新版本）→ 抛（拒绝降级读取，避免丢新字段）。
 *  - env.schema < codec.schema → 逐步 migrations[v] 升级 v→v+1，缺步则抛（迁移链断裂）。
 */
export function openEnvelope(env: SaveEnvelope, codec: SaveCodec): unknown {
  const expect = computeChecksum(env.schema, env.gameId, env.savedAt, env.data);
  if (expect !== env.checksum) {
    throw new CorruptSaveError(`存档校验失败：checksum 不符（期望 ${expect}，实为 ${env.checksum}）——数据已损坏或被篡改`);
  }
  if (env.gameId !== codec.gameId) {
    throw new CorruptSaveError(`存档 gameId 不符：期望 "${codec.gameId}"，实为 "${env.gameId}"（串档）`);
  }
  if (env.schema > codec.schema) {
    throw new CorruptSaveError(`存档 schema ${env.schema} 高于当前 ${codec.schema}（来自更新版本，拒绝降级读取）`);
  }
  let data = env.data;
  for (let v = env.schema; v < codec.schema; v++) {
    const step = codec.migrations?.[v];
    if (!step) throw new CorruptSaveError(`迁移链断裂：缺少 schema ${v}→${v + 1} 的迁移步骤`);
    data = step(data);
  }
  return data;
}
