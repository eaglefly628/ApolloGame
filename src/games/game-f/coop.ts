// Game F · 多人 B·slice1 —— 本地三人「共享岛」协作核（designer #23；game-side、零引擎、与 ECS 解耦）。
// 方案乙：三人各跑自己的盘（mirror，不重演），但贡献度凿同一座岛 → island 累加三方贡献；满即全局陷落。
// 结算读 per-owner 贡献排序 → 岛主（最高贡献）。真·远程传输（WS/WebRTC, REQ-018）押后主程；此处只做本地框架。
// ⛔ 纯表现/账号侧聚合：读各 owner 引擎的 contribution 资源求和，不进任何 world 的 sim/hash。

export interface OwnerContribution {
  name: string;     // 显示名（玄德 / 仲谋 / 孟德…）
  faction: string;  // 蜀 / 吴 / 魏
  human: boolean;   // 真人 or AI 补位
  contribution: number;
}

export interface CoopIsland {
  progress: number;          // 三方贡献之和
  goal: number;              // 陷落阈值（默认 3 owner × 100）
  fallen: boolean;           // 达标 = 全局岛陷落、本局结束
  ranking: OwnerContribution[]; // 按贡献降序（同分按原序稳定）
  owner: string | null;      // 岛主 = 贡献最高者
}

export const COOP_GOAL_PER_OWNER = 100;

// 纯函数：三方贡献 → 共享岛进度 + 排名 + 岛主。确定（稳定排序：贡献降序，等值保入参序）。
export function computeCoopIsland(owners: OwnerContribution[], goalPerOwner = COOP_GOAL_PER_OWNER): CoopIsland {
  const progress = owners.reduce((s, o) => s + Math.max(0, o.contribution), 0);
  const goal = Math.max(1, owners.length) * goalPerOwner;
  const ranking = owners
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (b.o.contribution - a.o.contribution) || (a.i - b.i))
    .map((x) => x.o);
  return { progress, goal, fallen: progress >= goal, ranking, owner: ranking[0]?.name ?? null };
}
