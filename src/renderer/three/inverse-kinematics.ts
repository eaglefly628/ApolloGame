import * as THREE from 'three';
import { validateIK3D, type IK3D, type IKTarget, type IKWeight } from '@engine/protocol/components/ik3d.js';
import { solveTwoBone } from './two-bone-ik.js';

type Params = Readonly<Record<string, number | string | boolean | undefined>>;
type Input = { readonly id: string; readonly config: unknown; readonly model?: THREE.Object3D; readonly params: Params };
type Context = { readonly resolveTarget: (target: IKTarget) => { position: THREE.Vector3; dependencies: readonly THREE.Object3D[] } | undefined; readonly refreshAttachments: () => void };
interface Envelope { value: number; target: number; start: number; elapsed: number; }
interface State { readonly token: string; readonly model?: THREE.Object3D; readonly weights: Map<string, Envelope>; readonly warnings: Set<string>; }
const finite = (v: ArrayLike<number>): boolean => Array.from(v).every(Number.isFinite);
function unit(v: THREE.Vector3): THREE.Vector3 | undefined { const length = Math.hypot(v.x, v.y, v.z); return length > 0 && Number.isFinite(length) ? v.clone().divideScalar(length) : undefined; }
function descendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean { for (let p: THREE.Object3D | null = node; p; p = p.parent) if (p === ancestor) return true; return false; }
function localRotation(node: THREE.Object3D, writable = false): THREE.Quaternion | undefined {
  if (writable && !node.matrixAutoUpdate) return undefined;
  if (node.matrixAutoUpdate) {
    const s = node.scale, q = node.quaternion, size = Math.max(s.x, s.y, s.z), norm = Math.hypot(q.x, q.y, q.z, q.w);
    if (!finite([...node.position.toArray(), ...s.toArray(), ...q.toArray()]) || Math.min(s.x, s.y, s.z) <= 0 || Math.max(Math.abs(s.x - s.y), Math.abs(s.y - s.z)) > size * 1e-6 || Math.abs(norm - 1) > 1e-5) return undefined;
    return q.clone();
  }
  const m = node.matrix.elements;
  if (!finite(m) || Math.abs(m[3]) + Math.abs(m[7]) + Math.abs(m[11]) + Math.abs(m[15] - 1) > 1e-8) return undefined;
  const x = new THREE.Vector3(m[0], m[1], m[2]), y = new THREE.Vector3(m[4], m[5], m[6]), z = new THREE.Vector3(m[8], m[9], m[10]);
  const lengths = [Math.hypot(x.x, x.y, x.z), Math.hypot(y.x, y.y, y.z), Math.hypot(z.x, z.y, z.z)], size = Math.max(...lengths);
  if (!(Math.min(...lengths) > 0) || !finite(lengths) || Math.max(Math.abs(lengths[0] - lengths[1]), Math.abs(lengths[1] - lengths[2])) > size * 1e-6) return undefined;
  x.divideScalar(lengths[0]); y.divideScalar(lengths[1]); z.divideScalar(lengths[2]);
  if (Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) > 1e-6 || x.clone().cross(y).dot(z) < .999999) return undefined;
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).normalize();
}
function inverseFrame(parent: THREE.Object3D | null): THREE.Matrix4 | undefined {
  if (!parent) return new THREE.Matrix4(); parent.updateWorldMatrix(true, false);
  const determinant = parent.matrixWorld.determinant();
  if (!finite(parent.matrixWorld.elements) || !Number.isFinite(determinant) || determinant === 0) return undefined;
  const inverse = parent.matrixWorld.clone().invert(); return finite(inverse.elements) ? inverse : undefined;
}

/** Native Bone adapter. All state is renderer-private; beginFrame runs before
 * animation sampling so IK can never become the next frame's source pose. */
export class InverseKinematics {
  private readonly originals = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly states = new Map<string, State>();

