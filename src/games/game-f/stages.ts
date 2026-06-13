// Game F · 关卡表 + 野怪波次 + 敌人预布阵（从 blueprint.ts 拆出）。
import { TEAM_B } from './constants.js';
import { type Faction, rosterFor } from './heroes.js';
import { project, offsetToAxial } from './hex.js';

// ── 关卡表（flow-spec §4.5，前 2 阶段）：敌阵=数据条目、与我方槽位同构；扩阶段=加条目+一行 when_deploy_stage_N。──
// 注：敌方强度暂只缩放 HP（攻击力烘在 strike_<id> 模板 amount 里；按阶段缩攻=每阶段一套 strike 模板，真需要再加）。
// 敌阵按**敌方阵营内序号 ei** 引用（0..3），build 时解析成 enemyHeroes[ei]——这样选阵营翻转后，
// 同一关卡表对蜀/魏皆成立（ei0=前排武将…）。默认蜀：ei0=张辽,ei1=许褚,ei2=司马,ei3=甘宁（与旧 b_ 逐字等价）。
export const STAGES: { n: number; comp: { ei: number; q: number; r: number; hpMul: number }[] }[] = [
  // （阶段1 无 PvP 敌阵——按准则整段野怪化，黄巾散兵=PVE_WAVES[0]，见下；坐标=7×8 视觉 col 0..6 / row 0..3 敌半场）
  {
    n: 2, // 阶段2「董卓先锋」：4 子全强度
    comp: [
      { ei: 0, q: 2, r: 3, hpMul: 1 },
      { ei: 1, q: 4, r: 3, hpMul: 1 },
      { ei: 2, q: 3, r: 1, hpMul: 1 },
      { ei: 3, q: 5, r: 1, hpMul: 1 },
    ],
  },
  {
    n: 3, // 阶段3「吕布陷阵」：5 子 + 2 星点缀（hpMul1.8≈2星）——同模板多实例（F-9 per-instance）
    comp: [
      { ei: 0, q: 1, r: 3, hpMul: 1.8 },
      { ei: 0, q: 5, r: 3, hpMul: 1 },
      { ei: 1, q: 3, r: 3, hpMul: 1 },
      { ei: 2, q: 3, r: 1, hpMul: 1 },
      { ei: 3, q: 5, r: 1, hpMul: 1 },
    ],
  },
  {
    n: 4, // 阶段4「官渡精锐」：6 子、整体 1.4×（羁绊成型近似——羁绊机制 Phase 3）
    comp: [
      { ei: 0, q: 1, r: 3, hpMul: 1.4 },
      { ei: 0, q: 5, r: 3, hpMul: 1.4 },
      { ei: 1, q: 2, r: 3, hpMul: 1.4 },
      { ei: 1, q: 4, r: 3, hpMul: 1.4 },
      { ei: 2, q: 3, r: 1, hpMul: 1.4 },
      { ei: 3, q: 5, r: 1, hpMul: 1.4 },
    ],
  },
  {
    n: 5, // 阶段5「赤壁决战」：7 子 + Boss（ei1 hpMul3，终关）
    comp: [
      { ei: 1, q: 3, r: 2, hpMul: 3 },
      { ei: 0, q: 1, r: 3, hpMul: 1.8 },
      { ei: 0, q: 5, r: 3, hpMul: 1.8 },
      { ei: 1, q: 2, r: 3, hpMul: 1.4 },
      { ei: 2, q: 2, r: 1, hpMul: 1.8 },
      { ei: 2, q: 4, r: 1, hpMul: 1.4 },
      { ei: 3, q: 5, r: 0, hpMul: 1.8 },
    ],
  },
];

// 敌人预布阵（功能 B，用户：排兵布阵时看敌人下一波）：返回当前回合英雄关敌阵的世界坐标 + 将名，
// 供 DOM 幽灵层投影画半透明敌兵。PVE 回合（阶段1 或 r≥5 野怪波）无英雄坐标→返回空（不预览）。
export function gameFEnemyPreview(stageIdx: number, roundIdx: number, pf: Faction = 'shu'): { name: string; x: number; y: number }[] {
  if (stageIdx <= 1 || roundIdx >= 5) return [];
  const stage = STAGES.find((s) => s.n === stageIdx);
  if (!stage) return [];
  const enemyHeroes = rosterFor(pf).filter((h) => h.team === TEAM_B);
  return stage.comp.map((c) => {
    const eh = enemyHeroes[c.ei];
    const a = offsetToAxial(c.q, c.r);
    const p = project(a.q, a.r);
    return { name: eh?.name ?? '魏', x: p.x, y: p.y };
  });
}

// ── 野怪波次（一图流：阶段1×4回合+每阶段末回合(r5)；固定阵容、死亡掉法球💰）──
// 强度随阶段爬坡；图暂借甘宁（真野怪皮=美术 pass，见 art-data 待办）。掉落链：Mortal.dropTemplate（引擎现成）。
export const PVE_WAVES: { stage: number; count: number; hpMul: number; atk: number }[] = [
  { stage: 1, count: 3, hpMul: 0.35, atk: 6 },
  { stage: 2, count: 4, hpMul: 0.6, atk: 9 },
  { stage: 3, count: 4, hpMul: 0.9, atk: 13 },
  { stage: 4, count: 5, hpMul: 1.2, atk: 17 },
  { stage: 5, count: 6, hpMul: 1.6, atk: 22 },
];
export const MOB_BASE_HP = 90; // ×HP_SCALE×hpMul = 实际血量
