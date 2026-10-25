import { describe, it, expect } from 'vitest';
import { TouchInputSource } from './touch-input.js';
function pointer(type: string, x: number, y: number, id = 1): Event {
  return Object.assign(new Event(type, { cancelable: true }), { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', button: 0 });
}
describe('TouchInputSource', () => {
  it('samples drag at tick boundaries; dead zone, range, other fingers and cancellation are bounded', () => {
    const target = new EventTarget();
    const focus = new EventTarget();
    const source = new TouchInputSource('p', target, { mode: 'drag', deadZone: 5, range: 30 }, focus);
    target.dispatchEvent(pointer('pointerdown', 10, 10));
    target.dispatchEvent(pointer('pointermove', 12, 10));
    expect(source.commandsForTick(1)).toEqual([]);
    target.dispatchEvent(pointer('pointermove', 100, -100, 2));
    expect(source.commandsForTick(2)).toEqual([]);
    target.dispatchEvent(pointer('pointermove', 100, -100));
    expect(source.commandsForTick(3)).toEqual([{ playerId: 'p', tick: 3, move: { dx: 1, dy: -1 } }]);
    target.dispatchEvent(pointer('pointercancel', 100, -100));
    expect(source.commandsForTick(4)).toEqual([]);
    target.dispatchEvent(pointer('pointerdown', 0, 0));
    target.dispatchEvent(pointer('pointermove', 10, 0));
    focus.dispatchEvent(new Event('blur'));
    expect(source.commandsForTick(5)).toEqual([]);
    source.dispose();
    target.dispatchEvent(pointer('pointerdown', 0, 0));
    target.dispatchEvent(pointer('pointermove', 20, 0));
    expect(source.commandsForTick(6)).toEqual([]);
  });
  it('queues only genuine taps once, cancels pending actions on reset, and ignores mouse input', () => {
    const target = new EventTarget();
    const source = new TouchInputSource('p', target, { mode: 'drag', tapAction: 'jump' }, target);
    target.dispatchEvent(pointer('pointerdown', 0, 0));
    target.dispatchEvent(pointer('pointerup', 1, 1));
    expect(source.commandsForTick(10)[0].actions).toEqual([{ source: 'p', key: 'jump', phase: 'down' }]);
    expect(source.commandsForTick(11)).toEqual([]);
    target.dispatchEvent(pointer('pointerdown', 0, 0));
    target.dispatchEvent(pointer('pointermove', 20, 0));
    target.dispatchEvent(pointer('pointerup', 0, 0));
    expect(source.commandsForTick(12)).toEqual([]);
    target.dispatchEvent(pointer('pointerdown', 0, 0));
    target.dispatchEvent(pointer('pointerup', 0, 0));
    source.reset();
    expect(source.commandsForTick(13)).toEqual([]);
    const mouse = Object.assign(pointer('pointerdown', 0, 0), { pointerType: 'mouse' });
    target.dispatchEvent(mouse);
    target.dispatchEvent(pointer('pointermove', 20, 0));
    expect(source.commandsForTick(14)).toEqual([]);
    source.dispose();
  });
});
