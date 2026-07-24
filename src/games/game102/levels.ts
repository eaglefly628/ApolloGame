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
  bitmap: string[];            // rows 行·每行 cols 字符（.=空 / 0..N=palette[index]）
  hp?: string[];               // 可选·同形字符层（.=1 / 2..3=硬块 hp）
  keys?: Array<[number, number]>; // 金钥匙坐标 [col,row]（须落在 bitmap 有像素处）
  door?: { col: number; row: number; w: number; h: number };
  note?: string;
}

// L1 教学关（S3 骨架用最小可玩规模·鲸鱼雏形）。
export const LEVEL_1: Level = {
  no: 1,
  name: '鲸',
  cols: 8, rows: 6,
  palette: ['green', 'orange', 'red'],
  ammo: 20,
  conveyorCap: 5, burstCap: 10, slots: 5,
  beltSpeed: 90,
  limit: { kind: 'moves', n: 40 },
  goals: [
    { kind: 'clear' },
    { kind: 'keys', n: 2 },
    { kind: 'door', needKeys: 2, target: 100 },
  ],
  stars: [3000, 6000, 9000],
  seed: 20001,
  bitmap: [
    '........',
    '..000...',
    '.011110.',
    '.012210.',
    '.011110.',
    '........',
  ],
  hp: [
    '........',
    '..111...',
    '.111110.',
    '.122210.',
    '.111110.',
    '........',
  ],
  keys: [[2, 2], [5, 4]],
  door: { col: 3, row: 3, w: 2, h: 1 },
  note: '教学：单色打通到钥匙',
};

export const LEVELS: readonly Level[] = [LEVEL_1];
export const levelByNo = (no: number): Level => LEVELS.find((l) => l.no === no) ?? LEVEL_1;
