import type { IWorld } from '@engine/core/types.js';
import type { Sound } from '@engine/protocol/components.js';
import type { AudioPort } from './audio-port.js';

// AudioSync —— "消费 Sound" 的协调器（基础设施服务，sim 外）。每次 sync 读世界里所有 `Sound` 组件，
// 与"当前在放"的集合做 diff：新出现的 clip → port.play；已消失的 → port.stop。
// Sound 的存在 = "应当在响"；移除 Sound 即停。与渲染器的"读组件→驱动后端"同构。
// 放在渲染同侧（每帧/每 tick 调一次），不进 snapshot/hash。
export class AudioSync {
  // 按 **EntityId** 追踪（Gemini Q4 "金币问题"）：同一 clipId 的多个实体实例各自独立追踪生命周期，
  // 不会因 clipId 撞键而互相覆盖。clipId 引用计数决定何时真正 stop（最后一个实例消失才停）。
  private readonly playing = new Map<string, Sound>(); // entityId → Sound
  private readonly refCount = new Map<string, number>(); // clipId → 在放实例数

  constructor(private readonly port: AudioPort) {}

  sync(world: IWorld): void {
    const desired = new Map<string, Sound>(); // entityId → Sound
    for (const [e] of world.query('Sound')) {
      const s = world.getComponent<Sound>(e, 'Sound');
      if (s) desired.set(e, s);
    }
    // 消失的实体 → 引用计数减一，归零才停该 clip。
    for (const [eid, s] of [...this.playing]) {
      if (!desired.has(eid)) {
        this.playing.delete(eid);
        const n = (this.refCount.get(s.clipId) ?? 1) - 1;
        if (n <= 0) {
          this.refCount.delete(s.clipId);
          this.port.stop(s.clipId);
        } else {
          this.refCount.set(s.clipId, n);
        }
      }
    }
    // 新出现的实体 → 播放并引用计数加一。
    for (const [eid, s] of desired) {
      if (!this.playing.has(eid)) {
        this.playing.set(eid, s);
        this.refCount.set(s.clipId, (this.refCount.get(s.clipId) ?? 0) + 1);
        this.port.play(s.clipId, { volume: s.volume, loop: s.loop });
      }
    }
  }
}
