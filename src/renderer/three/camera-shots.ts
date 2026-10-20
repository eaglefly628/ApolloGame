import type { ComponentNotice, IWorld } from '@engine/core/types.js';
import { validateCameraShot3D, validateCameraShotCarrier, type CameraShot3D, type CameraShot } from '@engine/protocol/components/camera-shot.js';
import { easeTween } from './camera-rig.js';

type Tuple3 = readonly [number, number, number];
export interface CameraShotFrame { readonly eye: Tuple3; readonly target: Tuple3; }
export interface CameraShotResult { readonly frame?: CameraShotFrame; readonly signature: string; readonly active: boolean; }
type ObservedWorld = IWorld & {
  readView?: () => IWorld;
  observeComponents?: (types: readonly string[], listener: (notice: ComponentNotice) => void) => () => void;
};
const EMPTY: CameraShotResult = Object.freeze({ signature: '', active: false });

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]]));
  });
}
const tuple = (value: readonly number[]): Tuple3 => Object.freeze([value[0]!, value[1]!, value[2]!] as [number, number, number]);

/** Pure presentation state. Component notices capture occurrences, never world writes. */
export class CameraShots {
  private root?: ObservedWorld;
  private view?: IWorld;
  private unsubscribe?: () => void;
  private selected?: string;
  private config?: CameraShot3D;
  private configKey = '';
  private pending?: CameraShot;
  private playing?: CameraShot;
  private started = 0;
  private generation = 0;
  private lastValid?: CameraShotFrame;
  private readonly warned = new Set<string>();

  private warn(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key); console.warn(`[camera-shots] ${message}`);
  }
  private resetPlayback(): void {
    this.pending = undefined; this.playing = undefined; this.lastValid = undefined;
  }
  private refresh(): void {
    const view = this.view;
    if (!view) return;
    const id = view.query('Camera3D').find(([entityId]) => !!view.getComponent(entityId, 'Camera3D'))?.[0];
    const raw = id === undefined ? undefined : view.getComponent(id, 'CameraShot3D');
    let config: CameraShot3D | undefined, key = '';
    if (raw !== undefined) {
      try {
        validateCameraShotCarrier(view.getComponent(id!, 'Camera3D'));
        config = validateCameraShot3D(raw); key = canonical({ shots: config.shots, onSignal: config.onSignal });
      }
      catch { config = undefined; key = ''; this.warn('invalid', 'invalid CameraShot3D or carrier rejected; using base camera'); }
    }
    if (id !== this.selected || key !== this.configKey) {
      this.resetPlayback(); this.selected = id; this.configKey = key;
      // A private data copy prevents later raw in-place edits from changing an active shot.
      this.config = config ? structuredClone(config) : undefined;
    }
  }
  private notice(notice: ComponentNotice): void {
    if (notice.kind === 'reset') {
      this.resetPlayback(); this.selected = undefined; this.configKey = ''; this.config = undefined; this.refresh(); return;
    }
    if (notice.kind === 'destroy' && notice.entityId === this.selected
      || notice.kind === 'remove' && notice.entityId === this.selected && ['Camera3D', 'CameraShot3D'].includes(notice.componentType)) this.resetPlayback();
    if (notice.kind !== 'add' || notice.component.type !== 'Signal') { this.refresh(); return; }
    this.refresh();
    const signal = notice.component as { readonly name?: unknown };
    const binding = this.config?.onSignal.find(item => item.signal === signal.name);
    if (!binding) return;
    if (this.pending) this.warn('collapsed', 'multiple pending camera triggers; the last matching publication wins');
    this.pending = this.config!.shots[binding.shot];
  }

  sync(world: IWorld, nowMs: number): CameraShotResult {
    const root = (world.root ?? world) as ObservedWorld;
    if (root !== this.root) {
      this.clear(); this.root = root;
      if (typeof root.observeComponents !== 'function') {
        this.warn('unsupported', 'world has no component observation; using base camera'); return EMPTY;
      }
      this.view = root.readView?.() ?? world;
      this.unsubscribe = root.observeComponents(['Camera3D', 'CameraShot3D', 'Signal'], notice => this.notice(notice));
    }
    if (!this.unsubscribe) return EMPTY;
    this.refresh();
    if (!Number.isFinite(nowMs)) { this.warn('clock', 'nonfinite render time ignored'); return EMPTY; }
    if (this.pending) {
      this.playing = this.pending; this.pending = undefined; this.started = nowMs; this.generation++;
      const first = this.playing.keyframes[0]!;
      this.lastValid = Object.freeze({ eye: tuple(first.eye), target: tuple(first.target) });
    }
    const shot = this.playing;
    if (!shot) return EMPTY;
    const elapsed = Math.max(0, (nowMs - this.started) / 1000), frames = shot.keyframes, last = frames[frames.length - 1]!;
    let eye: Tuple3 = last.eye, target: Tuple3 = last.target;
    if (elapsed < last.at) {
      let index = 0;
      while (index + 1 < frames.length && frames[index + 1]!.at <= elapsed) index++;
      const from = frames[index]!, to = frames[index + 1]!;
      const k = easeTween((elapsed - from.at) / (to.at - from.at), from.ease ?? 'linear');
      eye = tuple(from.eye.map((n, axis) => n + (to.eye[axis]! - n) * k));
      target = tuple(from.target.map((n, axis) => n + (to.target[axis]! - n) * k));
    }
    if (eye.every((n, axis) => n === target[axis])) this.warn('coincident', 'sampled eye equals target; holding last valid view until recovery');
    else this.lastValid = Object.freeze({ eye: tuple(eye), target: tuple(target) });
    const frame = this.lastValid!;
    return { frame, signature: `${this.generation}:${frame.eye.join(',')}:${frame.target.join(',')}`, active: elapsed < last.at };
  }

  clear(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined; this.root = undefined; this.view = undefined;
    this.selected = undefined; this.config = undefined; this.configKey = ''; this.resetPlayback();
  }
}
