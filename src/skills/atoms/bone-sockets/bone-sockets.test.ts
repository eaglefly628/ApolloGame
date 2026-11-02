import { describe, expect, it } from 'vitest';
import type { ComponentDef } from '@engine/core/define-component.js';
import { boneSocketsCapability } from './index.js';

describe('bone socket capability boundary', () => {
  const component = boneSocketsCapability.components.provides.BoneSockets3D as ComponentDef;
  const hand = { bone: 'LeftHand', frame: 'humanoid-hand-v1', side: 'left', offset: [0, 0, 0], rotation: [0, 0, 0] };

  it('provides render-only validation without simulation systems or writes', () => {
    expect(component.sim).toBe(false);
    expect(boneSocketsCapability.systems).toEqual([]);
    expect(boneSocketsCapability.components.writes).toEqual([]);
    expect(component.refine!({ version: 1, sockets: { grip: hand } })).toEqual([]);
  });

  it.each([
    { ...hand, bone: 'RightHand' },
    { ...hand, frame: 'world' },
    { ...hand, offset: [0, 0] },
    { ...hand, target: 'unowned' },
  ])('rejects malformed grip authoring through the provider refine hook', grip => {
    const issues = component.refine!({ version: 1, sockets: { grip } });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
  });
});
