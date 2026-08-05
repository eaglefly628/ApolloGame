/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { ALL_CAPABILITIES, AMBIGUOUS_COMPONENTS, COMPONENT_PROVIDERS } from './capability-registry.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';

// ═══════════════════════════════════════════════════════════════
//  注册表守护 —— 「每个 src/skills 下的 defineCapability 导出都必须在 ALL_CAPABILITIES」。
//
//  背景：能力对象若被游戏「直传消费」（不走 manifest），漏进注册表也能跑，但 manifest 路线/
//  创作台词汇表(buildCapabilityCatalog) 解析不到它——就是 t2-tray 曾漏注册那种隐性缺口。
//  本测用 Vite 的 import.meta.glob 扫**全部** skill 模块的导出，鸭子判定出 CapabilityDefinition，
//  断言其 id 都已注册。任何人新增一个 defineCapability 却忘了在 capability-registry 登记 → 本测立即红。
// ═══════════════════════════════════════════════════════════════

// 扫 src/skills 下所有源模块（排除测试文件，避免副作用重复注册 describe/it）。
// eager → 直接拿到模块对象；路径相对本测试文件（src/assembly → ../skills）。
const skillModules = import.meta.glob(['../skills/**/*.ts', '!../skills/**/*.test.ts'], {
  eager: true,
});

// 鸭子判定：defineCapability 的产物形状（id/version/describe/components/systems）。
// 这套形状只有 defineCapability 会产出，skills 里的纯函数/常量导出都不匹配。
function isCapability(v: unknown): v is CapabilityDefinition {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.version === 'string' &&
    typeof o.describe === 'object' &&
    o.describe !== null &&
    typeof o.components === 'object' &&
    o.components !== null &&
    Array.isArray(o.systems)
  );
}

const discovered: { id: string; path: string }[] = [];
for (const [path, mod] of Object.entries(skillModules)) {
  for (const val of Object.values(mod as Record<string, unknown>)) {
    if (isCapability(val)) discovered.push({ id: val.id, path });
  }
}

const registeredIds = new Set(ALL_CAPABILITIES.map((c) => c.id));

describe('capability-registry 守护 — src/skills 全部 defineCapability 必须注册', () => {
  it('glob 真扫到了 skills 能力（防路径写错时空跑=假绿）', () => {
    // 现有 ~80 个 defineCapability；随能力增长只会更多。低于此下限=glob 没匹配到，测试形同虚设。
    expect(discovered.length).toBeGreaterThan(70);
  });

  it('每个 defineCapability 导出的 id 都在 ALL_CAPABILITIES', () => {
    const missing = discovered.filter((d) => !registeredIds.has(d.id));
    // 失败信息直接点名漏注册的 id + 所在文件，便于一眼补登记。
    expect(missing).toEqual([]);
  });
});

// ── 共用组件不变量守卫（engine-review-2026-08-04 §3.3 · owner 2026-08-05 拍板）──────────
// 一个组件被多个能力共同提供（如 BoardCell 被 match3-board / block-grid 共用同一视图格接口）
// 是**允许**的，但**前提是各提供者声明的字段结构完全一致**——否则「按 A 的规格校验数据、
// 却按 B 的语义解释」就会发生，且全程零报错。本守卫把这条前提钉死：谁让它们分叉就转红。
describe('共用组件（多 provider）必须各家字段结构一致', () => {
  it('每个共用组件的所有提供者声明同一份 fields', () => {
    const byComponent = new Map<string, Array<{ capId: string; fields: string }>>();
    for (const cap of ALL_CAPABILITIES) {
      for (const [ctype, schema] of Object.entries(cap.components?.provides ?? {})) {
        // 按字段名排序后序列化 → 与书写顺序无关，只比"结构是否相同"
        const f = schema.fields ?? {};
        const norm = JSON.stringify(Object.keys(f).sort().map((k) => [k, (f as Record<string, { type?: string }>)[k]?.type]));
        const list = byComponent.get(ctype) ?? [];
        list.push({ capId: cap.id, fields: norm });
        byComponent.set(ctype, list);
      }
    }
    const diverged: string[] = [];
    for (const [ctype, providers] of byComponent) {
      if (providers.length < 2) continue;
      const uniq = new Set(providers.map((p) => p.fields));
      if (uniq.size > 1) {
        diverged.push(`${ctype}：${providers.map((p) => p.capId).join(' / ')} 声明的字段结构不一致`);
      }
    }
    expect(diverged).toEqual([]);
  });

  it('AMBIGUOUS_COMPONENTS 如实列出全部共用组件，且不入单一提供者表', () => {
    for (const [ctype, providers] of AMBIGUOUS_COMPONENTS) {
      expect(providers.length).toBeGreaterThan(1);
      // 共用组件刻意不进 COMPONENT_PROVIDERS（推断不猜），否则又会静默判给某一家
      expect(COMPONENT_PROVIDERS.has(ctype)).toBe(false);
    }
  });
});

