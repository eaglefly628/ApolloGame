// Game K · Zombie Slots —— 音效 = 数据（SfxSpec 音色表 + 引擎 SynthAudioPort 合成器）。
// 零外部音频文件·确定性·headless/SSR 无 AudioContext → 静默 no-op（测试安全）。同 game-q sfx 纪律。
import { SynthAudioPort, type SfxSpec } from '@services/audio/index.js';

export type KSfx = 'spin' | 'stop' | 'win' | 'bigwin' | 'scatter' | 'free' | 'bet' | 'broke';

// 音色表（数据）：wave 波形 · freq 起频 · freqTo 滑向 · dur 秒 · gain 峰值。
const TONE = {
  spin: { partials: [{ wave: 'sawtooth', freq: 180, freqTo: 320, dur: 0.14, gain: 0.04 }] },   // 起转·上扬机械
  stop: { partials: [{ wave: 'square', freq: 300, freqTo: 160, dur: 0.06, gain: 0.05 }] },      // 轮停·闷扣
  win: { partials: [{ wave: 'sine', freq: 660, freqTo: 990, dur: 0.22, gain: 0.06 }] },         // 中奖·清脆上行
  bigwin: { partials: [{ wave: 'sine', freq: 523, freqTo: 1319, dur: 0.5, gain: 0.08 }] },      // 大奖·华彩上冲
  scatter: { partials: [{ wave: 'triangle', freq: 880, freqTo: 440, dur: 0.18, gain: 0.06 }] }, // 分散·警笛感
  free: { partials: [{ wave: 'sine', freq: 392, freqTo: 784, dur: 0.6, gain: 0.08 }] },          // 免费旋转·号角
  bet: { partials: [{ wave: 'square', freq: 440, freqTo: 560, dur: 0.05, gain: 0.035 }] },        // 调注·点选
  broke: { partials: [{ wave: 'sawtooth', freq: 240, freqTo: 70, dur: 0.55, gain: 0.07 }] },     // 破产·下坠
} satisfies Record<KSfx, SfxSpec>;

const MUTE_KEY = 'apollo-k-sfx-mute';
let port: SynthAudioPort | null = null;
const getPort = (): SynthAudioPort => (port ??= new SynthAudioPort(TONE));

export function isMuted(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setMuted(m: boolean): void {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  if (m) port?.stopAll();
}
/** 合成播放一枚音效。无 AudioContext 或静音 → 静默。 */
export function playKSfx(kind: KSfx): void {
  if (isMuted()) return;
  getPort().play(kind);
}
