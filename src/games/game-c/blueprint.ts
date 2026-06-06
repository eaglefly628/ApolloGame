import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, flagCapability, stateCapability, textCapability } from '@atom-skills/index.js';
import { clickableCapability, craftRecipeCapability } from '@skills/tier2/index.js';
import { match3BoardCapability } from '@skills/tier3/index.js';
import {
  MATERIALS,
  GARMENTS,
  ACCESSORIES,
  COIN_ID,
  COIN_PER_TILE,
  BASE_LOOK,
  LOOK_FSM,
  SHOP_LEVEL_ID,
  SHOP_LEVEL_MAX,
  SHOP_LEVEL_ENTITY,
  garmentFlagId,
  garmentSignal,
  accessoryFlagId,
  type Garment,
} from './theme.js';

// ═══════════════════════════════════════════════════════════════
//  Game C ·《缝纫物语》v0.3 蓝图 —— 可玩三消棋盘 + 主动缝制养成（纯 DATA）
//
//  ⛔ 第一性原则：游戏是数据。本文件**只装配现成引擎能力**，不写任何 system。
//  v0.3 装配（四条需求落地后全是现成能力）：
//    · 三消棋盘 = match3-board(REQ-C-001)：MatchBoard 单例 + RandomSeed；点格交换/找连/消除产料。
//    · 点击选格/缝制 = clickable(REQ-C-002)：视图格 Clickable{action:'cell'}、缝制按钮 Clickable{action:'craft_*'}。
//    · 主动缝制 = craft-recipe(REQ-C-003)：点缝制按钮 → 够料则原子扣料 + 解锁 flag + 推进外观 + 缝纫店 +1。
//    · 消除产料 = match3 发 ResourceModify → resource-apply 结算到 6 材料。
//  「攒料(消除) → 主动缝制(花料升级店铺/做衣服) → 换装 → 爱诗展示」整条循环全是数据装配。
//  视图格/按钮都是世界实体（clickable 命中），渲染走 game-c.tsx 的轻量画板（表现层）。
//
//  设计抉择（接口摩擦，已记录给主程）：被动阈值解锁 `event-when`（读 Resource + 写 Signal）与
//  `match-resolve`（读 Signal + 经 resource-apply 写 Resource）在 Update 相位成依赖环；改用
//  Commit 相位的 `craft-recipe` 主动缝制即避环，且更贴合「攒料→主动升级」玩法（与主程开工清单一致）。
// ═══════════════════════════════════════════════════════════════

const GAME_C_CAPABILITIES = [
  match3BoardCapability, // T3：三消棋盘机制（选/换/找连/消除产料/重力/补块/连锁）
  clickableCapability, // T2：指针命中视图格/按钮 → Signal
  craftRecipeCapability, // T2：主动缝制（够料才成交，原子扣料 + 解锁 + 店铺等级 +1）
  resourceCapability, // F1：材料/货币/店铺等级 + resource-apply（全局按 id 路由）
  flagCapability, // F2：衣服解锁位
  stateCapability, // J1：女孩当前外观指针
  textCapability, // L6：外观文字（展示用）
];

// ── 棋盘布局（世界坐标 = canvas 像素；无相机 → clickable/渲染同一坐标系）。
export const BOARD_ENTITY = 'board';
export const BOARD_COLS = 6;
export const BOARD_ROWS = 7;
export const BOARD_CELL = 48;
export const BOARD_PAD = 16;
export const BOARD_W = BOARD_PAD * 2 + BOARD_COLS * BOARD_CELL; // 320
export const BOARD_BOTTOM = BOARD_PAD * 2 + BOARD_ROWS * BOARD_CELL; // 368
const KINDS = MATERIALS.length;

// ── 缝制按钮布局（棋盘下方两列；按钮也是世界实体，clickable 命中）。
export const BTN_W = 144;
export const BTN_H = 42;
const BTN_COL_X = [BOARD_PAD + BTN_W / 2, BOARD_W - BOARD_PAD - BTN_W / 2]; // [88, 232]
const BTN_ROW_Y0 = BOARD_BOTTOM + 22;
const BTN_ROW_GAP = 50;
export function garmentButtonPos(i: number): { x: number; y: number } {
  return { x: BTN_COL_X[i % 2], y: BTN_ROW_Y0 + Math.floor(i / 2) * BTN_ROW_GAP };
}
export const CANVAS_H = BTN_ROW_Y0 + Math.ceil(GARMENTS.length / 2) * BTN_ROW_GAP; // 含按钮的画布高

