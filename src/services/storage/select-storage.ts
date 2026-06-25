import type { StoragePort } from './storage-port.js';
import { MemoryStoragePort } from './memory-storage.js';
import { LocalStorageStoragePort } from './local-storage.js';
import { SteamCloudStoragePort } from './steam-cloud-storage.js';
import { createMockSteamCloudBridge, type SteamCloudBridge } from './cloud-bridge.js';
import { isMockSteamEnabled } from '../platform/index.js';

// createStoragePort —— 存储端口工厂，**不写 if 云 分支**。优先级：
//   ① 原生壳真云桥(available) → SteamCloudStoragePort；
//   ② 开了假 Steam → SteamCloudStoragePort 包假云（真假同代码路径，无账号可验云存档）；
//   ③ 有 localStorage → LocalStorageStoragePort；④ 否则 MemoryStoragePort（headless/测试）。
// bridge / opts.mock 可注入（测试用）。
export function createStoragePort(
  bridge: SteamCloudBridge | undefined = (globalThis as { __APOLLO_STEAM_CLOUD__?: SteamCloudBridge }).__APOLLO_STEAM_CLOUD__,
  opts: { mock?: boolean } = {},
): StoragePort {
  if (bridge && bridge.available) return new SteamCloudStoragePort(bridge);
  const mock = opts.mock ?? isMockSteamEnabled();
  if (mock) return new SteamCloudStoragePort(createMockSteamCloudBridge());
  try {
    if (typeof localStorage !== 'undefined') return new LocalStorageStoragePort();
  } catch { /* fall through */ }
  return new MemoryStoragePort();
}
