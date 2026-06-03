import type { IWorld, RendererBackend } from '@engine/core/types.js';
import { collectRenderables } from './renderable.js';

export interface CanvasRendererOptions {
  width?: number;
  height?: number;
  background?: string;
}

// 浏览器渲染后端：把 collectRenderables 的结果画到 Canvas2D。
// 无真实贴图资产时，sprite 退化为占位方块；shape 直接画几何。
// 升级路径：换成 PhaserBackend / AI 视频后端，collectRenderables 不变。
export class CanvasRenderer implements RendererBackend {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(private readonly opts: CanvasRendererOptions = {}) {}

  init(container: HTMLElement): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.opts.width ?? 640;
    canvas.height = this.opts.height ?? 400;
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  sync(world: IWorld): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.fillStyle = this.opts.background ?? '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const r of collectRenderables(world)) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rotation);
      ctx.scale(r.scaleX, r.scaleY);
      ctx.globalAlpha = r.color?.alpha ?? 1;
      ctx.fillStyle = r.color ? `#${(r.color.tint & 0xffffff).toString(16).padStart(6, '0')}` : '#e2e8f0';

      if (r.text) {
        ctx.font = `${r.text.fontSize}px ${r.text.fontFamily}`;
        ctx.textAlign = (r.text.anchor as CanvasTextAlign) || 'center';
        ctx.fillText(r.text.content, 0, 0);
      } else if (r.shape?.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, r.shape.radius ?? 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (r.shape?.kind === 'box') {
        const w = r.shape.width ?? 8;
        const h = r.shape.height ?? 8;
        ctx.fillRect(-w / 2, -h / 2, w, h);
      } else if (r.shape?.kind === 'polygon') {
        const v = r.shape.vertices ?? [];
        if (v.length >= 6) {
          ctx.beginPath();
          ctx.moveTo(v[0], v[1]);
          for (let i = 2; i + 1 < v.length; i += 2) ctx.lineTo(v[i], v[i + 1]);
          ctx.closePath();
          ctx.fill();
        }
      } else if (r.sprite) {
        ctx.fillRect(-8, -8, 16, 16); // 占位方块
      }

      ctx.restore();
    }
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}
