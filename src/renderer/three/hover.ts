import type { IWorld } from '@engine/core/types.js';
import type { Visibility } from '@engine/protocol/components.js';

/** Pointer observation is opt-in presentation state. No input commands, flags or signals. */
export class RenderHover {
  private canvas?: HTMLElement;
  private point?: readonly [number, number];
  private hovered: string | null = null;
  private invalidate?: () => void;
  private readonly move = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') { this.clearPoint(); return; }
    this.point = [event.clientX, event.clientY]; this.invalidate?.();
  };
  private readonly clearPoint = (): void => { this.point = undefined; this.hovered = null; this.invalidate?.(); };
  private readonly visibility = (): void => { if (this.canvas?.ownerDocument.hidden) this.clearPoint(); };
  sync(canvas: HTMLElement | undefined, enabled: boolean, world: IWorld, pick: (x: number, y: number) => { entityId: string } | null, invalidate: () => void): string | null {
    if (!enabled || !canvas) { this.clear(); return null; }
    if (canvas !== this.canvas) {
      this.clear(); this.canvas = canvas; this.invalidate = invalidate;
      canvas.addEventListener('pointermove', this.move as EventListener);
      for (const name of ['pointerleave', 'pointercancel']) canvas.addEventListener(name, this.clearPoint);
      canvas.ownerDocument.defaultView?.addEventListener('blur', this.clearPoint);
      canvas.ownerDocument.addEventListener('visibilitychange', this.visibility);
    }
    this.hovered = this.point && !canvas.ownerDocument.hidden ? pick(...this.point)?.entityId ?? null : null;
    const root = (world.root ?? world) as IWorld & { readView?: () => IWorld }, view = root.readView?.() ?? world;
    if (this.hovered && (!view.hasComponent(this.hovered, 'Pickable3D') || !view.hasComponent(this.hovered, 'RenderBinding3D')
      || view.getComponent<Visibility>(this.hovered, 'Visibility')?.visible === false)) this.hovered = null;
    return this.hovered;
  }
  clear(): void {
    const canvas = this.canvas;
    if (canvas) {
      canvas.removeEventListener('pointermove', this.move as EventListener);
      for (const name of ['pointerleave', 'pointercancel']) canvas.removeEventListener(name, this.clearPoint);
      canvas.ownerDocument.defaultView?.removeEventListener('blur', this.clearPoint);
      canvas.ownerDocument.removeEventListener('visibilitychange', this.visibility);
    }
    this.canvas = undefined; this.point = undefined; this.hovered = null; this.invalidate = undefined;
  }
}
