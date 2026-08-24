// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SteamCloudStoragePort, createStoragePort, createMockSteamCloudBridge,
  resetMockSteamCloud, MemoryStoragePort, LocalStorageStoragePort,
} from './index.js';
import type { SaveGame, SteamCloudBridge } from './index.js';

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

  it('索引缺失 + 真桥式 listFiles（返回 FileInfo{name} 对象）→ 仍能重建（防真/假桥形态漂移）', async () => {
    // 真 Steam 的 client.cloud.listFiles() 返回 {name,size} 对象数组，假桥返回字符串数组。
    // 若消费端把对象当字符串用（f.startsWith）会在真机上抛。此测试用真桥形态坐实归一化容错。
    const mock = createMockSteamCloudBridge({ persist: false });
    const realish: SteamCloudBridge = {
      ...mock,
      listFiles: async () =>
        (await mock.listFiles()).map((n) => ({ name: n, size: 0 })) as unknown as string[],
    };
    const port = new SteamCloudStoragePort(realish);
    await port.save('y', game('y', 7, 700));
    await realish.deleteFile('save/__index__.json'); // 索引丢失 → 走重建，listFiles 返回对象
    expect((await port.list()).map((m) => m.slot)).toEqual(['y']);
  });

  it('delete 索引写失败 → 回滚被删槽位文件（与 save 回滚对称·防反向脱节）', async () => {
    // 真机上 Steam Cloud writeFile 可能失败（配额/IO）。旧 delete 先删文件再写索引、不管索引
    // 写成败 → 索引写失败会留下「文件已删索引还列它」的反向脱节。此测试用会让索引写失败的桥坐实回滚。
    const mock = createMockSteamCloudBridge({ persist: false });
    let failIndexWrite = false;
    const bridge: SteamCloudBridge = {
      ...mock,
      async writeFile(name, content) {
        if (failIndexWrite && name.endsWith('__index__.json')) return false; // 模拟索引写失败
        return mock.writeFile(name, content);
      },
    };
    const port = new SteamCloudStoragePort(bridge);
    await port.save('a', game('a', 1, 100));
    expect((await port.load('a'))?.meta.tick).toBe(1);
    failIndexWrite = true;
    await expect(port.delete('a')).rejects.toThrow();     // 索引写失败 → delete 抛（不静默）
    failIndexWrite = false;
    expect((await port.load('a'))?.meta.tick).toBe(1);    // 槽位文件被回滚 → 存档没丢
  });

  it('save 索引写失败 → 槽位文件回滚：新槽删文件、旧槽还原旧档（对称 delete 侧·加固 2026-08-24）', async () => {
    // 与上方 delete 侧回滚用例同手法：桥只让索引文件写失败（模拟配额/IO），坐实 save 的两步写回滚——
    // 防「数据文件已换新、索引还是旧」的正向脱节（读档界面与真档对不上）。
    const mock = createMockSteamCloudBridge({ persist: false });
    let failIndexWrite = false;
    const bridge: SteamCloudBridge = {
      ...mock,
      async writeFile(name, content) {
        if (failIndexWrite && name.endsWith('__index__.json')) return false; // 模拟索引写失败
        return mock.writeFile(name, content);
      },
    };
    const port = new SteamCloudStoragePort(bridge);
    // ① 新槽（prev=null）：索引写失败 → 槽位文件被删（不留「有档无索引」的孤档）
    failIndexWrite = true;
    await expect(port.save('fresh', game('fresh', 1, 100))).rejects.toThrow(); // 抛（不静默）
    expect(await port.load('fresh')).toBeNull(); // 回滚=删文件
    failIndexWrite = false;
    expect((await port.list()).map((m) => m.slot)).not.toContain('fresh'); // 索引/数据一致地「都没有」
    // ② 旧槽（prev 有值）：先成功存 tick=1，再覆盖存 tick=2 失败 → 槽位文件还原 tick=1（老档不丢）
    await port.save('a', game('a', 1, 100));
    failIndexWrite = true;
    await expect(port.save('a', game('a', 2, 200))).rejects.toThrow();
    failIndexWrite = false;
    expect((await port.load('a'))?.meta.tick).toBe(1); // 槽位文件被回滚 → 老档仍在
    expect((await port.list()).find((m) => m.slot === 'a')?.tick).toBe(1); // 索引也仍指老档（一致）
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
