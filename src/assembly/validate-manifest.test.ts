import { describe, it, expect } from 'vitest';
import { validateComponentData, validateAssetRefs, formatIssues } from './validate-manifest.js';
import { parseManifest } from './manifest.js';
import { resourceCapability, flagCapability, spriteCapability, soundCapability } from '@atom-skills/index.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { buildGameFBlueprint } from '@games/game-f/index.js';

const ent = (comps: Record<string, Record<string, unknown>>): Record<string, EntityBlueprint> =>
  comps as unknown as Record<string, EntityBlueprint>;

describe('R12 组件数据 schema 校验（复用 provides.fields，不另造）', () => {
  it('合法 Resource → 零 error 零 warning', () => {
    const r = validateComponentData([resourceCapability], ent({ hp: { Resource: { id: 'hp', current: 10, min: 0, max: 100 } } }));
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('字段名拼错（currrent）→ warning（疑似拼错），非 error', () => {
    const r = validateComponentData([resourceCapability], ent({ hp: { Resource: { id: 'hp', currrent: 10, min: 0, max: 100 } } }));
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].field).toBe('currrent');
  });

  it('number 字段给了 string → error（会坏模拟）', () => {
    const r = validateComponentData([resourceCapability], ent({ hp: { Resource: { id: 'hp', current: '10', min: 0, max: 100 } } }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].field).toBe('current');
    expect(r.errors[0].message).toMatch(/应为 number/);
  });

  it('boolean 字段给了 number → error', () => {
    const r = validateComponentData([flagCapability], ent({ f: { Flag: { id: 'f', active: 1 } } }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].field).toBe('active');
  });

  it('无 provider 的组件 → 跳过字段校验（结构层另有告警，此处不误报）', () => {
    const r = validateComponentData([resourceCapability], ent({ x: { Nonexistent: { whatever: 1 } } }));
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('type 判别式键被忽略（不当作未知字段）', () => {
    const r = validateComponentData([resourceCapability], ent({ hp: { Resource: { type: 'Resource', id: 'hp', current: 1, min: 0, max: 2 } } }));
    expect(r.warnings).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  it('真实蓝图 → 零类型 error（数据与声明 schema 一致）', () => {
    const games = [
      ['game-f', buildGameFBlueprint()],
    ] as const;
    for (const [name, bp] of games) {
      const r = validateComponentData(bp.capabilities, bp.entities);
      expect(r.errors, `${name}: ${formatIssues(r.errors)}`).toHaveLength(0);
    }
  });
});

describe('R9 增益 A — 资产 key 硬校验（assetKey 字段对清单）', () => {
  const caps = [spriteCapability, soundCapability];
  const keys = new Set(['hero_idle', 'snd_coin']);

  it('引用清单中存在的 key → 通过', () => {
    const errs = validateAssetRefs(caps, ent({
      h: { Sprite: { textureKey: 'hero_idle', anchorX: 0.5, anchorY: 0.5, zOrder: 0 } },
      c: { Sound: { clipId: 'snd_coin', volume: 1, loop: false } },
    }), keys);
    expect(errs).toHaveLength(0);
  });

  it('引用清单中不存在的 key（AI 编造）→ error', () => {
    const errs = validateAssetRefs(caps, ent({
      h: { Sprite: { textureKey: 'hero_FABRICATED', anchorX: 0.5, anchorY: 0.5, zOrder: 0 } },
    }), keys);
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe('textureKey');
    expect(errs[0].message).toMatch(/不存在的资产 key/);
  });

  it('非 assetKey 字段不受影响（zOrder 等数值字段不查清单）', () => {
    const errs = validateAssetRefs(caps, ent({
      h: { Sprite: { textureKey: 'hero_idle', anchorX: 0.5, anchorY: 0.5, zOrder: 999 } },
    }), keys);
    expect(errs).toHaveLength(0);
  });

  it('parseManifest 提供 assetKeys → 未知 key 拒绝加载（opt-in 硬校验）', () => {
    // entities-only：能力由组件类型推断（含 sprite），免猜 capability id。
    const manifest = {
      entities: { h: { Sprite: { textureKey: 'ghost', anchorX: 0.5, anchorY: 0.5, zOrder: 0 } } },
    };
    // 不提供 assetKeys：放行（opt-in）。
    expect(() => parseManifest(manifest)).not.toThrow();
    // 提供 assetKeys 且不含 'ghost'：拒绝。
    expect(() => parseManifest(manifest, { assetKeys: new Set(['hero_idle']) })).toThrow(/资产引用错误|不存在的资产 key/);
  });
});
