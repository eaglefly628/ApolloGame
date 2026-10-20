import { describe, expect, it } from 'vitest';
import { validateAnimGraph3D } from './anim-graph.js';

const graph = () => ({
  type: 'AnimGraph3D',
  clips: { idle: { asset: 'motion/idle', clip: 'idle' }, walk: { clip: 'walk', speed: 1, loop: true } },
  states: { idle: { clip: 'idle' }, move: { blend: { param: 'move', points: [{ at: 0, clip: 'idle' }, { at: .1, clip: 'walk' }] } } },
  transitions: [{ from: 'idle', to: 'move', whenParam: 'move', cmp: 'gt', value: 0, fade: .2 }],
  params: { move: 'speed', ready: 'flag:ready', mode: 'state:gameplay' },
});
describe('AnimGraph3D closed data contract', () => {
  it('accepts external/internal clips, numeric blend and typed transitions without mutation', () => {
    const data = graph(), before = structuredClone(data);
    expect(validateAnimGraph3D(data)).toBe(data); expect(data).toEqual(before);
    expect(validateAnimGraph3D({ ...data, type: undefined })).toMatchObject({ clips: data.clips });
  });
  it('rejects unknown parameter sources even when no blend or transition consumes them', () => {
    const data = { clips: { idle: { clip: 'idle' } }, states: { idle: { clip: 'idle' } }, transitions: [], params: { unused: 'js:anything' } };
    expect(() => validateAnimGraph3D(data)).toThrow(/source must be speed/);
  });
  it('accepts flag/state equality but never free expressions or cross-type comparisons', () => {
    const data = graph();
    expect(() => validateAnimGraph3D({ ...data, transitions: [{ from: 'idle', to: 'move', whenParam: 'ready', cmp: 'eq', value: true, fade: 0 }, { from: 'move', to: 'idle', whenParam: 'mode', cmp: 'ne', value: 'playing', fade: 60 }] })).not.toThrow();
  });
  it.each([
    ['unknown code', (d: ReturnType<typeof graph>) => ({ ...d, expression: 'speed > 0' }), /unknown field/],
    ['wrong type', (d: ReturnType<typeof graph>) => ({ ...d, type: 'Anim3D' }), /type/],
    ['empty clips', (d: ReturnType<typeof graph>) => ({ ...d, clips: {} }), /1..64/],
    ['bad alias', (d: ReturnType<typeof graph>) => ({ ...d, clips: { 'speed()': { clip: 'idle' } } }), /stable alias/],
    ['clip name missing', (d: ReturnType<typeof graph>) => ({ ...d, clips: { idle: {} } }), /clip/],
    ['negative clip speed', (d: ReturnType<typeof graph>) => ({ ...d, clips: { ...d.clips, idle: { clip: 'idle', speed: -1 } } }), /speed/],
    ['infinite speed', (d: ReturnType<typeof graph>) => ({ ...d, clips: { ...d.clips, idle: { clip: 'idle', speed: Infinity } } }), /finite/],
    ['wrong loop', (d: ReturnType<typeof graph>) => ({ ...d, clips: { ...d.clips, idle: { clip: 'idle', loop: 'true' } } }), /boolean/],
    ['arbitrary source', (d: ReturnType<typeof graph>) => ({ ...d, params: { move: 'js:Velocity.vx' } }), /source/],
    ['missing source id', (d: ReturnType<typeof graph>) => ({ ...d, params: { move: 'flag:' } }), /source/],
    ['unknown state member', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { clip: 'idle', callback: 'bad' } } }), /unknown/],
    ['ambiguous state', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { clip: 'idle', blend: d.states.move.blend } } }), /exactly one/],
    ['empty state', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: {} } }), /exactly one/],
    ['missing clip alias', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { clip: 'invented' } } }), /missing alias/],
    ['blend missing param', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { blend: { ...d.states.move.blend, param: 'missing' } } } }), /missing alias/],
    ['blend boolean coercion', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { blend: { ...d.states.move.blend, param: 'ready' } } } }), /numeric/],
    ['single blend point', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { blend: { param: 'move', points: [{ at: 0, clip: 'idle' }] } } } }), /2..64/],
    ['duplicate blend at', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { blend: { param: 'move', points: [{ at: 0, clip: 'idle' }, { at: 0, clip: 'walk' }] } } } }), /increasing/],
    ['nonfinite at', (d: ReturnType<typeof graph>) => ({ ...d, states: { idle: { blend: { param: 'move', points: [{ at: NaN, clip: 'idle' }, { at: 1, clip: 'walk' }] } } } }), /finite/],
    ['transition bad state', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], to: 'missing' }] }), /missing alias/],
    ['transition bad param', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], whenParam: 'missing' }] }), /missing alias/],
    ['invalid cmp', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], cmp: 'evaluate' }] }), /cmp/],
    ['boolean order cmp', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], whenParam: 'ready', value: true }] }), /eq\/ne/],
    ['boolean numeric value', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], whenParam: 'ready', cmp: 'eq', value: 0 }] }), /source type/],
    ['state boolean value', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], whenParam: 'mode', cmp: 'eq', value: true }] }), /source type/],
    ['speed string value', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], value: '0.1' }] }), /finite/],
    ['negative fade', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], fade: -.1 }] }), /fade/],
    ['too long fade', (d: ReturnType<typeof graph>) => ({ ...d, transitions: [{ ...d.transitions[0], fade: 61 }] }), /fade/],
    ['not array transitions', (d: ReturnType<typeof graph>) => ({ ...d, transitions: {} }), /array/],
  ])('rejects %s', (_name, mutate, pattern) => { expect(() => validateAnimGraph3D(mutate(graph()))).toThrow(pattern); });
  it('bounds authoring sizes before renderer allocates actions or mixes states', () => {
    const data = graph();
    expect(() => validateAnimGraph3D({ ...data, params: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`p${i}`, 'speed'])) })).toThrow(/1..64/);
    expect(() => validateAnimGraph3D({ ...data, transitions: Array.from({ length: 257 }, () => data.transitions[0]) })).toThrow(/max256/);
  });
});
