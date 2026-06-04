import type { AudioPort, PlayOptions } from './audio-port.js';

// 浏览器音频后端 —— 每个 clipId 一个 HTMLAudioElement。clipId→url 由清单提供
// （可来自 assets/index.json 的 sound 条目）。仅浏览器可用；headless/测试用 NullAudioPort。
export class WebAudioPort implements AudioPort {
  private readonly elements = new Map<string, HTMLAudioElement>();
  private master = 1;

  constructor(private readonly urls: Readonly<Record<string, string>>, private readonly baseUrl = '') {}

  private element(clipId: string): HTMLAudioElement | null {
    const url = this.urls[clipId];
    if (!url) return null;
    let el = this.elements.get(clipId);
    if (!el) {
      el = new Audio(this.baseUrl + url);
      this.elements.set(clipId, el);
    }
    return el;
  }

  play(clipId: string, opts?: PlayOptions): void {
    const el = this.element(clipId);
    if (!el) return;
    el.loop = opts?.loop ?? false;
    el.volume = (opts?.volume ?? 1) * this.master;
    el.currentTime = 0;
    void el.play().catch(() => {}); // 自动播放策略可能拒绝 → 静默
  }
  stop(clipId: string): void {
    const el = this.elements.get(clipId);
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }
  stopAll(): void {
    for (const id of this.elements.keys()) this.stop(id);
  }
  setMasterVolume(v: number): void {
    this.master = v;
    for (const el of this.elements.values()) el.volume = v;
  }
}
