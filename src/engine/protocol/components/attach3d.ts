import type { Component } from '../../core/types.js';

/** Render-only bone attachment. Offsets are local metres; rotation is local XYZ radians. */
export interface Attach3D extends Component {
  readonly type: 'Attach3D';
  readonly parentId: string;
  readonly bone: string;
  readonly offset: readonly [number, number, number];
  readonly rot: readonly [number, number, number];
}

function reject(message: string): never { throw new Error(`Attach3D: ${message}`); }

function tuple(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 3) reject(`${label} must be a finite tuple of length 3`);
  for (const key of Reflect.ownKeys(value)) if (!['0', '1', '2', 'length'].includes(key as string)) reject(`${label}: unknown tuple field ${String(key)}`);
  for (const index of ['0', '1', '2']) {
    const data = Object.getOwnPropertyDescriptor(value, index);
    if (!data || !Object.hasOwn(data, 'value') || !Number.isFinite(data.value)) reject(`${label} must contain three finite numbers`);
  }
}

/** Closed, pure data validation. Bare blueprints may omit type; input is never normalized. */
export function validateAttach3D(value: unknown): Attach3D {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('must be a plain object');
  for (const key of Reflect.ownKeys(value)) {
    if (!['type', 'parentId', 'bone', 'offset', 'rot'].includes(key as string)) reject(`unknown field ${String(key)}`);
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')) reject(`${String(key)} must be plain data`);
  }
  const data = value as Record<string, unknown>;
  if (data.type !== undefined && data.type !== 'Attach3D') reject('type must be Attach3D');
  for (const field of ['parentId', 'bone']) {
    if (!Object.hasOwn(data, field) || typeof data[field] !== 'string' || !(data[field] as string).trim() || (data[field] as string).length > 256)
      reject(`${field} must be nonempty text (max256)`);
  }
  tuple(data.offset, 'offset');
  tuple(data.rot, 'rot');
  return value as Attach3D;
}