  beginFrame(): void {
    for (const [bone, original] of this.originals) bone.quaternion.copy(original);
    for (const bone of this.originals.keys()) bone.updateWorldMatrix(true, true);
    this.originals.clear();
  }
  clear(): void { this.beginFrame(); this.states.clear(); }
  private remember(bone: THREE.Bone): void { if (!this.originals.has(bone)) this.originals.set(bone, bone.quaternion.clone()); }
  private warn(id: string, state: State, key: string, message: string): void {
    if (!state.warnings.has(key)) { state.warnings.add(key); console.warn(`[InverseKinematics] ${id}: ${message}`); }
  }
  private weight(id: string, state: State, key: string, weight: IKWeight, params: Params, dt: number): number {
    if (typeof weight === 'number') return weight;
    const raw = params[weight.param];
    if (!(typeof raw === 'number' && Number.isFinite(raw)) && typeof raw !== 'boolean') {
      this.warn(id, state, `${key}:param`, `weight parameter "${weight.param}" is missing or not numeric/boolean; effective weight 0`);
      state.weights.delete(key); return 0;
    }
    const target = typeof raw === 'boolean' ? Number(raw) : Math.max(0, Math.min(1, raw));
    let envelope = state.weights.get(key);
    if (!envelope) { envelope = { value: 0, target, start: 0, elapsed: 0 }; state.weights.set(key, envelope); }
    if (envelope.target !== target) { envelope.target = target; envelope.start = envelope.value; envelope.elapsed = 0; }
    envelope.elapsed = Math.min(weight.fade, envelope.elapsed + dt);
    envelope.value = weight.fade === 0 ? target : envelope.start + (target - envelope.start) * envelope.elapsed / weight.fade;
    return envelope.value;
  }

