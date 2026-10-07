// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { MemorySavePort, sealEnvelope, openEnvelope } from '@zerocraft/engine/services/save/index.js';
import { mount, SAVE_CODEC, SAVE_SLOT, REGISTRY_SLOT, normalizeState } from './game112.js';
import { EMPTY_STATE } from './blueprint.js';
import { TICK_MS } from './world-data.js';

vi.mock('@zerocraft/engine/assets/index.js', () => ({ loadGameArtOverrides: async () => ({}) }));

describe('真实宿主的物件闭环', () => {
  it('空档领见面星砂 → 确认交换纸袋 → 读档后不能重复领取', async () => {
    vi.useFakeTimers();
    const save = new MemorySavePort();
    await save.write(REGISTRY_SLOT, sealEnvelope({ visited: true, entries: [] }, SAVE_CODEC, 100));
    const click = (selector: string): void => {
      const el = document.body.querySelector<HTMLElement>(selector);
      expect(el, selector).not.toBeNull(); el!.click();
    };
    let dispose = mount(document.body, undefined, { save, now: () => 100, seed: 112 });
    try {
      click('[data-action="home.enter"]'); await vi.advanceTimersByTimeAsync(TICK_MS);
      click('#hot-toys'); click('[data-action="shop.open"]');
      expect(document.getElementById('shop-selected-shortfall')).not.toBeNull();
      click('#shop-welcome-claim'); await vi.advanceTimersByTimeAsync(TICK_MS);
      expect(document.getElementById('shop-welcome-claim')).toBeNull();
      expect(document.getElementById('shop-welcome-claimed')).not.toBeNull();
      expect(document.getElementById('shop-selected-buy')).not.toBeNull();
      click('#shop-selected-buy'); await vi.advanceTimersByTimeAsync(TICK_MS);
      expect(document.getElementById('shop-selected-place')).not.toBeNull();
      let persisted = normalizeState(openEnvelope((await save.read(SAVE_SLOT))!, SAVE_CODEC));
      expect(persisted.stardust).toBe(0);
      expect(persisted.claimedGrants).toEqual(['welcome']);
      expect(persisted.items.paperbag).toBe(1);
      dispose();
      dispose = mount(document.body, undefined, { save, now: () => 100, seed: 112 });
      click('[data-action="home.enter"]'); await vi.advanceTimersByTimeAsync(TICK_MS);
      click('#hot-toys'); click('[data-action="shop.open"]');
      expect(document.getElementById('shop-welcome-claim')).toBeNull();
      persisted = normalizeState(openEnvelope((await save.read(SAVE_SLOT))!, SAVE_CODEC));
      expect(persisted.claimedGrants).toEqual(['welcome']);
    } finally { dispose(); vi.useRealTimers(); }
  });

  it('商店购买 → 摆放 → 点实物 → 回应 → 定时结算入档 → 刷新保留 → 收回', async () => {
    vi.useFakeTimers();
    const save = new MemorySavePort();
    await save.write(SAVE_SLOT, sealEnvelope({ ...EMPTY_STATE, stardust: 200 }, SAVE_CODEC, 100));
    await save.write(REGISTRY_SLOT, sealEnvelope({ visited: true, entries: [] }, SAVE_CODEC, 100));
    const click = (selector: string): void => {
      const el = document.body.querySelector<HTMLElement>(selector);
      expect(el, selector).not.toBeNull(); el!.click();
    };
    const tick = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(TICK_MS); };
    let dispose = mount(document.body, undefined, { save, now: () => 100, seed: 112 });
    try {
      click('[data-action="home.enter"]'); await tick();
      click('#hot-toys');
      // 收纳篮使用与游戏相同的商店入口，测试不直接改世界。
      click('[data-action="shop.open"]');
      click('#shop-cushion-inspect');
      click('#shop-selected-buy');
      expect(document.getElementById('shop-selected-place')).not.toBeNull();
      click('#shop-selected-place');
      expect(document.getElementById('prop-art-cushion')).not.toBeNull();
      click('#prop-label-cushion'); await tick();
      click('[data-action="item.respond"]'); await tick();
      const persisted = normalizeState(openEnvelope((await save.read(SAVE_SLOT))!, SAVE_CODEC));
      expect(persisted.itemUses?.cushion).toBe(1);
      expect(persisted.placed).toContain('cushion');
      expect(persisted.stardust).toBe(160);
      dispose();
      dispose = mount(document.body, undefined, { save, now: () => 100, seed: 112 });
      click('[data-action="home.enter"]'); await tick();
      expect(document.getElementById('prop-art-cushion')).not.toBeNull();
      click('#hot-toys'); click('#toy-cushion-remove');
      click('[data-action="hall.back"]');
      expect(document.getElementById('prop-art-cushion')).toBeNull();
    } finally { dispose(); vi.useRealTimers(); }
  });
});
