import type { Component } from '../../core/types.js';

export interface CameraShotKeyframe {
  readonly at: number;
  readonly eye: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly ease?: 'linear' | 'cubicOut' | 'inOut';
}
export interface CameraShot { readonly keyframes: readonly CameraShotKeyframe[]; }
export interface CameraShotBinding { readonly signal: string; readonly shot: string; }
export interface CameraShot3D extends Component {
  readonly type: 'CameraShot3D';
  readonly shots: Readonly<Record<string, CameraShot>>;
  readonly onSignal: readonly CameraShotBinding[];
}

/** Resolved render context, never additional component fields or implicit defaults. */
export interface CameraShotProjection {
  readonly projection: 'perspective' | 'ortho';
  readonly near: number;
  readonly far: number;
  readonly fov: number;
  readonly orthoSize: number;
  readonly aspect: number;
}

function reject(message: string): never { throw new Error(`CameraShot3D: ${message}`); }
function record(value: unknown, label: string, allowed?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (allowed && !allowed.includes(key))) reject(`${label}: unknown field ${String(key)}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) reject(`${label}.${key} must be enumerable plain data`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) reject(`${label} must be nonempty text (max256)`);
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > max) reject(`${label} must contain 1..${max} entries`);
  for (const key of Reflect.ownKeys(value)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) reject(`${label}: unknown array field ${String(key)}`);
  }
  for (let i = 0; i < value.length; i++) {
    const data = Object.getOwnPropertyDescriptor(value, String(i));
    if (!data || !Object.hasOwn(data, 'value')) reject(`${label} must be plain data without holes`);
  }
  return value;
}
function tuple(value: unknown, label: string): readonly number[] {
  const values = list(value, label, 3);
  if (values.length !== 3 || values.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e6)) reject(`${label} must be a finite tuple3 with abs <= 1e6`);
  return values as number[];
}

/** Strict raw blueprint validation; preserves input identity and never normalizes. */
export function validateCameraShot3D(value: unknown): CameraShot3D {
  const data = record(value, 'component', ['type', 'shots', 'onSignal']);
  if (Object.hasOwn(data, 'type') && data.type !== 'CameraShot3D') reject('type must be CameraShot3D');
  const shots = record(data.shots, 'shots'), names = Object.keys(shots);
  if (names.length < 1 || names.length > 32) reject('shots must contain 1..32 entries');
  let total = 0;
  for (const name of names) {
    text(name, 'shot name');
    const shot = record(shots[name], `shots.${name}`, ['keyframes']);
    const frames = list(shot.keyframes, `shots.${name}.keyframes`, 64);
    total += frames.length;
    if (total > 512) reject('keyframes total exceeds 512');
    let previous = -1;
    for (let i = 0; i < frames.length; i++) {
      const frame = record(frames[i], `shots.${name}.keyframes.${i}`, ['at', 'eye', 'target', 'ease']);
      if (typeof frame.at !== 'number' || !Number.isFinite(frame.at) || frame.at < 0 || frame.at > 600
        || (i === 0 ? frame.at !== 0 : frame.at <= previous)) reject('at must start at 0, strictly increase and be <= 600 seconds');
      previous = frame.at;
      const eye = tuple(frame.eye, 'eye'), target = tuple(frame.target, 'target');
      if (eye.every((n, axis) => n === target[axis])) reject('eye must differ from target');
      if (Object.hasOwn(frame, 'ease') && !['linear', 'cubicOut', 'inOut'].includes(frame.ease as string)) reject('ease must be linear/cubicOut/inOut');
    }
  }
  const bindings = list(data.onSignal, 'onSignal', 64), signals = new Set<string>();
  for (const value of bindings) {
    const binding = record(value, 'binding', ['signal', 'shot']);
    text(binding.signal, 'signal'); text(binding.shot, 'shot');
    if (signals.has(binding.signal)) reject('onSignal signal must be unique');
    signals.add(binding.signal);
    if (!Object.hasOwn(shots, binding.shot)) reject(`binding references missing shot ${binding.shot}`);
  }
  return value as CameraShot3D;
}

function coefficient(value: number, label: string): number {
  const gpu = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(gpu) || gpu === 0) reject(`projection ${label} is not finite, nonzero Float32 data`);
  return gpu;
}

/** The centered camera's native Matrix4 cofactor order, without a three dependency. */
function inverse(x: number, y: number, z: number, depth: number, perspective: boolean): readonly number[] {
  // All factors already passed coefficient(): even three minimal/maximal Float32
  // factors stay nonzero/finite in Float64, so this sparse determinant is safe.
  const xy = x * y, determinant = xy * (perspective ? depth : z);
  const reciprocal = 1 / determinant;
  return perspective
    ? [(y * depth) * reciprocal, (x * depth) * reciprocal, xy * reciprocal, (-depth * xy) * reciprocal, (z * xy) * reciprocal]
    : [(y * z) * reciprocal, (x * z) * reciprocal, xy * reciprocal, (-depth * xy) * reciprocal, (z * xy) * reciprocal];
}

/** Match native WebGL projection arithmetic and its inverse before GPU upload. */
export function validateCameraShotProjection(value: CameraShotProjection): void {
  const { projection, near, far, fov, orthoSize, aspect } = value;
  if (projection !== 'perspective' && projection !== 'ortho') reject('projection kind is invalid');
  if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near) reject('projection clip planes must be finite with 0 < near < far');
  const perspective = projection === 'perspective';
  let x: number, y: number, z: number, depth: number;
  if (perspective) {
    if (!Number.isFinite(fov) || fov <= 0 || fov >= 180 || !Number.isFinite(aspect) || aspect <= 0) reject('projection perspective lens/aspect is invalid');
    // eslint-disable-next-line zerocraft/no-transcendental -- Render-only admission must match native PerspectiveCamera arithmetic; never feeds simulation state.
    const top = near * Math.tan((Math.PI / 180) * 0.5 * fov), height = 2 * top, width = aspect * height, left = -0.5 * width;
    x = 2 * near / ((left + width) - left); y = 2 * near / (top - (top - height));
    z = -(far + near) / (far - near); depth = (-2 * far * near) / (far - near);
  } else {
    if (!Number.isFinite(orthoSize) || !Number.isFinite(aspect)) reject('projection orthographic lens/aspect is invalid');
    const halfH = Math.max(orthoSize, 1e-3), halfW = halfH * Math.max(aspect, 1e-6);
    // OrthographicCamera first halves the supplied full spans, then rebuilds its bounds.
    const dx = (halfW - -halfW) / 2, dy = (halfH - -halfH) / 2;
    x = 2 / (dx - -dx); y = 2 / (dy - -dy);
    z = -2 / (far - near); depth = -(far + near) / (far - near);
  }
  const gpu = [coefficient(x, 'x'), coefficient(y, 'y'), coefficient(z, 'z'), coefficient(depth, 'depth')];
  for (const entry of inverse(x, y, z, depth, perspective)) coefficient(entry, 'inverse');
  for (const entry of inverse(gpu[0]!, gpu[1]!, gpu[2]!, gpu[3]!, perspective)) coefficient(entry, 'Float32 inverse');
}

/** Safety checks only for an opt-in shot carrier; legacy cameras remain unchanged. */
export function validateCameraShotCarrier(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('requires valid Camera3D with finite yaw/pitch');
  const camera = value as Record<string, unknown>;
  for (const key of Reflect.ownKeys(camera)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(camera, key)!, 'value')) reject('Camera3D must be plain data');
  if (!Number.isFinite(camera.yaw) || !Number.isFinite(camera.pitch)) reject('requires valid Camera3D with finite yaw/pitch');
  for (const key of ['distance', 'fov', 'orthoSize', 'near', 'far']) {
    const field = camera[key];
    if (Object.hasOwn(camera, key) && (typeof field !== 'number' || !Number.isFinite(field) || field <= 0)) reject(`Camera3D.${key} must be finite and positive`);
  }
  if (typeof camera.fov === 'number' && camera.fov >= 180) reject('Camera3D.fov must be below 180');
  if (typeof camera.far === 'number' && camera.far <= (typeof camera.near === 'number' ? camera.near : 1)) reject('Camera3D.far must exceed near');
  if (Object.hasOwn(camera, 'projection') && !['perspective', 'ortho'].includes(camera.projection as string)) reject('Camera3D.projection must be perspective/ortho');
  if (Object.hasOwn(camera, 'type') && camera.type !== 'Camera3D') reject('Camera3D type must be Camera3D');
  // Static checks isolate authored fields from scene-dependent defaults. The renderer
  // validates the complete actual context again (viewport, fit radius, defaults, far).
  const canonical: CameraShotProjection = { projection: 'perspective', near: 1, far: 10000, fov: 50, orthoSize: 1, aspect: 1 };
  if (typeof camera.fov === 'number') validateCameraShotProjection({ ...canonical, fov: camera.fov });
  if (typeof camera.orthoSize === 'number') validateCameraShotProjection({ ...canonical, projection: 'ortho', orthoSize: camera.orthoSize });
  if (typeof camera.near === 'number' || typeof camera.far === 'number') {
    const near = typeof camera.near === 'number' ? camera.near : 1;
    const far = typeof camera.far === 'number' ? camera.far : Math.max(10000, near * 2);
    validateCameraShotProjection({ ...canonical, projection: camera.projection === 'ortho' ? 'ortho' : 'perspective', near, far });
  }
}
