// Game T ·《墨消》—— 关卡表（纯数据）+ schema 纯函数（字符画解析 / 目标推导 / 星级结算 / 校验）。
// 单关形状严格对齐 docs/design/game-t/level-schema.md §一（layout=字符画·GD 手写友好）。
//
// ⚠ 当前 LEVELS 的 5 关为 PE 装配占位（覆盖关型闭集 score/collect/jelly/blocker/mixed·跑通骨架与走查）：
//   GD-T 的 30 关正式表（levels + balance-sim 定标·通关率带见 GDD §四）交付后整表替换——
//   moves/stars 数值不许拍脑袋（schema §二），占位数值不代表难度定标。
import { BRUSH_PER_MOVE, INK_NAMES } from './theme.js';

export type GoalKind = 'score' | 'collect' | 'jelly' | 'blocker';
export interface LevelGoal {
  kind: GoalKind;
  n?: number; // score/collect 的目标量
  color?: number; // collect 的目标色 0..kinds-1
}
export interface LevelSpec {
  no: number; // 关号（稳定主键·保号）
  name: string; // 关名（水墨意象·GD 文案表交付前为占位）
  type: 'score' | 'collect' | 'jelly' | 'blocker' | 'mixed';
  cols: number;
  rows: number;
  kinds: number; // 色数 4..6
  moves: number;
  goals: LevelGoal[];
  stars: [number, number, number]; // 1/2/3 星分数阈（判在含收笔的总分上）
  seed: number; // 本关确定性种子（补块）
  layout: { board: string[]; jelly?: string[]; blockers?: string[] };
  note?: string;
}

// ── 字符画 → 数组（schema §一「装配映射·纯转换零逻辑」）────────────────────────
//   board：'.'=随机补(-1=EMPTY·开局 refill 相位确定性补齐) · '0'..'5'=指定色摆盘
//   jelly：'.'=无 · '1'/'2'=墨渍层数
//   blockers：'.'=无 · '1'..'3'=冰纹瓷 hp · 'S'=砚石(-1·不可动)
export interface ParsedLayout {
  cells: number[];
  jelly?: number[];
  blockers?: number[];
}
export function parseLayout(spec: LevelSpec): ParsedLayout {
  const flat = (rows: string[], map: (ch: string) => number): number[] => {
    const out: number[] = [];
    for (const row of rows) for (const ch of row) out.push(map(ch));
    return out;
  };
  const cells = flat(spec.layout.board, (ch) => (ch === '.' ? -1 : ch.charCodeAt(0) - 48));
  const jelly = spec.layout.jelly ? flat(spec.layout.jelly, (ch) => (ch === '.' ? 0 : ch.charCodeAt(0) - 48)) : undefined;
  const blockers = spec.layout.blockers
    ? flat(spec.layout.blockers, (ch) => (ch === '.' ? 0 : ch === 'S' ? -1 : ch.charCodeAt(0) - 48))
    : undefined;
  return {
    cells,
    ...(jelly && jelly.some((v) => v > 0) ? { jelly } : {}),
    ...(blockers && blockers.some((v) => v !== 0) ? { blockers } : {}),
  };
}

// ── 目标 → 资源阈值（goals 闭集 → 现成 Resource/Condition 语汇·胜负链与 HUD 共用同一推导）──
export interface GoalReq {
  rid: string; // Resource id
  need: number;
  label: string; // HUD 短标
}
export function goalRequirements(spec: LevelSpec): GoalReq[] {
  const L = parseLayout(spec);
  const sum = (a: number[] | undefined, f: (v: number) => number): number => (a ?? []).reduce((s, v) => s + f(v), 0);
  return spec.goals.map((g): GoalReq => {
    switch (g.kind) {
      case 'score':
        return { rid: 'score', need: g.n ?? 0, label: '得分' };
      case 'collect':
        return { rid: `ink${g.color ?? 0}`, need: g.n ?? 0, label: `集·${INK_NAMES[g.color ?? 0] ?? '?'}` };
      case 'jelly': // 洗净全部墨渍：需求量=摆盘总层数（jellyResource 每洗一层 +1）
        return { rid: 'washed', need: sum(L.jelly, (v) => (v > 0 ? v : 0)), label: '洗墨' };
      case 'blocker': // 破尽冰纹瓷：需求量=摆盘总 hp（砚石 -1 不计入）
        return { rid: 'cracked', need: sum(L.blockers, (v) => (v > 0 ? v : 0)), label: '破瓷' };
    }
  });
}

// ── 结算纯函数（sim 外·GD balance-sim 与 HUD 共口径）──────────────────────────
/** 收笔总分 = 局内消除分 + 剩步 × 1000（GDD §四 V1）。 */
export function finalScore(score: number, movesLeft: number): number {
  return score + Math.max(0, movesLeft) * BRUSH_PER_MOVE;
}
/** 星级：胜利前提下按总分过阈计数；GDD §四「1 星=达成目标过关」→ 保底 1 星。 */
export function starsFor(total: number, spec: LevelSpec): number {
  const n = spec.stars.filter((t) => total >= t).length;
  return Math.max(1, Math.min(3, n));
}

// ── 选关进度推导（host 存档 → LevelPath 节点状态·纯函数可测）───────────────────
export interface LevelNodeState {
  no: number;
  name: string;
  stars: number; // 0=未过
  state: 'done' | 'current' | 'locked';
}
export function progressStates(levels: LevelSpec[], starsByNo: Record<number, number>): LevelNodeState[] {
  let currentPicked = false;
  return levels.map((lv) => {
    const stars = starsByNo[lv.no] ?? 0;
    if (stars > 0) return { no: lv.no, name: lv.name, stars, state: 'done' as const };
    if (!currentPicked) {
      currentPicked = true;
      return { no: lv.no, name: lv.name, stars: 0, state: 'current' as const };
    }
    return { no: lv.no, name: lv.name, stars: 0, state: 'locked' as const };
  });
}

