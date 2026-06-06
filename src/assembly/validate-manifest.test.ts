import { describe, it, expect } from 'vitest';
import { validateComponentData, formatIssues } from './validate-manifest.js';
import { resourceCapability, flagCapability } from '@atom-skills/index.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';

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

  it('三游戏真实蓝图 → 零类型 error（数据与声明 schema 一致）', () => {
    const games = [
      ['game-a', buildGameABlueprint(LEVEL_SCROLL)],
      ['game-b', buildGameBBlueprint()],
      ['game-c', buildGameCBlueprint()],
    ] as const;
    for (const [name, bp] of games) {
      const r = validateComponentData(bp.capabilities, bp.entities);
      expect(r.errors, `${name}: ${formatIssues(r.errors)}`).toHaveLength(0);
    }
  });
});
