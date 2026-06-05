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

// 浏览器指针输入源 —— 监听 target 的 pointer 事件，按 tick 确定性注入。仅浏览器；headless/测试用 QueuedInputSource。
export class PointerInputSource extends QueuedInputSource {
  private readonly onPointer = (e: PointerEvent) => {
    const phase = e.type === 'pointerdown' ? 'down' : e.type === 'pointerup' ? 'up' : 'move';
    this.enqueue({ source: this.pid, x: e.clientX, y: e.clientY, phase });
  };

  constructor(
    private readonly pid: string,
    private readonly el: HTMLElement,
    private readonly opts: { move?: boolean } = {},
  ) {
    super(pid);
    el.addEventListener('pointerdown', this.onPointer as EventListener);
    el.addEventListener('pointerup', this.onPointer as EventListener);
    if (opts.move) el.addEventListener('pointermove', this.onPointer as EventListener);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onPointer as EventListener);
    this.el.removeEventListener('pointerup', this.onPointer as EventListener);
    this.el.removeEventListener('pointermove', this.onPointer as EventListener);
  }
}
