// Game I · 声音测试 —— 数据目录 + Web Audio 合成播放器（自包含·无需音频文件）。
//
// 红线：声音目录 SOUNDS 是「数据」（id/label/波形/频率/时长，弱模型能填）；
// 真正出声的 makeSoundPlayer 是「宿主运行时胶水」（Web Audio·像 showToast），不是数据。
// 游戏层只填 SoundDef + 在按钮上发 playSound 信号；二者只在信号名/id 处相遇。

export interface SoundDef {
  id: string;
  label: string;
  type: OscillatorType;   // sine / square / sawtooth / triangle
  freq: number;           // 起始频率 Hz
  freq2?: number;         // 终止频率（滑音·缺省=无滑音）
  dur: number;            // 时长秒
}

export const SOUNDS: SoundDef[] = [
  { id: 'click',   label: '🔘 点击', type: 'square',   freq: 800,  dur: 0.05 },
  { id: 'tick',    label: '⏱ 滴答',  type: 'sine',     freq: 1200, dur: 0.04 },
  { id: 'blip',    label: '💧 气泡', type: 'sine',     freq: 600,  dur: 0.07 },
  { id: 'success', label: '✅ 成功', type: 'sine',     freq: 523,  freq2: 784,  dur: 0.18 },
  { id: 'coin',    label: '🪙 金币', type: 'square',   freq: 988,  freq2: 1319, dur: 0.12 },
  { id: 'powerup', label: '⬆ 升级',  type: 'square',   freq: 392,  freq2: 1047, dur: 0.30 },
  { id: 'error',   label: '❌ 错误', type: 'sawtooth', freq: 220,  freq2: 130,  dur: 0.22 },
  { id: 'alert',   label: '🚨 警报', type: 'triangle', freq: 880,  freq2: 587,  dur: 0.40 },
];

/** 宿主音频播放器（Web Audio·懒初始化 AudioContext）。无 AudioContext（如测试/SSR）时静默 no-op。 */
export function makeSoundPlayer(): { play: (id: string, volume?: number) => void; close: () => void } {
  let ctx: AudioContext | null = null;
  const AC: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined' ? AudioContext
    : (typeof (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined'
        ? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined);
  const ensure = (): AudioContext | null => {
    if (!ctx && AC) ctx = new AC();
    return ctx;
  };
  return {
    play(id, volume = 0.7) {
      const def = SOUNDS.find((s) => s.id === id);
      if (!def) return;
      const ac = ensure();
      if (!ac) return; // 无 Web Audio → 静默
      if (ac.state === 'suspended') void ac.resume(); // 用户手势后解锁
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freq, now);
      if (def.freq2 !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, def.freq2), now + def.dur);
      }
      const vol = Math.max(0.0001, Math.min(1, volume));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);   // 起音
      gain.gain.exponentialRampToValueAtTime(0.0001, now + def.dur); // 衰减
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + def.dur + 0.03);
    },
    close() {
      if (ctx) { void ctx.close(); ctx = null; }
    },
  };
}
