// Game F · 太阁守军 Roster（T1，game-f-taikou-roster.md「关卡生产线」）—— 纯数据。
// 守岛方=太阁立志传战国群雄的 PvE 阵容库。每个守军=一组组件（名/皮/攻击型），映射现成战斗能力。
// v1 先用「滩头杂兵」起步（roster §一，全 ✅复用）；国人众部将 / 天守 Boss 待 roster 补全再接。
import { F_TAIKOU } from './assets.js';

export interface TaikouUnit {
  code: string;
  name: string;
  sprite: string;
  atkType: 'melee' | 'ranged'; // 近战贴脸 / 远程射程外输出（GridMover.range + 追踪弹）
}

// 滩头杂兵（roster §一，token 级，纯 ✅复用）。
export const TAIKOU_BEACHHEAD: Record<string, TaikouUnit> = {
  yari: { code: 'ash_yari', name: '枪足轻', sprite: F_TAIKOU.yari, atkType: 'melee' }, // 贴脸普攻
  yumi: { code: 'ash_yumi', name: '弓足轻', sprite: F_TAIKOU.yumi, atkType: 'ranged' }, // 射程外输出
  teppo: { code: 'ash_teppo', name: '铁炮足轻', sprite: F_TAIKOU.teppo, atkType: 'ranged' }, // 慢攻速高伤（数值在波次 atk）
  kunoichi: { code: 'kunoichi', name: '杂兵忍', sprite: F_TAIKOU.kunoichi, atkType: 'melee' }, // 骚扰近战
};

// 关卡 → 守军单位（v1 滩头爬坡；难度数值沿用 stages.ts 的 PVE_WAVES，本表只定"是谁/什么兵种"）。
// index = stage-1（PVE_WAVES 按 stage 1..5）。滩头(1) 枪 → 弓 → 铁炮 → 忍 → 枪(强)。
export const STAGE_UNIT: TaikouUnit[] = [
  TAIKOU_BEACHHEAD.yari,
  TAIKOU_BEACHHEAD.yumi,
  TAIKOU_BEACHHEAD.teppo,
  TAIKOU_BEACHHEAD.kunoichi,
  TAIKOU_BEACHHEAD.yari,
];

// 取某 stage 的守军单位（越界兜底 = 枪足轻）。
export const unitForStage = (stage: number): TaikouUnit => STAGE_UNIT[stage - 1] ?? TAIKOU_BEACHHEAD.yari;
