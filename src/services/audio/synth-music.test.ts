import { describe, it, expect } from 'vitest';
import { SynthMusicPort, type AudioCtxLike, type MusicTrack } from './synth-music.js';

function fakeCtx() {
  // gainDisconnects/oscStops（测试加固 2026-08-24）：供「换曲先停旧」断言——旧曲全停 = 旧 bus 断链
  // （实现走 bus.disconnect() 断整条旧链）+ 每振荡器在调度期即带既定 stop(t)（有界·不残留）。
  const log = { osc: 0, gain: 0, started: 0, busVol: [] as number[], gainDisconnects: 0, oscStops: 0 };
  const param = (sink?: number[]): { value: number; setValueAtTime: (v: number) => void; linearRampToValueAtTime: () => void; exponentialRampToValueAtTime: () => void } => ({
    value: 0, setValueAtTime: (v: number) => { sink?.push(v); }, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {},
  });
  const node = (): { connect: () => void; disconnect: () => void } => ({ connect: () => {}, disconnect: () => {} });
  const ctx: AudioCtxLike = {
    currentTime: 0, sampleRate: 48000, state: 'running', destination: node(),
    createGain: () => { log.gain++; return { connect: () => {}, disconnect: () => { log.gainDisconnects++; }, gain: log.gain === 1 ? param(log.busVol) : param() }; },
    createOscillator: () => { log.osc++; return { ...node(), type: 'triangle', frequency: param(), start: () => { log.started++; }, stop: () => { log.oscStops++; }, onended: null }; },
    createBufferSource: () => ({ ...node(), buffer: null, start: () => {}, stop: () => {}, onended: null }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, log };
}

const TRACK: MusicTrack = { bpm: 120, loopBeats: 4, gain: 1, notes: [{ beat: 0, dur: 1, freq: 440 }, { beat: 2, dur: 1, freq: 550 }] };

describe('SynthMusicPort — 数据驱动循环音序后端', () => {
  it('play 预排两圈 → 每音一个振荡器并起播（2 音 × 2 圈 = 4）', () => {
    const { ctx, log } = fakeCtx();
    const p = new SynthMusicPort({ ctx });
    p.play(TRACK);
    expect(log.osc).toBe(4);
    expect(log.started).toBe(4);
    p.stop();
  });

  it('current 反映在放的曲；stop 后清空', () => {
    const { ctx } = fakeCtx();
    const p = new SynthMusicPort({ ctx });
    p.play(TRACK);
    expect(p.current).toBe(TRACK);
    p.stop();
    expect(p.current).toBeNull();
  });

  it('setVolume 改 bus 增益并夹紧 0~1', () => {
    const { ctx, log } = fakeCtx();
    const p = new SynthMusicPort({ ctx, volume: 0.3 });
    p.play(TRACK);
    p.setVolume(0.5);
    expect(p.getVolume()).toBe(0.5);
    expect(log.busVol.at(-1)).toBeCloseTo(0.5, 5);
    p.setVolume(9); expect(p.getVolume()).toBe(1);
    p.setVolume(-1); expect(p.getVolume()).toBe(0);
    p.stop();
  });

  it('换曲：play 新曲先停旧（旧 bus 断链 + 每振荡器带既定 stop 调度 = 旧曲全停·不残留）', () => {
    const { ctx, log } = fakeCtx();
    const p = new SynthMusicPort({ ctx });
    p.play(TRACK); // 2 音 × 2 圈 = 4 osc
    expect(log.osc).toBe(4);
    expect(log.oscStops).toBe(4); // 实测实现口径：osc.stop(t) 在调度期即定（每音有界·非换曲时才停）
    expect(log.gainDisconnects).toBe(0); // 旧曲在放·bus 尚在链
    const t2: MusicTrack = { bpm: 90, loopBeats: 2, notes: [{ beat: 0, dur: 1, freq: 330 }] };
    p.play(t2);
    expect(p.current).toBe(t2);
    // 换曲停旧的真机制（钉现状·测试加固 2026-08-24）：stopVoices() 断掉旧 bus——恰 1 次断链
    // （断的只能是旧 bus·新 bus 正在链上），旧曲整条增益链离 destination = 全停。
    expect(log.gainDisconnects).toBe(1);
    expect(log.osc).toBe(6); // 新曲 1 音 × 2 圈已排（4+2）
    expect(log.oscStops).toBe(6); // 新音符同样带既定 stop——新旧全部有界·无永响残留
    p.stop();
    expect(log.gainDisconnects).toBe(2); // stop 再断新 bus·彻底静默
  });

  it('无 AudioContext（headless）→ play/stop/setVolume 不抛错', () => {
    const p = new SynthMusicPort();
    expect(() => { p.play(TRACK); p.setVolume(0.4); p.stop(); }).not.toThrow();
    expect(p.current).toBeNull();
  });
});
