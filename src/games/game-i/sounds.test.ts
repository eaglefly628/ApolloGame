// Game I · 声音测试核心：数据目录完整 + 播放器无 AudioContext 时静默不抛错。
import { describe, it, expect } from 'vitest';
import { SOUNDS, makeSoundPlayer } from './sounds.js';

describe('Game I 声音测试', () => {
  it('声音目录是纯数据（id 唯一·字段齐全）', () => {
    expect(SOUNDS.length).toBeGreaterThanOrEqual(6);
    const ids = SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // id 唯一
    for (const s of SOUNDS) {
      expect(typeof s.label).toBe('string');
      expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(s.type);
      expect(s.freq).toBeGreaterThan(0);
      expect(s.dur).toBeGreaterThan(0);
    }
  });

  it('播放器无 Web Audio（如测试环境）时 play/close 静默不抛错', () => {
    const player = makeSoundPlayer();
    expect(() => player.play('click', 0.7)).not.toThrow();
    expect(() => player.play('不存在', 0.5)).not.toThrow();
    expect(() => player.close()).not.toThrow();
  });
});
