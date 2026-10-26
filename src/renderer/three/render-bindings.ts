import type { Component, ComponentNotice, IWorld } from '@engine/core/types.js';
import type { Flag, Resource } from '@engine/protocol/components.js';
import { validateRenderBinding3D, validateRenderBindingCarriers, type RenderBinding, type RenderBinding3D } from '@engine/protocol/components/render-binding.js';
import { easeTween } from './camera-rig.js';

type Root = IWorld & { readView?: () => IWorld; observeComponents?: (types: readonly string[], listener: (n: ComponentNotice) => void) => () => void };
interface Channel { readonly config: RenderBinding; enabled: boolean; value?: number; goal?: number; from?: number; start: number; }
interface Entry { readonly key: string; readonly channels: Channel[]; }
export interface RenderBindingFrame { readonly world: IWorld; readonly signature: string; readonly active: boolean; readonly hover: boolean; readonly dissolves?: ReadonlySet<string>; }
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
}

/** Read-only projection: observations record signal decisions; only render sync samples time. */
export class RenderBindings {
  private root?: Root;
  private view?: IWorld;
  private unsubscribe?: () => void;
  private readonly entries = new Map<string, Entry>();
  private readonly warned = new Set<string>();
  private lastTime?: number;
  revision = 0;
  private warn(key: string, message: string): void {
    if (!this.warned.has(key)) { this.warned.add(key); console.warn(`[render-bindings] reject: ${message}`); }
  }
  private refresh(): void {
    const view = this.view;
    if (!view) return;
    const seen = new Set<string>();
    for (const id of view.queryEntities('RenderBinding3D')) {
      seen.add(id);
      try {
        const raw = validateRenderBinding3D(view.getComponent(id, 'RenderBinding3D'));
        validateRenderBindingCarriers(raw, type => view.getComponent(id, type));
        const key = canonical(raw.bindings);
        if (this.entries.get(id)?.key !== key) this.entries.set(id, { key, channels: structuredClone(raw.bindings).map(config => ({ config, enabled: false, start: 0 })) });
      } catch (error) {
        this.entries.delete(id); this.warn(`config:${id}`, `${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const id of this.entries.keys()) if (!seen.has(id)) this.entries.delete(id);
  }
  private notice(notice: ComponentNotice): void {
    if (notice.kind === 'reset') { this.entries.clear(); this.lastTime = undefined; this.revision++; this.refresh(); return; }
    if (notice.kind === 'destroy' || notice.kind === 'remove' && notice.componentType === 'RenderBinding3D') {
      if (this.entries.delete(notice.entityId)) this.revision++;
    }
    this.refresh();
    if (notice.kind !== 'add' || notice.component.type !== 'Signal') return;
    const signal = notice.component as Component & { name?: unknown; arg?: unknown };
    for (const [id, entry] of this.entries) for (const channel of entry.channels) {
      const source = channel.config.source;
      if (source.kind !== 'signal' || source.arg === 'self' && signal.arg !== id) continue;
      if (signal.name === source.on) channel.enabled = true;
      else if (signal.name === source.off) channel.enabled = false;
    }
  }
  prepare(world: IWorld): boolean {
    const root = (world.root ?? world) as Root;
    if (root !== this.root) {
      this.clear(); this.root = root; this.view = root.readView?.() ?? world;
      if (root.observeComponents) this.unsubscribe = root.observeComponents(['RenderBinding3D', 'Signal'], n => this.notice(n));
    }
    this.refresh();
    return [...this.entries.values()].some(entry => entry.channels.some(c => c.config.source.kind === 'hover'));
  }
  sync(world: IWorld, nowMs: number, hovered: string | null = null): RenderBindingFrame {
    this.prepare(world);
    if (!this.entries.size) return { world, signature: '', active: false, hover: false };
    if (!Number.isFinite(nowMs)) { this.warn('clock', 'nonfinite render time; authored values retained'); return { world, signature: '', active: false, hover: false }; }
    const rewind = this.lastTime !== undefined && nowMs < this.lastTime;
    this.lastTime = nowMs;
    const view = this.view!, overrides = new Map<string, Map<string, Component>>(), sig: unknown[] = [];
    let active = false, hover = false;
    for (const [id, entry] of this.entries) for (const channel of entry.channels) {
      const binding = channel.config, source = binding.source;
      let ratio: number | undefined;
      if (source.kind === 'hover') { ratio = hovered === id ? 1 : 0; hover = true; }
      else if (source.kind === 'signal') {
        if (!this.unsubscribe) { this.warn('observation', 'world has no component observation; signal bindings retain authored values'); continue; }
        ratio = channel.enabled ? 1 : 0;
      } else {
        const type = source.kind === 'flag' ? 'Flag' : 'Resource', owner = view.byId(type, 'id', source.id);
        const data = owner === undefined ? undefined : view.getComponent<Resource | Flag>(owner, type);
        if (source.kind === 'flag' && data && 'active' in data && typeof data.active === 'boolean') ratio = data.active ? 1 : 0;
        if (source.kind === 'resource-ratio' && data && 'current' in data) {
          const span = data.max - data.min, n = (data.current - data.min) / span;
          if ([data.current, data.min, data.max, span, n].every(Number.isFinite) && span > 0) ratio = Math.max(0, Math.min(1, n));
        }
        if (ratio === undefined) {
          this.warn(`source:${id}:${binding.target}`, `${id}.${binding.target}: missing/invalid ${source.kind} ${source.id}; authored value retained`);
          channel.value = channel.goal = undefined; continue;
        }
      }
      const goal = binding.range[0] + (binding.range[1] - binding.range[0]) * ratio;
      const duration = (binding.transition?.duration ?? 0) * 1000;
      // RENDER-BIND-ABSOLUTE-SAMPLE: absolute elapsed time, never frame-count integration.
      const sample = (): number => channel.goal === undefined ? goal : (channel.from ?? channel.goal)
        + (channel.goal - (channel.from ?? channel.goal)) * easeTween(duration ? Math.max(0, Math.min(1, (nowMs - channel.start) / duration)) : 1, binding.transition?.ease ?? 'linear');
      if (channel.goal === undefined || rewind) { channel.from = channel.goal = goal; channel.start = nowMs; }
      else if (goal !== channel.goal) { channel.from = sample(); channel.goal = goal; channel.start = nowMs; }
      channel.value = sample();
      if (channel.value !== goal) active = true;
      const [type, field] = binding.target.split('.') as [string, string];
      let components = overrides.get(id);
      if (!components) overrides.set(id, components = new Map());
      const original = components.get(type) ?? view.getComponent(id, type)!;
      const copy = { ...original } as Component & Record<string, unknown>;
      if (type === 'Material3D') copy.dissolve = { ...(copy.dissolve as object), progress: channel.value };
      else copy[field] = channel.value;
      components.set(type, copy); sig.push([id, binding.target, channel.value]);
    }
    if (!overrides.size) return { world, signature: '', active: false, hover };
    const projected: IWorld = { ...view, getComponent: <T extends Component>(id: string, type: string) => (overrides.get(id)?.get(type) as T | undefined) ?? view.getComponent<T>(id, type) };
    return { world: projected, signature: JSON.stringify(sig), active, hover, dissolves: new Set([...overrides].filter(([, c]) => c.has('Material3D')).map(([id]) => id)) };
  }
  clear(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined; this.root = undefined; this.view = undefined;
    this.entries.clear(); this.lastTime = undefined; this.warned.clear(); this.revision++;
  }
}
