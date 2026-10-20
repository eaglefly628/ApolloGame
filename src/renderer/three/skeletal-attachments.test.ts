import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SkeletalAttachments } from './skeletal-attachments.js';

function config(parentId = 'actor', bone = 'Hand', offset: readonly [number, number, number] = [0, 0, 0], rot: readonly [number, number, number] = [0, 0, 0]) { return { type: 'Attach3D', parentId, bone, offset, rot }; }
function actor(position: readonly [number, number, number] = [0, 0, 0], handPosition: readonly [number, number, number] = [0, 2, 0]) {
  const model = new THREE.Group(), hand = new THREE.Bone(); hand.name = 'Hand'; hand.position.set(...handPosition); model.position.set(...position); model.add(hand); return { model, hand };
}
function fixture() { const scene = new THREE.Scene(), controller = new SkeletalAttachments(), child = new THREE.Group(), parent = actor(); scene.add(parent.model, child); return { scene, controller, child, ...parent, models: new Map([['actor', parent.model as THREE.Object3D]]) }; }
function xyz(object: THREE.Object3D): number[] { return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld).toArray(); }
function point(object: THREE.Object3D, x: number, y = 0, z = 0): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld); }
function close(actual: readonly number[], expected: readonly number[], precision = 6): void { expect(actual).toHaveLength(expected.length); actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], precision)); }
afterEach(() => { vi.restoreAllMocks(); });

