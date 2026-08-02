// Game T ·《墨消》—— 音效 = 数据（SfxSpec 音色表 + 引擎 SynthAudioPort 合成）。
// GDD §五点五 音效 13 条闭集·鼓/锣/木鱼基调（消除墨点按连锁级升调 → clear/clear2/clear3 三档变体）。
// 零外部音频文件·确定性·headless/SSR 无 AudioContext → 静默 no-op（测试安全）。同 game-q/game-g 纪律。
//
// 接线现状（宿主只能观测 world diff）：swap/clear*/win/lose/star/tap 已接；
// illegal/spawn/scroll/seal/taiji/collect/land 需棋盘事件面（REQ-M3-三期④ 手感层）落地后接——
// 音色数据先备齐，拟声细调待 GD 文案表。
import { SynthAudioPort, type SfxSpec } from '@services/audio/index.js';

export type TSfx =
  | 'swap' // 交换 whoosh
  | 'illegal' // 非法步闷响（待接线）
  | 'clear' // 消除墨点·连锁 1 级
  | 'clear2' // 连锁 2 级（升调）
  | 'clear3' // 连锁 ≥3 级（再升调）
  | 'spawn' // 特殊棋子生成锣点（待接线）
  | 'scroll' // 卷轴引爆笔锋声（待接线）
  | 'seal' // 钤印鼓点（待接线）
  | 'taiji' // 太极全屏铜锣（待接线）
  | 'collect' // 收集入袋（待接线）
  | 'land' // 落地木鱼（待接线）
  | 'star' // 三星逐颗
  | 'win' // 胜利大锣
  | 'lose' // 失败低鼓
  | 'tap'; // 按钮点击

// 拟声对照=copy.md §五（GD 文案表·「唰/咚/嗒/铛/刷/咚！/锵/叮/笃/叮叮叮/咚锵/嗡/哒」）。
const TONE = {
  swap: { partials: [{ wave: 'sine', freq: 620, freqTo: 880, dur: 0.15, gain: 0.04 }] }, // 「唰——」150ms 滑音
  illegal: { partials: [{ wave: 'sine', freq: 160, freqTo: 110, dur: 0.12, gain: 0.06 }] },
  clear: { partials: [{ wave: 'triangle', freq: 520, freqTo: 640, dur: 0.09, gain: 0.05 }] },
  clear2: { partials: [{ wave: 'triangle', freq: 660, freqTo: 800, dur: 0.09, gain: 0.05 }] },
  clear3: { partials: [{ wave: 'triangle', freq: 820, freqTo: 1000, dur: 0.1, gain: 0.055 }] },
  spawn: { partials: [{ wave: 'square', freq: 440, freqTo: 470, dur: 0.16, gain: 0.045 }] },
  scroll: { partials: [{ wave: 'sawtooth', freq: 300, freqTo: 900, dur: 0.14, gain: 0.045 }] },
  seal: { partials: [{ wave: 'sine', freq: 130, freqTo: 90, dur: 0.16, gain: 0.08 }] },
  taiji: { partials: [{ wave: 'square', freq: 220, freqTo: 180, dur: 0.5, gain: 0.06 }] },
  collect: { partials: [{ wave: 'sine', freq: 740, freqTo: 1050, dur: 0.08, gain: 0.04 }] },
  land: { partials: [{ wave: 'sine', freq: 420, freqTo: 380, dur: 0.05, gain: 0.035 }] },
  star: { partials: [{ wave: 'sine', freq: 700, freqTo: 1100, dur: 0.14, gain: 0.055 }] },
  win: { partials: [{ wave: 'square', freq: 262, freqTo: 524, dur: 0.55, gain: 0.06 }] },
  lose: { partials: [{ wave: 'sine', freq: 200, freqTo: 70, dur: 0.6, gain: 0.07 }] },
  tap: { partials: [{ wave: 'sine', freq: 500, freqTo: 560, dur: 0.04, gain: 0.035 }] },
} satisfies Record<TSfx, SfxSpec>;

const MUTE_KEY = 'apollo-t-sfx-mute';
let port: SynthAudioPort | null = null;
const getPort = (): SynthAudioPort => (port ??= new SynthAudioPort(TONE));

export function isMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export function setMuted(m: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (m) port?.stopAll();
}
/** 合成播放一枚音效。无 AudioContext 或静音 → 静默。 */
export function playTSfx(kind: TSfx): void {
  if (isMuted()) return;
  getPort().play(kind);
}
