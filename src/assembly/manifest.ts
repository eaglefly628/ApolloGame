import type { WorldBlueprint, EntityBlueprint } from './demo.assembly.js';
import { resolveCapabilities, inferCapabilityIds, AMBIGUOUS_COMPONENTS } from './capability-registry.js';
import { validateComponentData, validateAssetRefs, formatIssues } from './validate-manifest.js';
import { validateReferences } from './validate-references.js';

// ═══════════════════════════════════════════════════════════════
//  Manifest 加载器 —— studio「导出 manifest」的逆运算
//
//  规范 manifest(单一数据格式)= { capabilities: string[](能力id), entities: {id:{Comp:data}} }，
//  正是 studio exportManifest 产出的形状。parseManifest 把它泡发回可被 engine.load 的 WorldBlueprint：
//  id → 能力对象(注册表)，entities 原样(纯数据)。导出能再导入 = 对称闭环。
//  这就是「游戏=数据」的临门一脚：AI / 预设 / 手改 产出的同一种数据，引擎直接跑。
// ═══════════════════════════════════════════════════════════════

export interface Manifest {
  /** manifest 格式版本（P1c）。缺省 1。装载时 < 当前版本按 MANIFEST_MIGRATIONS 逐级升；> 当前版本拒收（引擎太旧）。 */
  schema?: number;
  capabilities?: string[];
  entities: Record<string, Record<string, unknown>>;
}

/** 当前 manifest 格式版本。改组件字段名/形状时 +1 并在 MANIFEST_MIGRATIONS 登记 N→N+1 的升级函数。 */
export const MANIFEST_SCHEMA = 1;

/** 版本迁移链：键 = 源版本，函数 = 把该版本的 raw 升到下一版（纯函数·可单测）。目前无历史版本。 */
export const MANIFEST_MIGRATIONS: Readonly<Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>> = {};

/** 把 raw manifest 升到当前版本（缺 schema 视为 1）。返回 [升级后的 raw, 走过的版本号列表]。 */
export function migrateManifest(raw: Record<string, unknown>): [Record<string, unknown>, number[]] {
  let v = typeof raw.schema === 'number' ? raw.schema : 1;
  if (v > MANIFEST_SCHEMA) fail(`schema ${v} 比本引擎支持的 ${MANIFEST_SCHEMA} 新——升级引擎，或用旧版工具导出`);
  const steps: number[] = [];
  let cur = raw;
  while (v < MANIFEST_SCHEMA) {
    const m = MANIFEST_MIGRATIONS[v];
    if (!m) fail(`schema ${v} → ${v + 1} 无迁移函数（引擎漏登记）`);
    cur = { ...m(cur), schema: v + 1 };
    steps.push(v);
    v++;
  }
  return [cur, steps];
}

export interface ParseResult {
  blueprint: WorldBlueprint;
  inferredCapabilities: boolean;
  warnings: string[];
}

// 原型链保留名：manifest 用普通对象累积实体/组件（`entities[eid] = …`），若 key 是这些名字，
// 赋值不会产生自有属性，而是去改写原型 → 条目**静默蒸发**（fail-open：游戏少了个实体却零报错，
// 极难定位），同时是原型污染入口（卡带可来自工坊/用户库，不是可信输入）。
// 故 fail-closed：加载期直接报错要求改名——manifest 是 LLM 产出的数据，叫 `__proto__` 必是笔误而非本意，
// 大声拒绝远好过静默吞掉。（engine-review-2026-08-04 §3.3 · P2）
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isUnsafeKey(k: string): boolean {
  return UNSAFE_KEYS.has(k);
}

function fail(msg: string): never {
  throw new Error(`manifest: ${msg}`);
}

export interface ParseOptions {
  /** 资产清单里所有已注册的 key（AssetIndex.assets[].id 等）。提供则对 `assetKey` 字段加载期硬校验（R9 增益 A）。 */
  assetKeys?: ReadonlySet<string>;
}

