/** Derived locomotion assets only. Preserve the None source byte-for-byte.
 * Linear endpoint XZ extraction retains hip bob/sway. It is not generic curved
 * root motion, turn extraction, a contact calibration, or a loop approval.
 */
import { engineClip } from './motion-engine.mjs';
import { check, motionId, sha256 } from './motion-catalog.mjs';
import { writeComposedGlb, unpackGlb } from './motion-compose-glb.mjs';

export async function separatePlanarRootMotion(bytes, options) {
  check(Buffer.isBuffer(bytes), 'planar root: GLB Buffer required');
  check(options && Object.getPrototypeOf(options) === Object.prototype &&
    Object.keys(options).every(k => ['id','fps','frames','sourceSha256','policy'].includes(k)), 'planar root: unknown options');
  const { id, fps, frames, sourceSha256, policy } = options;
  motionId(id);
  check(policy === 'linear-xz-v1', 'planar root: unsupported extraction policy');
  check(/^[a-f0-9]{64}$/.test(sourceSha256) && sha256(bytes) === sourceSha256, 'planar root: source SHA mismatch');
  check(Number.isInteger(fps) && fps >= 1 && fps <= 120 && Number.isInteger(frames) && frames >= 2 && frames <= 36001, 'planar root: invalid frame grid');
  const loaded = await engineClip(bytes, { fps, frames, loop: false });
  const { THREE } = loaded.api;
  const { doc } = unpackGlb(bytes);
  const names = doc.skins[0].joints.map(i => doc.nodes[i].name);
  const bones = new Map(names.map(name => [name, loaded.scene.getObjectByName(name)]));
  const hip = bones.get('Hips');
  const mixer = new THREE.AnimationMixer(loaded.scene);
  const action = mixer.clipAction(loaded.clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const samples = [], hips = [], parentInverses = [];
  try {
    check(names.length === new Set(names).size && [...bones.values()].every(b => b?.isBone), 'planar root: unique joint names required');
    check(hip?.parent, 'planar root: Hips parent required');
    const hipDescendants = new Set();
    hip.traverse(node => { if (node.isBone) hipDescendants.add(node); });
    check([...bones.values()].every(bone => hipDescendants.has(bone)), 'planar root: every skin joint must descend from Hips; extra motion roots are unsupported');
    for (let frame = 0; frame < frames; frame++) {
      mixer.setTime(frame / fps); loaded.scene.updateMatrixWorld(true);
      const sample = Object.create(null);
      for (const [name, bone] of bones) sample[name] = {
        translation: bone.position.toArray(), rotation: bone.quaternion.toArray(), scale: bone.scale.toArray(),
      };
      samples.push(sample); hips.push(hip.getWorldPosition(new THREE.Vector3()));
      check(Math.abs(hip.parent.matrixWorld.determinant()) > 1e-12, 'planar root: singular parent');
      parentInverses.push(hip.parent.matrixWorld.clone().invert());
    }
    const start = hips[0], end = hips.at(-1);
    const net = { x: end.x - start.x, z: end.z - start.z };
    const trajectory = hips.map((position, frame) => {
      const t = frame / (frames - 1), x = net.x * t, z = net.z * t;
      samples[frame].Hips.translation = position.clone().sub(new THREE.Vector3(x, 0, z)).applyMatrix4(parentInverses[frame]).toArray();
      return { frame, x, z };
    });
    const derived = writeComposedGlb(bytes, { id, fps, frames, samples, THREE });
    return {
      bytes: derived,
      trajectory: {
        version: 1, policy, sourceSha256, derivedSha256: sha256(derived),
        clipId: id, fps, frames, units: 'meters', axes: '+X,+Z; Y unchanged',
        durationS: (frames - 1) / fps, net, samples: trajectory,
        status: 'derived-unreviewed', contactCalibration: 'not-performed', loopApproval: 'not-performed',
      },
    };
  } finally {
    mixer.stopAllAction(); mixer.uncacheRoot(loaded.scene);
    loaded.scene.traverse(node => {
      node.geometry?.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose();
    });
  }
}
