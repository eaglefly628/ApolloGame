import * as THREE from 'three';
import { validateAttach3D, type Attach3D } from '@engine/protocol/components/attach3d.js';
import type { Pose3D } from '../three-projection.js';

type Binding = { readonly id: string; readonly config: unknown; readonly object: THREE.Object3D };
interface Base { readonly object: THREE.Object3D; readonly visible: boolean; readonly auto: boolean; readonly matrix: THREE.Matrix4; readonly world: THREE.Matrix4; }
interface Entry { readonly binding: Binding; readonly config?: Attach3D; readonly error?: string; }
interface Diagnostic { readonly object: THREE.Object3D; readonly token: string; readonly codes: Set<string>; }
const finite = (values: ArrayLike<number>): boolean => Array.from(values).every(Number.isFinite);
function visible(object: THREE.Object3D): boolean { for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false; return true; }

/** Render-only world transforms. Resource ownership and native parenting stay in
 * the original pools; only the object's temporary matrix/visibility are owned. */
export class SkeletalAttachments {
  private readonly managed = new Map<THREE.Object3D, Base>();
  private readonly diagnostics = new Map<string, Diagnostic>();

  beginFrame(): void {
    // Restore all local matrices before updating any ancestor/child world matrix.
    for (const state of this.managed.values()) {
      state.object.visible = state.visible;
      state.object.matrixAutoUpdate = state.auto;
      state.object.matrix.copy(state.matrix);
      state.object.matrixWorld.copy(state.world);
      state.object.matrixWorldNeedsUpdate = true;
    }
    for (const state of this.managed.values()) state.object.updateWorldMatrix(true, true);
    this.managed.clear();
  }

  clear(): void { this.beginFrame(); this.diagnostics.clear(); }

