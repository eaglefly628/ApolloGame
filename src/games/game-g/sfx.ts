// 菜单音效（owner 2026-06-20 · 程序化合成 · 零外部音频文件 · 确定性）。
// 思路同程序化立绘：声音=数据（每种音的频率/波形/时长/音量是一张表），Web Audio 是固定合成器。
// happy-dom/SSR 无 AudioContext → 静默 no-op（测试安全）。静音状态走 localStorage 持久。

export type Sfx = 'click' | 'open' | 'close' | 'coin' | 'play' | 'rare' | 'error';

// 音色表（数据）：f 起始频率 · f2 滑到的频率(可选) · type 波形 · dur 秒 · gain 峰值音量。
const TONE: Record<Sfx, { f: number; f2?: number; type: OscillatorType; dur: number; gain: number }> = {
  click: { f: 420, type: 'triangle', dur: 0.05, gain: 0.05 }, // 轻点
  open: { f: 360, f2: 720, type: 'sine', dur: 0.13, gain: 0.07 }, // 上扬·打开
  close: { f: 640, f2: 280, type: 'sine', dur: 0.12, gain: 0.06 }, // 下落·关闭
  coin: { f: 880, f2: 1320, type: 'square', dur: 0.1, gain: 0.05 }, // 金币/购买
  play: { f: 220, f2: 440, type: 'sawtooth', dur: 0.22, gain: 0.07 }, // 出征号角
  rare: { f: 660, f2: 1760, type: 'triangle', dur: 0.28, gain: 0.07 }, // 稀有/开包
  error: { f: 200, f2: 120, type: 'square', dur: 0.16, gain: 0.06 }, // 失败
};

const MUTE_KEY = 'gg_sfx_muted';
let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { if (!ctx) ctx = new AC(); return ctx; } catch { return null; }
}

export function isSfxMuted(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setSfxMuted(m: boolean): void {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
}

/** 合成播放一枚 UI 音效。无音频上下文或静音 → 静默。 */
export function playSfx(kind: Sfx): void {
  if (isSfxMuted()) return;
  const c = audioCtx(); if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const t = TONE[kind]; const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = t.type; o.frequency.setValueAtTime(t.f, now);
    if (t.f2) o.frequency.exponentialRampToValueAtTime(t.f2, now + t.dur);
    g.gain.setValueAtTime(t.gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + t.dur);
  } catch { /* audio failures are non-fatal */ }
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
