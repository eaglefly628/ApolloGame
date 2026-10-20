// E2 render-only: graph weights are data; native three actions sample all tracks.
import * as THREE from 'three';
import type { AnimGraph3D } from '@engine/protocol/components.js';
import { validateAnimGraph3D } from '@engine/protocol/components/anim-graph.js';

type Params = Readonly<Record<string, number | string | boolean | undefined>>;
type Transition = AnimGraph3D['transitions'][number];
type Fade = { readonly start: ReadonlyMap<string, number>; readonly duration: number; elapsed: number };

function matches(rule: Transition, params: Params): boolean {
  const actual = params[rule.whenParam], expected = rule.value;
  // Missing sources are never false (including `ne`), and coercion is forbidden.
  if (actual === undefined || typeof actual !== typeof expected) return false;
  if (typeof actual === 'number' && !Number.isFinite(actual)) return false;
  switch (rule.cmp) {
    case 'eq': return actual === expected;
    case 'ne': return actual !== expected;
    case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
  }
}

/** Owns one model instance only. Configuration is validated before construction. */
export class AnimationGraphController {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly lastBlendTargets = new Map<string, ReadonlyMap<string, number>>();
  private readonly missingParams = new Set<string>();
  private weights = new Map<string, number>();
  private state: string;
  private fade?: Fade;
  private initialized = false;
  private disposed = false;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly graph: AnimGraph3D,
    clips: ReadonlyMap<string, { clip: THREE.AnimationClip; loop: boolean }>,
  ) {
    validateAnimGraph3D(graph); // Also guard direct world construction, not only asset loading.
    this.state = Object.keys(graph.states)[0];
    if (!this.state) throw new Error('AnimGraph3D requires an initial state');
    // Reject before allocating bindings so a failed constructor cannot leak them.
    for (const alias of Object.keys(graph.clips)) {
      if (!clips.has(alias)) throw new Error(`AnimGraph3D missing clip alias: ${alias}`);
    }
    this.mixer = new THREE.AnimationMixer(root);
    for (const [alias, config] of Object.entries(graph.clips)) {
      const source = clips.get(alias)!;
      // clipAction caches by clip UUID. Each alias must have its own native action,
      // even when two aliases refer to exactly the same source clip.
      const action = this.mixer.clipAction(source.clip.clone());
      const loop = config.loop ?? source.loop;
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !loop;
      action.setEffectiveTimeScale(config.speed ?? 1);
      action.setEffectiveWeight(0);
      this.actions.set(alias, action);
      this.weights.set(alias, 0);
    }
  }

  private target(params: Params): Map<string, number> {
    const state = this.graph.states[this.state];
    const result = new Map<string, number>();
    if (state.clip !== undefined) {
      result.set(state.clip, 1);
      return result;
    }
    const { points, param } = state.blend;
    const value = params[param];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      if (!this.missingParams.has(param)) {
        this.missingParams.add(param);
        console.warn(`AnimGraph3D: missing numeric blend parameter ${param}; retaining available target weights`);
      }
      // No invented endpoint: retain this state's last valid target, or its bind
      // pose when this state has never received a valid numeric source.
      return new Map(this.lastBlendTargets.get(this.state));
    }
    const x = value;
    if (x <= points[0].at) result.set(points[0].clip, 1);
    else if (x >= points[points.length - 1].at) result.set(points[points.length - 1].clip, 1);
    else {
      for (let i = 1; i < points.length; i++) {
        const left = points[i - 1], right = points[i];
        if (x > right.at) continue;
        const span = right.at - left.at;
        // Finite endpoints can still have an infinite difference. Halving only
        // that case bounds both differences while preserving subnormal spans.
        const t = Number.isFinite(span)
          ? (x - left.at) / span
          : (x / 2 - left.at / 2) / (right.at / 2 - left.at / 2);
        result.set(left.clip, 1 - t);
        result.set(right.clip, (result.get(right.clip) ?? 0) + t);
        break;
      }
    }
    this.lastBlendTargets.set(this.state, result);
    return result;
  }

  update(dtSeconds: number, params: Params): { live: boolean; changed: boolean } {
    if (this.disposed) return { live: false, changed: false };
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new Error('AnimGraph3D delta must be finite and nonnegative');
    let changed = !this.initialized;
    if (!this.initialized) {
      // Establish a real source pose before a first-frame transition can fade it.
      const initial = this.target(params);
      for (const alias of this.actions.keys()) this.weights.set(alias, initial.get(alias) ?? 0);
      this.initialized = true;
    }
    const rule = this.graph.transitions.find(candidate => candidate.from === this.state && matches(candidate, params));
    if (rule) {
      if (this.state !== rule.to) changed = true;
      this.state = rule.to;
      this.fade = rule.fade > 0 ? { start: new Map(this.weights), duration: rule.fade, elapsed: 0 } : undefined;
    }
    const target = this.target(params);
    const fade = this.fade;
    if (fade) {
      fade.elapsed = Math.min(fade.duration, fade.elapsed + dtSeconds);
      if (dtSeconds > 0) changed = true; // Include the final transition frame, even for identical target poses.
    }
    const t = fade ? fade.elapsed / fade.duration : 1;
    for (const [alias, action] of this.actions) {
      const previous = this.weights.get(alias) ?? 0;
      const goal = target.get(alias) ?? 0;
      const weight = fade ? (fade.start.get(alias) ?? 0) * (1 - t) + goal * t : goal;
      if (weight !== previous) changed = true;
      this.weights.set(alias, weight);
      if (weight > 0 && !action.isScheduled()) action.reset().play();
      else if (weight === 0 && action.isScheduled()) action.stop();
      // Do not also call fadeIn/fadeOut: setEffectiveWeight stops native fading.
      action.setEffectiveWeight(weight);
      // Capture before update so a LoopOnce's final frame still invalidates once.
      if (weight > 0 && action.isRunning() && dtSeconds > 0) changed = true;
    }
    if (fade && t === 1) this.fade = undefined;
    // Even dt=0 applies newly selected paused poses and parameter-only blending.
    this.mixer.update(dtSeconds);
    const live = !!this.fade || [...this.actions].some(([alias, action]) => (this.weights.get(alias) ?? 0) > 0 && action.isRunning());
    return { live, changed };
  }

  /** Copies only: callers cannot mutate native actions or the private state. */
  get debug() {
    return {
      state: this.state,
      weights: Object.fromEntries(this.weights) as Readonly<Record<string, number>>,
      actions: Object.fromEntries([...this.actions].map(([alias, action]) => [alias, {
        time: action.time, speed: action.timeScale, loop: action.loop === THREE.LoopRepeat,
        running: action.isRunning(), scheduled: action.isScheduled(),
      }])) as Readonly<Record<string, Readonly<{ time: number; speed: number; loop: boolean; running: boolean; scheduled: boolean }>>>,
      resources: {
        actions: this.mixer.stats.actions.total, activeActions: this.mixer.stats.actions.inUse,
        bindings: this.mixer.stats.bindings.total, activeBindings: this.mixer.stats.bindings.inUse,
        interpolants: this.mixer.stats.controlInterpolants.total,
      },
    } as const;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fade = undefined;
    this.mixer.stopAllAction(); // Native property bindings restore their original pose.
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.weights.clear();
    this.lastBlendTargets.clear();
    this.missingParams.clear();
  }
}
