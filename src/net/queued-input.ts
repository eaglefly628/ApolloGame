import type { Command, InputSource, RawInputData } from './commands.js';

// 队列输入源 —— 把异步到达的"原始输入事件"(指针/点击/UI onClick)缓冲，在 tick 边界确定性释放（R3）。
// 这就是 PB 要的"React 事件 → 当帧 input source"接缝：UI 侧 enqueue，引擎按 tick 取走写进单例 InputQueue。
// 异步事件归并到具体 tick 的命令集 = 确定性注入（与键盘源同一 InputSource 契约，可被 MultiInputSource 合并）。
export class QueuedInputSource implements InputSource {
  private queue: RawInputData[] = [];

  constructor(private readonly playerId: string) {}

  /** UI/指针回调调用：压入一条原始输入事件，下一 tick 释放。 */
  enqueue(data: RawInputData): void {
    this.queue.push(data);
  }

  /** 便捷：压入一个语义动作（如选项点击 'choice:2'）。 */
  enqueueAction(name: string, value?: { x?: number; y?: number }): void {
    this.queue.push({ source: this.playerId, key: name, x: value?.x, y: value?.y, phase: 'action' });
  }

  commandsForTick(tick: number): Command[] {
    if (this.queue.length === 0) return [];
    const actions = this.queue;
    this.queue = [];
    return [{ playerId: this.playerId, tick, move: { dx: 0, dy: 0 }, actions }];
  }
}

// 视口坐标 → canvas 像素坐标（纯函数，可测）。e.clientX/Y 是相对浏览器视口的，需减去 canvas 的
// BoundingRect 偏移，再按「buffer 尺寸 / CSS 显示尺寸」缩放（canvas 被 CSS 拉伸时二者不等）。
// 不做这步，Q5 的屏幕→世界逆投影会全盘错位（Gemini 代码级 #2）。
export function canvasPointerToScreen(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  bufferW: number,
  bufferH: number,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left) * (bufferW / rect.width),
    y: (clientY - rect.top) * (bufferH / rect.height),
  };
}

// 浏览器指针输入源 —— 监听 canvas 的 pointer 事件，映射为 canvas 像素坐标后按 tick 确定性注入。
// 仅浏览器；headless/测试用 QueuedInputSource。
//
// 确定性铁律（Gemini 致命级修正）：**屏幕→世界逆投影在此（本地、入网前）完成**，注入的是**世界坐标**。
// 传 worldFromScreen（用本地相机做 screenToWorld）→ 世界坐标进 Command/网络 → 多端一致；sim 内绝不再读相机/视口
// （否则 1080p vs 720p 两端同一指令算出不同出生点 → desync）。不传则注入 canvas 像素（无相机时 = 世界，identity）。
export class PointerInputSource extends QueuedInputSource {
  private readonly onPointer = (e: PointerEvent) => {
    const phase = e.type === 'pointerdown' ? 'down' : e.type === 'pointerup' ? 'up' : 'move';
    const rect = this.canvas.getBoundingClientRect();
    const p = canvasPointerToScreen(e.clientX, e.clientY, rect, this.canvas.width, this.canvas.height);
    const w = this.opts.worldFromScreen ? this.opts.worldFromScreen(p.x, p.y) : p; // 采集期逆投影 → 世界坐标
    this.enqueue({ source: this.pid, x: w.x, y: w.y, phase });
  };

  constructor(
    private readonly pid: string,
    private readonly canvas: HTMLCanvasElement,
    // worldFromScreen：本地相机逆投影 (canvas 像素 → 世界)。带相机的游戏必须传，保证联机确定性。
    private readonly opts: { move?: boolean; worldFromScreen?: (sx: number, sy: number) => { x: number; y: number } } = {},
  ) {
    super(pid);
    canvas.addEventListener('pointerdown', this.onPointer as EventListener);
    canvas.addEventListener('pointerup', this.onPointer as EventListener);
    if (opts.move) canvas.addEventListener('pointermove', this.onPointer as EventListener);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer as EventListener);
    this.canvas.removeEventListener('pointerup', this.onPointer as EventListener);
    this.canvas.removeEventListener('pointermove', this.onPointer as EventListener);
  }
}
