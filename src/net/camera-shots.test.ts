import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { CameraShot3D } from '@engine/protocol/components/camera-shot.js';
import { CameraShots } from '@renderer/three/camera-shots.js';
import { hashSnapshot } from './determinism.js';
import { hashWorld } from './world-hash.js';

function config(offset = 0): CameraShot3D {
  return { type: 'CameraShot3D', shots: { intro: { keyframes: [{ at: 0, eye: [1 + offset, 2, 3], target: [0, 0, 0] }, { at: 600, eye: [11 + offset, 2, 3], target: [0, 1, 0], ease: 'inOut' }] } }, onSignal: [{ signal: 'play', shot: 'intro' }] };
}
function world(): World {
  const w = new World(); w.createEntity('camera'); w.addComponent('camera', { type: 'Camera3D', yaw: 0, pitch: .5 });
  w.addComponent('camera', { type: 'Transform', x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 });
  w.addComponent('camera', { type: 'Velocity', vx: 1, vy: 2, angular: 0 });
  w.addComponent('camera', { type: 'Flag', id: 'flag', active: false });
  w.addComponent('camera', { type: 'State', fsmId: 'story', current: 'intro', previous: 'intro' });
  return w;
}
describe('CameraShot3D simulation isolation', () => {
  it('excludes addition, replacement and removal from both simulation hashes', () => {
    const w = world(), before = hashSnapshot(w.snapshot()); expect(hashWorld(w)).toBe(before);
    for (const data of [config(), config(10)]) { w.addComponent('camera', data); expect(hashSnapshot(w.snapshot())).toBe(before); expect(hashWorld(w)).toBe(before); }
    w.removeComponent('camera', 'CameraShot3D'); expect(hashSnapshot(w.snapshot())).toBe(before); expect(hashWorld(w)).toBe(before);
  });
  it.each([
    { type: 'Transform', x: 2, y: 2, rotation: 0, scaleX: 1, scaleY: 1 }, { type: 'Velocity', vx: 2, vy: 2, angular: 0 },
    { type: 'Flag', id: 'flag', active: true }, { type: 'State', fsmId: 'story', current: 'game', previous: 'intro' },
    { type: 'Signal', name: 'play', source: 'camera' },
  ])('still detects simulation changes in $type', changed => {
    const w = world(); w.addComponent('camera', config()); const before = hashWorld(w);
    w.addComponent('camera', changed as Component); expect(hashWorld(w)).not.toBe(before); expect(hashWorld(w)).toBe(hashSnapshot(w.snapshot()));
  });
  it('keeps raw World/readView snapshots, full/incremental hash, write sequence and dirty untouched over 20k CPU camera updates', () => {
    // Native THREE camera CPU evidence only; the renderer GPU gate is separate.
    const worlds = [world(), world()], controllers = worlds.map(() => new CameraShots()), cameras = worlds.map(() => new THREE.PerspectiveCamera());
    for (let side = 0; side < 2; side++) {
      const w = worlds[side]!; w.addComponent('camera', config(side * 10)); controllers[side]!.sync(w, 0);
      w.addComponent('camera', { type: 'Signal', name: 'play', source: 'camera' }); controllers[side]!.sync(w, 0); w.drainDirty();
    }
    const bases = worlds.map(w => ({ snapshot: JSON.stringify(w.snapshot()), hash: hashWorld(w), seq: w.writeSequence }));
    expect(bases[0]!.hash).toBe(bases[1]!.hash);
    let maxDifference = 0;
    try {
      for (let frame = 0; frame < 10_000; frame++) for (let side = 0; side < 2; side++) {
        const w = worlds[side]!, now = frame * (side ? 1000 / 144 : 1000 / 60), result = controllers[side]!.sync(frame % 2 ? w : w.readView(), now);
        expect(result.active).toBe(true); const camera = cameras[side]!;
        camera.position.fromArray(result.frame!.eye); camera.lookAt(new THREE.Vector3().fromArray(result.frame!.target)); camera.updateMatrixWorld();
        expect(camera.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        const snapshot = w.snapshot(); expect(JSON.stringify(snapshot)).toBe(bases[side]!.snapshot);
        expect(hashSnapshot(snapshot)).toBe(bases[side]!.hash); expect(hashWorld(w)).toBe(bases[side]!.hash);
        expect(w.writeSequence).toBe(bases[side]!.seq); expect(w.drainDirty()).toEqual([]);
        if (side) maxDifference = Math.max(maxDifference, camera.position.distanceTo(cameras[0]!.position));
      }
      expect(maxDifference).toBeGreaterThan(5);
    } finally { controllers.forEach(controller => controller.clear()); }
  });
});
