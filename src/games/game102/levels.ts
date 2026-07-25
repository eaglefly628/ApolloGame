// Game 102 · Pixel Pour —— 关卡数据（纯数据·一关一条）。
// schema 见 docs/design/game102/pe-handoff.md §1.1；一张像素图 = 一关（位图+调色板+特殊件坐标）。

export type LevelLimit = { kind: 'moves'; n: number } | { kind: 'time'; sec: number };
export type LevelGoal =
  | { kind: 'clear' }
  | { kind: 'keys'; n: number }
  | { kind: 'door'; needKeys: number; target: number };

export interface Level {
  no: number;                  // 关号（稳定主键）
  name: string;                // 图名
  cols: number; rows: number;  // 棋盘尺寸
  palette: string[];           // 本关颜色闭集（index 对齐 bitmap 数字·名对应 theme.PALETTE）
  ammo: number;                // 每炮弹药
  conveyorCap: number; burstCap: number; slots: number;
  beltSpeed: number;
  limit: LevelLimit;
  goals: LevelGoal[];
  stars: [number, number, number];
  seed: number;                // 确定性种子
  bitmap: string[];            // rows 行·每行 cols 字符（.=空 / 0..N=palette[index]·满格像素画）
  hp?: string[];               // 可选·同形字符层（.=1 / 2..3=硬块 hp）
  keys?: Array<[number, number]>; // 金钥匙坐标 [col,row]（须落在 bitmap 有像素处）
  door?: { col: number; row: number; w: number; h: number };
  pumpkins?: Array<[number, number]>; // 南瓜头锚点格 [col,row]（打碎掉落件·S4 接 gravity/hitbox）
  note?: string;
}

// L1《同心靶》——**粗粒 + 连块 + 层层包裹**像素画（owner 2026-07-25：每击可见·连成块·外→内剥）。
// 同心结构 = 绿(外框) → 黄(环) → 蓝(环) → 红(心)：直观演示「过位剥离·从外向里啃」。满格 12×12=144·零'.'。
// 每色格数：green 44 / yellow 36 / blue 28 / red 36（Σ=144）→ 递进队列按此守恒配炮（见 blueprint.deployQueue）。
export const LEVEL_1: Level = {
  no: 1,
  name: '同心靶',
  cols: 12, rows: 12,
  palette: ['green', 'yellow', 'blue', 'red'], // 0=green 1=yellow 2=blue 3=red
  ammo: 12,
  conveyorCap: 6, burstCap: 10, slots: 5,
  beltSpeed: 90,
  limit: { kind: 'moves', n: 99 },
  goals: [{ kind: 'clear' }],
  stars: [3000, 6000, 9000],
  seed: 20001,
  bitmap: [
    '000000000000',
    '011111111110',
    '012222222210',
    '012333333210',
    '012333333210',
    '012333333210',
    '012333333210',
    '012333333210',
    '012333333210',
    '012222222210',
    '011111111110',
    '000000000000',
  ],
  note: '同心靶（粗粒连块·外绿→黄→蓝→红心·演示外→内过位剥离）',
};

export const LEVELS: readonly Level[] = [LEVEL_1];
export const levelByNo = (no: number): Level => LEVELS.find((l) => l.no === no) ?? LEVEL_1;