/** 校验 + 加载规范 manifest → 可运行 WorldBlueprint（带推断/告警信息）。 */
export function parseManifestDetailed(raw: unknown, opts: ParseOptions = {}): ParseResult {
  if (typeof raw !== 'object' || raw === null) fail('根必须是对象');
  if ('schema' in (raw as object) && typeof (raw as Record<string, unknown>).schema !== 'number') fail('schema 必须是数字（manifest 格式版本）');
  const [obj, migrated] = migrateManifest(raw as Record<string, unknown>);

  const ent = obj.entities;
  if (Array.isArray(ent)) fail('entities 是数组——疑似旧生成格式，需先转成 { 实体id: { 组件名: 数据 } } 对象');
  if (typeof ent !== 'object' || ent === null) fail('entities 必须是 { 实体id: { 组件名: 数据 } } 对象');

  const srcEntities = ent as Record<string, unknown>;
  const entities: Record<string, EntityBlueprint> = {};
  for (const [eid, comps] of Object.entries(srcEntities)) {
    if (isUnsafeKey(eid)) fail(`实体 id "${eid}" 是原型链保留名——请改名（禁用：${[...UNSAFE_KEYS].join(' / ')}）`);
    if (typeof comps !== 'object' || comps === null || Array.isArray(comps)) {
      fail(`实体 "${eid}" 必须是 { 组件名: 数据 } 对象`);
    }
    const cleaned: Record<string, unknown> = {};
    for (const [ctype, data] of Object.entries(comps as Record<string, unknown>)) {
      if (isUnsafeKey(ctype)) fail(`实体 "${eid}" 的组件名 "${ctype}" 是原型链保留名——请改名（禁用：${[...UNSAFE_KEYS].join(' / ')}）`);
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        fail(`实体 "${eid}" 的组件 "${ctype}" 必须是对象`);
      }
      // 组件数据里的 type 字段冗余(类型由键决定)，剥掉以免与引擎内部表示打架。
      const { type: _drop, ...rest } = data as Record<string, unknown>;
      cleaned[ctype] = rest;
    }
    entities[eid] = cleaned as EntityBlueprint;
  }

  const warnings: string[] = [];
  if (migrated.length) warnings.push(`manifest 已从 schema ${migrated[0]} 逐级升到 ${MANIFEST_SCHEMA}（走过 ${migrated.join('→')}）`);
  let inferred = false;
  let capIds: string[];
  const rawCaps = obj.capabilities;
  if (rawCaps !== undefined && !Array.isArray(rawCaps)) fail('capabilities 必须是 capability id 字符串数组');
  if (Array.isArray(rawCaps) && rawCaps.length > 0) {
    if (!rawCaps.every((c) => typeof c === 'string')) fail('capabilities 必须全是字符串 id');
    capIds = rawCaps as string[];
  } else {
    capIds = inferCapabilityIds(entities as Record<string, Record<string, unknown>>);
    inferred = true;
    warnings.push(
      `未声明 capabilities，已据组件类型推断 ${capIds.length} 个；仅含"提供组件"的能力，行为类系统(如运动/碰撞)可能需显式补全`,
    );
    // 共用组件（多个能力都提供）→ 推断**刻意不猜**（见 capability-registry AMBIGUOUS_COMPONENTS）。
    // 旧行为是静默判给注册序靠前者，实测能把方块放置游戏装成三消解释器且零报错。
    // 这里逐个点名告警：作者必须显式写 capabilities 才能确定用哪个解释器。
    const used = new Set<string>();
    for (const comps of Object.values(entities)) for (const t of Object.keys(comps)) used.add(t);
    for (const [ctype, providers] of AMBIGUOUS_COMPONENTS) {
      if (!used.has(ctype)) continue;
      warnings.push(
        `组件 "${ctype}" 被多个能力共同提供（${providers.join(' / ')}）——无法从数据反推该用哪个，`
        + `已跳过它的推断。请在 manifest 的 capabilities 里显式声明你要的那个，否则该组件不会被解释。`,
      );
    }
  }

  const capabilities = resolveCapabilities(capIds);

  // 体检：用了某组件却无任何 capability 提供它 → 该组件大概率不被解释（渲染/行为缺失）。
  const provided = new Set<string>();
  for (const c of capabilities) for (const t of Object.keys(c.components?.provides ?? {})) provided.add(t);
  const missing = new Set<string>();
  for (const comps of Object.values(entities)) {
    for (const t of Object.keys(comps)) if (!provided.has(t)) missing.add(t);
  }
  if (missing.size) {
    warnings.push(`这些组件无对应 provider capability（可能不被解释）：${[...missing].join(', ')}`);
  }

  // R12：用各能力声明的 fields 校验组件数据——字段拼错（warning）/ 基元类型不符（error，拒绝加载）。
  const schema = validateComponentData(capabilities, entities);
  for (const w of schema.warnings) warnings.push(formatIssues([w]));
  if (schema.errors.length) fail(`组件数据类型错误（${schema.errors.length} 处）—— ${formatIssues(schema.errors)}`);

  // P0 引用链接器：id 交叉引用体检（信号链 / 全局 id / 模板 / 图内跳转）。全部 warning——
  // id 可在运行时合法出现（prefab 展开 / 代码侧注入），链接器是体检报告，不是闸门。
  for (const w of validateReferences(entities)) warnings.push(formatIssues([w]));

  // R9 增益 A：资产 key 硬校验（opt-in——仅当提供 assetKeys 集合时才查，未知 key 拒绝加载，防 AI 编造）。
  if (opts.assetKeys) {
    const assetErrors = validateAssetRefs(capabilities, entities, opts.assetKeys);
    if (assetErrors.length) fail(`资产引用错误（${assetErrors.length} 处）—— ${formatIssues(assetErrors)}`);
  }

  return { blueprint: { capabilities, entities }, inferredCapabilities: inferred, warnings };
}

/** 便捷版：只取可运行蓝图。 */
export function parseManifest(raw: unknown, opts?: ParseOptions): WorldBlueprint {
  return parseManifestDetailed(raw, opts).blueprint;
}
