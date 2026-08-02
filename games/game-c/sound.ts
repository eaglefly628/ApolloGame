import { SynthAudioPort, SynthMusicPort, type SfxSpec, type MusicTrack, type MusicNote } from '@services/audio/index.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》声音（owner 2026-07-18「没发现游戏有音乐」）——声音=数据（音频手册铁律）。
//
//  BGM = 一张音符表 MusicTrack（夜宴小调 lounge 循环）；SFX = 各事件一张音色表 SfxSpec。
//  引擎 SynthMusicPort / SynthAudioPort 是把这两份**纯数据**合成成声音的固定解释器——本文件不写任何 Web Audio
//  命令式代码（音频手册③红线）。无 AudioContext（headless/test）→ 端口内部全程静默 no-op（测试/SSR 安全）。
//  render-only·表现层旁路·不进 sim/hash（回放 lockstep 零影响）。
// ═══════════════════════════════════════════════════════════════

// ── ① 事件音效（音色表·可被最弱 LLM 照抄改值）──
export const C_SFX = {
  deal:   { partials: [{ noise: true, dur: 0.09, gain: 0.10 }, { wave: 'sine', freq: 520, freqTo: 900, dur: 0.10, gain: 0.10 }] }, // 发牌·纸面掠起
  chip:   { partials: [{ noise: true, dur: 0.045, gain: 0.17 }, { wave: 'triangle', freq: 240, freqTo: 150, dur: 0.09, gain: 0.16 }, { wave: 'square', freq: 640, at: 0.006, dur: 0.03, gain: 0.05 }] }, // 筹码落桌·咔哒
  check:  { partials: [{ noise: true, dur: 0.05, gain: 0.12 }, { wave: 'sine', freq: 175, dur: 0.06, gain: 0.11 }] }, // 过牌·敲桌
  fold:   { partials: [{ noise: true, dur: 0.12, gain: 0.10 }, { wave: 'sine', freq: 380, freqTo: 165, dur: 0.14, gain: 0.10 }] }, // 弃牌·牌滑走下沉
  flip:   { partials: [{ noise: true, dur: 0.07, gain: 0.12 }, { wave: 'triangle', freq: 440, freqTo: 740, dur: 0.12, gain: 0.12 }] }, // 翻街·揭示
  allin:  { partials: [{ wave: 'square', freq: 300, freqTo: 540, dur: 0.16, gain: 0.12 }, { wave: 'triangle', freq: 150, dur: 0.20, gain: 0.12 }, { noise: true, dur: 0.10, gain: 0.14 }] }, // 全下·推入
  reveal: { partials: [{ noise: true, dur: 0.08, gain: 0.14 }, { wave: 'triangle', freq: 110, freqTo: 82, dur: 0.16, gain: 0.14 }, { wave: 'sine', freq: 300, dur: 0.10, gain: 0.06 }] }, // 摊牌·揭盅
  win:    { partials: [{ wave: 'sine', freq: 784, dur: 0.16, gain: 0.16 }, { wave: 'sine', freq: 1046, at: 0.07, dur: 0.16, gain: 0.13 }, { wave: 'sine', freq: 1318, at: 0.14, dur: 0.20, gain: 0.10 }] }, // 胜·上行亮叮
  lose:   { partials: [{ wave: 'triangle', freq: 300, freqTo: 155, dur: 0.26, gain: 0.15 }, { wave: 'sine', freq: 88, dur: 0.30, gain: 0.12 }] }, // 负·闷沉
  pawn:   { partials: [{ wave: 'sine', freq: 880, dur: 0.05, gain: 0.11 }, { wave: 'sine', freq: 1175, at: 0.045, dur: 0.06, gain: 0.09 }, { noise: true, dur: 0.03, gain: 0.06 }] }, // 典当·金币叮
  click:  { partials: [{ wave: 'sine', freq: 660, dur: 0.04, gain: 0.09 }] }, // UI 点击
} satisfies Record<string, SfxSpec>;
export type CSfx = keyof typeof C_SFX;

// ── ② 背景音乐（音符表·夜宴小调 lounge 循环）──
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12); // MIDI 音高→频率
type Nt = [beat: number, midi: number, dur: number, gain?: number, wave?: MusicNote['wave']];
const seq = (ns: Nt[]): MusicNote[] => ns.map(([beat, midi, dur, gain, wave]) => ({ beat, dur, freq: mtof(midi), gain, wave }));
// 一组和弦做持续 pad（每和弦音一长音·叠加暖垫）。
const pad = (chords: number[][], hold = 3.8, gain = 0.024): MusicNote[] => {
  const out: MusicNote[] = [];
  chords.forEach((ch, ci) => ch.forEach((m) => out.push({ beat: ci * 4, dur: hold, freq: mtof(m), gain, wave: 'sine' })));
  return out;
};
// 小调走向 Am–Dm–E–Am（暗涌·适牌桌夜宴氛围）。
const PROG = [[45, 57, 60, 64], [50, 57, 62, 65], [52, 56, 59, 64], [45, 57, 60, 64]];
export const C_BGM: MusicTrack = {
  bpm: 72, loopBeats: 16, gain: 1, notes: [
    ...seq([[0, 33, 16, 0.02, 'sine']]), // 低根音垫（整段一长音）
    ...pad(PROG, 3.8, 0.022),
    ...seq([ // 稀疏主旋律（walking·爵士夜·三角波柔）
      [0, 69, 1.5, 0.038, 'triangle'], [2, 72, 1, 0.034, 'triangle'], [3, 71, 1, 0.030, 'triangle'],
      [4, 69, 2, 0.036, 'triangle'], [7, 65, 1, 0.028, 'triangle'],
      [8, 64, 1.5, 0.036, 'triangle'], [10, 67, 1, 0.032, 'triangle'], [11, 69, 1, 0.030, 'triangle'],
      [12, 71, 2, 0.036, 'triangle'], [14, 76, 1.5, 0.034, 'triangle'],
    ]),
  ],
};

// ── ③ 门面（BGM 起停 + SFX 播放 + 静音·驱动自宿主 muted 态·无 localStorage 依赖）──
class GameCAudio {
  private music: SynthMusicPort | null = null;
  private sfxPort: SynthAudioPort | null = null;
  private muted = false;
  private atTable = false;
  private readonly musicVol = 0.24; // 轻柔（BGM 不压玩法音效）

  private musicPort(): SynthMusicPort { return (this.music ??= new SynthMusicPort({ volume: this.musicVol })); }
  private sfx(): SynthAudioPort { return (this.sfxPort ??= new SynthAudioPort(C_SFX)); }

  /** 进牌桌：起 BGM（进桌由点击触发=满足 autoplay 用户手势·端口内部 resume）。 */
  enterTable(): void { this.atTable = true; if (!this.muted) this.musicPort().play(C_BGM); }
  /** 回菜单/退场：停 BGM。 */
  leaveTable(): void { this.atTable = false; this.music?.stop(); }
  /** 静音开关：静音停乐；取消静音若在桌则续乐。 */
  setMuted(m: boolean): void { this.muted = m; if (m) this.music?.stop(); else if (this.atTable) this.musicPort().play(C_BGM); }
  /** 播一次性音效（静音跳过·无 AudioContext 端口内部静默）。 */
  play(ev: CSfx): void { if (this.muted) return; this.sfx().play(ev); }
  /** 全拆（teardown）。 */
  dispose(): void { this.music?.stop(); this.atTable = false; }
}
/** game-c 声音单例（宿主 game-c.ts 消费·render-only）。 */
export const gcAudio = new GameCAudio();