  sync(inputs: readonly Input[], context: Context, dtSeconds: number): { signature: string } {
    this.beginFrame();
    const seen = new Set<string>(), rows: unknown[] = [], dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    for (const input of inputs) {
      seen.add(input.id); let config: IK3D | undefined, token: string;
      try { config = validateIK3D(input.config); token = JSON.stringify(config); }
      catch (error) { token = `invalid:${error instanceof Error ? error.message : 'config'}`; }
      let state = this.states.get(input.id);
      if (!state || state.token !== token || state.model !== input.model) { state = { token, model: input.model, weights: new Map(), warnings: new Set() }; this.states.set(input.id, state); }
      if (!config) { this.warn(input.id, state, 'config', token); rows.push([input.id, 'invalid']); continue; }
      const model = input.model;
      if (!model) { this.warn(input.id, state, 'model', 'model is not ready; skipped'); rows.push([input.id, 'missing-model']); continue; }
      const names = new Map<string, THREE.Bone[]>(); model.traverse(node => { if ((node as THREE.Bone).isBone) names.set(node.name, [...(names.get(node.name) ?? []), node as THREE.Bone]); });
      const bone = (name: string): THREE.Bone | undefined => names.get(name)?.length === 1 ? names.get(name)![0] : undefined;
      const statuses: unknown[] = [];
      const target = (key: string, request: IKTarget, controlled: THREE.Bone): THREE.Vector3 | undefined => {
        context.refreshAttachments();
        const resolved = context.resolveTarget(request);
        if (!resolved || !finite(resolved.position.toArray())) { this.warn(input.id, state!, `${key}:target`, 'target is unavailable or nonfinite; skipped'); state!.weights.delete(key); return undefined; }
        if (resolved.dependencies.some(node => descendant(node, controlled))) { this.warn(input.id, state!, `${key}:dependency`, 'target depends on the controlled bone subtree; skipped'); return undefined; }
        return resolved.position.clone();
      };
      const reject = (key: string, message: string): void => { statuses.push([key, 'rejected']); this.warn(input.id, state!, `${key}:rig`, message); };
      try {
        if (config.lookAt) {
          const spec = config.lookAt, key = 'lookAt', weight = this.weight(input.id, state, key, spec.weight, input.params, dt);
          if (weight === 0) statuses.push([key, 'zero']);
          else {
            const controlled = bone(spec.bone);
            if (!controlled || !localRotation(controlled, true)) reject(key, 'lookAt requires a unique Bone with positive uniform local TRS; skipped');
            else {
              const point = target(key, spec.target, controlled), frame = inverseFrame(controlled.parent);
              const desired = point && frame ? unit(point.applyMatrix4(frame).sub(controlled.position)) : undefined;
              if (!point) statuses.push([key, 'missing-target']);
              else if (!desired) reject(key, 'lookAt target is coincident or parent frame is singular; skipped');
              else {
                const original = controlled.quaternion.clone(), current = new THREE.Vector3(0, 0, 1).applyQuaternion(original);
                const solved = new THREE.Quaternion().setFromUnitVectors(current, desired).multiply(original).normalize();
                this.remember(controlled); controlled.quaternion.copy(original.slerp(solved, weight)); model.updateWorldMatrix(true, true); statuses.push([key, 'active']);
              }
            }
          }
        }
        for (let i = 0; i < config.chains.length; i++) {
          const spec = config.chains[i], key = `chain:${i}`, weight = this.weight(input.id, state, key, spec.weight, input.params, dt);
          if (weight === 0) { statuses.push([key, 'zero']); continue; }
          const root = bone(spec.root), mid = bone(spec.mid), end = bone(spec.end);
          if (!root || !mid || !end || !descendant(mid, root) || !descendant(end, mid) || !localRotation(root, true) || !localRotation(mid, true)) { reject(key, 'chain requires unique ancestor-linked root/mid/end Bones and writable positive uniform TRS; skipped'); continue; }
          let supported = true;
          for (let node: THREE.Object3D | null = end; node && node !== root.parent; node = node.parent) if (!localRotation(node)) { supported = false; break; }
          if (!supported) { reject(key, 'chain local scale/shear is unsupported (positive uniform TRS required); skipped'); continue; }
          const point = target(key, spec.target, root), frame = inverseFrame(root.parent);
          if (!point) { statuses.push([key, 'missing-target']); continue; }
          if (!frame) { reject(key, 'common parent frame is singular/nonfinite; skipped'); continue; }
          model.updateWorldMatrix(true, true);
          const position = (node: THREE.Object3D): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).applyMatrix4(frame);
          const a = position(root), b = position(mid), c = position(end), goal = point.applyMatrix4(frame), pole = spec.pole && new THREE.Vector3(...spec.pole).applyMatrix4(frame);
          const solved = solveTwoBone(a, b, c, goal, pole);
          if (!solved) { reject(key, 'chain has zero length or nonfinite coordinates; skipped'); continue; }
          const from = unit(b.clone().sub(a)), to = unit(solved.mid.clone().sub(a));
          if (!from || !to) { reject(key, 'chain directions are degenerate; skipped'); continue; }
          const deltaRoot = new THREE.Quaternion().setFromUnitVectors(from, to), parentRotation = new THREE.Quaternion();
          for (let node = mid.parent; node && node !== root.parent; node = node.parent) parentRotation.premultiply(localRotation(node)!);
          parentRotation.premultiply(deltaRoot);
          const rotatedEnd = c.clone().sub(a).applyQuaternion(deltaRoot).add(a), sourceMid = unit(rotatedEnd.sub(solved.mid)), targetMid = unit(solved.end.clone().sub(solved.mid));
          if (!sourceMid || !targetMid) { reject(key, 'chain second segment is degenerate; skipped'); continue; }
          const deltaMid = new THREE.Quaternion().setFromUnitVectors(sourceMid, targetMid), qRoot = deltaRoot.clone().multiply(root.quaternion).normalize();
          const qMid = parentRotation.clone().invert().multiply(deltaMid).multiply(parentRotation).multiply(mid.quaternion).normalize();
          if (!finite([...qRoot.toArray(), ...qMid.toArray()])) { reject(key, 'solved quaternion is nonfinite; skipped'); continue; }
          this.remember(root); this.remember(mid);
          root.quaternion.slerp(qRoot, weight); mid.quaternion.slerp(qMid, weight); model.updateWorldMatrix(true, true); statuses.push([key, 'active']);
        }
      } catch (error) { this.warn(input.id, state, 'runtime', `runtime target/frame rejected (${error instanceof Error ? error.message : 'invalid context'})`); statuses.push(['runtime', 'rejected']); }
      const corrections: unknown[] = [];
      model.traverse(node => { if (this.originals.has(node as THREE.Bone)) corrections.push([node.uuid, ...(node as THREE.Bone).quaternion.toArray()]); });
      rows.push([input.id, model.uuid, statuses, corrections]);
    }
    for (const id of this.states.keys()) if (!seen.has(id)) this.states.delete(id);
    return { signature: JSON.stringify(rows) };
  }
}