  sync(bindings: readonly Binding[], models: ReadonlyMap<string, THREE.Object3D>): { signature: string; hidden: ReadonlySet<string>; poses: ReadonlyMap<string, Pose3D> } {
    // Also make repeated sync calls safe for headless consumers.
    this.beginFrame();
    const entries = new Map<string, Entry>(), hidden = new Set<string>(), poses = new Map<string, Pose3D>();
    const duplicates = new Set<string>(), usedObjects = new Map<THREE.Object3D, string>();
    for (const binding of bindings) {
      if (!this.managed.has(binding.object)) {
        if (binding.object.matrixAutoUpdate) binding.object.updateMatrix();
        this.managed.set(binding.object, { object: binding.object, visible: binding.object.visible, auto: binding.object.matrixAutoUpdate, matrix: binding.object.matrix.clone(), world: binding.object.matrixWorld.clone() });
      }
      if (entries.has(binding.id)) duplicates.add(binding.id);
      const other = usedObjects.get(binding.object);
      if (other !== undefined && other !== binding.id) { duplicates.add(other); duplicates.add(binding.id); }
      usedObjects.set(binding.object, binding.id);
      try { entries.set(binding.id, { binding, config: validateAttach3D(binding.config) }); }
      catch (error) { entries.set(binding.id, { binding, error: error instanceof Error ? error.message : 'validation failed' }); }
    }
    for (const id of this.diagnostics.keys()) if (!entries.has(id)) this.diagnostics.delete(id);

    const frameIssues = new Map<string, Set<string>>();
    const warn = (entry: Entry, code: string, message: string): void => {
      const active = frameIssues.get(entry.binding.id) ?? new Set<string>(); active.add(code); frameIssues.set(entry.binding.id, active);
      const config = entry.config, parent = config && models.get(config.parentId);
      const token = config ? JSON.stringify([config.parentId, config.bone, config.offset, config.rot, parent?.uuid ?? null]) : entry.error ?? 'duplicate';
      let diagnostic = this.diagnostics.get(entry.binding.id);
      if (!diagnostic || diagnostic.object !== entry.binding.object || diagnostic.token !== token) {
        diagnostic = { object: entry.binding.object, token, codes: new Set() }; this.diagnostics.set(entry.binding.id, diagnostic);
      }
      if (!diagnostic.codes.has(code)) { diagnostic.codes.add(code); console.warn(`[SkeletalAttachments] ${entry.binding.id}: ${message}`); }
    };
    const hide = (entry: Entry, code: string, message: string): void => { entry.binding.object.visible = false; hidden.add(entry.binding.id); warn(entry, code, message); };

    const children = new Map<string, string[]>(), indegree = new Map<string, number>();
    for (const [id, entry] of entries) {
      const parent = entry.config?.parentId;
      indegree.set(id, parent !== undefined && entries.has(parent) ? 1 : 0);
      if (parent !== undefined && entries.has(parent)) children.set(parent, [...(children.get(parent) ?? []), id]);
    }
    const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id), finished = new Set<string>();
    // Index each current parent instance once per sync. Rebuilding also detects
    // removed/renamed/duplicate bones without retaining references to old models.
    const bones = new Map<THREE.Object3D, Map<string, THREE.Bone[]>>();
    const index = (model: THREE.Object3D): ReadonlyMap<string, readonly THREE.Bone[]> => {
      let names = bones.get(model);
      if (!names) {
        names = new Map(); model.traverse(node => { if ((node as THREE.Bone).isBone) names!.set(node.name, [...(names!.get(node.name) ?? []), node as THREE.Bone]); }); bones.set(model, names);
      }
      return names;
    };

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const id = queue[cursor], entry = entries.get(id)!, { object } = entry.binding, config = entry.config;
      finished.add(id);
      if (duplicates.has(id)) hide(entry, 'duplicate', 'ambiguous attachment entity/object; hidden');
      else if (!config) hide(entry, 'invalid', `invalid Attach3D; hidden (${entry.error})`);
      else {
        const parent = models.get(config.parentId);
        if (!parent || hidden.has(config.parentId) || !visible(parent)) hide(entry, 'missing-parent', `parent model "${config.parentId}" is unavailable; hidden`);
        else {
          parent.updateWorldMatrix(true, true);
          const matches = index(parent).get(config.bone) ?? [];
          const anchor = matches.length === 1 ? matches[0] : parent;
          if (matches.length !== 1) warn(entry, 'bone-fallback', `bone "${config.bone}" is ${matches.length === 0 ? 'missing' : 'ambiguous'}; using parent model root`);
          const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.rot, 'XYZ'));
          const local = new THREE.Matrix4().compose(new THREE.Vector3(...config.offset), rotation, object.scale);
          const world = new THREE.Matrix4().multiplyMatrices(anchor.matrixWorld, local);
          let valid = finite(world.elements);
          if (object.parent) {
            object.parent.updateWorldMatrix(true, false);
            const determinant = object.parent.matrixWorld.determinant();
            valid &&= Number.isFinite(determinant) && determinant !== 0;
            if (valid) local.multiplyMatrices(object.parent.matrixWorld.clone().invert(), world);
          } else local.copy(world);
          valid &&= finite(local.elements);
          if (!valid) hide(entry, 'nonfinite', 'attachment matrix is nonfinite or its native parent is singular; hidden');
          else {
            object.matrixAutoUpdate = false;
            object.matrix.copy(local);
            object.matrixWorld.copy(world);
            object.matrixWorldNeedsUpdate = true;
            object.updateMatrixWorld(true);
            if (!visible(object)) hidden.add(id);
            else {
              const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(); world.decompose(position, quaternion, scale);
              // A zero render scale is valid. Its rotation is undefined for
              // decomposition, while its finite matrix still draws correctly.
              if (!finite(quaternion.toArray())) quaternion.identity(); else quaternion.normalize();
              scale.set((world.determinant() < 0 ? -1 : 1) * Math.hypot(world.elements[0], world.elements[1], world.elements[2]), Math.hypot(world.elements[4], world.elements[5], world.elements[6]), Math.hypot(world.elements[8], world.elements[9], world.elements[10]));
              const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
              const pose: Pose3D = { x: position.x, y: position.y, z: position.z, rx: euler.x, ry: euler.y, rotZ: euler.z, sx: scale.x, sy: scale.y, sz: scale.z, quat: quaternion.toArray() };
              if (!finite([pose.x, pose.y, pose.z, pose.rx!, pose.ry!, pose.rotZ, pose.sx, pose.sy, pose.sz!, ...pose.quat!])) hide(entry, 'nonfinite', 'attachment camera pose is nonfinite; hidden');
              else poses.set(id, pose);
            }
          }
        }
      }
      for (const child of children.get(id) ?? []) { indegree.set(child, indegree.get(child)! - 1); if (indegree.get(child) === 0) queue.push(child); }
    }
    for (const [id, entry] of entries) if (!finished.has(id)) hide(entry, 'cycle', 'cyclic attachment dependency; hidden');
    // Every duplicate object is hidden, including earlier duplicate-id entries.
    for (const binding of bindings) if (duplicates.has(binding.id)) { binding.object.visible = false; hidden.add(binding.id); poses.delete(binding.id); }
    for (const [id, diagnostic] of this.diagnostics) {
      for (const code of diagnostic.codes) if (!frameIssues.get(id)?.has(code)) diagnostic.codes.delete(code);
      if (diagnostic.codes.size === 0) this.diagnostics.delete(id);
    }
    const signature = JSON.stringify([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, { binding: { object } }]) => hidden.has(id) ? [id, object.uuid, 0] : [id, object.uuid, 1, ...object.matrixWorld.elements]));
    return { signature, hidden, poses };
  }
}
