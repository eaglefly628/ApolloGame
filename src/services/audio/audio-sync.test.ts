import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Sound } from '@engine/protocol/components.js';
import { NullAudioPort } from './null-audio.js';
import { AudioSync } from './audio-sync.js';

function addSound(w: World, eid: string, clipId: string, loop = false): void {
  w.createEntity(eid);
  w.addComponent(eid, { type: 'Sound', clipId, volume: 1, loop } as Sound);
}

describe('AudioSync — 消费 Sound 驱动 AudioPort', () => {
  it('新出现的 Sound → play；移除 → stop（diff 协调）', () => {
    const port = new NullAudioPort();
    const sync = new AudioSync(port);
    const w = new World();

    addSound(w, 'bgm', 'daily', true);
    sync.sync(w);
    expect(port.playing.has('daily')).toBe(true);

    // 再 sync 一次：已在放 → 不重复 play
    sync.sync(w);
    expect(port.log.filter((l) => l.op === 'play' && l.clipId === 'daily')).toHaveLength(1);

    // 移除 Sound → stop
    w.destroyEntity('bgm');
    sync.sync(w);
    expect(port.playing.has('daily')).toBe(false);
  });

  it('多个 Sound 各自播放', () => {
    const port = new NullAudioPort();
    const sync = new AudioSync(port);
    const w = new World();
    addSound(w, 'a', 'bgm');
    addSound(w, 'b', 'sfx');
    sync.sync(w);
    expect(port.playing).toEqual(new Set(['bgm', 'sfx']));
  });
});
