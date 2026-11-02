import * as THREE from 'three';
import { validateFacePose3D, sampleFaceCurve, type FacePose3D } from '../../engine/protocol/components/face-pose.js';
import { driverFields } from '../../engine/protocol/components/animation-driver.js';
import { PERFORMANCE_Q, validateAnimationPerformance3D, validateAnimationPerformancePlayback3D, type AnimationPerformance3D, type AnimationPerformancePlayback3D } from '../../engine/protocol/components/animation-performance.js';

export interface FacialAnimationInput {
  readonly actorId: string;
  readonly face: FacePose3D;
  readonly performance?: AnimationPerformance3D;
  readonly playback?: AnimationPerformancePlayback3D;
}
export interface FacialAnimationDiagnostic { readonly code: string; readonly message: string; readonly channel?: string }
export interface FacialAnimationResult {
  readonly status: 'ready' | 'loading' | 'rejected';
  readonly channels: Readonly<Record<string, number>>;
  readonly diagnostics: readonly FacialAnimationDiagnostic[];
}
interface MeshState { readonly array: number[]; readonly defaults: readonly number[] }
interface Entry {
  readonly meshes: Map<THREE.Mesh, MeshState>;
  readonly previous: Map<THREE.Mesh, Map<number, number>>;
  preparedFrame: boolean;
  actorId?: string;
}
class FaceFailure extends Error {
  constructor(readonly code: string, message: string, readonly channel?: string) { super(message); }
}
function failure(code: string, message: string, channel?: string): never { throw new FaceFailure(code, message, channel); }

/** Call prepare once on each fresh ModelPool clone BEFORE any native mixer
 * binds morph tracks. beginFrame restores prior pre-face values before native
 * base sampling; apply is synchronous and never advances a clock or a World. */
export class FacialAnimationPool {
  private readonly entries = new Map<THREE.Object3D, Entry>();
  private readonly preparedEntries = new WeakMap<THREE.Object3D, Entry>();
  private readonly owners = new WeakMap<THREE.Mesh, THREE.Object3D>();
  private disposed = false;

