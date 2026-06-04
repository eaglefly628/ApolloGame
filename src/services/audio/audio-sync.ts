import type { IWorld } from '@engine/core/types.js';
import type { Sound } from '@engine/protocol/components.js';
import type { AudioPort } from './audio-port.js';

// AudioSync —— "消费 Sound" 的协调器（基础设施服务，sim 外）。每次 sync 读世界里所有 `Sound` 组件，
// 与"当前在放"的集合做 diff：新出现的 clip → port.play；已消失的 → port.stop。
// Sound 的存在 = "应当在响"；移除 Sound 即停。与渲染器的"读组件→驱动后端"同构。
// 放在渲染同侧（每帧/每 tick 调一次），不进 snapshot/hash。
export class AudioSync {
  private readonly playing = new Map<string, Sound>();

  constructor(private readonly port: AudioPort) {}

  sync(world: IWorld): void {
    // 期望集合：clipId → Sound（同 clipId 多份时后者覆盖）。
    const desired = new Map<string, Sound>();
    for (const [e] of world.query('Sound')) {
      const s = world.getComponent<Sound>(e, 'Sound');
      if (s) desired.set(s.clipId, s);
    }
    // 停掉不再期望的。
    for (const clipId of [...this.playing.keys()]) {
      if (!desired.has(clipId)) {
        this.port.stop(clipId);
        this.playing.delete(clipId);
      }
    }
    // 播放新出现的。
    for (const [clipId, s] of desired) {
      if (!this.playing.has(clipId)) {
        this.port.play(clipId, { volume: s.volume, loop: s.loop });
        this.playing.set(clipId, s);
      }
    }
  }
}
