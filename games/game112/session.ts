// game112 —— 宿主会话驱动（sim 外·契约明许·**零玩法判定**）。
// 职责：建 Engine · 把 UI 具名动作经 QueuedInputSource → applyCommands → InputQueue 喂进 sim（唯一合法写口）
// · 推 tick · 投影视图 · 导出持久态。规则一条都不在这里：全在 blueprint 数据 + 引擎能力里。
// 无 DOM 依赖 → 测试直接驱动。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { applyCommands } from '@zerocraft/engine/net/index.js';
import { QueuedInputSource } from '@zerocraft/engine/net/host/index.js';
import { hashSnapshot } from '@zerocraft/engine/net/determinism.js';
import { buildBlueprint, EMPTY_STATE, type PersistedState } from './blueprint.js';
import { buildHallView, buildReadingView, toPersisted, type HallView, type ReadingView } from './project.js';
import { SEED_DEFAULT } from './world-data.js';

export class HallSession {
  readonly engine: Engine;
  private readonly q = new QueuedInputSource('player');
  private tick = 0;

  constructor(seed = SEED_DEFAULT, initial: PersistedState = EMPTY_STATE) {
    this.engine = new Engine();
    this.engine.load(buildBlueprint(seed, initial));
  }

  get world() { return this.engine.world; }
  get ticks(): number { return this.tick; }

  /** 具名动作入队并推一拍（动作在 tick 边界释放·录放一致）。 */
  act(key: string, value?: { arg?: string; x?: number }): void {
    this.q.enqueueAction(key, value);
    this.step();
  }

  /** 空推 n 拍（兴致自然变化等靠它）。 */
  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      applyCommands(this.world, this.q.commandsForTick(this.tick));
      this.world.tick();
      this.tick += 1;
    }
  }

  hall(): HallView { return buildHallView(this.world); }
  reading(chapterId: string): ReadingView | undefined { return buildReadingView(this.world, chapterId); }
  persisted(): PersistedState { return toPersisted(this.world); }
  hash(): string { return hashSnapshot(this.world.snapshot()); }
}
