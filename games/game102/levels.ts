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

// L1《小黄鸭》——照 owner 参考图（Level 2 rubber duck）手描复刻：蓝底 + 黄鸭身 + 橙喙 + 黑眼/嘴 + 白高光。
// 17×15 满格。palette 0=blue(底) 1=yellow(身) 2=orange(喙) 3=black(眼/嘴) 4=white(高光)。
// ⚠ 手描（参考图内联无文件·无法程序化取像素）；owner 若附图文件可用 pixelgen.quantizeToBitmap 精确提取覆写。
export const LEVEL_1: Level = {
  no: 1,
  name: '小黄鸭',
  cols: 17, rows: 15,
  palette: ['blue', 'yellow', 'orange', 'black', 'white'],
  ammo: 12,
  conveyorCap: 6, burstCap: 10, slots: 5,
  beltSpeed: 90,
  limit: { kind: 'moves', n: 99 },
  goals: [{ kind: 'clear' }],
  stars: [3000, 6000, 9000],
  seed: 20001,
  bitmap: [
    '00000000000000000',
    '00000111111000000',
    '00001111111100000',
    '00011111111110000',
    '00011113111110000',
    '00111111111122200',
    '00111111111442200',
    '01111331111110000',
    '01113111111111000',
    '01111111111111000',
    '01111111111111000',
    '00111111111110000',
    '00011111111100000',
    '00000111111000000',
    '00000000000000000',
  ],
  note: '小黄鸭（照参考图手描·蓝底黄身橙喙黑眼白高光）',
};

export const LEVELS: readonly Level[] = [LEVEL_1];
export const levelByNo = (no: number): Level => LEVELS.find((l) => l.no === no) ?? LEVEL_1;
