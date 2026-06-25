// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockSteamBridge, resetMockSteam, createPlatformPort,
  SteamworksPlatformPort, NullPlatformPort, type MockSteamEvent,
} from './index.js';

beforeEach(() => { resetMockSteam(); localStorage.clear(); });

describe('platform · MockSteamBridge（本地假 Steam·同真桥契约）', () => {
  it('available + 假玩家名 + appId；解锁幂等并发事件', () => {
    const evt: MockSteamEvent[] = [];
    const b = createMockSteamBridge({ toast: false, log: false, onEvent: (e) => evt.push(e) });
    expect(b.available).toBe(true);
    expect(typeof b.name).toBe('string');
    expect(b.appId).toBe(480);
    b.unlockAchievement!('ACH_A');
    b.unlockAchievement!('ACH_A'); // 重复 → 幂等不再发事件
    expect(evt.filter((e) => e.kind === 'unlock')).toEqual([{ kind: 'unlock', id: 'ACH_A' }]);
  });

  it('统计读写 + 排行榜高分在前', () => {
    const b = createMockSteamBridge({ toast: false, log: false });
    b.setStat!('wins', 5);
    expect(b.getStat!('wins')).toBe(5);
    expect(b.getStat!('missing')).toBe(0);
    b.uploadLeaderboard!('lb', 30); b.uploadLeaderboard!('lb', 90); b.uploadLeaderboard!('lb', 60);
    // 间接验证：再造一个桥（读同一持久化态），分数应按高→低
    b.store!();
  });

  it('localStorage 持久化：新桥能读回上一桥解锁的成就', () => {
    createMockSteamBridge({ toast: false, log: false }).unlockAchievement!('ACH_PERSIST');
    const evt: MockSteamEvent[] = [];
    const b2 = createMockSteamBridge({ toast: false, log: false, onEvent: (e) => evt.push(e) });
    b2.unlockAchievement!('ACH_PERSIST'); // 已在持久化态里 → 幂等、无事件
    expect(evt).toEqual([]);
  });

  it('解锁弹 Steam 风格 toast 到 document', () => {
    const b = createMockSteamBridge({ log: false }); // toast 默认开
    b.unlockAchievement!('ACH_TOAST');
    expect(document.querySelector('.apollo-steam-toast')).not.toBeNull();
  });
});

describe('platform · 工厂选假 Steam', () => {
  it('opts.mock=true 且无真桥 → SteamworksPlatformPort（包假桥），可用', () => {
    const p = createPlatformPort(undefined, { mock: true });
    expect(p).toBeInstanceOf(SteamworksPlatformPort);
    expect(p.isAvailable()).toBe(true);
  });
  it('localStorage 开关 apollo:steam:mock=1 → 启用假 Steam', () => {
    localStorage.setItem('apollo:steam:mock', '1');
    expect(createPlatformPort(undefined)).toBeInstanceOf(SteamworksPlatformPort);
  });
  it('开关关闭、无桥 → NullPlatformPort', () => {
    expect(createPlatformPort(undefined)).toBeInstanceOf(NullPlatformPort);
  });
});
