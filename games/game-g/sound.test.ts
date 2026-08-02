// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { G_SFX, playSfx, isSfxOn, setSfxOn, toggleSfx, SFX_MUTE_KEY } from './sound.js';
import { isSfxMuted, setSfxMuted } from './sfx.js';

describe('Game G · 战斗音效（程序化合成 · 数据表 · 静默安全 · 全局静音同步）', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

  it('战斗事件声音表齐备（放牌/抽牌/施法/对决/胜负…）', () => {
    for (const ev of ['select', 'deploy', 'draw', 'cast', 'discard', 'invalid', 'clashReveal', 'clashWin', 'clashLose', 'confirm', 'endTurn', 'victory', 'defeat'] as const) {
      expect(G_SFX[ev], ev).toBeDefined();
      expect(G_SFX[ev].partials.length, ev).toBeGreaterThan(0);
    }
  });

  it('静音开关持久 + toggle 翻转（默认开）', () => {
    expect(isSfxOn()).toBe(true); // 默认开
    setSfxOn(false); expect(isSfxOn()).toBe(false);
    expect(toggleSfx()).toBe(true); expect(isSfxOn()).toBe(true); // 翻回开
    expect(toggleSfx()).toBe(false); expect(isSfxOn()).toBe(false); // 再翻为关
    expect(localStorage.getItem(SFX_MUTE_KEY)).toBe('1');
  });

  it('与菜单音效共用同一静音键 → 一处切换两处同步', () => {
    setSfxOn(false); // 战斗侧静音
    expect(isSfxMuted()).toBe(true); // 菜单侧同步看到静音
    setSfxMuted(false); // 菜单侧取消静音
    expect(isSfxOn()).toBe(true); // 战斗侧同步看到开
  });

  it('playSfx 无 AudioContext（happy-dom）也不抛错·静音也安全', () => {
    expect(() => { playSfx('deploy'); playSfx('victory'); }).not.toThrow();
    setSfxOn(false);
    expect(() => playSfx('clashReveal')).not.toThrow();
  });
});
