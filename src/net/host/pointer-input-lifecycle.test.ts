// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { PointerInputSource, QueuedInputSource } from './queued-input.js';
const pointer = (type: string, x: number, y: number) => new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1 });
describe('queued pointer lifecycle', () => {
  it('reset discards pending queue actions without altering subsequent tick commands', () => {
    const queue = new QueuedInputSource('p'); queue.enqueueAction('old'); queue.reset(); expect(queue.commandsForTick(1)).toEqual([]);
    queue.enqueueAction('new'); expect(queue.commandsForTick(2)[0].actions?.[0]).toMatchObject({ source: 'p', key: 'new', phase: 'action' });
  });
  it('cancel, lost capture, blur and disposal discard drag origins and pending actions', () => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
    const source = new PointerInputSource('p', canvas, { move: true });
    for (const kind of ['pointercancel', 'lostpointercapture', 'blur']) {
      canvas.dispatchEvent(pointer('pointerdown', 10, 10)); canvas.dispatchEvent(pointer('pointermove', 15, 10));
      (kind === 'blur' ? window : canvas).dispatchEvent(kind === 'blur' ? new Event(kind) : pointer(kind, 15, 10));
      expect(source.commandsForTick(3), kind).toEqual([]);
      canvas.dispatchEvent(pointer('pointerdown', 20, 20)); canvas.dispatchEvent(pointer('pointerup', 20, 20));
      expect(source.commandsForTick(4)[0].actions?.map(a => a.phase), kind).toEqual(['down', 'up']);
    }
    canvas.dispatchEvent(pointer('pointerdown', 0, 0)); source.dispose(); expect(source.commandsForTick(5)).toEqual([]);
    canvas.dispatchEvent(pointer('pointerup', 100, 100)); expect(source.commandsForTick(6)).toEqual([]);
  });
  it('preserves completed tap/drag commands through normal capture release and ignores secondary fingers', () => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
    const source = new PointerInputSource('p', canvas, { move: true });
    try {
      canvas.dispatchEvent(pointer('pointerdown', 10, 10)); canvas.dispatchEvent(pointer('pointerup', 10, 10));
      canvas.dispatchEvent(pointer('lostpointercapture', 10, 10));
      expect(source.commandsForTick(1)[0].actions?.map(a => a.phase)).toEqual(['down', 'up']);
      canvas.dispatchEvent(pointer('pointerdown', 10, 10));
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
        canvas.dispatchEvent(new PointerEvent(type, { clientX: 99, clientY: 99, pointerId: 2 }));
      }
      canvas.dispatchEvent(pointer('pointerup', 30, 10)); canvas.dispatchEvent(pointer('lostpointercapture', 30, 10));
      expect(source.commandsForTick(2)[0].actions).toEqual([
        { source: 'p', x: 10, y: 10, phase: 'down' },
        { source: 'p', key: 'drag', x: 10, y: 10, values: [30, 10], phase: 'drag' },
      ]);
    } finally { source.dispose(); }
  });

});
