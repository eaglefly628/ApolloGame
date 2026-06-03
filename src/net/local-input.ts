import type { Command, InputSource } from './commands.js';

// ═══════════════════════════════════════════════════════════════
//  本地键盘输入源 — 实时键盘 → 每 tick 命令
// ═══════════════════════════════════════════════════════════════
//
//  方向键 / WASD 映射成移动意图。它实现 InputSource，与网络对端可互换：
//  引擎只问 commandsForTick(tick)，不关心命令来自键盘还是网线。
//  （仅浏览器使用；headless / 测试用脚本源，不导入本文件。）
// ═══════════════════════════════════════════════════════════════

const KEYMAP: Record<string, { dx?: number; dy?: number }> = {
  ArrowUp: { dy: -1 },
  KeyW: { dy: -1 },
  ArrowDown: { dy: 1 },
  KeyS: { dy: 1 },
  ArrowLeft: { dx: -1 },
  KeyA: { dx: -1 },
  ArrowRight: { dx: 1 },
  KeyD: { dx: 1 },
};

export class KeyboardInputSource implements InputSource {
  private readonly pressed = new Set<string>();

  private readonly onDown = (e: KeyboardEvent) => {
    if (KEYMAP[e.code] || e.code === 'Space') {
      this.pressed.add(e.code);
      e.preventDefault();
    }
  };
  private readonly onUp = (e: KeyboardEvent) => {
    this.pressed.delete(e.code);
  };
  // 丢焦点时 keyup 收不到 → 清空按下集合，防止"按键卡住"持续移动。
  private readonly onBlur = () => {
    this.pressed.clear();
  };

  constructor(
    private readonly playerId: string,
    private readonly target: EventTarget = window,
  ) {
    this.target.addEventListener('keydown', this.onDown as EventListener);
    this.target.addEventListener('keyup', this.onUp as EventListener);
    this.target.addEventListener('blur', this.onBlur as EventListener);
  }

  commandsForTick(tick: number): Command[] {
    let dx = 0;
    let dy = 0;
    for (const code of this.pressed) {
      const m = KEYMAP[code];
      if (!m) continue;
      dx += m.dx ?? 0;
      dy += m.dy ?? 0;
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    const jump = this.pressed.has('Space');
    if (dx === 0 && dy === 0 && !jump) return [];
    const cmd: Command = { playerId: this.playerId, tick, move: { dx, dy } };
    return [jump ? { ...cmd, jump: true } : cmd];
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown as EventListener);
    this.target.removeEventListener('keyup', this.onUp as EventListener);
    this.target.removeEventListener('blur', this.onBlur as EventListener);
  }
}
