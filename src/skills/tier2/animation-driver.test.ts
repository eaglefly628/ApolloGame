import { describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import { Engine } from '@runtime/engine.js';
import { hashSnapshot } from '@net/determinism.js';
import { animationDriverCapability } from './animation-driver.js';
import { createAnimationDriver } from '@engine/animation/driver.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D, AnimationDriverCommand3D } from '@engine/protocol/components/animation-driver.js';
import { parseManifest } from '@assembly/manifest.js';
import { parseManifestAsync } from '@assembly/manifest-async.js';
import { validateComponentData, validateAssetRefs } from '@assembly/validate-manifest.js';
import { collectAssetRefs } from '@assembly/derive-asset-index.js';
import { validateAnimationDrivers } from '@assembly/animation-drivers.js';
import type { EntityBlueprint } from '@assembly/demo.assembly.js';

function config(): AnimationDriver3D {
  return { type: 'AnimationDriver3D', version: 1, tickRate: 60, initialState: 'idle',
    graph: { type: 'AnimGraph3D', clips: { idle: { asset: 'motion/idle', clip: 'idle', loop: true }, attack: { asset: 'motion/attack', clip: 'attack', loop: false } },
      states: { idle: { clip: 'idle' }, attack: { clip: 'attack' } }, transitions: [{ from: 'idle', to: 'attack', whenParam: 'attack', cmp: 'eq', value: true, fade: 0 }], params: { attack: 'flag:attacking' } },
    clips: { idle: { durationTicks: 4, notifies: [{ id: 'foot', atTick: 2 }] }, attack: { durationTicks: 3, notifies: [{ id: 'strike', atTick: 1 }] } } };
}
function world(id = 'actor'): World {
  const w = new World(); for (const s of animationDriverCapability.systems) w.addSystem(s);
  w.createEntity(id); w.addComponent(id, { type: 'Model3D', modelKey: 'hero' }); w.addComponent(id, config()); return w;
}
const playback = (w: World, id = 'actor') => w.getComponent<AnimationDriverPlayback3D>(id, 'AnimationDriverPlayback3D')!;
const entities = () => ({ hero: { Model3D: { modelKey: 'hero' }, AnimationDriver3D: config() } });
const cast = (e: Record<string,unknown>) => e as Record<string,EntityBlueprint>;
const command = (seq: number, op: 'pause'|'resume') => ({ type: 'AnimationDriverCommand3D', version: 1, commands: [{ seq, op }] }) as AnimationDriverCommand3D;

describe('M3.5 D1 world integration', () => {
  it('actually advances through a registered fixed-tick system without a renderer', () => {
    const w = world(); expect(playback(w)).toBeUndefined();
    w.tick(); const p = playback(w); expect(p.tick).toBe(1); expect(p.clips.idle.cursorSubticks).toBe(1000);
    w.tick(); expect(playback(w).clips.idle.cursorSubticks).toBe(2000); expect(playback(w).events.some(e => e.notifyId === 'foot')).toBe(true);
  });
  it('uses explicit false/missing flags differently and re-enters a single action from time zero', () => {
    const w = world(); w.tick(); expect(playback(w).state).toBe('idle');
    w.createEntity('flag'); w.addComponent('flag', { type: 'Flag', id: 'attacking', active: true }); w.tick(); expect(playback(w).state).toBe('attack');
    const instance = playback(w).clips.attack.instance; w.tick();
    w.addComponent('actor', { type: 'AnimationDriverCommand3D', version: 1, commands: [{ seq: 1, op: 'play', state: 'attack' }] } as AnimationDriverCommand3D);
    w.tick(); expect(playback(w).clips.attack.instance).toBeGreaterThan(instance); expect(playback(w).clips.attack.cursorSubticks).toBe(0);
  });
  it('samples deterministic planar speed and preserves the previous blend target on nonfinite magnitude', () => {
    const w = world(), c = JSON.parse(JSON.stringify(config()));
    c.graph.params = { speed: 'speed' }; c.graph.transitions = [];
    c.graph.states = { idle: { blend: { param: 'speed', points: [{ at: 0, clip: 'idle' }, { at: 5, clip: 'attack' }] } } };
    w.addComponent('actor', c); w.addComponent('actor', { type: 'Velocity', vx: 3, vy: 4, angular: 0 }); w.tick();
    expect(playback(w).weights.attack).toBe(1);
    w.addComponent('actor', { type: 'Velocity', vx: 1e308, vy: 1e308, angular: 0 }); w.tick();
    expect(playback(w).weights.attack).toBe(1);
  });
  it('pauses only animation cursors and consumes a command sequence once', () => {
    const w = world(); w.tick(); w.addComponent('actor', command(1, 'pause')); w.tick(); const c = playback(w).clips.idle.cursorSubticks;
    w.tick(); expect(playback(w).clips.idle.cursorSubticks).toBe(c); expect(playback(w).events).toEqual([]);
    w.addComponent('actor', command(2, 'resume')); w.tick(); expect(playback(w).clips.idle.cursorSubticks).toBeGreaterThan(c);
  });
  it('restores a JSON snapshot mid-loop and reproduces state, instance, events and hash despite World.version advancing', () => {
    const w = world('10'); for (let i = 0; i < 9; i++) w.tick();
    const saved = JSON.parse(JSON.stringify(w.snapshot())), order = w.snapshotOrder();
    const expected: Array<unknown> = []; for (let i = 0; i < 30; i++) { w.tick(); expected.push({ snapshot: w.snapshot(), hash: hashSnapshot(w.snapshot()) }); }
    w.restore(saved, order);
    for (let i = 0; i < 30; i++) { w.tick(); expect({ snapshot: w.snapshot(), hash: hashSnapshot(w.snapshot()) }).toEqual(expected[i]); }
  });
  it('makes new configuration and playback hash-sensitive while retaining legacy render-only exclusion', () => {
    const w = world(); w.tick(); const before = hashSnapshot(w.snapshot());
    const saved = w.snapshot(); const changed = JSON.parse(JSON.stringify(saved)); changed.actor.AnimationDriverPlayback3D.tick++;
    expect(hashSnapshot(changed)).not.toBe(before);
    const changedConfig = JSON.parse(JSON.stringify(saved)); changedConfig.actor.AnimationDriver3D.initialState = 'attack'; expect(hashSnapshot(changedConfig)).not.toBe(before);
    const old = JSON.parse(JSON.stringify(saved)); old.actor.AnimGraph3D = { arbitrary: 'render only' }; expect(hashSnapshot(old)).toBe(before);
  });
  it('stages the entire actor batch before commits and leaves original snapshots intact on malformed raw data', () => {
    const w = world('a'); w.createEntity('z'); w.addComponent('z', { ...config(), tickRate: NaN });
    const before = w.snapshot(); expect(() => w.tick()).toThrow(); expect(w.snapshot()).toEqual(before);
  });
  it('never lets excluded presentation components affect authoritative simulation advancement', () => {
    const a = world(), b = world();
    b.removeComponent('actor', 'Model3D'); b.addComponent('actor', { type: 'AnimState3D', clip: 'legacy' });
    for (let i = 0; i < 12; i++) { a.tick(); b.tick(); expect(playback(a)).toEqual(playback(b)); expect(hashSnapshot(a.snapshot())).toBe(hashSnapshot(b.snapshot())); }
  });
});

describe('M3.5 authoring and atomic load boundary', () => {
  it('validates raw blueprint data and infers the actual capability through sync and async manifests', async () => {
    const source = { entities: entities() };
    const sync = parseManifest(source), async = await parseManifestAsync(source);
    expect(sync.capabilities.map(c => c.id)).toContain('t2-animation-driver'); expect(async.capabilities.map(c => c.id)).toContain('t2-animation-driver');
    const engine = new Engine(); engine.load(sync); engine.world.tick(); expect(engine.world.hasComponent('hero', 'AnimationDriverPlayback3D')).toBe(true);
  });
  it('validates components without relying on a provider, and sees nested external animation assets', () => {
    expect(validateComponentData([], cast(entities())).errors).toEqual([]);
    const invalid = JSON.parse(JSON.stringify(entities())); invalid.hero.AnimationDriver3D.clips.idle.durationTicks = NaN;
    expect(validateComponentData([], cast(invalid)).errors.length).toBeGreaterThan(0);
    expect(validateAssetRefs([], cast(entities()), new Set(['hero']))).toHaveLength(2);
    expect(collectAssetRefs([], cast(entities())).map(r => [r.key, r.assetType])).toEqual([['motion/idle','animation'],['motion/attack','animation']]);
  });
  it.each(['AnimGraph3D','AnimState3D'])('rejects %s ownership conflict before mutating Engine state or tick rate', field => {
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept'); const snapshot = engine.world.snapshot();
    const add = vi.spyOn(engine.world, 'addSystem'); const e = { hero: { ...entities().hero, [field]: {} } };
    expect(() => engine.load({ entities: cast(e), capabilities: [animationDriverCapability], meta: { tickRate: 60 } })).toThrow(/exclusive/);
    expect(engine.tickRate).toBe(30); expect(engine.world.snapshot()).toEqual(snapshot); expect(add).not.toHaveBeenCalled();
  });
  it('requires the capability and matching Engine tick rate, including a later load changing existing clocks', () => {
    const engine = new Engine({ tickRate: 30 });
    expect(() => engine.load({ entities: cast(entities()), capabilities: [animationDriverCapability] })).toThrow(/tickRate/);
    const good = new Engine(); expect(() => good.load({ entities: cast(entities()), capabilities: [] })).toThrow(/requires t2-animation-driver/);
    good.load({ entities: cast(entities()), capabilities: [animationDriverCapability] });
    expect(() => good.load({ entities: {}, capabilities: [], meta: { tickRate: 30 } })).toThrow(/tickRate/);
    expect(good.tickRate).toBe(60);
  });
  it('reuses the driver system across additive loads instead of double-advancing prior actors', () => {
    const engine = new Engine(); engine.load({ entities: cast(entities()), capabilities: [animationDriverCapability] }); engine.world.tick();
    const tick = playback(engine.world, 'hero').tick;
    engine.load({ entities: cast({ second: entities().hero }), capabilities: [animationDriverCapability] });
    engine.world.tick(); expect(playback(engine.world, 'hero').tick).toBe(tick + 1); expect(playback(engine.world, 'second').tick).toBe(1);
  });
  it('installs the driver once even when a single blueprint repeats its capability', () => {
    const engine = new Engine(); engine.load({ entities: cast(entities()), capabilities: [animationDriverCapability, animationDriverCapability] });
    engine.world.tick(); expect(playback(engine.world, 'hero').tick).toBe(1);
  });
  it('validates playback identity and command references atomically', () => {
    const c = config(), p = createAnimationDriver(c), e = { hero: { Model3D: { modelKey: 'hero' }, AnimationDriver3D: c, AnimationDriverPlayback3D: p } };
    validateAnimationDrivers(e); const invalid = JSON.parse(JSON.stringify(e)); invalid.hero.AnimationDriverPlayback3D.configIdentity.canonical += 'tampered'; expect(() => validateAnimationDrivers(invalid)).toThrow(/identity/);
    expect(() => validateAnimationDrivers({ hero: { AnimationDriverCommand3D: command(1,'pause') } })).toThrow(/same-entity/);
  });
});
