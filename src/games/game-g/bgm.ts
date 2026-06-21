import { SynthMusicPort, type MusicTrack, type MusicNote } from '@services/audio/index.js';

// Game G 背景音乐（owner 2026-06-21）：3 首「非常轻柔·低音量」循环，数据驱动·零外部资产——
// 引擎 SynthMusicPort 把音符表循环合成。曲=数据(频率/拍点/波形)，引擎=固定循环解释器。
// BGM 与 SFX 各自独立开关/音量（owner 强调分开）。无 AudioContext（headless/test）→ 静默 no-op。

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12); // MIDI 音高→频率
type N = [beat: number, midi: number, dur: number, gain?: number, wave?: MusicNote['wave']];
const seq = (ns: N[]): MusicNote[] => ns.map(([beat, midi, dur, gain, wave]) => ({ beat, dur, freq: mtof(midi), gain, wave }));
// 把一组和弦(每 4 拍一换)做琶音展开（流水）。
const arp = (chords: number[][], step = 0.5, gain = 0.045): MusicNote[] => {
  const out: MusicNote[] = [];
  chords.forEach((ch, ci) => { const up = [...ch, ch[1] + 12]; for (let k = 0; k < 8; k++) { const idx = k < up.length ? k : up.length - 1 - (k - up.length + 1); out.push({ beat: ci * 4 + k * step, dur: step * 1.4, freq: mtof(up[Math.max(0, Math.min(up.length - 1, idx))]), gain, wave: 'triangle' }); } });
  return out;
};
// 把一组和弦做持续 pad（每和弦音一长音·叠加）。
const pad = (chords: number[][], hold = 4.4, gain = 0.04): MusicNote[] => {
  const out: MusicNote[] = [];
  chords.forEach((ch, ci) => ch.forEach((m) => out.push({ beat: ci * 4, dur: hold, freq: mtof(m), gain, wave: 'sine' })));
  return out;
};

// 和弦进行 I–V–vi–IV（C–G–Am–F·最入耳的流行走向）；PROG2 带低根音作暖垫，TRIAD 给琶音用。
const PROG2 = [[48, 60, 64, 67], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]];
const TRIAD = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];

export interface BgmTrackDef { id: string; name: string; track: MusicTrack }
export const BGM_TRACKS: readonly BgmTrackDef[] = [
  {
    id: 'moonlit', name: '月下·清辉', // 温柔主旋律（级进·动听）+ 暖和弦垫
    track: { bpm: 60, loopBeats: 16, gain: 1, notes: [
      ...pad(PROG2, 4.6, 0.026), // 暖垫
      ...seq([
        [0, 72, 1.2, 0.062], [1.2, 71, 0.8, 0.05], [2, 67, 1, 0.05], [3, 69, 1, 0.046],
        [4, 67, 1.5, 0.056], [5.5, 71, 0.5, 0.046], [6, 74, 2, 0.052],
        [8, 72, 1, 0.056], [9, 69, 1, 0.05], [10, 67, 1, 0.046], [11, 64, 1, 0.046],
        [12, 65, 1, 0.056], [13, 67, 1, 0.05], [14, 64, 1, 0.046], [15, 60, 1, 0.05],
      ]),
    ] },
  },
  {
    id: 'flow', name: '行云·流水', // 流动琶音 + 顶部轻旋律（明亮舒展）
    track: { bpm: 68, loopBeats: 16, gain: 1, notes: [
      ...seq([[0, 36, 16, 0.02, 'sine']]), // 低根音垫
      ...arp(TRIAD, 0.5, 0.034),
      ...seq([
        [0, 76, 2, 0.04], [2, 74, 2, 0.036], [4, 79, 2, 0.038], [6, 74, 2, 0.034],
        [8, 76, 2, 0.04], [10, 72, 2, 0.036], [12, 77, 1.5, 0.038], [13.5, 76, 0.5, 0.03], [14, 72, 2, 0.034],
      ]),
    ] },
  },
  {
    id: 'dream', name: '空山·入眠', // 梦境暖 pad + 缓慢钟鸣旋律（最舒缓·助眠）
    track: { bpm: 52, loopBeats: 16, gain: 1, notes: [
      ...pad(PROG2, 4.7, 0.03),
      ...seq([
        [0, 79, 2.4, 0.034, 'sine'], [2.5, 76, 1.5, 0.03, 'sine'],
        [4, 74, 2.4, 0.032, 'sine'], [6.5, 71, 1.5, 0.03, 'sine'],
        [8, 72, 2.4, 0.034, 'sine'], [10.5, 69, 1.5, 0.03, 'sine'],
        [12, 67, 2, 0.032, 'sine'], [14, 72, 2, 0.03, 'sine'],
      ]),
    ] },
  },
];

// ── 开关/选曲/音量（各自持久·与 SFX 分开）──
const ON_KEY = 'gg_bgm_on', TRK_KEY = 'gg_bgm_track', VOL_KEY = 'gg_bgm_vol';
const ls = {
  get: (k: string): string | null => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 无 localStorage */ } },
};
let port: SynthMusicPort | null = null;
const getPort = (): SynthMusicPort => (port ??= new SynthMusicPort({ volume: bgmVolume() }));

export const isBgmOn = (): boolean => ls.get(ON_KEY) !== '0'; // 默认开
export const bgmTrackIdx = (): number => { const i = parseInt(ls.get(TRK_KEY) ?? '0', 10); return Number.isFinite(i) && i >= 0 && i < BGM_TRACKS.length ? i : 0; };
export const bgmVolume = (): number => { const v = parseFloat(ls.get(VOL_KEY) ?? '0.35'); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35; };

/** 起播当前曲（若开）。须由用户手势触发（autoplay 策略）——引擎端口内部 resume。 */
export function startBgm(): void { if (!isBgmOn()) return; const p = getPort(); p.setVolume(bgmVolume()); p.play(BGM_TRACKS[bgmTrackIdx()].track); }
export function stopBgm(): void { port?.stop(); }
export function setBgmOn(on: boolean): void { ls.set(ON_KEY, on ? '1' : '0'); if (on) startBgm(); else stopBgm(); }
export function toggleBgm(): boolean { const on = !isBgmOn(); setBgmOn(on); return on; }
export function selectBgm(idx: number): void { const i = Math.max(0, Math.min(BGM_TRACKS.length - 1, idx)); ls.set(TRK_KEY, String(i)); if (isBgmOn()) startBgm(); }
export function setBgmVolume(v: number): void { const vv = Math.max(0, Math.min(1, v)); ls.set(VOL_KEY, vv.toFixed(2)); port?.setVolume(vv); }
