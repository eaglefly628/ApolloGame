// Game T ·《墨消》—— 关卡表（纯数据）+ schema 纯函数（字符画解析 / 目标推导 / 星级结算 / 校验）。
// 单关形状严格对齐 docs/design/game-t/level-schema.md §一（layout=字符画·GD 手写友好）。
//
// 关卡数据单一真相 = docs/design/game-t/levels.jsonc（GD-T run2 交付·gen 生成·balance-sim 200 seeds
// 定标·**平铺 60/珠口径已对齐 theme.ts**）；./levels.data.json 是它的运行时纯 JSON 副本（jsonc 注释
// 无法直 import）——守卫测试断言两者逐行等价 + 全表过 levelIssues + 关名/章文案 ≡ copy.md（GD 重跑
// gen 后忘同步即红）。REQ-M3-计分倍率 落地后 GD 改 CASCADE_MULT 重定标，PE 只需同步副本。
import levelsData from './levels.data.json';
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

// ── 关名（docs/design/game-t/copy.md §三·UI 直用·守卫测试与文案表比对防漂移）────
export const LEVEL_NAMES: Record<number, string> = {
  1: '初入山门', 2: '扎马运气', 3: '双风贯耳', 4: '力劈华山', 5: '连环冲拳', 6: '虎啸试炼',
  7: '白鹤亮翅', 8: '芥子纳墨', 9: '拾遗撷珠', 10: '百川汇墨', 11: '紫毫入砚', 12: '鹤舞九霄',
  13: '蛇行洗墨', 14: '曲水流觞', 15: '墨渍侵纸', 16: '双层寒墨', 17: '浣墨回廊', 18: '灵蛇试炼',
  19: '金豹碎瓷', 20: '裂帛之音', 21: '层瓷叠嶂', 22: '坚冰三尺', 23: '玄铁寒瓷', 24: '豹隐试炼',
  25: '龙吟初动', 26: '破瓷聚力', 27: '洗墨凝碧', 28: '碎冰拾金', 29: '双珠合璧', 30: '飞龙在天',
};

// ── 五章过场（copy.md §二·GDD §二点五 轻叙事·Modal/Panel 纯数据·师父立绘=S6 台账件）──
export interface ChapterSpec {
  no: number;
  name: string; // 「一·虎」
  master: string; // 师父名
  theme: string; // 机制主题
  intro: string; // 过场文案（2-3 句）
  firstLevel: number; // 本章首关（进关且未过时弹过场）
}
export const CHAPTERS: ChapterSpec[] = [
  { no: 1, name: '一·虎', master: '伏虎师父', theme: '基础(得分)', firstLevel: 1, intro: '「站桩先扎马，运墨如运力。」伏虎师父一掌拍碎案上顽石，「墨要连、力要整——去，把这三子连成一线。」' },
  { no: 2, name: '二·鹤', master: '白鹤师父', theme: '收集', firstLevel: 7, intro: '白鹤师父单足立于崖石，衣袂不动。「取墨如衔珠，贵在准与巧。四子成轴、拐角成印——手要轻，眼要尖。」' },
  { no: 3, name: '三·蛇', master: '灵蛇师父', theme: '洗墨(果冻)', firstLevel: 13, intro: '「纸上宿墨未干，便是心上尘垢。」灵蛇师父指尖一点，墨渍层层化开，「以柔克滞，逐层洗净，方见白纸。」' },
  { no: 4, name: '四·豹', master: '金豹师父', theme: '破瓷(障碍)', firstLevel: 19, intro: '金豹师父盯着那面冰纹瓷，声如裂帛：「硬碰硬是莽夫。绕其锋、震其邻，一片片碎给我看。」' },
  { no: 5, name: '五·龙', master: '游龙师父', theme: '混合·出师', firstLevel: 25, intro: '山巅风起。游龙师父负手而立：「洗墨、破瓷、取珠——五形归一，方能成龙。此为出师试炼，去吧。」' },
];
/** 某关是否章首（是则返回该章·配合「未过关才弹」由宿主用进度判）。 */
export function chapterStartingAt(levelNo: number): ChapterSpec | null {
  return CHAPTERS.find((c) => c.firstLevel === levelNo) ?? null;
}

// ── 正式 30 关（GD-T run2 交付·五章×6·balance-sim 200 seeds 定标·29/30 带内）────
export const LEVELS: LevelSpec[] = (levelsData as Array<Omit<LevelSpec, 'name' | 'stars'> & { stars: number[] }>).map(
  (r) => ({
    ...r,
    stars: [r.stars[0], r.stars[1], r.stars[2]] as [number, number, number],
    name: LEVEL_NAMES[r.no] ?? `第${r.no}关`,
  }),
);

