import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { IKTarget } from '@engine/protocol/components.js';
import { createIKTargetResolver } from './ik-targets.js';
import type { Pose3D } from '../three-projection.js';

function fixture() {
  const world = new World(), models = new Map<string, THREE.Object3D>(), drawables = new Map<string, THREE.Object3D>();
  const poses = new Map<string, Pose3D>(), hidden = new Set<string>();
  const resolve = createIKTargetResolver(world, models, drawables, poses, () => hidden);
  return { world, models, drawables, poses, hidden, resolve };
}
const target = (entity: string, bone?: string): IKTarget => ({ entity, ...(bone ? { bone } : {}), offset: [.1, .2, -.3] });
const transform = { type: 'Transform3D' as const, x: 3, y: 4, z: 5, rotX: .3, rotY: -.7, scaleX: 2, scaleY: .5, scaleZ: 3 };

describe('IK target render matrices', () => {
  it('resolves a nondraw Transform3D point with rotated nonuniform local offset without dirtying sim', () => {
    const f = fixture(); f.world.createEntity('point'); f.world.addComponent('point', transform); f.world.drainDirty();
    const before = f.world.snapshot(), hash = hashSnapshot(before), sequence = f.world.writeSequence;
    const object = new THREE.Object3D(); object.position.set(3, 4, 5); object.rotation.set(.3, -.7, 0); object.scale.set(2, .5, 3); object.updateMatrix();
    const expected = new THREE.Vector3(...target('point').offset).applyMatrix4(object.matrix);
    for (let i = 0; i < 100; i++) expect(f.resolve(target('point'))!.position.distanceTo(expected)).toBeLessThan(1e-12);
    expect(f.world.snapshot()).toEqual(before); expect(hashSnapshot(f.world.snapshot())).toBe(hash);
    expect(f.world.writeSequence).toBe(sequence); expect(f.world.drainDirty()).toEqual([]);
  });

  it('uses actual drawable affine shear rather than decomposing or stale base data', () => {
    const f = fixture(), object = new THREE.Object3D(); f.world.createEntity('prop'); f.world.addComponent('prop', transform);
    object.matrixAutoUpdate = false; object.matrix.set(1, .4, 0, 7, 0, 2, .3, 8, 0, 0, .5, 9, 0, 0, 0, 1);
    f.drawables.set('prop', object);
    const resolved = f.resolve(target('prop'))!;
    expect(resolved.position.toArray()).toEqual(new THREE.Vector3(...target('prop').offset).applyMatrix4(object.matrix).toArray());
    expect(resolved.dependencies).toEqual([object]);
  });

  it('resolves instanced meshes from their current final Pose3D', () => {
    const f = fixture(); f.poses.set('batch', { x: 4, y: 5, z: 6, sx: 2, sy: 3, sz: 4, rotZ: 0 });
    expect(f.resolve(target('batch'))!.position.toArray()).toEqual([4.2, 5.6, 4.8]);
  });

  it('requires a unique visible actual Bone and returns that dependency', () => {
    const f = fixture(), model = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'Hand'; bone.position.y = 2; model.add(bone); f.models.set('actor', model);
    expect(f.resolve(target('actor', 'Hand'))!.position.toArray()).toEqual([.1, 2.2, -.3]);
    expect(f.resolve(target('actor', 'Hand'))!.dependencies).toEqual([bone]);
    const duplicate = new THREE.Bone(); duplicate.name = 'Hand'; model.add(duplicate);
    expect(f.resolve(target('actor', 'Hand'))).toBeUndefined(); model.remove(duplicate);
    bone.visible = false; expect(f.resolve(target('actor', 'Hand'))).toBeUndefined();
    bone.visible = true; expect(f.resolve(target('actor', 'absent'))).toBeUndefined();
  });

  it('never falls back to obsolete Transform3D for missing models or attachments', () => {
    const f = fixture();
    for (const id of ['model', 'prop']) { f.world.createEntity(id); f.world.addComponent(id, transform); }
    f.world.addComponent('model', { type: 'Model3D', modelKey: 'missing' });
    f.world.addComponent('prop', { type: 'Attach3D', parentId: 'model', bone: 'Hand', offset: [0, 0, 0], rot: [0, 0, 0] });
    expect(f.resolve(target('model'))).toBeUndefined(); expect(f.resolve(target('prop'))).toBeUndefined();
    f.drawables.set('prop', new THREE.Object3D()); f.hidden.add('prop'); expect(f.resolve(target('prop'))).toBeUndefined();
  });

  it('honors world Visibility on nondraw point anchors and recovers when shown', () => {
    const f = fixture(); f.world.createEntity('point'); f.world.addComponent('point', transform);
    f.world.addComponent('point', { type: 'Visibility', visible: false, active: true }); f.world.drainDirty();
    expect(f.resolve(target('point'))).toBeUndefined(); expect(f.world.drainDirty()).toEqual([]);
    f.world.addComponent('point', { type: 'Visibility', visible: true, active: true });
    expect(f.resolve(target('point'))).toBeDefined();
    f.drawables.set('point', new THREE.Object3D()); f.world.addComponent('point', { type: 'Visibility', visible: false, active: true });
    expect(f.resolve(target('point'))).toBeUndefined();
  });

  it('tracks transitive attachment Bone dependencies despite E3 not reparenting', () => {
    const f = fixture(), actor = new THREE.Group(), hand = new THREE.Bone(), kettle = new THREE.Group(), grip = new THREE.Bone();
    hand.name = 'Hand'; grip.name = 'Grip'; actor.add(hand); kettle.add(grip);
    f.models.set('actor', actor); f.models.set('kettle', kettle); f.drawables.set('point', new THREE.Object3D());
    for (const [id, parentId, bone] of [['kettle', 'actor', 'Hand'], ['point', 'kettle', 'Grip']]) {
      f.world.createEntity(id); f.world.addComponent(id, { type: 'Attach3D', parentId, bone, offset: [0, 0, 0], rot: [0, 0, 0] });
    }
    expect(f.resolve(target('point'))!.dependencies).toEqual([f.drawables.get('point'), grip, hand]);
    f.hidden.add('kettle'); expect(f.resolve(target('point'))).toBeUndefined(); f.hidden.clear();
    f.models.delete('actor'); expect(f.resolve(target('point'))).toBeUndefined(); f.models.set('actor', actor);
    hand.name = 'other'; expect(f.resolve(target('point'))!.dependencies.at(-1)).toBe(actor); // E3 root fallback.
    f.world.addComponent('kettle', { type: 'Attach3D', parentId: 'kettle', bone: 'Grip', offset: [0, 0, 0], rot: [0, 0, 0] });
    expect(f.resolve(target('point'))).toBeUndefined();
  });

  it('rejects a hidden native ancestor even if the target itself is visible', () => {
    const f = fixture(), parent = new THREE.Group(), child = new THREE.Object3D(); parent.add(child); f.drawables.set('point', child);
    parent.visible = false; expect(f.resolve(target('point'))).toBeUndefined();
    parent.visible = true; expect(f.resolve(target('point'))).toBeDefined();
  });

  it.each([NaN, Infinity])('rejects nonfinite matrices and overflowed transformed points %s', value => {
    const f = fixture(), object = new THREE.Object3D(); object.matrixAutoUpdate = false; object.matrix.elements[12] = value; f.drawables.set('point', object);
    expect(f.resolve(target('point'))).toBeUndefined();
    object.matrix.identity().makeScale(Number.MAX_VALUE, 1, 1);
    expect(f.resolve({ entity: 'point', offset: [2, 0, 0] })).toBeUndefined();
  });

  it('rejects projective matrices and malformed raw anchor getters without invoking them', () => {
    const f = fixture(), object = new THREE.Object3D(); object.matrixAutoUpdate = false; object.matrix.elements[3] = .1; f.drawables.set('projective', object);
    expect(f.resolve(target('projective'))).toBeUndefined();
    f.world.createEntity('bad'); let calls = 0;
    f.world.addComponent('bad', Object.defineProperty({ type: 'Transform3D', y: 0, z: 0 }, 'x', { enumerable: true, get() { calls++; throw Error('unexpected getter'); } }) as never);
    expect(f.resolve(target('bad'))).toBeUndefined(); expect(calls).toBe(0);
  });
});
