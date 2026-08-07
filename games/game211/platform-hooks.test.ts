// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { ggOnBattleWon, ggCloudSave, ggCloudLoad, __setGgPlatform } from './platform-hooks.js';
import type { PlatformPort } from '@zerocraft/engine/services/platform/index.js';
import { resetMockSteamCloud } from '@zerocraft/engine/services/storage/index.js';

function fakePort(): { port: PlatformPort; calls: string[] } {
  const calls: string[] = [];
  const port: PlatformPort = {
    isAvailable: () => true,
    unlockAchievement: (id) => calls.push('ach:' + id),
    clearAchievement: () => {},
    setStat: (id, v) => calls.push(`stat:${id}=${v}`),
    getStat: () => 0,
    uploadLeaderboard: (b, s) => calls.push(`lb:${b}=${s}`),
    setRichPresence: (_k, v) => calls.push('rp:' + v),
    store: () => calls.push('store'),
  };
  return { port, calls };
}

beforeEach(() => { resetMockSteamCloud(); localStorage.clear(); __setGgPlatform(null); });

describe('game211 · 平台触点', () => {
  it('胜利：解 GG_FIRST_WIN + 无伤加 GG_FLAWLESS + 传战役进度排行 + 富状态', () => {
    const { port, calls } = fakePort();
    ggOnBattleWon({ campaignMax: 7, flawless: true }, port);
    expect(calls).toContain('ach:GG_FIRST_WIN');
    expect(calls).toContain('ach:GG_FLAWLESS');
    expect(calls).toContain('lb:campaign_progress=7');
    expect(calls).toContain('rp:战役 第 7 关');
    expect(calls).toContain('store');
  });

  it('非无伤：不解 GG_FLAWLESS', () => {
    const { port, calls } = fakePort();
    ggOnBattleWon({ campaignMax: 2, flawless: false }, port);
    expect(calls).toContain('ach:GG_FIRST_WIN');
    expect(calls).not.toContain('ach:GG_FLAWLESS');
  });

  it('平台不可用 → 零调用', () => {
    const calls: string[] = [];
    const port: PlatformPort = { ...fakePort().port, isAvailable: () => false, unlockAchievement: (id) => calls.push(id) };
    ggOnBattleWon({ campaignMax: 1, flawless: true }, port);
    expect(calls).toEqual([]);
  });

  it('云存档镜像：开假云 → 写后能读回', async () => {
    localStorage.setItem('apollo:steam:mock', '1');
    ggCloudSave('{"hp":42}');
    expect(await ggCloudLoad()).toBe('{"hp":42}');
  });

  it('未开云 → ggCloudLoad 返回 null', async () => {
    expect(await ggCloudLoad()).toBeNull();
  });
});
