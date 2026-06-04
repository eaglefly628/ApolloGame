// 存储 / 存档服务（基础设施，确定性 sim 之外）。
export type { StoragePort, SaveGame, SaveMeta } from './storage-port.js';
export { MemoryStoragePort } from './memory-storage.js';
export { LocalStorageStoragePort } from './local-storage.js';
export { SaveSystem } from './save-system.js';
