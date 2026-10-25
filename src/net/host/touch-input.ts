import type { Command, InputSource, RawInputData } from '../commands.js';

export interface TouchInputConfig {
  mode: 'drag';
  /** CSS pixels from drag origin below which a direction is neutral. */
  deadZone?: number;
  /** CSS pixels at which an axis reaches full movement. */
  range?: number;
  tapAction?: string;
}

/** Pointer events are sampled here; world writes happen exclusively through tick commands. */
export class TouchInputSource implements InputSource {
  private pointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private offset = { x: 0, y: 0 };
  private dragged = false;
  private pending: RawInputData[] = [];
  private disposed = false;
  private readonly deadZone: number;
  private readonly range: number;
  private readonly removals: Array<() => void> = [];

  constructor(
    private readonly playerId: string,
    private readonly target: EventTarget = window,
    private readonly config: TouchInputConfig = { mode: 'drag' },
    focus: EventTarget = window,
  ) {
    this.deadZone = config.deadZone ?? 8;
    this.range = config.range ?? 64;
    if (config.mode !== 'drag' || !Number.isFinite(this.deadZone) || this.deadZone < 0 || !Number.isFinite(this.range) || this.range <= this.deadZone) {
      throw new Error('touch requires drag mode and 0 <= deadZone < range');
    }
    if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
      const previous = target.style.getPropertyValue('touch-action');
      const priority = target.style.getPropertyPriority('touch-action');
      target.style.setProperty('touch-action', 'none');
      this.removals.push(() => {
        if (target.style.getPropertyValue('touch-action') !== 'none') return;
        if (previous) target.style.setProperty('touch-action', previous, priority);
        else target.style.removeProperty('touch-action');
      });
    }
    const listen = (on: EventTarget, type: string, fn: (e: PointerEvent) => void) => {
      const cb = fn as EventListener;
      on.addEventListener(type, cb, { passive: false });
      this.removals.push(() => on.removeEventListener(type, cb));
    };
    listen(target, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.pointer !== null || e.button > 0) return;
      // Native controls and LayoutNode actions retain their own event semantics.
      if (typeof Element !== 'undefined' && e.target instanceof Element && e.target.closest('button,input,select,textarea,a,[role="button"]')) return;
      this.pointer = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.offset = { x: 0, y: 0 };
      this.dragged = false;
      try { (e.target as Element | null)?.setPointerCapture?.(e.pointerId); } catch { /* detached/no capture surface */ }
      e.preventDefault();
    });
    listen(target, 'pointermove', (e) => {
      if (e.pointerId !== this.pointer) return;
      this.offset = { x: e.clientX - this.origin.x, y: e.clientY - this.origin.y };
      if (Math.sqrt(this.offset.x * this.offset.x + this.offset.y * this.offset.y) > this.deadZone) this.dragged = true;
      e.preventDefault();
    });
    listen(target, 'pointerup', (e) => {
      if (e.pointerId !== this.pointer) return;
      if (!this.dragged && Math.sqrt((e.clientX - this.origin.x) ** 2 + (e.clientY - this.origin.y) ** 2) <= this.deadZone && config.tapAction) {
        this.pending.push({ source: playerId, key: config.tapAction, phase: 'down' });
      }
      this.pointer = null;
      this.offset = { x: 0, y: 0 };
      e.preventDefault();
    });
    const cancel = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.reset(); };
    listen(target, 'pointercancel', cancel);
    listen(target, 'lostpointercapture', cancel);
    listen(focus, 'blur', () => this.reset());
  }

  reset(): void { this.pointer = null; this.offset = { x: 0, y: 0 }; this.pending = []; this.dragged = false; }
  commandsForTick(tick: number): Command[] {
    if (this.disposed) return [];
    const axis = (v: number): number => Math.abs(v) <= this.deadZone ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - this.deadZone) / (this.range - this.deadZone));
    const move = { dx: axis(this.offset.x), dy: axis(this.offset.y) };
    const actions = this.pending; this.pending = [];
    if (!move.dx && !move.dy && !actions.length) return [];
    return [{ playerId: this.playerId, tick, move, ...(actions.length ? { actions } : {}) }];
  }
  dispose(): void { this.disposed = true; this.reset(); for (const remove of this.removals.splice(0)) remove(); }
}
