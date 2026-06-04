import type { StoragePort, SaveGame, SaveMeta } from './storage-port.js';

// 浏览器存储后端 —— localStorage。键空间用前缀隔离，外加一个索引键存所有槽位的元数据列表。
// 仅在有 localStorage 的环境可用（浏览器）；headless/测试用 MemoryStoragePort。
export class LocalStorageStoragePort implements StoragePort {
  constructor(private readonly prefix = 'apollo-save:') {}

  private key(slot: string): string {
    return this.prefix + slot;
  }
  private get indexKey(): string {
    return this.prefix + '__index__';
  }

  async save(slot: string, data: SaveGame): Promise<void> {
    localStorage.setItem(this.key(slot), JSON.stringify(data));
    const index = await this.list();
    const next = index.filter((m) => m.slot !== slot);
    next.push(data.meta);
    localStorage.setItem(this.indexKey, JSON.stringify(next));
  }

  async load(slot: string): Promise<SaveGame | null> {
    const raw = localStorage.getItem(this.key(slot));
    return raw ? (JSON.parse(raw) as SaveGame) : null;
  }

  async list(): Promise<SaveMeta[]> {
    const raw = localStorage.getItem(this.indexKey);
    const index = raw ? (JSON.parse(raw) as SaveMeta[]) : [];
    return index.sort((a, b) => b.timestamp - a.timestamp);
  }

  async delete(slot: string): Promise<void> {
    localStorage.removeItem(this.key(slot));
    const index = (await this.list()).filter((m) => m.slot !== slot);
    localStorage.setItem(this.indexKey, JSON.stringify(index));
  }
}
