// game211 平台触点（Steam / 假 Steam · sim 外）。把战役结果接到平台端口：胜利解成就、传战役进度
// 排行榜、更新富状态；并把本游戏自有 localStorage 存档 blob 镜像上云（game211 用自家 Save 而非
// 引擎 SaveSystem 快照，故走云桥直写文件）。全部经工厂选实现：原生壳真 Steam / 开关下假 Steam /
// 否则 Null 静默 —— 游戏零分支、不可用绝不影响玩法。
import { createPlatformPort, type PlatformPort } from '@zerocraft/engine/services/platform/index.js';
import { resolveCloudBridge } from '@zerocraft/engine/services/storage/index.js';

let _port: PlatformPort | null = null;
export function ggPlatform(): PlatformPort { return (_port ??= createPlatformPort()); }
/** 测试注入用。 */
export function __setGgPlatform(p: PlatformPort | null): void { _port = p; }

const CLOUD_FILE = 'game211-save-v1.json';

/** 一场战役结算后调用（仅胜利时触发成就/排行）。flawless = 本场大本营满血未破。 */
export function ggOnBattleWon(opts: { campaignMax: number; flawless: boolean }, p: PlatformPort = ggPlatform()): void {
  if (!p.isAvailable()) return;
  p.unlockAchievement('GG_FIRST_WIN');
  if (opts.flawless) p.unlockAchievement('GG_FLAWLESS');
  p.setStat('campaign_max', opts.campaignMax);
  p.uploadLeaderboard('campaign_progress', opts.campaignMax);   // P3 排行榜：战役进度
  p.setRichPresence('status', `战役 第 ${opts.campaignMax} 关`); // P3 富状态
  p.store();
}

/** 把存档 blob 镜像到（真/假）Steam 云 —— best-effort、fire-and-forget，失败不影响本地存档。 */
export function ggCloudSave(raw: string): void {
  const cloud = resolveCloudBridge();
  if (cloud) void cloud.writeFile(CLOUD_FILE, raw).catch(() => {});
}

/** 从云读回存档 blob（无云/无档 → null）。供「云端恢复」显式动作用。 */
export async function ggCloudLoad(): Promise<string | null> {
  const cloud = resolveCloudBridge();
  if (!cloud) return null;
  try { return await cloud.readFile(CLOUD_FILE); } catch { return null; }
}
