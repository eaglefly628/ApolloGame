// Game G · 地煞数值人话化纯函数（收藏图谱/天梯/地煞图鉴旧手写 DOM 渲染已退役·拆分自 lobby-screen.ts）。
// 现役收藏/图鉴走数据驱动（collection-screen.ts）。本文件只保留被现役代码复用的 dishaNumberLine。
import { DISHA_SPECS } from './disha.js';

// 地煞「真正数值」（读甲 DISHA_SPECS·关1-5 精确数值）→ 人话一行，让玩家一目了然。
export function dishaNumberLine(dishaId: string): string {
  const s = DISHA_SPECS[dishaId]; if (!s) return '';
  const p: string[] = [];
  if (s.homeHp) p.push(`大本营 ${s.homeHp} 血`);
  if (s.allWinPct) p.push(`全军 +${s.allWinPct}% 胜率`);
  if (s.generalWinPct) p.push(`主将 +${s.generalWinPct}%`);
  if (s.phalanxPerAdj) p.push(`每相邻友兵 +${s.phalanxPerAdj}%${s.phalanxCap ? ` · 封顶 +${s.phalanxCap}%` : ''}`);
  if (s.nearBaseSlots) p.push(`大本营前 ${s.nearBaseSlots} 格 ${[s.nearBasePower ? `守军战力 +${s.nearBasePower}` : '', s.nearBaseWinPct ? `+${s.nearBaseWinPct}% 胜率` : ''].filter(Boolean).join('·') || '固守'}`);
  if (s.eliteMidWinPct) p.push(`中路前锋 +${s.eliteMidWinPct}%`);
  if (s.flankYouWinPct) p.push(`你被左右夹 −${s.flankYouWinPct}%`);
  if (s.firstStrike) p.push(`先手出击${s.firstStrikeWinPct ? ` +${s.firstStrikeWinPct}%` : ''}`);
  if (s.winStreakPer) p.push(`每连胜 +${s.winStreakPer}%${s.winStreakCap ? ` · 封顶 +${s.winStreakCap}%` : ''}`);
  if (s.lastStandGeneral) p.push('主将 2 命（首负不亡·退一格）');
  if (s.noRout) p.push('主将亡不溃散');
  if (s.bonusMana) p.push(`每回合多 +${s.bonusMana} 召唤源泉`);
  if (s.batteryEveryTurns) p.push(`每 ${s.batteryEveryTurns} 回合压一路 −${s.batteryWinPct}%`);
  return p.join(' · ');
}
