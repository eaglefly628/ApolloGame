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

// L1《南瓜园》——**满格像素画**（每格一 power 色·owner 2026-07-24 内容模型）。
// 由 src/games/game102/pixelgen.ts 的 genGarden(22,22,20001) 生成→check-in 为数据（authoring 产物·game-t levels.gen 范式）。
// 重生成：改 seed/size 重跑生成器覆写本条；Path A（真画量化）见 docs/design/game102/pixel-gen.md。
export const LEVEL_1: Level = {
  no: 1,
  name: '南瓜园',
  cols: 22, rows: 22,
  palette: ['green', 'black', 'red', 'orange', 'yellow', 'white'],
  ammo: 20,
  conveyorCap: 5, burstCap: 10, slots: 5,
  beltSpeed: 90,
  limit: { kind: 'moves', n: 40 },
  goals: [
    { kind: 'clear' },
    { kind: 'keys', n: 3 },
    { kind: 'door', needKeys: 3, target: 100 },
  ],
  stars: [3000, 6000, 9000],
  seed: 20001,
  bitmap: [
    '0100000000000010000000',
    '0000000000000010000000',
    '0000000000000000001000',
    '0000000000001113110000',
    '0000113110011433331000',
    '0001433331101433331000',
    '0021433331013313133200',
    '0242334333101333322420',
    '0021333331001333242200',
    '0001333331101113124301',
    '0001112110001001013100',
    '0000024201131100100000',
    '0010002014333310000000',
    '0011000114333311000000',
    '0101000133131331110000',
    '0000000013333210011001',
    '0000000013332420010010',
    '0000010011131200000000',
    '0010011010010001000000',
    '1001000000100001000000',
    '0010000100000000000000',
    '0001000000000000100000',
  ],
  keys: [[8, 9], [17, 8], [13, 16]],
  door: { col: 10, row: 20, w: 2, h: 2 },
  pumpkins: [[6, 7], [15, 6], [11, 14]],
  note: '满格像素南瓜园（pixelgen.genGarden 生成·南瓜头/钥匙/门）',
};

export const LEVELS: readonly Level[] = [LEVEL_1];
export const levelByNo = (no: number): Level => LEVELS.find((l) => l.no === no) ?? LEVEL_1;
