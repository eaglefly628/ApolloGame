// 关卡表（flow-spec §4.5）：敌阵=数据条目；扩阶段=加条目+一行 when_deploy_stage_N。
// 敌阵按**敌方阵营内序号 ei**（0..3）引用——选阵营翻转后同表对蜀/魏皆成立。
// 注：敌方强度暂只缩放 HP（攻击力烘在 strike 模板 amount 里）。
export const STAGES: { n: number; comp: { ei: number; q: number; r: number; hpMul: number }[] }[] = [
  // 阶段1 无 PvP 敌阵——全野怪化（黄巾散兵=PVE_WAVES[0]）。
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
    n: 3, // 阶段3「吕布陷阵」：5 子 + 2 星点缀（hpMul1.8≈2星）
    comp: [
      { ei: 0, q: 1, r: 3, hpMul: 1.8 },
      { ei: 0, q: 5, r: 3, hpMul: 1 },
      { ei: 1, q: 3, r: 3, hpMul: 1 },
      { ei: 2, q: 3, r: 1, hpMul: 1 },
      { ei: 3, q: 5, r: 1, hpMul: 1 },
    ],
  },
  {
    n: 4, // 阶段4「官渡精锐」：6 子、整体 1.4×
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

// 野怪波次（一图流：阶段1×4回合+每阶段末回合r5；固定阵容、死亡掉法球）。
// 图暂借甘宁（真野怪皮=美术 pass，见 art-data 待办）。
export const PVE_WAVES: { stage: number; count: number; hpMul: number; atk: number }[] = [
  { stage: 1, count: 3, hpMul: 0.35, atk: 6 },
  { stage: 2, count: 4, hpMul: 0.6, atk: 9 },
  { stage: 3, count: 4, hpMul: 0.9, atk: 13 },
  { stage: 4, count: 5, hpMul: 1.2, atk: 17 },
  { stage: 5, count: 6, hpMul: 1.6, atk: 22 },
];

export const MOB_BASE_HP = 90; // ×HP_SCALE×hpMul = 实际血量
