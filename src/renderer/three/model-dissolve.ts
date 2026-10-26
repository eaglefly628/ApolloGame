import * as THREE from 'three';
import type { Material3D } from '@engine/protocol/components.js';
import { injectDissolve } from './dissolve.js';

export interface ModelDissolveInput { readonly object: THREE.Object3D; readonly dissolve: NonNullable<Material3D['dissolve']>; readonly texture?: THREE.Texture; }
interface Slot { readonly mesh: THREE.Mesh; readonly original: THREE.Material | THREE.Material[]; readonly installed: THREE.Material | THREE.Material[]; }
interface Entry { readonly object: THREE.Object3D; readonly signature: string; readonly slots: Slot[]; readonly materials: THREE.Material[]; }

/** Own only effect material clones. Geometry, model originals and texture assets stay with their owners. */
export class ModelDissolves {
  private readonly entries = new Map<string, Entry>();
  sync(inputs: ReadonlyMap<string, ModelDissolveInput>): ReadonlyMap<string, readonly THREE.Material[]> {
    const out = new Map<string, readonly THREE.Material[]>();
    for (const [id, old] of this.entries) if (!inputs.has(id)) { this.release(old); this.entries.delete(id); }
    for (const [id, input] of inputs) {
      const { progress: _progress, trigger: _trigger, dur: _dur, direction: _direction, ...shape } = input.dissolve;
      const signature = JSON.stringify([shape, input.texture?.uuid]);
      let entry = this.entries.get(id);
      if (entry && (entry.object !== input.object || entry.signature !== signature)) { this.release(entry); this.entries.delete(id); entry = undefined; }
      if (!entry) {
        const slots: Slot[] = [], materials: THREE.Material[] = [];
        input.object.traverse(object => {
          if (!(object as THREE.Mesh).isMesh) return;
          const mesh = object as THREE.Mesh, original = mesh.material;
          const clone = (material: THREE.Material): THREE.Material => {
            // RENDER-BIND-MODEL-OWNERSHIP: shader uniforms must never live on template/sibling materials.
            const copy = material.clone(); injectDissolve(copy, input.dissolve, input.texture); materials.push(copy); return copy;
          };
          const installed = Array.isArray(original) ? original.map(clone) : clone(original);
          mesh.material = installed; slots.push({ mesh, original, installed });
        });
        entry = { object: input.object, signature, slots, materials }; this.entries.set(id, entry);
      }
      for (const slot of entry.slots) {
        const originals = Array.isArray(slot.original) ? slot.original : [slot.original];
        const installed = Array.isArray(slot.installed) ? slot.installed : [slot.installed];
        originals.forEach((original, index) => {
          const source = original as THREE.MeshStandardMaterial, target = installed[index] as THREE.MeshStandardMaterial;
          if (source.color && target.color) target.color.copy(source.color); // ModelPool.tint continues to own base colour.
        });
      }
      out.set(id, entry.materials);
    }
    return out;
  }
  private release(entry: Entry): void {
    for (const slot of entry.slots) if (slot.mesh.material === slot.installed) slot.mesh.material = slot.original;
    for (const material of entry.materials) material.dispose(); // Never dispose shared texture maps.
  }
  clear(): void { for (const entry of this.entries.values()) this.release(entry); this.entries.clear(); }
}
