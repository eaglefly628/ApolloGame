// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemorySavePort } from './memory-save-port.js';
import { LocalStorageSavePort } from './local-save-port.js';
import { BridgeSavePort, FileSavePort, CloudSavePort, createMemoryFileBridge } from './bridge-save-port.js';
import { sealEnvelope, openEnvelope } from './envelope.js';
import type { SavePort, SaveCodec } from './save-port.js';
import { createMockSteamCloudBridge, resetMockSteamCloud } from '@services/storage/index.js';

// SavePort 契约（REQ-CAP 件③）：write/read/list/remove 往返 + 与信封 seal/open 端到端。
// 四后端同一套契约测试跑一遍（Memory / LocalStorage / File[内存桥] / Cloud[假 Steam 云桥]）。
const codec: SaveCodec = { gameId: 'game-z', schema: 1 };

function contract(name: string, make: () => SavePort): void {
  describe(`SavePort 契约 · ${name}`, () => {
    it('write→read 往返（经信封 seal/open 端到端）', async () => {
      const port = make();
      const data = { gold: 42, deck: [1, 2, 3] };
      await port.write('slot1', sealEnvelope(data, codec, 111));
      const env = await port.read('slot1');
      expect(env).not.toBeNull();
      expect(openEnvelope(env!, codec)).toEqual(data);
      expect(env!.savedAt).toBe(111);
    });
    it('list 返回元数据（按 savedAt 降序）；read 缺槽 → null', async () => {
      const port = make();
      await port.write('a', sealEnvelope({ n: 1 }, codec, 100));
      await port.write('b', sealEnvelope({ n: 2 }, codec, 300));
      await port.write('c', sealEnvelope({ n: 3 }, codec, 200));
      const metas = await port.list();
      expect(metas.map((m) => m.slot)).toEqual(['b', 'c', 'a']);
      expect(metas[0]).toMatchObject({ slot: 'b', schema: 1, gameId: 'game-z', savedAt: 300 });
      expect(await port.read('nope')).toBeNull();
    });
    it('remove 删槽 + 出列表；覆盖写不重复入列表', async () => {
      const port = make();
      await port.write('x', sealEnvelope({ n: 1 }, codec, 1));
      await port.write('x', sealEnvelope({ n: 2 }, codec, 2)); // 覆盖
      expect(await port.list()).toHaveLength(1);
      await port.remove('x');
      expect(await port.read('x')).toBeNull();
      expect(await port.list()).toHaveLength(0);
    });
  });
}

beforeEach(() => { resetMockSteamCloud(); localStorage.clear(); });

contract('MemorySavePort', () => new MemorySavePort());
contract('LocalStorageSavePort', () => new LocalStorageSavePort('test-save:'));
contract('FileSavePort（内存文件桥）', () => new FileSavePort(createMemoryFileBridge()));
contract('CloudSavePort（假 Steam 云桥）', () => new CloudSavePort(createMockSteamCloudBridge({ persist: false })));
contract('BridgeSavePort（基类·内存桥）', () => new BridgeSavePort(createMemoryFileBridge()));

describe('BridgeSavePort —— 索引缺失从文件重建（兜底）', () => {
  it('删掉索引文件后 list 仍能从槽位文件重建', async () => {
    const bridge = createMemoryFileBridge();
    const port = new BridgeSavePort(bridge);
    await port.write('a', sealEnvelope({ n: 1 }, codec, 100));
    await port.write('b', sealEnvelope({ n: 2 }, codec, 200));
    await bridge.deleteFile('save/__index__.json'); // 索引损毁
    const metas = await port.list();
    expect(metas.map((m) => m.slot).sort()).toEqual(['a', 'b']);
  });
});

// ⚔ 对抗性输入（存档腐蚀 + 配额写失败·加固 2026-08-24）：LocalStorageSavePort 的三条防御腿——
// 坏 JSON 槽读回 null 不抛 / 坏索引当空 / 两步写（数据→索引）索引失败回滚数据键（原子性兜底）。
describe('LocalStorageSavePort —— 坏数据与写失败防御', () => {
  const PREFIX = 'test-save:';

  it('槽位存坏 JSON（DevTools 篡改）→ read null 不抛；结构好坏由 openEnvelope checksum 把关', async () => {
    const port = new LocalStorageSavePort(PREFIX);
    localStorage.setItem(PREFIX + 'bad', '{oops 不是 JSON');
    await expect(port.read('bad')).resolves.toBeNull(); // 不抛炸主循环
  });

  it('索引键损坏 → list 当空 []（存档界面不崩）·好档信封本体不受牵连', async () => {
    const port = new LocalStorageSavePort(PREFIX);
    await port.write('ok', sealEnvelope({ n: 1 }, codec, 100));
    localStorage.setItem(PREFIX + '__index__', '!!not-json!!'); // 索引损坏
    await expect(port.list()).resolves.toEqual([]); // 坏索引 → []
    const env = await port.read('ok'); // 槽位数据仍完好可读（索引坏≠数据坏）
    expect(openEnvelope(env!, codec)).toEqual({ n: 1 });
  });

  it('索引写失败（配额）→ 数据键回滚：新槽删键、旧槽还原旧值，然后把错误抛给调用方', async () => {
    // 可注入抛错的 fake storage（happy-dom 的 localStorage 是 Proxy·方法覆写会被吞——整体 stubGlobal 替换）：
    // 只让「索引键」的 setItem 抛，模拟 QuotaExceededError 恰落在两步写（数据→索引）的第二步。
    const store = new Map<string, string>();
    let failIndexWrite = false;
    const fake = {
      getItem: (k: string): string | null => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string): void => {
        if (failIndexWrite && k === PREFIX + '__index__') throw new Error('QuotaExceededError(fake)');
        store.set(k, String(v));
      },
      removeItem: (k: string): void => { store.delete(k); },
      clear: (): void => store.clear(),
      key: (i: number): string | null => [...store.keys()][i] ?? null,
      get length(): number { return store.size; },
    };
    vi.stubGlobal('localStorage', fake);
    try {
      const port = new LocalStorageSavePort(PREFIX);
      // ① 新槽（prev=null）：索引写失败 → 数据键被删（不留「有数据无索引」的孤档）
      failIndexWrite = true;
      await expect(port.write('fresh', sealEnvelope({ n: 1 }, codec, 100))).rejects.toThrow('QuotaExceededError');
      expect(localStorage.getItem(PREFIX + 'fresh')).toBeNull(); // 回滚=删键
      await expect(port.read('fresh')).resolves.toBeNull();
      // ② 旧槽（prev 有值）：先成功存 v1，再覆盖写失败 → 数据键还原 v1（老档不丢）
      failIndexWrite = false;
      await port.write('keep', sealEnvelope({ v: 1 }, codec, 111));
      failIndexWrite = true;
      await expect(port.write('keep', sealEnvelope({ v: 2 }, codec, 222))).rejects.toThrow('QuotaExceededError');
      failIndexWrite = false;
      const env = await port.read('keep');
      expect(openEnvelope(env!, codec)).toEqual({ v: 1 }); // 回滚到旧值·checksum 仍自洽
      expect(env!.savedAt).toBe(111);
      expect((await port.list()).map((m) => m.slot)).toContain('keep'); // 索引/数据一致（都指 v1）
    } finally {
      vi.unstubAllGlobals(); // 还原真 localStorage（后续用例不受牵连）
    }
  });
});