export function boardCellCenter(index: number): { x: number; y: number } {
  const col = index % BOARD_COLS;
  const row = Math.floor(index / BOARD_COLS);
  return { x: BOARD_PAD + col * BOARD_CELL + BOARD_CELL / 2, y: BOARD_PAD + row * BOARD_CELL + BOARD_CELL / 2 };
}
// 确定性生成开局网格：逐格随机、但避开「与左二 / 上二同色」→ 无任何 3 连（开局不自消），
// 且**非退化**——区别于 (c+2r)% 那种规则条纹（条纹盘任何相邻交换都凑不成连 = 死局）。
// 随机盘几乎必然存在可行步（健壮的「无可行步→重排」属棋盘能力，见 REQ-C-006）。
const GEN_SEED = 0x5715c3;
function genInitialCells(): number[] {
  let s = GEN_SEED >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const cells = new Array<number>(BOARD_COLS * BOARD_ROWS).fill(-1);
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const i = r * BOARD_COLS + c;
      let k = 0;
      for (let tries = 0; tries < 24; tries++) {
        k = Math.floor(rnd() * KINDS);
        const h = c >= 2 && cells[i - 1] === k && cells[i - 2] === k;
        const v = r >= 2 && cells[i - BOARD_COLS] === k && cells[i - 2 * BOARD_COLS] === k;
        if (!h && !v) break;
      }
      cells[i] = k;
    }
  }
  return cells;
}

// 一件衣服的「需求」既是缝制成本（主动花费）。
const craftCosts = (g: Garment) => g.requires.map((r) => ({ id: r.material, amount: r.amount }));

export function buildGameCBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};
  const cells0 = genInitialCells();

  // ── 三消棋盘单例 + 确定性补块种子。
  entities[BOARD_ENTITY] = {
    MatchBoard: {
      cols: BOARD_COLS, rows: BOARD_ROWS, kindCount: KINDS, cells: cells0.slice(),
      kindResource: MATERIALS.map((m) => m.id), matAmount: 2,
      coinResource: COIN_ID, coinPerTile: COIN_PER_TILE,
      kindTint: MATERIALS.map((m) => m.tint), kindLabel: MATERIALS.map((m) => m.glyph),
      phase: 'idle', selIndex: -1, swapA: -1, swapB: -1, stepTimer: 0, stepDelay: 8, selectAction: 'cell',
    },
    RandomSeed: { seed: 20260605, sequence: 0 },
  };

  // ── 视图格（静态建好；match3-view-sync 只改 Color.tint；clickable 命中其 Shape）。
  for (let i = 0; i < BOARD_COLS * BOARD_ROWS; i++) {
    const { x, y } = boardCellCenter(i);
    const kind = cells0[i];
    entities[`cell_${i}`] = {
      BoardCell: { boardId: BOARD_ENTITY, index: i },
      Transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: BOARD_CELL - 6, height: BOARD_CELL - 6 },
      Color: { tint: MATERIALS[kind].tint, alpha: 1 },
      Clickable: { action: 'cell' },
    };
  }

  // ── 材料经济：6 材料 + 针线币（消除产出落到这里）。
  for (const m of MATERIALS) entities[`mat_${m.id}`] = { Resource: { id: m.id, current: 0, min: 0, max: 9999 } };
  entities[`mat_${COIN_ID}`] = { Resource: { id: COIN_ID, current: 0, min: 0, max: 999999 } };

  // ── 缝纫店等级（每缝制一件衣服 +1）。
  entities[SHOP_LEVEL_ENTITY] = { Resource: { id: SHOP_LEVEL_ID, current: 0, min: 0, max: SHOP_LEVEL_MAX } };

  // ── 女孩当前外观：look 状态机 + 展示文字。
  entities.girl = {
    State: { fsmId: LOOK_FSM, current: BASE_LOOK, previous: BASE_LOOK },
    Text: { content: '练习服', fontSize: 20, fontFamily: 'serif', anchor: 'center', lineSpacing: 4 },
  };

  // ── 每件衣服：解锁 flag + 缝制按钮（Clickable 命中→Signal→CraftRecipe 够料才成交）。
  GARMENTS.forEach((g, i) => {
    const sig = garmentSignal(g); // 'sig_<id>' 复用为缝制信号名
    const { x, y } = garmentButtonPos(i);
    entities[`flag_${g.id}`] = { Flag: { id: garmentFlagId(g), active: false } };
    entities[`btn_${g.id}`] = {
      Transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: BTN_W, height: BTN_H },
      Clickable: { action: sig },
      CraftRecipe: {
        onSignal: sig,
        costs: craftCosts(g),
        gains: [{ id: SHOP_LEVEL_ID, amount: 1 }],
        grantsFlag: garmentFlagId(g),
        grantsState: { fsmId: LOOK_FSM, value: g.lookId },
      },
    };
  });

  // ── 配饰解锁位（内容资产 + 占位）。v0.3 先作为可解锁内容存在；主动缝制配饰 v0.4（见 REQ-C-005）。
  // 注：本组 flag 实体也是「资产透视」双击定位的落点（studio assets-model 据 accflag_<id> 关联）。
  for (const a of ACCESSORIES) entities[`accflag_${a.id}`] = { Flag: { id: accessoryFlagId(a), active: false } };

  return { capabilities: GAME_C_CAPABILITIES, entities };
}

// 供 UI / 测试引用的稳定 id。
export const GIRL_ENTITY = 'girl';
export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export { SHOP_LEVEL_ENTITY };
export const garmentButtonEntity = (g: Garment | string): string => `btn_${typeof g === 'string' ? g : g.id}`;
