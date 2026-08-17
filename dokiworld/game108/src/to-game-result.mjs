// game108 → DokiWorld GameResult 的**纯投影函数**（零规则·只读世界机读态）。
//
// 读的落点与验收剧本同口径（games/game108/acceptance-adapter.ts readWorld 同一套地址）：
//   · 终局：`flow` 实体的 GameFlow.current —— blueprint.ts duelFlow 的终态 'p1win' / 'p2win'
//     （settle 态的 hpDown 转移落进来的，胜负唯一机读落点【R-108-15】）
//   · 血量：side 实体 'p1' / 'p2' 各自的 Resource（id 'hp'·两侧同 id 按实体寻址，
//     max 从组件自身读——不在此复制 HP_MAX 常量，世界是唯一真相）
//   · 回合：'round' 实体的 Resource.current（每次结算 +1）
//
// normalizedScore 判据（0..100 整数·注释即规范）：
//   score = clamp(round(50 + 50 × (p1.hp − p2.hp) / hpMax), 0, 100)
//   即「血量差的线性投影」：50 = 均势；胜局 p2.hp=0 ⇒ score = 50 + p1.hp/2 ∈ [50..100]
//   （残血险胜≈50、满血完胜=100）；负局对称落在 [0..50]；中途退出用当时血差，同一把尺。
//   罕见边界：双方同拍归零时 settle 先查 p2 倒下 ⇒ p1win + score 50（数据序即规则序）。
//
// outcome：'p1win' → 'win'；'p2win' → 'loss'；未终局 → 'exited'（onPrepareExit 中途退出用）。

/**
 * @param {{ getComponent(id: string, type: string): unknown }} world 世界只读投影
 * @returns {{ terminal: boolean, normalizedScore: number, outcome: 'win'|'loss'|'exited',
 *             metrics: { round: number, playerHp: number, opponentHp: number } }}
 */
export function toGameResult(world) {
  const flow = /** @type {{ current?: string } | undefined} */ (world.getComponent("flow", "GameFlow"));
  const current = flow?.current ?? "charge";
  const hp = (side) => /** @type {{ current?: number, max?: number } | undefined} */ (world.getComponent(side, "Resource"));
  const p1 = hp("p1");
  const p2 = hp("p2");
  const playerHp = p1?.current ?? 0;
  const opponentHp = p2?.current ?? 0;
  const hpMax = Math.max(p1?.max ?? 0, p2?.max ?? 0, 1);
  const round = /** @type {{ current?: number } | undefined} */ (world.getComponent("round", "Resource"))?.current ?? 1;

  // 【episode 路由的输入】metrics 加厚（owner 2026-08-17 判做第 5 条·剧情要按结果分支，
  // 就得有东西可分支）。**全部从世界现读，不新造规则、不在这里算第二套**：
  //   style = 赌性指针（0..20·低=常诈唬「蓄一手出另一手」·高=蓄什么出什么）
  //   read  = 她对你的读准度（0..10·她赢一次 +1、被你读穿 −1）
  //   perfect = 一滴血没掉（`EpisodeGameResultCondition.metrics` 支持按这些逐项匹配）
  // 读不到（旧存档 / 世界还没起）一律给 -1 / false，**不猜**——剧情侧据此知道"这局没有这项数据"。
  const numOf = (eid) => /** @type {{ current?: number } | undefined} */ (world.getComponent(eid, "Resource"))?.current;
  const style = numOf("style:p1");
  const read = numOf("read:p2");

  const terminal = current === "p1win" || current === "p2win";
  const outcome = current === "p1win" ? "win" : current === "p2win" ? "loss" : "exited";
  const normalizedScore = Math.min(100, Math.max(0, Math.round(50 + (50 * (playerHp - opponentHp)) / hpMax)));
  return {
    terminal, normalizedScore, outcome,
    metrics: {
      round, playerHp, opponentHp,
      style: typeof style === "number" ? style : -1,
      read: typeof read === "number" ? read : -1,
      perfect: playerHp > 0 && playerHp === hpMax,
    },
  };
}
