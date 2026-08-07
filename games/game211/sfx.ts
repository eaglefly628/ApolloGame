// 菜单音效（owner 2026-06-20 · 程序化合成 · 零外部音频文件 · 确定性）。
// 思路同程序化立绘：声音=数据（每种音的频率/波形/时长/音量是一张表），合成器=引擎 SynthAudioPort 固定解释器
// （主程 2026-06-21 归并：原本地手写 Web Audio 与战斗音效重复，下沉到引擎统一端口·游戏层只剩数据）。
// happy-dom/SSR 无 AudioContext → 静默 no-op（测试安全）。静音状态走 localStorage 持久（与战斗音效同键）。
import { SynthAudioPort, type SfxSpec } from '@zerocraft/engine/services/audio/index.js';
import { SFX_MUTE_KEY } from './sound.js';

export type Sfx = 'click' | 'open' | 'close' | 'coin' | 'play' | 'rare' | 'error';

// 音色表（数据）：起始频率 freq · 滑到的频率 freqTo(可选) · wave 波形 · dur 秒 · gain 峰值音量。
const TONE = {
  click: { partials: [{ wave: 'triangle', freq: 420, dur: 0.05, gain: 0.05 }] }, // 轻点
  open: { partials: [{ wave: 'sine', freq: 360, freqTo: 720, dur: 0.13, gain: 0.07 }] }, // 上扬·打开
  close: { partials: [{ wave: 'sine', freq: 640, freqTo: 280, dur: 0.12, gain: 0.06 }] }, // 下落·关闭
  coin: { partials: [{ wave: 'square', freq: 880, freqTo: 1320, dur: 0.1, gain: 0.05 }] }, // 金币/购买
  play: { partials: [{ wave: 'sawtooth', freq: 220, freqTo: 440, dur: 0.22, gain: 0.07 }] }, // 出征号角
  rare: { partials: [{ wave: 'triangle', freq: 660, freqTo: 1760, dur: 0.28, gain: 0.07 }] }, // 稀有/开包
  error: { partials: [{ wave: 'square', freq: 200, freqTo: 120, dur: 0.16, gain: 0.06 }] }, // 失败
} satisfies Record<Sfx, SfxSpec>;

let port: SynthAudioPort | null = null;
const getPort = (): SynthAudioPort => (port ??= new SynthAudioPort(TONE));

export function isSfxMuted(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch { return false; }
}
export function setSfxMuted(m: boolean): void {
  try { localStorage.setItem(SFX_MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  if (m) port?.stopAll();
}

/** 合成播放一枚 UI 音效。无音频上下文或静音 → 静默。 */
export function playSfx(kind: Sfx): void {
  if (isSfxMuted()) return;
  getPort().play(kind); // 引擎端口：无 AudioContext 内部静默
}

// 动作 → 音效映射（数据）：data-act → Sfx；缺省 'click'。
const ACT_SFX: Record<string, Sfx> = {
  play: 'play', 'guide-finish': 'play',
  shop: 'open', recharge: 'open', settings: 'open', intro: 'open', tut: 'open', man: 'open', deckAdd: 'open', heroDetail: 'open',
  'recharge-close': 'close', 'settings-close': 'close', 'help-close': 'close', 'deckPicker-close': 'close', 'reveal-close': 'close', 'story-skip': 'close', 'guide-skip': 'close',
  rechargeBuy: 'coin', exchangeBuy: 'coin', shardBuy: 'coin', buyTiangang: 'coin', buyFoil: 'coin', diamondUnlock: 'coin', inlay: 'coin', toggleTiangang: 'coin', craftTiangang: 'rare',
  gacha: 'rare',
};
/** 某个 data-act 该响哪种音（缺省轻点 click）。 */
export function sfxForAct(act: string): Sfx {
  return ACT_SFX[act] ?? 'click';
}
