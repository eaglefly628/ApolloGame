import { SynthAudioPort, type SfxSpec } from '@services/audio/index.js';

// Game G 战斗音效（游戏部分·owner 2026-06-21）。
// 数据驱动：每个事件 = 一段**纯数据**声音规格(SfxSpec)；引擎 SynthAudioPort 是把数据合成成声音的固定解释器。
// 本文件不写任何 Web Audio 命令式代码——只声明「放牌该是什么声」。无 AudioContext（headless/测试）时全程静默 no-op。

// ── 战斗事件 → 声音规格（可被最弱 LLM 照抄改值）──
export const G_SFX = {
  select: { partials: [{ wave: 'square', freq: 660, dur: 0.04, gain: 0.1 }] }, // 选动作/选牌·轻点
  deploy: { partials: [{ noise: true, dur: 0.05, gain: 0.16 }, { wave: 'triangle', freq: 190, freqTo: 120, dur: 0.13, gain: 0.22 }, { wave: 'sine', freq: 92, dur: 0.11, gain: 0.14 }, { wave: 'triangle', freq: 540, at: 0.01, dur: 0.05, gain: 0.06 }] }, // 放牌·咔哒落桌(加低频体+泛音·更厚)
  draw: { partials: [{ noise: true, dur: 0.1, gain: 0.09 }, { wave: 'sine', freq: 430, freqTo: 770, dur: 0.12, gain: 0.12 }] }, // 抽牌·纸面掠起
  cast: { partials: [{ wave: 'triangle', freq: 523, dur: 0.18, gain: 0.13 }, { wave: 'triangle', freq: 659, at: 0.05, dur: 0.18, gain: 0.12 }, { wave: 'triangle', freq: 784, at: 0.1, dur: 0.2, gain: 0.12 }] }, // 施天罡·上行琶音
  discard: { partials: [{ noise: true, dur: 0.12, gain: 0.09 }, { wave: 'sine', freq: 400, freqTo: 200, dur: 0.14, gain: 0.11 }] }, // 弃牌·下沉
  invalid: { partials: [{ wave: 'square', freq: 140, dur: 0.16, gain: 0.16 }, { wave: 'square', freq: 148, dur: 0.16, gain: 0.12 }] }, // 无效·低嗡
  clashReveal: { partials: [{ noise: true, dur: 0.09, gain: 0.22 }, { wave: 'triangle', freq: 95, freqTo: 70, dur: 0.16, gain: 0.2 }, { wave: 'square', freq: 220, freqTo: 140, dur: 0.1, gain: 0.08 }, { wave: 'sine', freq: 60, dur: 0.18, gain: 0.12 }] }, // 掷命揭晓·撞击(加金属泛音+低频冲击)
  clashWin: { partials: [{ wave: 'sine', freq: 880, dur: 0.13, gain: 0.17 }, { wave: 'sine', freq: 1320, at: 0.05, dur: 0.13, gain: 0.14 }, { wave: 'sine', freq: 1760, at: 0.1, dur: 0.14, gain: 0.1 }, { wave: 'triangle', freq: 660, dur: 0.08, gain: 0.06 }] }, // 本场我胜·亮叮(三和泛音·更亮)
  clashLose: { partials: [{ wave: 'triangle', freq: 175, freqTo: 90, dur: 0.2, gain: 0.2 }, { wave: 'sine', freq: 68, dur: 0.24, gain: 0.14 }, { wave: 'square', freq: 130, freqTo: 96, dur: 0.16, gain: 0.06 }] }, // 本场我负·闷捶(加低频+不谐泛音·更沉)
  confirm: { partials: [{ wave: 'sine', freq: 720, dur: 0.06, gain: 0.13 }] }, // 看明白了·确认点
  endTurn: { partials: [{ noise: true, dur: 0.06, gain: 0.08 }, { wave: 'triangle', freq: 330, freqTo: 520, dur: 0.14, gain: 0.13 }] }, // 结束回合·掠过
  victory: { partials: [{ wave: 'triangle', freq: 523, dur: 0.28, gain: 0.18 }, { wave: 'triangle', freq: 659, at: 0.11, dur: 0.28, gain: 0.18 }, { wave: 'triangle', freq: 784, at: 0.22, dur: 0.3, gain: 0.18 }, { wave: 'triangle', freq: 1046, at: 0.34, dur: 0.42, gain: 0.2 }, { wave: 'sine', freq: 1568, at: 0.34, dur: 0.5, gain: 0.09 }, { wave: 'sine', freq: 262, dur: 0.6, gain: 0.08 }] }, // 胜利·上行号角(加高位微光+低根·更华彩)
  defeat: { partials: [{ wave: 'triangle', freq: 392, dur: 0.32, gain: 0.17 }, { wave: 'triangle', freq: 330, at: 0.16, dur: 0.32, gain: 0.17 }, { wave: 'triangle', freq: 247, at: 0.32, dur: 0.48, gain: 0.18 }, { wave: 'sine', freq: 98, dur: 0.7, gain: 0.1 }, { wave: 'sine', freq: 233, at: 0.32, dur: 0.5, gain: 0.06 }] }, // 战败·下行哀落(加低频长鸣·更沉郁)
} satisfies Record<string, SfxSpec>;

export type GSfx = keyof typeof G_SFX;

// ── 静音开关（本地持久化·默认开）──
// 全局静音键：菜单音效(sfx.ts)与战斗音效共用一键，'1'=静音 → 顶栏 🔊 钮与大厅设置开关彼此同步。
// 每次读 localStorage 取最新（不缓存）：任一处切换，另一处即刻生效。
export const SFX_MUTE_KEY = 'gg_sfx_muted';
let port: SynthAudioPort | null = null;
const getPort = (): SynthAudioPort => (port ??= new SynthAudioPort(G_SFX));
function muted(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch { return false; }
}

export function playSfx(ev: GSfx): void {
  if (muted()) return;
  getPort().play(ev); // 无 AudioContext → 端口内部静默
}
export function isSfxOn(): boolean { return !muted(); }
export function setSfxOn(on: boolean): void {
  try { localStorage.setItem(SFX_MUTE_KEY, on ? '0' : '1'); } catch { /* 无 localStorage */ }
  if (!on) port?.stopAll();
}
export function toggleSfx(): boolean { const on = muted(); setSfxOn(on); return on; }
