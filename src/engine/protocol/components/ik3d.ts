import type { Component } from '../../core/types.js';

export interface IKTarget {
  readonly entity: string;
  readonly bone?: string;
  readonly offset: readonly [number, number, number];
}

export type IKWeight = number | { readonly param: string; readonly fade: number };

/** Render-only two-bone constraints and local +Z look-at, applied after animation. */
export interface IK3D extends Component {
  readonly type: 'IK3D';
  readonly chains: readonly {
    readonly kind: 'two-bone';
    readonly root: string;
    readonly mid: string;
    readonly end: string;
    readonly target: IKTarget;
    readonly pole?: readonly [number, number, number];
    readonly weight: IKWeight;
  }[];
  readonly lookAt?: { readonly bone: string; readonly target: IKTarget; readonly weight: IKWeight };
}

function reject(message: string): never { throw new Error(`IK3D: ${message}`); }
function record(value: unknown, label: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    if (!allowed.includes(key as string)) reject(`${label}: unknown field ${String(key)}`);
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')) reject(`${label}.${String(key)} must be plain data`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): void {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) reject(`${label} must be nonempty text (max256)`);
}
function tuple(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 3) reject(`${label} must be a finite tuple of length 3`);
  for (const key of Reflect.ownKeys(value)) if (!['0', '1', '2', 'length'].includes(key as string)) reject(`${label}: unknown tuple field ${String(key)}`);
  for (const index of ['0', '1', '2']) {
    const data = Object.getOwnPropertyDescriptor(value, index);
    if (!data || !Object.hasOwn(data, 'value') || !Number.isFinite(data.value)) reject(`${label} must contain three finite numbers`);
  }
}
function target(value: unknown, label: string): void {
  const data = record(value, label, ['entity', 'bone', 'offset']);
  text(data.entity, `${label}.entity`);
  if (Object.hasOwn(data, 'bone')) text(data.bone, `${label}.bone`);
  tuple(data.offset, `${label}.offset`);
}
function weight(value: unknown, label: string): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 1) reject(`${label} must be finite in 0..1`);
    return;
  }
  const data = record(value, label, ['param', 'fade']);
  text(data.param, `${label}.param`);
  if (typeof data.fade !== 'number' || !Number.isFinite(data.fade) || data.fade < 0 || data.fade > 60) reject(`${label}.fade must be finite in 0..60`);
}

/** Closed raw blueprint validation. No normalization, target lookup or world writes. */
export function validateIK3D(value: unknown): IK3D {
  const data = record(value, 'component', ['type', 'chains', 'lookAt']);
  if (data.type !== undefined && data.type !== 'IK3D') reject('type must be IK3D');
  if (!Array.isArray(data.chains) || data.chains.length > 16) reject('chains must be an array with 0..16 entries');
  for (const key of Reflect.ownKeys(data.chains)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= data.chains.length)) reject(`chains: unknown array field ${String(key)}`);
  }
  if (data.chains.length === 0 && !Object.hasOwn(data, 'lookAt')) reject('empty chains require lookAt');
  for (let i = 0; i < data.chains.length; i++) {
    const item = Object.getOwnPropertyDescriptor(data.chains, String(i));
    if (!item || !Object.hasOwn(item, 'value')) reject('chains must contain plain data without holes');
    const label = `chains.${i}`, chain = record(item.value, label, ['kind', 'root', 'mid', 'end', 'target', 'pole', 'weight']);
    if (chain.kind !== 'two-bone') reject(`${label}.kind must be two-bone`);
    for (const name of ['root', 'mid', 'end']) text(chain[name], `${label}.${name}`);
    if (new Set([chain.root, chain.mid, chain.end]).size !== 3) reject(`${label} root/mid/end must be distinct`);
    target(chain.target, `${label}.target`);
    if (Object.hasOwn(chain, 'pole')) tuple(chain.pole, `${label}.pole`);
    weight(chain.weight, `${label}.weight`);
  }
  if (Object.hasOwn(data, 'lookAt')) {
    const lookAt = record(data.lookAt, 'lookAt', ['bone', 'target', 'weight']);
    text(lookAt.bone, 'lookAt.bone'); target(lookAt.target, 'lookAt.target'); weight(lookAt.weight, 'lookAt.weight');
  }
  return value as IK3D;
}
