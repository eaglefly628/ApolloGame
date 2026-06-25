// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SteamCloudStoragePort, createStoragePort, createMockSteamCloudBridge,
  resetMockSteamCloud, MemoryStoragePort, LocalStorageStoragePort,
} from './index.js';
import type { SaveGame } from './index.js';

const game = (slot: string, tick: number, ts: number): SaveGame => ({
  meta: { slot, tick, hash: 'h' + tick, timestamp: ts, label: 'L' + tick },
  snapshot: { tick, entities: [] } as unknown as SaveGame['snapshot'],
});

beforeEach(() => { resetMockSteamCloud(); localStorage.clear(); });

describe('storage · SteamCloudStoragePort（经假云桥·与契约一致）', () => {
  it('save→load 往返；list/delete 一致', async () => {
    const port = new SteamCloudStoragePort(createMockSteamCloudBridge({ persist: false }));
    await port.save('a', game('a', 1, 100));
    await port.save('b', game('b', 2, 200));
    expect((await port.load('a'))?.meta.tick).toBe(1);
    expect(await port.load('missing')).toBeNull();
    expect((await port.list()).map((m) => m.slot).sort()).toEqual(['a', 'b']);
    await port.delete('a');
    expect((await port.list()).map((m) => m.slot)).toEqual(['b']);
    expect(await port.load('a')).toBeNull();
  });

  it('索引缺失 → 从云文件重建', async () => {
    const cloud = createMockSteamCloudBridge({ persist: false });
    const port = new SteamCloudStoragePort(cloud);
    await port.save('x', game('x', 5, 500));
    await cloud.deleteFile('save/__index__.json'); // 模拟索引丢失
    expect((await port.list()).map((m) => m.slot)).toEqual(['x']); // 重建兜底
  });

  it('持久化：新端口（读同一假云态）能读回上一端口存的档', async () => {
    await new SteamCloudStoragePort(createMockSteamCloudBridge()).save('p', game('p', 9, 900));
    const port2 = new SteamCloudStoragePort(createMockSteamCloudBridge());
    expect((await port2.load('p'))?.meta.tick).toBe(9);
  });
});

describe('storage · createStoragePort 工厂', () => {
  it('开假 Steam（mock）→ SteamCloudStoragePort', () => {
    expect(createStoragePort(undefined, { mock: true })).toBeInstanceOf(SteamCloudStoragePort);
  });
  it('真云桥 available → SteamCloudStoragePort', () => {
    const bridge = createMockSteamCloudBridge({ persist: false });
    expect(createStoragePort(bridge)).toBeInstanceOf(SteamCloudStoragePort);
  });
  it('无云、无 mock、有 localStorage → LocalStorageStoragePort', () => {
    expect(createStoragePort(undefined)).toBeInstanceOf(LocalStorageStoragePort);
  });
});
