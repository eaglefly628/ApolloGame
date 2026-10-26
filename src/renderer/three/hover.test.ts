// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import { RenderHover } from './hover.js';

afterEach(() => vi.restoreAllMocks());
function fixture() {
  const canvas = document.createElement('canvas'), world = new World(), hover = new RenderHover(), dirty = vi.fn();
  world.createEntity('model'); world.addComponent('model', { type: 'Pickable3D', signal: 'click' }); world.addComponent('model', { type: 'RenderBinding3D', bindings: [] });
  const pick = vi.fn(() => ({ entityId: 'model' })), step = (enabled = true) => hover.sync(canvas, enabled, world, pick, dirty);
  const move = (pointerType = 'mouse') => canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 4, clientY: 8, pointerType }));
  return { canvas, world, hover, pick, dirty, step, move };
}
describe('render-only pointer hover lifecycle', () => {
  it('adds no listeners or pick calls without opt-in; tracks mouse but suppresses touch and never writes world', () => {
    const f = fixture(), listen = vi.spyOn(f.canvas, 'addEventListener'); expect(f.step(false)).toBeNull(); expect(listen).not.toHaveBeenCalled();
    f.step(); f.world.drainDirty(); const before = f.world.snapshot(), seq = f.world.writeSequence;
    f.move(); expect(f.step()).toBe('model'); expect(f.pick).toHaveBeenLastCalledWith(4, 8); expect(f.dirty).toHaveBeenCalledOnce();
    expect(f.world.snapshot()).toEqual(before); expect(f.world.writeSequence).toBe(seq); expect(f.world.drainDirty()).toEqual([]);
    f.move('touch'); expect(f.step()).toBeNull(); f.hover.clear();
  });
  it.each(['pointerleave', 'pointercancel', 'blur', 'hidden', 'visibility', 'destroy', 'remove'])('clears on %s and detaches listeners idempotently', event => {
    const f = fixture(); f.step(); f.move(); expect(f.step()).toBe('model');
    const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
    if (event === 'blur') window.dispatchEvent(new Event('blur'));
    else if (event === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
    else if (event === 'visibility') f.world.addComponent('model', { type: 'Visibility', visible: false, active: true });
    else if (event === 'destroy') f.world.destroyEntity('model');
    else if (event === 'remove') f.world.removeComponent('model', 'RenderBinding3D');
    else f.canvas.dispatchEvent(new Event(event));
    expect(f.step()).toBeNull(); f.hover.clear(); f.hover.clear(); const count = f.dirty.mock.calls.length; f.move(); window.dispatchEvent(new Event('blur')); expect(f.dirty.mock.calls.length).toBe(count);
    if (event === 'hidden') { if (hidden) Object.defineProperty(document, 'hidden', hidden); else Reflect.deleteProperty(document, 'hidden'); }
  });
});
