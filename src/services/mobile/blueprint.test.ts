// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IWorld } from '@engine/core/types.js';
import type { InputQueue, Velocity } from '@engine/protocol/components.js';
import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
const renderer = vi.hoisted(() => ({ init: vi.fn(), sync: vi.fn(), destroy: vi.fn() }));
vi.mock('@renderer/canvas-renderer.js', () => ({ CanvasRenderer: class {
  constructor(private readonly options: { width: number; height: number }) {}
  init(host: HTMLElement) {
    renderer.init(host);
    const canvas = document.createElement('canvas'); const dpr = window.devicePixelRatio || 1;
    canvas.width = this.options.width * dpr; canvas.height = this.options.height * dpr; host.appendChild(canvas);
  }
  sync = renderer.sync; destroy = renderer.destroy;
} }));
import { mountMobileBlueprint } from './index.js';
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); localStorage.clear(); delete (window as unknown as Record<string, unknown>).__APOLLO_NATIVE_STATE__; });
const blueprint: WorldBlueprint = {
  capabilities: [],
  entities: { hero: { Controllable: { playerId: 'p', speed: 2 }, Velocity: { vx: 0, vy: 0 } } },
};
describe('mobile declarative blueprint mount', () => {
  it('awaits load, observes initial background state, and destroys renderer/input/host idempotently', async () => {
    const frame = vi.fn(() => 1); vi.stubGlobal('requestAnimationFrame', frame); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    (window as unknown as Record<string, unknown>).__APOLLO_NATIVE_STATE__ = { active: false };
    const host = document.createElement('div');
    dispose = await mountMobileBlueprint(host, blueprint, { w: 300, h: 200 }, { touch: { mode: 'drag' }, save: { slot: 'blueprint-v1' } });
    const scene = host.firstElementChild!.firstElementChild as HTMLElement;
    expect(renderer.init).toHaveBeenCalledWith(scene); expect(scene.style.width).toBe('300px'); expect(frame).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: true } })); expect(frame).toHaveBeenCalledTimes(1);
    dispose(); dispose(); dispose = undefined; expect(renderer.destroy).toHaveBeenCalledTimes(1); expect(host.childElementCount).toBe(0);
    window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: true } })); expect(frame).toHaveBeenCalledTimes(1);
  });
  it('rejects corrupt data and cleans renderer and the global environment so another mount can succeed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    localStorage.setItem('apollo-save:bad-v1', '{bad');
    const host = document.createElement('div');
    await expect(mountMobileBlueprint(host, blueprint, undefined, { save: { slot: 'bad-v1' } })).rejects.toThrow(/corrupt/i);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    dispose = await mountMobileBlueprint(host, blueprint);
    expect(renderer.init).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
  it('fits the shared scene and inverse-projects scaled Retina pointer events without neutralizing keyboard movement', async () => {
    let callback!: FrameRequestCallback;
    vi.stubGlobal('requestAnimationFrame', vi.fn((next: FrameRequestCallback) => { callback = next; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn()); vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const disconnect = vi.fn(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true });
    const camera = { ...blueprint, entities: { ...blueprint.entities, camera: { Camera: { offsetX: 100, offsetY: 50, zoom: 2 } } } };
    dispose = await mountMobileBlueprint(host, camera, { w: 800, h: 400 });
    const canvas = host.querySelector('canvas')!; const scene = canvas.parentElement!;
    expect(scene.style.transform).toBe('scale(0.5)');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 400, height: 200 } as DOMRect);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 210, clientY: 120, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 210, clientY: 120, pointerId: 1 })); callback(20);
    const world = renderer.sync.mock.calls.at(-1)![0] as IWorld;
    expect(world.getComponent<Velocity>('hero', 'Velocity')!.vx).toBe(2);
    expect(world.getComponent<InputQueue>('global-input', 'InputQueue')!.actions).toEqual([
      { source: 'p', phase: 'down', x: 100, y: 50 }, { source: 'p', phase: 'up', x: 100, y: 50 },
    ]);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 210, clientY: 120, pointerId: 1 }));
    window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: false } }));
    window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: true } })); callback(20);
    expect(world.getComponent<InputQueue>('global-input', 'InputQueue')!.actions).toEqual([]);
    Object.defineProperty(host, 'clientWidth', { value: 200, configurable: true }); window.dispatchEvent(new Event('resize'));
    expect(scene.style.transform).toBe('scale(0.25)');
    dispose(); dispose = undefined; expect(disconnect).toHaveBeenCalledOnce(); expect(host.childElementCount).toBe(0);
    Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true }); window.dispatchEvent(new Event('resize'));
    expect(scene.style.transform).toBe('scale(0.25)');
  });
  it('leases touch-action on the supplied product host and restores it on cleanup', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const host = document.createElement('div'); host.style.setProperty('touch-action', 'pan-y', 'important');
    const rootBefore = document.documentElement.style.getPropertyValue('touch-action');
    dispose = await mountMobileBlueprint(host, blueprint, undefined, { touch: { mode: 'drag' } });
    expect(host.style.getPropertyValue('touch-action')).toBe('none');
    expect(document.documentElement.style.getPropertyValue('touch-action')).toBe(rootBefore);
    dispose(); dispose = undefined; expect(host.style.getPropertyValue('touch-action')).toBe('pan-y');
    expect(host.style.getPropertyPriority('touch-action')).toBe('important');
  });
  it.each([{ w: 0, h: 1 }, { w: 1, h: -1 }, { w: NaN, h: 1 }, { w: 1, h: Infinity }])('rejects invalid viewport before changing the host: %j', async viewport => {
    const host = document.createElement('div'); host.textContent = 'unchanged';
    await expect(mountMobileBlueprint(host, blueprint, viewport)).rejects.toThrow(/finite positive/);
    expect(host.textContent).toBe('unchanged'); expect(renderer.init).not.toHaveBeenCalled();
  });

  it('supports pointer-only cartridges with no Controllable and releases the owned touch surface', async () => {
    let callback!: FrameRequestCallback; vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn()); const host = document.createElement('div');
    dispose = await mountMobileBlueprint(host, { capabilities: [], entities: {} }, { w: 100, h: 100 });
    const canvas = host.querySelector('canvas')!; expect(canvas.style.touchAction).toBe('none');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 25, clientY: 30, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 25, clientY: 30, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1 })); callback(20);
    const world = renderer.sync.mock.calls.at(-1)![0] as IWorld;
    expect(world.getComponent<InputQueue>('global-input', 'InputQueue')!.actions).toEqual([
      { source: 'p1', phase: 'down', x: 25, y: 30 }, { source: 'p1', phase: 'up', x: 25, y: 30 },
    ]);
    dispose(); dispose = undefined; expect(canvas.parentElement).not.toBe(host); expect(host.querySelector('canvas')).toBeNull();
  });

});
