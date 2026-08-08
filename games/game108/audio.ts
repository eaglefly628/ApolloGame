// game108 音频 —— **声音 = 数据**（`docs/playbooks/audio.md` 铁律）。
//
// 每种音的频率/波形/时长/音量是一张表，合成器是引擎的固定解释器（`SynthAudioPort` / `SynthMusicPort`）。
// **零外部音频文件**、确定性、无 `AudioContext`（headless/SSR/探针）自动静默 no-op。
// 手册红线抄在这儿免得走偏：不在游戏层手写 Web Audio、不依赖 mp3 资产、音色表只用闭集字段。
//
// 正样例照的是 `games/game-g/{sfx,bgm}.ts`。BGM 与 SFX **各自独立开关**（手册明写）。
import { SynthAudioPort, SynthMusicPort, type SfxSpec, type MusicTrack, type MusicNote } from '@zerocraft/engine/services/audio/index.js';

// ── 音效（SFX）────────────────────────────────────────────────────────
/** 事件键闭集——屏上每一次"值得出声"的事都在这里，别再加散的。 */
export type Sfx = 'charge' | 'full' | 'throw' | 'reveal' | 'hit' | 'taken' | 'tie' | 'win' | 'lose' | 'ui' | 'denied';

// 音色表（数据）：起始频率 freq · 滑到的频率 freqTo(可选) · wave 波形 · dur 秒 · gain 峰值。
// 调音思路跟着玩法走：蓄力一层比一层高（可惜同一个键只能一个音，用短促上滑表示"又存了一点"），
// 蓄满是**一记明确的事件音**（玩法里蓄满就是一个事件，不是数字从 2 变 3）；
// 命中按"打出去/挨一下"分成两个音，挨打那个刻意难听（低频方波下滑）。
const TONE = {
  charge: { partials: [{ wave: 'triangle', freq: 520, freqTo: 700, dur: 0.06, gain: 0.05 }] },
  full: { partials: [{ wave: 'triangle', freq: 700, freqTo: 1320, dur: 0.22, gain: 0.06 }, { wave: 'sine', freq: 1760, dur: 0.18, gain: 0.03 }] },
  throw: { partials: [{ wave: 'sawtooth', freq: 300, freqTo: 180, dur: 0.12, gain: 0.05 }] },
  reveal: { partials: [{ wave: 'square', freq: 240, freqTo: 480, dur: 0.1, gain: 0.05 }] },
  hit: { partials: [{ wave: 'square', freq: 180, freqTo: 90, dur: 0.16, gain: 0.07 }, { wave: 'triangle', freq: 880, freqTo: 440, dur: 0.12, gain: 0.04 }] },
  taken: { partials: [{ wave: 'square', freq: 140, freqTo: 60, dur: 0.26, gain: 0.08 }] },
  tie: { partials: [{ wave: 'sine', freq: 440, dur: 0.14, gain: 0.04 }, { wave: 'sine', freq: 440, dur: 0.14, gain: 0.04 }] },
  win: { partials: [{ wave: 'triangle', freq: 523, dur: 0.14, gain: 0.06 }, { wave: 'triangle', freq: 659, dur: 0.16, gain: 0.06 }, { wave: 'triangle', freq: 784, freqTo: 1046, dur: 0.34, gain: 0.07 }] },
  lose: { partials: [{ wave: 'sine', freq: 392, freqTo: 196, dur: 0.5, gain: 0.06 }] },
  ui: { partials: [{ wave: 'triangle', freq: 420, dur: 0.05, gain: 0.045 }] },
  denied: { partials: [{ wave: 'square', freq: 200, freqTo: 150, dur: 0.09, gain: 0.045 }] },
} satisfies Record<Sfx, SfxSpec>;

// ── 背景音乐（BGM）────────────────────────────────────────────────────
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);   // MIDI 音高 → 频率

/**
 * 一首轻柔的循环（约会向定位：**别抢戏**，是垫在草地上的空气，不是战斗曲）。
 * 走向 I–V–vi–IV（C–G–Am–F）—— 最入耳的流行走向，八拍一圈。
 * 两层：`pad` 长音铺底 + `arp` 琶音流动；音量都压得很低（gain ≤ 0.04）。
 */
const PROG = [[48, 60, 64, 67], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]];
const notes: MusicNote[] = [];
PROG.forEach((chord, ci) => {
  for (const m of chord) notes.push({ beat: ci * 4, dur: 4.3, freq: mtof(m), gain: 0.028, wave: 'sine' });
  const up = [...chord.slice(1), chord[1]! + 12];
  for (let k = 0; k < 8; k++) {
    const idx = k < up.length ? k : up.length - 1 - (k - up.length + 1);
    notes.push({ beat: ci * 4 + k * 0.5, dur: 0.7, freq: mtof(up[Math.max(0, Math.min(up.length - 1, idx))]!), gain: 0.022, wave: 'triangle' });
  }
});
export const BGM_TRACK: MusicTrack = { bpm: 92, loopBeats: 16, notes, gain: 0.9 };

// ── 开关（持久化·BGM 与 SFX 分开）────────────────────────────────────
const KEY = { sfx: 'g108_sfx_off', bgm: 'g108_bgm_off', voice: 'g108_voice_off' } as const;
const readFlag = (k: string): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(k) === '1'; } catch { return false; }
};
const writeFlag = (k: string, off: boolean): void => {
  try { localStorage.setItem(k, off ? '1' : '0'); } catch { /* 无 localStorage（探针/SSR）→ 本次会话内仍生效 */ }
};

/** 三个开关的当前状态（`true` = 开着）。 */
export interface AudioFlags { sfx: boolean; bgm: boolean; voice: boolean }
export const loadAudioFlags = (): AudioFlags => ({
  sfx: !readFlag(KEY.sfx), bgm: !readFlag(KEY.bgm), voice: !readFlag(KEY.voice),
});

/**
 * 音频门面：屏那边只管发事件名，开关/端口/降级都在这儿。
 * 无 `AudioContext` 时端口内建静默 no-op —— 探针与单测跑过不会炸，也不会出声。
 */
export function createAudio(initial: AudioFlags = loadAudioFlags()) {
  let flags: AudioFlags = { ...initial };
  let sfxPort: SynthAudioPort | null = null;
  let musicPort: SynthMusicPort | null = null;

  const sfx = (): SynthAudioPort => (sfxPort ??= new SynthAudioPort(TONE));
  const music = (): SynthMusicPort => (musicPort ??= new SynthMusicPort({ volume: 0.3 }));

  const syncBgm = (): void => {
    if (flags.bgm) music().play(BGM_TRACK);
    else music().stop();
  };

  return {
    get flags(): AudioFlags { return { ...flags }; },
    /** 放一枚音效（关着就什么也不做）。 */
    play(id: Sfx): void { if (flags.sfx) sfx().play(id); },
    /** 开局时调一次：BGM 按当前开关起。**必须由真实用户手势之后调**（浏览器自动播放策略）。 */
    start(): void { syncBgm(); },
    toggle(which: keyof AudioFlags): AudioFlags {
      flags = { ...flags, [which]: !flags[which] };
      writeFlag(KEY[which], !flags[which]);
      if (which === 'bgm') syncBgm();
      return { ...flags };
    },
    stop(): void { musicPort?.stop(); },
  };
}
export type GameAudio = ReturnType<typeof createAudio>;
