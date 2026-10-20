import * as THREE from 'three';
import type { IWorld } from '@engine/core/types.js';
import type { Attach3D, Transform3D, Visibility, IKTarget } from '@engine/protocol/components.js';
import { validateAttach3D } from '@engine/protocol/components/attach3d.js';
import { transform3dPose, type Pose3D } from '../three-projection.js';
import { applyPose } from './geometry.js';

export interface ResolvedIKTarget { readonly position: THREE.Vector3; readonly dependencies: readonly THREE.Object3D[]; }
function visible(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
function bones(model: THREE.Object3D, name: string): THREE.Bone[] {
  const matches: THREE.Bone[] = [];
  model.traverse(node => { if ((node as THREE.Bone).isBone && node.name === name) matches.push(node as THREE.Bone); });
  return matches;
}
function dataOnly(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.length <= 4 && Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return Object.hasOwn(descriptor, 'value') && (key === 'length' || typeof descriptor.value === 'number');
  });
  return [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === 'string' && Object.hasOwn(descriptor, 'value') &&
      (descriptor.value === null || typeof descriptor.value !== 'object' || Array.isArray(descriptor.value) && dataOnly(descriptor.value));
  });
}

/** Resolve the actual current render matrix, including E3 shear. The caller
 * refreshes attachments before each solve; hidden attachments never fall back
 * to their obsolete base Transform3D. Diagnostics belong to the IK controller. */
export function createIKTargetResolver(
  world: IWorld,
  models: ReadonlyMap<string, THREE.Object3D>,
  drawables: ReadonlyMap<string, THREE.Object3D>,
  poses: ReadonlyMap<string, Pose3D>,
  hidden: () => ReadonlySet<string>,
): (target: IKTarget) => ResolvedIKTarget | undefined {
  const root = (world.root ?? world) as IWorld & { readView?: () => IWorld };
  const view = root.readView?.() ?? world, dummy = new THREE.Object3D();
  return target => {
    try {
      if (hidden().has(target.entity)) return undefined;
      const visibility = view.getComponent<Visibility>(target.entity, 'Visibility');
      if (visibility && (!dataOnly(visibility) || !visibility.visible)) return undefined;
      const model = models.get(target.entity), object = model ?? drawables.get(target.entity);
      const dependencies: THREE.Object3D[] = [];
      let matrix: THREE.Matrix4;
      if (target.bone !== undefined) {
        if (!model || !visible(model)) return undefined;
        const matches = bones(model, target.bone);
        if (matches.length !== 1 || !visible(matches[0])) return undefined;
        matches[0].updateWorldMatrix(true, false);
        matrix = matches[0].matrixWorld;
        dependencies.push(matches[0]);
      } else if (object) {
        if (!visible(object)) return undefined;
        object.updateWorldMatrix(true, false);
        matrix = object.matrixWorld;
        dependencies.push(object);
      } else {
        // A missing/hidden model or attachment is not an ordinary point anchor.
        if (view.hasComponent(target.entity, 'Model3D') || view.hasComponent(target.entity, 'Attach3D')) return undefined;
        const pose = poses.get(target.entity);
        if (pose) applyPose(dummy, pose); // Instanced Mesh3D has no per-entity Object3D.
        else {
          const transform = view.getComponent<Transform3D>(target.entity, 'Transform3D');
          if (!transform || !dataOnly(transform) || ![transform.x, transform.y, transform.z].every(Number.isFinite)) return undefined;
          applyPose(dummy, transform3dPose(transform));
        }
        dummy.updateMatrix(); matrix = dummy.matrix;
      }
      // E3 deliberately preserves native parents. Follow data dependencies too,
      // otherwise a prop held by this same arm would evade the self-chase guard.
      const visited = new Set<string>();
      let id = target.entity;
      while (view.hasComponent(id, 'Attach3D')) {
        if (visited.has(id) || hidden().has(id)) return undefined;
        visited.add(id);
        const raw = view.getComponent<Attach3D>(id, 'Attach3D');
        if (!dataOnly(raw)) return undefined;
        const config = validateAttach3D(raw), parent = models.get(config.parentId);
        if (!parent || !visible(parent) || hidden().has(config.parentId)) return undefined;
        const matches = bones(parent, config.bone);
        dependencies.push(matches.length === 1 ? matches[0] : parent); // Same fallback as E3.
        id = config.parentId;
      }
      const e = matrix.elements;
      if (!e.every(Number.isFinite) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || e[15] !== 1) return undefined;
      const position = new THREE.Vector3(...target.offset).applyMatrix4(matrix);
      return position.toArray().every(Number.isFinite) ? { position, dependencies } : undefined;
    } catch { return undefined; } // Controller records a bounded rejection diagnostic.
  };
}
