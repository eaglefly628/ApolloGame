import { describe, it, expect } from 'vitest';
import { SynthAudioPort, SynthMusicPort } from '@services/audio/index.js';
import { C_SFX, C_BGM, gcAudio, type CSfx } from './sound.js';

// 声音=数据（音频手册铁律）：曲/音色纯数据，端口是引擎固定合成器；无 AudioContext（headless/test）→ 静默 no-op。
describe('game-c sound — 声音=数据·SynthMusic/SynthAudio 端口（headless no-op 安全）', () => {
  it('BGM 是合法 MusicTrack（bpm/loopBeats/音符表·全正数纯数据）', () => {
    expect(C_BGM.bpm).toBeGreaterThan(0);
    expect(C_BGM.loopBeats).toBeGreaterThan(0);
    expect(C_BGM.notes.length).toBeGreaterThan(0);
    for (const n of C_BGM.notes) {
      expect(n.freq).toBeGreaterThan(0);
      expect(n.dur).toBeGreaterThan(0);
      expect(n.beat).toBeGreaterThanOrEqual(0);
    }
    expect(() => new SynthMusicPort().play(C_BGM)).not.toThrow(); // headless 无 AudioContext → 静默不炸
  });

  it('各事件 SFX 是合法 SfxSpec（partials 非空·端口可吃·闭集字段）', () => {
    const keys: CSfx[] = ['deal', 'chip', 'check', 'fold', 'flip', 'allin', 'reveal', 'win', 'lose', 'pawn', 'click'];
    const port = new SynthAudioPort(C_SFX);
    for (const k of keys) {
      expect(C_SFX[k].partials.length).toBeGreaterThan(0);
      expect(() => port.play(k)).not.toThrow(); // headless 静默
    }
  });

  it('门面：进桌起 BGM / 静音停乐 / 播 SFX / 退场——headless 全 no-op 不炸', () => {
    expect(() => {
      gcAudio.enterTable();
      gcAudio.play('deal');
      gcAudio.play('chip');
      gcAudio.setMuted(true);   // 静音：停乐 + 后续 SFX 跳过
      gcAudio.play('win');
      gcAudio.setMuted(false);  // 取消静音：在桌续乐
      gcAudio.leaveTable();
      gcAudio.dispose();
    }).not.toThrow();
  });
});
