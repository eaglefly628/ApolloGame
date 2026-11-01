import * as THREE from 'three';

/** Render projection only: all clip selection, loop wrapping and time authority
 * belong to the fixed-tick driver. This sampler never advances a clock. */
export interface DriverPoseSample { readonly clip: string; readonly timeSeconds: number; readonly weight: number; }
export interface DriverPoseClip { readonly clip: THREE.AnimationClip; readonly durationTicks: number; }
/** GLTF stores times as float32. Compare seconds, not rounded duration ticks. */
export function driverDurationToleranceSeconds(tickRate: number): number { return Math.max(1e-6, 1 / tickRate); }

export class AnimationDriverPoseSampler {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly durations = new Map<string, number>();
  private lastSignature?: string;
  private disposed = false;

  constructor(private readonly root: THREE.Object3D, tickRate: number, clips: ReadonlyMap<string, DriverPoseClip>) {
    if (!Number.isSafeInteger(tickRate) || tickRate < 1 || tickRate > 240 || clips.size < 1 || clips.size > 64) throw new Error('AnimationDriver3D pose: invalid tick rate or clip budget');
    // Validate the entire binding before allocating native mixer/action bindings.
    for (const [alias, spec] of clips) {
      if (!alias || !Number.isSafeInteger(spec.durationTicks) || spec.durationTicks < 1 || !Number.isFinite(spec.clip.duration) || spec.clip.duration <= 0
        || Math.abs(spec.clip.duration - spec.durationTicks / tickRate) > driverDurationToleranceSeconds(tickRate) + 1e-12) throw new Error(`AnimationDriver3D pose: clip duration mismatch for "${alias}"`);
    }
    this.mixer = new THREE.AnimationMixer(root);
    for (const [alias, spec] of clips) {
      // Native clipAction caches UUID; aliases need independent absolute times.
      const action = this.mixer.clipAction(spec.clip.clone());
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
      action.setEffectiveTimeScale(0); action.setEffectiveWeight(0); action.play();
      action.paused = true;
      this.actions.set(alias, action); this.durations.set(alias, spec.durationTicks / tickRate);
    }
  }

  sample(samples: readonly DriverPoseSample[]): { readonly changed: boolean } {
    if (this.disposed) throw new Error('AnimationDriver3D pose: sampler disposed');
    if (!Array.isArray(samples) || samples.length > 64) throw new Error('AnimationDriver3D pose: sample budget exceeded');
    const seen = new Set<string>(); let total = 0;
    for (const sample of samples) {
      const duration = this.durations.get(sample.clip);
      if (duration === undefined || seen.has(sample.clip) || !Number.isFinite(sample.timeSeconds) || sample.timeSeconds < 0 || sample.timeSeconds > duration
        || !Number.isFinite(sample.weight) || sample.weight < 0 || sample.weight > 1) throw new Error('AnimationDriver3D pose: invalid absolute sample');
      seen.add(sample.clip); total += sample.weight;
    }
    if (total > 1 + 1e-9) throw new Error('AnimationDriver3D pose: sample weights exceed one');
    const signature = JSON.stringify(samples);
    // Always reapply: post-animation IK can mutate bones even on an unchanged
    // snapshot. changed only controls render invalidation, never pose correctness.
    // Release/restore native bindings first. PropertyMixer suppresses identical
    // values otherwise, which can leave a previous IK-modified bone untouched.
    this.mixer.stopAllAction();
    for (const action of this.actions.values()) { action.reset(); action.enabled = true; action.play(); action.setEffectiveWeight(0); }
    for (const sample of samples) {
      const action = this.actions.get(sample.clip)!;
      action.time = sample.timeSeconds;
      action.paused = true; action.setEffectiveTimeScale(0); action.setEffectiveWeight(sample.weight);
    }
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const changed = this.lastSignature !== signature; this.lastSignature = signature;
    return { changed };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root);
    this.actions.clear(); this.durations.clear(); this.lastSignature = undefined;
  }
}