describe('SkeletalAttachments real native Bone/Mixer transforms', () => {
  it('follows sampled hand rotation, applies local offset/XYZ rotation and retains child render scale while replacing its base position/rotation', () => {
    const f = fixture(); f.model.position.set(10, 0, 0); f.child.position.set(-20, -30, -40); f.child.rotation.set(.4, .5, .6); f.child.scale.set(2, 3, 4);
    const mixer = new THREE.AnimationMixer(f.model), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    mixer.clipAction(new THREE.AnimationClip('reach', 1, [new THREE.QuaternionKeyframeTrack('Hand.quaternion', [0, 1], [0, 0, 0, 1, ...q.toArray()])])).play(); mixer.update(0);
    const data = config('actor', 'Hand', [1, 0, 0], [0, 0, Math.PI / 2]); Object.freeze(data.offset); Object.freeze(data.rot); Object.freeze(data);
    const binding = [{ id: 'cup', config: data, object: f.child }], initial = f.controller.sync(binding, f.models);
    close(xyz(f.child), [11, 2, 0]);
    f.controller.beginFrame(); mixer.update(.5); const moved = f.controller.sync(binding, f.models), h = Math.SQRT1_2;
    close(xyz(f.child), [10 + h, 2 + h, 0]); close(point(f.child, 1).toArray(), [10 - h, 2 + 3 * h, 0]); close(point(f.child, 0, 1).toArray(), [10 - 2 * h, 2 - 2 * h, 0]);
    expect(moved.signature).not.toBe(initial.signature); expect(moved.hidden.size).toBe(0); close([moved.poses.get('cup')!.x, moved.poses.get('cup')!.y], [10 + h, 2 + h]);
    expect(f.child.parent).toBe(f.scene); expect(f.model.children).toEqual([f.hand]); expect(f.child.position.toArray()).toEqual([-20, -30, -40]); expect(f.child.scale.toArray()).toEqual([2, 3, 4]);
    f.controller.clear(); mixer.stopAllAction(); mixer.uncacheRoot(f.model);
  });

  it('uses XYZ Euler order and invalidates offset/rotation changes while ignoring replaced base position/rotation', () => {
    const f = fixture(), binding = (data: unknown) => [{ id: 'cup', object: f.child, config: data }];
    const initial = f.controller.sync(binding(config()), f.models); f.controller.beginFrame(); f.child.position.set(50, 60, 70); f.child.rotation.set(.3, .4, .5);
    expect(f.controller.sync(binding(config()), f.models).signature).toBe(initial.signature);
    f.controller.beginFrame(); const rotated = f.controller.sync(binding(config('actor', 'Hand', [0, 0, 0], [Math.PI / 2, Math.PI / 2, 0])), f.models);
    close(point(f.child, 1).toArray(), [0, 3, 0]); close(point(f.child, 0, 1).toArray(), [0, 2, 1]); close(point(f.child, 0, 0, 1).toArray(), [1, 2, 0]); expect(rotated.signature).not.toBe(initial.signature);
    f.controller.beginFrame(); const offset = f.controller.sync(binding(config('actor', 'Hand', [1, 0, 0])), f.models); close(xyz(f.child), [1, 2, 0]); expect(offset.signature).not.toBe(initial.signature); f.controller.clear(); close(xyz(f.child), [50, 60, 70]);
  });

  it('counts actual Bones rather than equally named decorative nodes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), decoration = new THREE.Object3D(); decoration.name = 'Hand'; decoration.position.set(100, 0, 0); f.model.remove(f.hand); f.model.add(decoration, f.hand);
    f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); close(xyz(f.child), [0, 2, 0]); expect(warn).not.toHaveBeenCalled(); f.controller.clear();
  });

  it('retains complete nonuniform-parent shear instead of decomposing and recomposing the draw matrix', () => {
    const f = fixture(); f.model.scale.set(2, 1, 1); f.hand.position.set(0, 0, 0); f.hand.rotation.z = Math.PI / 4; f.child.scale.set(1, 2, 1);
    f.controller.sync([{ id: 'cup', config: config(), object: f.child }], f.models);
    const origin = point(f.child, 0), x = point(f.child, 1).sub(origin), y = point(f.child, 0, 1).sub(origin);
    expect(x.dot(y)).toBeCloseTo(-3, 10); close(point(f.child, 1, 1).toArray(), [-Math.SQRT2, 3 * Math.SQRT1_2, 0]); expect(f.child.matrixAutoUpdate).toBe(false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); f.child.matrixWorld.decompose(p, q, s); const lossy = new THREE.Matrix4().compose(p, q, s); expect(lossy.elements).not.toEqual(f.child.matrixWorld.elements); f.controller.clear();
  });

  it('keeps the desired world matrix under an existing transformed native parent without reparenting', () => {
    const f = fixture(), container = new THREE.Group(); container.position.set(100, -20, 7); container.rotation.set(.1, .4, -.2); container.scale.set(3, .5, 2); f.scene.add(container); container.add(f.child);
    f.controller.sync([{ id: 'cup', config: config('actor', 'Hand', [1, 0, 3]), object: f.child }], f.models);
    close(xyz(f.child), [1, 2, 3]); close(point(f.child, 1).toArray(), [2, 2, 3]); expect(f.child.parent).toBe(container); f.controller.clear();
  });

  it('orders nested attached model roots before their children even when bindings arrive in reverse order', () => {
    const f = fixture(), second = actor([0, 0, 0], [0, 2, 0]); f.model.position.set(10, 0, 0); f.hand.position.set(1, 0, 0); second.model.scale.setScalar(2); f.scene.add(second.model); f.models.set('second', second.model);
    const result = f.controller.sync([{ id: 'cup', object: f.child, config: config('second', 'Hand', [0, 0, 3]) }, { id: 'second', object: second.model, config: config() }], f.models);
    close(xyz(second.model), [11, 0, 0]); close(xyz(f.child), [11, 4, 6]); close([result.poses.get('cup')!.x, result.poses.get('cup')!.y, result.poses.get('cup')!.z], [11, 4, 6]); expect(second.model.parent).toBe(f.scene); expect(f.child.parent).toBe(f.scene); f.controller.clear();
  });

  it('updates real raycasting at the attachment pose and excludes hidden attachments from returned camera/pick metadata', () => {
    const f = fixture(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); mesh.position.set(-20, -30, 0); f.scene.add(mesh);
    f.controller.sync([{ id: 'cup', object: mesh, config: config() }], f.models);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 10), new THREE.Vector3(0, 0, -1)); expect(ray.intersectObject(mesh)).not.toHaveLength(0);
    expect(new THREE.Raycaster(new THREE.Vector3(-20, -30, 10), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)).toHaveLength(0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); f.models.clear(); f.controller.beginFrame(); const result = f.controller.sync([{ id: 'cup', object: mesh, config: config() }], f.models);
    expect(result.hidden.has('cup')).toBe(true); expect(result.poses.has('cup')).toBe(false); expect(warn).toHaveBeenCalledOnce(); f.controller.clear(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });
});

