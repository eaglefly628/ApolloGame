import type { Component, ComponentListener, ComponentNotice, ComponentType, EntityId } from './types.js';

export type { ComponentListener, ComponentNotice } from './types.js';

interface Subscription {
  readonly types: Set<ComponentType>;
  listener: ComponentListener | undefined;
  reported: boolean;
}

/** Clone only POD data, without evaluating accessors. Never freezes a live component. */
function frozenSnapshot(component: Component): Readonly<Component> {
  const copies = new Map<object, object>();
  const pending: Array<{ source: object; copy: object }> = [];
  const clone = (value: unknown): unknown => {
    if (value === null || typeof value === 'string' || typeof value === 'number'
      || typeof value === 'boolean' || value === undefined) return value;
    if (typeof value !== 'object') throw new Error('component contains non-POD data');
    const found = copies.get(value);
    if (found) return found;
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      throw new Error('component contains a non-POD object');
    }
    const copy: object = Array.isArray(value) ? [] : Object.create(proto) as object;
    copies.set(value, copy);
    pending.push({ source: value, copy });
    return copy;
  };
  const result = clone(component) as Component;
  for (let i = 0; i < pending.length; i++) {
    const { source, copy } = pending[i]!;
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') throw new Error('component contains a symbol key');
      const descriptor = descriptors[key]!;
      if (!('value' in descriptor)) throw new Error('component contains an accessor');
      if (Array.isArray(source) && key === 'length') {
        (copy as unknown[]).length = descriptor.value as number;
      } else if (descriptor.enumerable) {
        Object.defineProperty(copy, key, {
          value: clone(descriptor.value), enumerable: true, writable: true, configurable: true,
        });
      }
    }
  }
  for (const { copy } of pending) Object.freeze(copy);
  return result;
}

function diagnostic(message: string): void {
  // Observability must not make an otherwise successful write fail, even with a custom console.
  try { console.warn(`[World.observeComponents] ${message}`); } catch { /* passive */ }
}

/** Lazily owned by World. No event history or live component references are retained. */
export class ComponentObservers {
  private readonly subscriptions = new Set<Subscription>();
  private readonly byType = new Map<ComponentType, Set<Subscription>>();
  private snapshotReported = false;

  get empty(): boolean { return this.subscriptions.size === 0; }

  subscribe(types: readonly ComponentType[], listener: ComponentListener): () => void {
    const subscription: Subscription = { types: new Set(types), listener, reported: false };
    this.subscriptions.add(subscription);
    for (const type of subscription.types) {
      let subscribers = this.byType.get(type);
      if (!subscribers) this.byType.set(type, subscribers = new Set());
      subscribers.add(subscription);
    }
    return () => {
      if (!subscription.listener) return;
      subscription.listener = undefined;
      this.subscriptions.delete(subscription);
      for (const type of subscription.types) {
        const subscribers = this.byType.get(type)!;
        subscribers.delete(subscription);
        if (subscribers.size === 0) this.byType.delete(type);
      }
      subscription.types.clear();
    };
  }

  watches(type: ComponentType): boolean { return this.byType.has(type); }

  added(entityId: EntityId, component: Component): void {
    try {
      // An extra read of component.type could execute a getter after the original write.
      const descriptor = Object.getOwnPropertyDescriptor(component, 'type');
      if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') {
        throw new Error('component type must be an own data property');
      }
      const subscribers = this.byType.get(descriptor.value);
      if (!subscribers?.size) return;
      const snapshot = frozenSnapshot(component);
      this.deliver(subscribers, Object.freeze({ kind: 'add', entityId, component: snapshot }));
    } catch {
      if (!this.snapshotReported) {
        this.snapshotReported = true;
        diagnostic('component snapshot rejected; the original write is preserved');
      }
    }
  }

  removed(entityId: EntityId, componentType: ComponentType): void {
    const subscribers = this.byType.get(componentType);
    if (subscribers?.size) this.deliver(subscribers, Object.freeze({ kind: 'remove', entityId, componentType }));
  }

  destroyed(entityId: EntityId): void {
    if (!this.empty) this.deliver(this.subscriptions, Object.freeze({ kind: 'destroy', entityId }));
  }

  reset(): void {
    if (!this.empty) this.deliver(this.subscriptions, Object.freeze({ kind: 'reset' }));
  }

  private deliver(subscribers: ReadonlySet<Subscription>, notice: ComponentNotice): void {
    // New subscriptions start at the next publication; cancellation takes effect immediately.
    for (const subscription of [...subscribers]) {
      if (!subscription.listener) continue;
      try { subscription.listener(notice); } catch {
        if (!subscription.reported) {
          subscription.reported = true;
          diagnostic('listener threw; delivery to other listeners continues');
        }
      }
    }
  }
}
