import type { PlatformPort } from './platform-port.js';
import { NullPlatformPort } from './null-platform.js';
import { SteamworksPlatformPort, type SteamBridge } from './steamworks-platform.js';

// createPlatformPort —— 平台端口工厂。游戏/壳层调一次拿到对的实现，**不写 if Steam 分支**：
//   原生壳里 preload 注入了可用的 __APOLLO_STEAM__ 桥 → SteamworksPlatformPort；
//   web / dev / headless / 测试（无桥或桥不可用）→ NullPlatformPort 静默降级。
// bridge 参数可注入（测试用假桥）；默认读 globalThis.__APOLLO_STEAM__。
export function createPlatformPort(
  bridge: SteamBridge | undefined = (globalThis as { __APOLLO_STEAM__?: SteamBridge }).__APOLLO_STEAM__,
): PlatformPort {
  if (bridge && bridge.available) return new SteamworksPlatformPort(bridge);
  return new NullPlatformPort();
}