  prepare(instance: THREE.Object3D | null | undefined): void {
    if (!instance) return;
    if (this.disposed) throw Error('FacePose3D: pool disposed');
    if (this.entries.has(instance)) return;
    const known = this.preparedEntries.get(instance);
    if (known) {
      // Face removal must not invalidate already-bound native morph tracks when
      // the same model is rendered again or receives FacePose3D later.
      for (const [mesh, state] of known.meshes) {
        if (mesh.morphTargetInfluences !== state.array) failure('invalid-model', 'Native morph array changed after preparation');
        if (this.owners.has(mesh) && this.owners.get(mesh) !== instance) failure('shared-mesh', 'Two actors cannot share a mutable Mesh object');
      }
      for (const mesh of known.meshes.keys()) this.owners.set(mesh, instance);
      this.entries.set(instance, known); return;
    }
    const meshes = new Map<THREE.Mesh, MeshState>();
    instance.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      if (this.owners.has(mesh) && this.owners.get(mesh) !== instance) failure('shared-mesh', 'Two actors cannot share a mutable Mesh object');
      const original = mesh.morphTargetInfluences;
      if (original === undefined) return;
      if (!Array.isArray(original) || original.some(v => !Number.isFinite(v))) failure('invalid-model', 'Invalid native morph influence array');
      meshes.set(mesh, { array: [...original], defaults: [...original] });
    });
    // Validate all meshes before replacing any array. Shared geometry/materials
    // remain untouched; only per-instance influence arrays become independent.
    for (const [mesh, state] of meshes) { mesh.morphTargetInfluences = state.array; this.owners.set(mesh, instance); }
    const entry = { meshes, previous: new Map<THREE.Mesh, Map<number, number>>(), preparedFrame: false };
    this.entries.set(instance, entry); this.preparedEntries.set(instance, entry);
  }

  private restore(entry: Entry): void {
    for (const [mesh, values] of entry.previous) {
      const binding = entry.meshes.get(mesh)!;
      // If external code replaced this array, do not write into its new state.
      if (mesh.morphTargetInfluences !== binding.array) continue;
      for (const [index, value] of values) binding.array[index] = value;
    }
    entry.previous.clear();
  }

  beginFrame(instance: THREE.Object3D | null | undefined): void {
    if (!instance) return;
    this.prepare(instance);
    const entry = this.entries.get(instance)!;
    this.restore(entry); entry.preparedFrame = true;
  }

  apply(instance: THREE.Object3D | null | undefined, input: FacialAnimationInput): FacialAnimationResult {
    if (!instance) return { status: 'loading', channels: {}, diagnostics: [{ code: 'model-loading', message: 'Model instance is not available yet' }] };
    try {
      if (this.disposed) failure('disposed', 'Facial pool is disposed');
      const fields = driverFields(input, ['actorId', 'face', 'performance', 'playback'], 'face input');
      if (!Object.hasOwn(fields, 'actorId') || !Object.hasOwn(fields, 'face')) failure('invalid-data', 'Face input requires actorId and face');
      validateFacePose3D(input.face);
      if (typeof input.actorId !== 'string' || !input.actorId || input.actorId.length > 256 || /[\u0000-\u001f\u007f]/.test(input.actorId)) failure('invalid-actor', 'Bounded actor identity is required');
      if (input.performance) validateAnimationPerformance3D(input.performance);
      if (input.playback) {
        if (!input.performance) failure('invalid-performance', 'Playback requires its matching configuration');
        validateAnimationPerformancePlayback3D(input.performance, input.playback);
        if (input.playback.actorId !== input.actorId) failure('actor-mismatch', 'Performance playback belongs to another actor');
      }
      const entry = this.entries.get(instance);
      if (!entry?.preparedFrame) failure('frame-order', 'Call prepare before mixer binding and beginFrame before base animation and face');
      if (entry.actorId && entry.actorId !== input.actorId) failure('actor-mismatch', 'Model instance is bound to another actor');
      const meshes = new Map<string, THREE.Mesh[]>();
      instance.traverse(node => { if ((node as THREE.Mesh).isMesh) { const group = meshes.get(node.name) ?? []; group.push(node as THREE.Mesh); meshes.set(node.name, group); } });
      const targetIndices = new Map<THREE.Mesh, Set<number>>();
      const writes: { alias: string; mesh: THREE.Mesh; index: number; value: number }[] = [];
      for (const alias of Object.keys(input.face.channels).sort()) {
        const channel = input.face.channels[alias], found = meshes.get(channel.mesh) ?? [];
        if (found.length !== 1) failure('unsupported-mesh', 'Named mesh must exist exactly once: ' + channel.mesh, alias);
        const mesh = found[0], binding = entry.meshes.get(mesh), descriptor = mesh.morphTargetDictionary && Object.getOwnPropertyDescriptor(mesh.morphTargetDictionary, channel.morph);
        if (!binding || !descriptor || !('value' in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0 || descriptor.value >= binding.array.length) failure('unsupported-morph', 'Named native morph is unavailable: ' + channel.morph, alias);
        if (!Object.values(mesh.geometry.morphAttributes).some(attributes => Array.isArray(attributes) && attributes[descriptor.value] !== undefined)) failure('unsupported-morph', 'Named morph has no native geometry target', alias);
        const indices = targetIndices.get(mesh) ?? new Set<number>();
        if (indices.has(descriptor.value)) failure('ambiguous-morph', 'Two channels resolve to the same native morph index', alias);
        indices.add(descriptor.value); targetIndices.set(mesh, indices);
        if (mesh.morphTargetInfluences !== binding.array || binding.array.some(v => !Number.isFinite(v))) failure('invalid-model', 'Native morph array changed after preparation', alias);
        let value: number;
        if (typeof channel.weight === 'number') value = channel.weight;
        else {
          const curve = channel.weight;
          if (input.performance && !Object.hasOwn(input.performance.slots, curve.slot)) failure('invalid-slot', 'Curve references a slot absent from the performance configuration', alias);
          const slot = input.playback?.slots[curve.slot];
          value = slot ? sampleFaceCurve(curve, slot.cursorTick) * slot.weightQ / PERFORMANCE_Q : 0;
          if (slot?.outgoing) value += sampleFaceCurve(curve, slot.outgoing.cursorTick) * slot.outgoing.weightQ / PERFORMANCE_Q;
        }
        if (!Number.isFinite(value) || value < 0 || value > 1 + 1e-12) failure('invalid-weight', 'Composed face weight is outside 0..1', alias);
        writes.push({ alias, mesh, index: descriptor.value, value: Math.min(1, value) });
      }
      // Atomic data/binding validation above. Repeat apply within the same frame
      // restores the same pre-face base rather than sampling its own last output.
      this.restore(entry); entry.actorId = input.actorId;
      const channels: Record<string, number> = {};
      for (const w of writes) {
        const values = entry.previous.get(w.mesh) ?? new Map<number, number>();
        values.set(w.index, w.mesh.morphTargetInfluences![w.index]); entry.previous.set(w.mesh, values);
        w.mesh.morphTargetInfluences![w.index] = w.value; channels[w.alias] = w.value;
      }
      return { status: 'ready', channels, diagnostics: [] };
    } catch (error) {
      const e = error instanceof FaceFailure ? error : new FaceFailure('invalid-data', error instanceof Error ? error.message : String(error));
      return { status: 'rejected', channels: {}, diagnostics: [{ code: e.code, message: e.message, ...(e.channel ? { channel: e.channel } : {}) }] };
    }
  }

  /** Restore pre-face base, not the model's original default: native facial
   * animation in the current frame remains authoritative after removing Face. */
  clear(instance: THREE.Object3D): void {
    const entry = this.entries.get(instance); if (!entry) return;
    this.restore(entry);
    for (const mesh of entry.meshes.keys()) this.owners.delete(mesh);
    delete entry.actorId; entry.preparedFrame = false;
    this.entries.delete(instance);
  }
  dispose(): void {
    if (this.disposed) return;
    for (const instance of this.entries.keys()) this.clear(instance);
    this.disposed = true;
  }
}
