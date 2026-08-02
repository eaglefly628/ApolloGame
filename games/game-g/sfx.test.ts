// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { playSfx, sfxForAct, isSfxMuted, setSfxMuted } from './sfx.js';

describe('Game G · 菜单音效（程序化合成 · 数据映射 · 静默安全）', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

  it('动作→音效映射：缺省 click，关键动作各有其音', () => {
    expect(sfxForAct('tab')).toBe('click'); // 缺省
    expect(sfxForAct('play')).toBe('play');
    expect(sfxForAct('shop')).toBe('open');
    expect(sfxForAct('recharge-close')).toBe('close');
    expect(sfxForAct('buyTiangang')).toBe('coin');
    expect(sfxForAct('gacha')).toBe('rare');
  });

  it('静音状态持久（localStorage）', () => {
    expect(isSfxMuted()).toBe(false); // 默认开
    setSfxMuted(true);
    expect(isSfxMuted()).toBe(true);
    setSfxMuted(false);
    expect(isSfxMuted()).toBe(false);
  });

  it('playSfx 无 AudioContext（happy-dom）也不抛错', () => {
    expect(() => playSfx('click')).not.toThrow();
    expect(() => playSfx('rare')).not.toThrow();
    setSfxMuted(true);
    expect(() => playSfx('coin')).not.toThrow(); // 静音也安全
  });
});
