import type { IWorld, RendererBackend } from '@engine/core/types.js';
import type { AssetManager } from '@assets/index.js';
import { isImageHandle } from '@assets/index.js';
import { collectRenderables, getCameraView } from './renderable.js';
import { wrapLines } from './text-layout.js';

export interface CanvasRendererOptions {
  width?: number;
  height?: number;
  background?: string;
  /** 可选资产管理器：提供则 sprite 按 textureKey 画真实贴图，否则退化为占位方块。 */
  assets?: AssetManager;
}

// 浏览器渲染后端：把 collectRenderables 的结果画到 Canvas2D。
// 有 AssetManager 且贴图已加载时，sprite 画真实图像；否则退化为占位方块；shape 直接画几何。
// 升级路径：换成 PhaserBackend / AI 视频后端，collectRenderables 不变。
export class CanvasRenderer implements RendererBackend {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly assets?: AssetManager;
  // 文本布局缓存（渲染器侧，不进 sim）：measureText/wrapLines 极贵，只在 content/font/maxWidth
  // 变化时重算，否则复用上次的行数组，避免每帧对每个文本实体重跑布局（Gemini 代码级 #3）。
  private readonly textCache = new Map<string, { sig: string; lines: string[] }>();

  constructor(private readonly opts: CanvasRendererOptions = {}) {
    this.assets = opts.assets;
  }

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

    // 世界→屏幕投影（卷轴）：有相机则把世界向相机反方向平移并缩放，使相机中心落在视口中心；
    // 无相机则世界坐标 1:1（与原行为一致）。整段 renderable 绘制都在此变换下。
    const cam = getCameraView(world);
    ctx.save();
    if (cam) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.centerX, -cam.centerY);
    }

    for (const r of collectRenderables(world)) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rotation);
      ctx.scale(r.scaleX, r.scaleY);
      ctx.globalAlpha = r.color?.alpha ?? 1;
      ctx.fillStyle = r.color ? `#${(r.color.tint & 0xffffff).toString(16).padStart(6, '0')}` : '#e2e8f0';

      if (r.text) {
        const tx = r.text;
        ctx.font = `${tx.fontSize}px ${tx.fontFamily}`;
        ctx.textAlign = (tx.anchor as CanvasTextAlign) || 'center';
        // 多行：按 \n 硬换行 + 可选 maxWidth 自动换行。布局缓存：仅 content/font/maxWidth 变化才重算。
        const sig = `${tx.fontSize}|${tx.fontFamily}|${tx.maxWidth ?? 0}|${tx.content}`;
        let cached = this.textCache.get(r.entityId);
        if (!cached || cached.sig !== sig) {
          cached = { sig, lines: wrapLines(tx.content, tx.maxWidth ?? 0, (s) => ctx.measureText(s).width) };
          this.textCache.set(r.entityId, cached);
        }
        const lineHeight = tx.fontSize + (tx.lineSpacing ?? 0);
        for (let li = 0; li < cached.lines.length; li++) {
          ctx.fillText(cached.lines[li], 0, li * lineHeight);
        }
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
        const drawn = this.drawSprite(ctx, r.sprite.textureKey);
        if (!drawn) ctx.fillRect(-8, -8, 16, 16); // 资产未就绪 → 占位方块
      }

      ctx.restore();
    }

    ctx.restore(); // 收尾相机投影变换
  }

  // 解析 textureKey → 已加载帧，居中绘制源矩形。成功返回 true，否则 false(退化占位)。
  // (ctx 已被 sync 平移到实体中心；此处按帧尺寸居中绘制。)
  private drawSprite(ctx: CanvasRenderingContext2D, textureKey: string): boolean {
    const frame = this.assets?.resolve(textureKey);
    if (!frame || !isImageHandle(frame.asset.handle)) return false;
    const { sx, sy, sw, sh } = frame;
    ctx.drawImage(frame.asset.handle.image, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    return true;
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}
