// Game Q · Neon Siege —— 音效 = 数据（SfxSpec 音色表 + 引擎 SynthAudioPort 合成器）。
// 零外部音频文件·确定性·headless/SSR 无 AudioContext → 静默 no-op（测试安全）。同 game-g sfx 纪律。
import { SynthAudioPort, type SfxSpec } from '@zerocraft/engine/services/audio/index.js';

export type QSfx = 'build' | 'kill' | 'leak' | 'win' | 'lose';

// 音色表（数据）：freq 起频 · freqTo 滑向 · wave 波形 · dur 秒 · gain 峰值。
const TONE = {
  build: { partials: [{ wave: 'square', freq: 520, freqTo: 820, dur: 0.09, gain: 0.05 }] },   // 建造·上扬确认
  kill: { partials: [{ wave: 'triangle', freq: 940, freqTo: 300, dur: 0.07, gain: 0.045 }] }, // 击杀·脆落
  leak: { partials: [{ wave: 'sawtooth', freq: 175, freqTo: 90, dur: 0.2, gain: 0.07 }] },     // 漏怪·闷响警示
  win: { partials: [{ wave: 'sine', freq: 523, freqTo: 1047, dur: 0.42, gain: 0.07 }] },       // 胜利·上行
  lose: { partials: [{ wave: 'sine', freq: 330, freqTo: 98, dur: 0.5, gain: 0.07 }] },         // 失败·下行
} satisfies Record<QSfx, SfxSpec>;

const MUTE_KEY = 'apollo-q-sfx-mute';
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
export function playQSfx(kind: QSfx): void {
  if (isMuted()) return;
  getPort().play(kind);
}