describe('SkeletalAttachments lifecycle, fallback and invalid input', () => {
  it('hides a missing parent once, recovers late and hides again on parent removal without reusing an old instance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), binding = [{ id: 'cup', object: f.child, config: config() }]; f.models.clear();
    const missing = f.controller.sync(binding, f.models); expect(f.child.visible).toBe(false); expect(missing.hidden.has('cup')).toBe(true);
    for (let frame = 0; frame < 5; frame++) { f.controller.beginFrame(); expect(f.child.visible).toBe(true); expect(f.controller.sync(binding, f.models).signature).toBe(missing.signature); } expect(warn).toHaveBeenCalledOnce();
    f.models.set('actor', f.model); f.controller.beginFrame(); const ready = f.controller.sync(binding, f.models); expect(f.child.visible).toBe(true); close(xyz(f.child), [0, 2, 0]); expect(ready.signature).not.toBe(missing.signature);
    f.models.clear(); f.controller.beginFrame(); const gone = f.controller.sync(binding, f.models); expect(gone.hidden.has('cup')).toBe(true); expect(gone.poses.size).toBe(0); expect(warn).toHaveBeenCalledTimes(2);
    const replacement = actor([30, 0, 0], [1, 0, 0]); f.scene.add(replacement.model); f.models.set('actor', replacement.model); f.controller.beginFrame(); f.controller.sync(binding, f.models); close(xyz(f.child), [31, 0, 0]); f.controller.clear();
  });

  it.each(['missing', 'ambiguous', 'non-bone'])('warns once and uses the parent root for a %s exact bone name', kind => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(); f.model.position.set(3, 0, 0);
    if (kind === 'missing') f.hand.name = 'Other';
    if (kind === 'non-bone') { f.model.remove(f.hand); const named = new THREE.Object3D(); named.name = 'Hand'; named.position.set(100, 0, 0); f.model.add(named); }
    if (kind === 'ambiguous') { const duplicate = new THREE.Bone(); duplicate.name = 'Hand'; duplicate.position.set(100, 0, 0); f.model.add(duplicate); }
    for (let frame = 0; frame < 5; frame++) { f.controller.beginFrame(); f.controller.sync([{ id: 'cup', object: f.child, config: config('actor', 'Hand', [1, 0, 0], [0, 0, Math.PI / 2]) }], f.models); close(xyz(f.child), [4, 0, 0]); close(point(f.child, 1).toArray(), [4, 1, 0]); }
    expect(warn).toHaveBeenCalledOnce(); expect(f.child.visible).toBe(true); f.controller.clear();
  });

  it('does not retain a stale named bone when a current model hierarchy changes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), binding = [{ id: 'cup', object: f.child, config: config() }];
    f.controller.sync(binding, f.models); close(xyz(f.child), [0, 2, 0]); f.model.remove(f.hand); f.controller.beginFrame(); f.controller.sync(binding, f.models); close(xyz(f.child), [0, 0, 0]); expect(warn).toHaveBeenCalledOnce();
    const newHand = new THREE.Bone(); newHand.name = 'Hand'; newHand.position.set(0, 10, 0); f.model.add(newHand); f.controller.beginFrame(); f.controller.sync(binding, f.models); close(xyz(f.child), [0, 10, 0]); f.controller.clear();
  });

  it('restores base matrix/visibility/auto-update before ordinary pose writes and on removal/clear', () => {
    const f = fixture(); f.child.position.set(5, 6, 7); f.child.rotation.set(.1, .2, .3); f.child.scale.set(2, 3, 4); f.child.updateMatrix(); const base = f.child.matrix.clone();
    f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); f.controller.beginFrame(); expect(f.child.visible).toBe(true); expect(f.child.matrixAutoUpdate).toBe(true); close(f.child.matrix.elements, base.elements);
    f.child.position.set(12, 13, 14); const none = f.controller.sync([], f.models); f.child.updateMatrixWorld(true); close(xyz(f.child), [12, 13, 14]); expect(none.signature).toBe('[]');
    f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); f.controller.clear(); expect(f.child.matrixAutoUpdate).toBe(true); close(xyz(f.child), [12, 13, 14]); expect((f.controller as any).managed.size).toBe(0); expect((f.controller as any).diagnostics.size).toBe(0);
  });

  it('preserves pre-existing manual local/world matrices and original hidden visibility', () => {
    const f = fixture(); f.child.matrixAutoUpdate = false; f.child.matrixWorldAutoUpdate = false; f.child.visible = false;
    f.child.matrix.set(1, .4, 0, 3, 0, 1, 0, 4, 0, 0, 1, 5, 0, 0, 0, 1); f.child.matrixWorld.makeTranslation(8, 9, 10); const local = f.child.matrix.clone(), world = f.child.matrixWorld.clone();
    const result = f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); expect(result.hidden.has('cup')).toBe(true); f.controller.clear();
    expect(f.child.visible).toBe(false); expect(f.child.matrixAutoUpdate).toBe(false); expect(f.child.matrixWorldAutoUpdate).toBe(false); expect(f.child.matrix.elements).toEqual(local.elements); expect(f.child.matrixWorld.elements).toEqual(world.elements);
  });

  it('handles zero and reflected child scales with finite camera metadata', () => {
    const f = fixture(); f.child.scale.set(-2, 3, 4); let result = f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); expect(result.poses.get('cup')!.sx).toBeCloseTo(-2); close(point(f.child, 1).toArray(), [-2, 2, 0]);
    f.controller.beginFrame(); f.child.scale.set(0, 2, 1); result = f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); expect(result.hidden.size).toBe(0); expect(result.poses.get('cup')!.sx).toBe(0); expect(result.poses.get('cup')!.quat!.every(Number.isFinite)).toBe(true); f.controller.clear();
  });

  it('contains raw cycles and downstream attachments while unrelated bindings still render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), a = actor(), b = actor(), downstream = new THREE.Group(); f.scene.add(a.model, b.model, downstream); f.models.set('a', a.model); f.models.set('b', b.model);
    const bindings = [{ id: 'a', object: a.model, config: config('b') }, { id: 'b', object: b.model, config: config('a') }, { id: 'downstream', object: downstream, config: config('a') }, { id: 'cup', object: f.child, config: config() }];
    for (let frame = 0; frame < 5; frame++) { f.controller.beginFrame(); const result = f.controller.sync(bindings, f.models); expect([...result.hidden].sort()).toEqual(['a', 'b', 'downstream']); expect(result.poses.has('cup')).toBe(true); }
    expect(warn).toHaveBeenCalledTimes(3); f.controller.clear(); expect(a.model.visible).toBe(true); expect(b.model.visible).toBe(true);
  });

  it.each([
    ['self cycle', () => config('cup')],
    ['unknown field', () => ({ ...config(), extra: true })],
    ['nonfinite offset', () => ({ ...config(), offset: [NaN, 0, 0] })],
    ['missing tuple', () => ({ parentId: 'actor', bone: 'Hand', offset: [0, 0, 0] })],
    ['cyclic raw object', () => { const raw: any = { ...config() }; raw.cycle = raw; return raw; }],
  ])('hides %s safely with one diagnostic', (_, make) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), data = make();
    for (let frame = 0; frame < 5; frame++) { f.controller.beginFrame(); const result = f.controller.sync([{ id: 'cup', object: f.child, config: data }], f.models); expect(result.hidden.has('cup')).toBe(true); expect(result.poses.size).toBe(0); }
    expect(warn).toHaveBeenCalledOnce(); f.controller.clear();
  });

  it.each(['bone', 'child', 'native-parent'])('hides nonfinite/singular %s matrices and recovers on the next valid frame', kind => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), container = new THREE.Group(); f.scene.add(container); container.add(f.child);
    if (kind === 'bone') f.hand.scale.x = Infinity; else if (kind === 'child') f.child.scale.x = NaN; else container.scale.x = 0;
    const binding = [{ id: 'cup', object: f.child, config: config() }]; let result = f.controller.sync(binding, f.models); expect(result.hidden.has('cup')).toBe(true); expect(result.poses.size).toBe(0); expect(warn).toHaveBeenCalledOnce();
    f.controller.beginFrame(); f.hand.scale.setScalar(1); f.child.scale.setScalar(1); container.scale.setScalar(1); result = f.controller.sync(binding, f.models); expect(result.hidden.size).toBe(0); close(xyz(f.child), [0, 2, 0]); f.controller.clear();
  });

  it('hides a child when its attached parent is missing or base-hidden', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), second = actor(); f.scene.add(second.model); f.models.set('second', second.model);
    let result = f.controller.sync([{ id: 'cup', object: f.child, config: config('second') }, { id: 'second', object: second.model, config: config('not-ready') }], f.models); expect([...result.hidden].sort()).toEqual(['cup', 'second']); expect(warn).toHaveBeenCalledTimes(2);
    f.controller.clear(); f.model.visible = false; result = f.controller.sync([{ id: 'cup', object: f.child, config: config() }], f.models); expect(result.hidden.has('cup')).toBe(true); f.controller.clear();
  });

  it('resolves a long reversed dependency chain without using the JavaScript call stack', () => {
    const f = fixture(), bindings: { id: string; object: THREE.Object3D; config: unknown }[] = []; f.hand.position.set(1, 0, 0);
    for (let i = 0; i < 2000; i++) { const model = actor([0, 0, 0], [1, 0, 0]).model, id = `chain-${i}`; f.scene.add(model); f.models.set(id, model); bindings.push({ id, object: model, config: config(i === 0 ? 'actor' : `chain-${i - 1}`) }); }
    const result = f.controller.sync(bindings.reverse(), f.models); expect(result.hidden.size).toBe(0); close(xyz(f.models.get('chain-1999')!), [2000, 0, 0]); f.controller.clear(); close(xyz(f.models.get('chain-1999')!), [0, 0, 0]);
  });

  it('keeps actual object hierarchy/resources and state bounded across 10,000 frames and repeated model replacement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material); f.scene.add(mesh);
    const geometryDisposed = vi.spyOn(geometry, 'dispose'), materialDisposed = vi.spyOn(material, 'dispose'), binding = [{ id: 'cup', object: mesh, config: config() }];
    const first = f.controller.sync(binding, f.models).signature;
    for (let frame = 0; frame < 10000; frame++) { f.controller.beginFrame(); const result = f.controller.sync(binding, f.models); expect(result.signature).toBe(first); }
    expect(mesh.parent).toBe(f.scene); expect(f.model.children).toEqual([f.hand]); expect(f.scene.children).toHaveLength(3); expect((f.controller as any).managed.size).toBe(1); expect((f.controller as any).diagnostics.size).toBe(0); expect(geometryDisposed).not.toHaveBeenCalled(); expect(materialDisposed).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
    for (let i = 0; i < 20; i++) { f.controller.beginFrame(); f.models.set('actor', actor([i, 0, 0]).model); f.controller.sync(binding, f.models); close(xyz(mesh), [i, 2, 0]); }
    f.controller.beginFrame(); f.controller.sync([], f.models); expect((f.controller as any).managed.size).toBe(0); expect((f.controller as any).diagnostics.size).toBe(0); f.controller.clear(); expect(geometryDisposed).not.toHaveBeenCalled(); expect(materialDisposed).not.toHaveBeenCalled(); geometry.dispose(); material.dispose();
  });
});
