import { describe, expect, it } from 'vitest';
import { validateIK3D } from './ik3d.js';

const target = () => ({ entity: 'future-target', offset: [0, .1, 0] });
const chain = () => ({ kind: 'two-bone', root: 'UpperArm', mid: 'LowerArm', end: 'Hand', target: target(), weight: 1 });
const valid = () => ({ chains: [chain()] });
const lookAt = () => ({ bone: 'Head', target: target(), weight: .5 });

describe('IK3D closed pure data', () => {
  it('accepts frozen raw and typed data by identity without adding defaults or mutating it', () => {
    const raw = Object.freeze({ chains: Object.freeze([Object.freeze(chain())]) });
    const before = JSON.stringify(raw);
    expect(validateIK3D(raw)).toBe(raw); expect(JSON.stringify(raw)).toBe(before); expect(Object.hasOwn(raw, 'type')).toBe(false);
    const typed = { ...valid(), type: 'IK3D' }; expect(validateIK3D(typed)).toBe(typed);
    expect(validateIK3D(Object.assign(Object.create(null), valid())).chains).toHaveLength(1);
  });

  it.each([undefined, null, 3, 'ik', [], new Map(), Object.assign(Object.create({ inherited: true }), valid())])('rejects nonplain root %s', value => {
    expect(() => validateIK3D(value)).toThrow(/IK3D.*plain/);
  });

  it('accepts 1..16 chains and zero chains only with lookAt', () => {
    expect(validateIK3D({ chains: Array.from({ length: 16 }, chain) }).chains).toHaveLength(16);
    expect(validateIK3D({ chains: [], lookAt: lookAt() }).lookAt?.bone).toBe('Head');
    for (const raw of [{}, { chains: [] }, { chains: Array.from({ length: 17 }, chain) }, { chains: null }, { lookAt: lookAt() }])
      expect(() => validateIK3D(raw)).toThrow(/chains/);
  });

  it('rejects array holes, accessor items and extra chain-array fields', () => {
    expect(() => validateIK3D({ chains: new Array(1) })).toThrow(/plain data.*holes/);
    expect(() => validateIK3D({ chains: Object.assign([chain()], { extra: true }) })).toThrow(/unknown array/);
    let calls = 0;
    const chains = Object.defineProperty([chain()], '0', { get() { calls++; return chain(); } });
    expect(() => validateIK3D({ chains })).toThrow(/plain data/); expect(calls).toBe(0);
  });

  it.each(['root', 'mid', 'end'])('requires nonempty bounded %s without normalizing bone names', name => {
    expect(validateIK3D({ chains: [{ ...chain(), [name]: 'x'.repeat(256) }] }).chains).toHaveLength(1);
    for (const value of ['', '   ', null, 4, 'x'.repeat(257)]) expect(() => validateIK3D({ chains: [{ ...chain(), [name]: value }] })).toThrow(new RegExp(name));
  });

  it('requires kind two-bone and distinct root/mid/end', () => {
    for (const kind of [undefined, 'three-bone', 1]) expect(() => validateIK3D({ chains: [{ ...chain(), kind }] })).toThrow(/kind/);
    for (const c of [{ ...chain(), mid: 'UpperArm' }, { ...chain(), end: 'LowerArm' }, { ...chain(), end: 'UpperArm' }])
      expect(() => validateIK3D({ chains: [c] })).toThrow(/distinct/);
  });

  it('requires bounded target entity/bone and lookAt bone strings', () => {
    for (const value of ['', '  ', null, 7, 'x'.repeat(257)]) {
      expect(() => validateIK3D({ chains: [{ ...chain(), target: { ...target(), entity: value } }] })).toThrow(/entity/);
      expect(() => validateIK3D({ chains: [{ ...chain(), target: { ...target(), bone: value } }] })).toThrow(/bone/);
      expect(() => validateIK3D({ chains: [], lookAt: { ...lookAt(), bone: value } })).toThrow(/bone/);
    }
    expect(validateIK3D({ chains: [{ ...chain(), target: { entity: 'x'.repeat(256), bone: 'x'.repeat(256), offset: [0, 0, 0] } }] }).chains).toHaveLength(1);
  });

  it('requires target offsets and finite three-element offsets/poles', () => {
    for (const value of [undefined, null, {}, { 0: 0, 1: 0, 2: 0, length: 3 }, [], [0, 0], [0, 0, 0, 0], [0, '0', 0], [NaN, 0, 0], [0, Infinity, 0], [0, , 0]]) {
      expect(() => validateIK3D({ chains: [{ ...chain(), target: { ...target(), offset: value } }] })).toThrow(/offset/);
      expect(() => validateIK3D({ chains: [{ ...chain(), pole: value }] })).toThrow(/pole/);
      expect(() => validateIK3D({ chains: [], lookAt: { ...lookAt(), target: { ...target(), offset: value } } })).toThrow(/offset/);
    }
    expect(validateIK3D({ chains: [{ ...chain(), pole: [-1, .5, 2] }] }).chains[0].pole).toEqual([-1, .5, 2]);
  });

  it('bounds constant weight to finite 0..1 for chains and lookAt', () => {
    for (const weight of [0, .5, 1]) expect(validateIK3D({ chains: [{ ...chain(), weight }], lookAt: { ...lookAt(), weight } }).lookAt?.weight).toBe(weight);
    for (const weight of [-.01, 1.01, NaN, Infinity, -Infinity, '1', true, null, undefined]) {
      expect(() => validateIK3D({ chains: [{ ...chain(), weight }] })).toThrow(/weight/);
      expect(() => validateIK3D({ chains: [], lookAt: { ...lookAt(), weight } })).toThrow(/weight/);
    }
  });

  it('accepts only a closed param/fade weight binding with bounded finite fade', () => {
    for (const fade of [0, .2, 60]) expect(validateIK3D({ chains: [{ ...chain(), weight: { param: 'grip', fade } }] }).chains[0].weight).toEqual({ param: 'grip', fade });
    for (const fade of [undefined, null, -.01, 60.01, NaN, Infinity, '0']) expect(() => validateIK3D({ chains: [{ ...chain(), weight: { param: 'grip', fade } }] })).toThrow(/fade/);
    for (const param of ['', '  ', null, 3, 'x'.repeat(257)]) expect(() => validateIK3D({ chains: [{ ...chain(), weight: { param, fade: 0 } }] })).toThrow(/param/);
    expect(() => validateIK3D({ chains: [{ ...chain(), weight: { param: 'grip', fade: 0, expression: 'free-code' } }] })).toThrow(/unknown field/);
  });

  it('rejects unknown fields at every closed object and invalid optional lookAt', () => {
    for (const value of [
      { ...valid(), extra: 1 }, { ...valid(), type: 'Attach3D' }, { ...valid(), lookAt: undefined }, { ...valid(), lookAt: null },
      { chains: [{ ...chain(), extra: 1 }] }, { chains: [{ ...chain(), target: { ...target(), extra: 1 } }] },
      { chains: [], lookAt: { ...lookAt(), extra: 1 } }, { chains: [{ ...chain(), target: [] }] },
      { chains: [{ ...chain(), target: { ...target(), offset: Object.assign([0, 0, 0], { extra: 1 }) } }] },
    ]) expect(() => validateIK3D(value)).toThrow(/IK3D/);
  });

  it('rejects nested getters without invoking them', () => {
    let calls = 0;
    const value = Object.defineProperty(target(), 'entity', { get() { calls++; return 'target'; } });
    expect(() => validateIK3D({ chains: [{ ...chain(), target: value }] })).toThrow(/plain data/);
    const offset = Object.defineProperty([0, 0, 0], '1', { get() { calls++; return 0; } });
    expect(() => validateIK3D({ chains: [{ ...chain(), target: { ...target(), offset } }] })).toThrow(/finite/);
    expect(calls).toBe(0);
  });
});