// ── schema 校验（authoring 门·GD 换表后本函数即机器检查·测试断言 LEVELS 全过）────
export function levelIssues(spec: LevelSpec): string[] {
  const issues: string[] = [];
  const push = (m: string): void => {
    issues.push(`关 ${spec.no}: ${m}`);
  };
  if (!Number.isInteger(spec.no) || spec.no < 1) push('no 须为 ≥1 整数');
  if (spec.cols < 6 || spec.cols > 8) push(`cols=${spec.cols} 出建议界 [6,8]（schema §一）`);
  if (spec.rows < 8 || spec.rows > 10) push(`rows=${spec.rows} 出建议界 [8,10]`);
  if (spec.kinds < 4 || spec.kinds > 6) push(`kinds=${spec.kinds} 出界 [4,6]`);
  if (spec.moves <= 0) push('moves 须 >0');
  if (!spec.goals.length) push('goals 不得为空');
  if (!(spec.stars[0] < spec.stars[1] && spec.stars[1] < spec.stars[2])) push('stars 须严格递增');
  const checkGrid = (name: string, rows: string[] | undefined, chars: RegExp): void => {
    if (!rows) return;
    if (rows.length !== spec.rows) push(`${name} 行数 ${rows.length} ≠ rows ${spec.rows}`);
    rows.forEach((row, r) => {
      if (row.length !== spec.cols) push(`${name} 第 ${r} 行长 ${row.length} ≠ cols ${spec.cols}`);
      if (!chars.test(row)) push(`${name} 第 ${r} 行含非法字符`);
    });
  };
  checkGrid('board', spec.layout.board, /^[.0-5]*$/);
  checkGrid('jelly', spec.layout.jelly, /^[.12]*$/);
  checkGrid('blockers', spec.layout.blockers, /^[.1-3S]*$/);
  for (const row of spec.layout.board) {
    for (const ch of row) {
      if (ch !== '.' && ch.charCodeAt(0) - 48 >= spec.kinds) push(`board 摆盘色 ${ch} ≥ kinds ${spec.kinds}`);
    }
  }
  const L = parseLayout(spec);
  for (const g of spec.goals) {
    if (g.kind === 'collect' && ((g.color ?? -1) < 0 || (g.color ?? 0) >= spec.kinds)) push('collect 目标色出界');
    if ((g.kind === 'score' || g.kind === 'collect') && !(g.n && g.n > 0)) push(`${g.kind} 目标量须 >0`);
    if (g.kind === 'jelly' && !L.jelly) push('jelly 目标但摆盘无墨渍');
    if (g.kind === 'blocker' && !(L.blockers ?? []).some((v) => v > 0)) push('blocker 目标但摆盘无冰纹瓷');
  }
  return issues;
}

const DOTS = (rows: number, cols: number): string[] => Array.from({ length: rows }, () => '.'.repeat(cols));

// ── 占位关卡表（5 关·关型闭集各一·待 GD 30 关正式表整表替换）───────────────────
export const LEVELS: LevelSpec[] = [
  {
    no: 1,
    name: '初磨', // 占位关名·GD 文案表交付后替换
    type: 'score',
    cols: 7,
    rows: 9,
    kinds: 4,
    moves: 20,
    goals: [{ kind: 'score', n: 3600 }],
    stars: [3600, 12000, 22000],
    seed: 10001,
    layout: { board: DOTS(9, 7) },
    note: 'PE 占位·纯分数教学（GDD §三 1-5 段）',
  },
  {
    no: 2,
    name: '拾砂',
    type: 'collect',
    cols: 7,
    rows: 9,
    kinds: 5,
    moves: 22,
    goals: [{ kind: 'collect', color: 1, n: 24 }],
    stars: [4000, 14000, 24000],
    seed: 10002,
    layout: { board: DOTS(9, 7) },
    note: 'PE 占位·收集+第五色（GDD §三 6-10 段）',
  },
  {
    no: 3,
    name: '浸润',
    type: 'jelly',
    cols: 7,
    rows: 9,
    kinds: 4,
    moves: 24,
    goals: [{ kind: 'jelly' }],
    stars: [5000, 15000, 26000],
    seed: 10003,
    layout: {
      board: DOTS(9, 7),
      jelly: ['.......', '.......', '.......', '..111..', '..121..', '..111..', '.......', '.......', '.......'],
    },
    note: 'PE 占位·洗墨（墨渍=果冻·GDD §三 11-15 段）',
  },
  {
    no: 4,
    name: '冰纹',
    type: 'blocker',
    cols: 7,
    rows: 9,
    kinds: 5,
    moves: 26,
    goals: [{ kind: 'blocker' }],
    stars: [5000, 16000, 28000],
    seed: 10004,
    layout: {
      board: DOTS(9, 7),
      blockers: ['.......', '.......', '..1.1..', '.2...2.', '.......', '.2...2.', '..1.1..', 'S.....S', '.......'],
    },
    note: 'PE 占位·破瓷+砚石地形（GDD §三 16-25 段）',
  },
  {
    no: 5,
    name: '五形小试',
    type: 'mixed',
    cols: 7,
    rows: 9,
    kinds: 5,
    moves: 28,
    goals: [{ kind: 'jelly' }, { kind: 'collect', color: 0, n: 18 }],
    stars: [6000, 18000, 30000],
    seed: 10005,
    layout: {
      board: DOTS(9, 7),
      jelly: ['.......', '.......', '.......', '...11..', '...11..', '.......', '.......', '.......', '.......'],
    },
    note: 'PE 占位·混合双目标（GDD §三 26-30 段风格）',
  },
];
