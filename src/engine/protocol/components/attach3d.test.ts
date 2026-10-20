import { describe, expect, it } from 'vitest';
import { validateAttach3D } from './attach3d.js';

const valid = () => ({ parentId: 'actor', bone: 'RightHand', offset: [0, .1, -.2], rot: [.5, 0, 1] });

describe('Attach3D closed pure data', () => {
  it('accepts raw and typed frozen input by identity without adding fields or normalizing values', () => {
    const raw = Object.freeze({ parentId: ' actor ', bone: 'Right Hand', offset: Object.freeze([0, .1, -.2]), rot: Object.freeze([.5, 0, 1]) });
    const before = JSON.stringify(raw);
    expect(validateAttach3D(raw)).toBe(raw); expect(JSON.stringify(raw)).toBe(before);
    expect(Object.hasOwn(raw, 'type')).toBe(false);
    const typed = { ...valid(), type: 'Attach3D' };
    expect(validateAttach3D(typed)).toBe(typed);
    expect(validateAttach3D(Object.assign(Object.create(null), valid())).parentId).toBe('actor');
  });

  it.each([undefined, null, 1, 'attachment', false, [], new Date(0), Object.assign(Object.create({ inherited: true }), valid())])('rejects a nonplain component %s', value => {
    expect(() => validateAttach3D(value)).toThrow(/Attach3D.*plain/);
  });

  it.each(['parentId', 'bone', 'offset', 'rot'])('requires %s', field => {
    const raw: Record<string, unknown> = valid(); delete raw[field];
    expect(() => validateAttach3D(raw)).toThrow(new RegExp(field));
  });

  it.each(['parentId', 'bone'] as const)('bounds %s without trimming it', field => {
    expect(validateAttach3D({ ...valid(), [field]: 'x'.repeat(256) })[field]).toHaveLength(256);
    for (const value of ['', '   ', null, 7, 'x'.repeat(257)]) expect(() => validateAttach3D({ ...valid(), [field]: value })).toThrow(new RegExp(field));
  });

  it.each(['offset', 'rot'])('requires exactly three finite primitive numbers in %s', field => {
    for (const value of [null, {}, { 0: 0, 1: 0, 2: 0, length: 3 }, [], [0], [0, 1], [0, 1, 2, 3], [0, '1', 0], [0, true, 0], [NaN, 0, 0], [0, Infinity, 0], [0, 0, -Infinity], [0, , 0]])
      expect(() => validateAttach3D({ ...valid(), [field]: value })).toThrow(new RegExp(field));
  });

  it('rejects wrong discriminators, unknown fields and extra tuple properties', () => {
    expect(() => validateAttach3D({ ...valid(), type: 'Model3D' })).toThrow(/type/);
    expect(() => validateAttach3D({ ...valid(), scale: 1 })).toThrow(/unknown field scale/);
    expect(() => validateAttach3D({ ...valid(), [Symbol('extra')]: 1 })).toThrow(/unknown field/);
    expect(() => validateAttach3D({ ...valid(), offset: Object.assign([0, 0, 0], { extra: 1 }) })).toThrow(/unknown tuple/);
  });

  it('rejects component and tuple accessors without invoking arbitrary code', () => {
    let calls = 0;
    const raw = Object.defineProperty(valid(), 'bone', { get() { calls++; return 'RightHand'; }, enumerable: true });
    expect(() => validateAttach3D(raw)).toThrow(/plain data/);
    const offset = Object.defineProperty([0, 0, 0], '0', { get() { calls++; return 0; }, enumerable: true });
    expect(() => validateAttach3D({ ...valid(), offset })).toThrow(/finite/);
    expect(calls).toBe(0);
  });
});
