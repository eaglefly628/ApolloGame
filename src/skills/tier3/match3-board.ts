import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { MatchBoard, BoardCell, Signal, Color, Text, ResourceModify, RandomSeed, Sprite } from '@engine/protocol/components.js';
import { findByComponentId } from '@engine/core/query.js';
import { randomInt } from '@atom-skills/index.js';

// ═══════════════════════════════════════════════════════════════
//  match3-board —— 三消棋盘机制（REQ-C-001；Tier 3「算法/解释器型机制」大类）。
//
//  Condition→Event→Effect 是反应式布尔逻辑，表达不了「带网格邻接扫描 / 循环」的算法——三消正是这类缺口。
//  本能力把「交换 / 找连 / 消除产出 / 重力 / 补块 / 连锁」做成一个 config 驱动、确定性的相位状态机：
//
//    idle    ：读点击选格（BoardCell 上由 clickable 发的选中 Signal）→ 选/换；相邻两格 → 交换、转 swapped。
//    swapped ：首扫；有连线 → clear；无连线 → 回退交换 → idle（非法步）。
//    match   ：全盘找 ≥3 同色横/竖连线；有 → clear；无 → idle（稳定）。
//    clear   ：标记格按 kindResource 累加产料 + 货币（一种一份 ResourceModify，避免一实体多组件）、置 -1 → fall。
//    fall    ：每列非空块下沉到底 → refill。
//    refill  ：顶部空位用 RandomSeed 整数 PRNG 确定性补新 → match（连锁再扫）。
//
//  产出走现成 ResourceModify（写到各材料自己的 Resource 实体）→ resource-apply 结算 → 游戏已装配好的
//  升级/换装/展示链自动点亮，游戏数据不动一行。视图格（BoardCell）由游戏蓝图静态建好，本能力只改其外观、不增删实体。
//  确定性：整数网格 + 大小比较 + RandomSeed（mulberry32 整数 PRNG，仅 imul/位运算/单次除法）→ lockstep/录放安全。
// ═══════════════════════════════════════════════════════════════

// ── 纯算法 helper（导出供单测；无副作用，确定性）────────────────────────────
export function cellIndex(c: number, r: number, cols: number): number {
  return r * cols + c;
}

// 两格是否四邻（同行相邻列 或 同列相邻行）。
export function adjacent(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols);
  const ca = a % cols;
  const rb = Math.floor(b / cols);
  const cb = b % cols;
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}

// 全盘找 ≥3 同色横/竖连线，返回被消除格 index 集合（空格 -1 不参与）。
export function findMatches(cells: readonly number[], cols: number, rows: number): Set<number> {
  const matched = new Set<number>();
  // 横向
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= cols; c++) {
      const prev = cells[r * cols + (c - 1)];
      const cur = c < cols ? cells[r * cols + c] : -999;
      if (cur !== prev || prev === -1) {
        if (prev !== -1 && c - runStart >= 3) for (let k = runStart; k < c; k++) matched.add(r * cols + k);
        runStart = c;
      }
    }
  }
  // 纵向
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= rows; r++) {
      const prev = cells[(r - 1) * cols + c];
      const cur = r < rows ? cells[r * cols + c] : -999;
      if (cur !== prev || prev === -1) {
        if (prev !== -1 && r - runStart >= 3) for (let k = runStart; k < r; k++) matched.add(k * cols + c);
        runStart = r;
      }
    }
  }
  return matched;
}

// 每列非空块下沉到底（保持列内相对顺序），上方补 -1。原地修改 cells。
export function applyGravity(cells: number[], cols: number, rows: number): void {
  for (let c = 0; c < cols; c++) {
    const stack: number[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      const v = cells[r * cols + c];
      if (v !== -1) stack.push(v); // 自底向上收集非空
    }
    for (let r = rows - 1, i = 0; r >= 0; r--, i++) {
      cells[r * cols + c] = i < stack.length ? stack[i] : -1; // 自底向下回填，其余置空
    }
  }
}

// 顶部（任意 -1）按确定性 PRNG 补新（index 序，确定）。原地修改 cells + 推进 seed。
export function refillEmpty(cells: number[], kindCount: number, seed: RandomSeed): void {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === -1) cells[i] = randomInt(seed, 0, kindCount);
  }
}

function swapCells(cells: number[], a: number, b: number): void {
  const t = cells[a];
  cells[a] = cells[b];
  cells[b] = t;
}

// 在某资源自己的实体上发 ResourceModify（按 id 全局定位；一种一份=不撞一实体多组件）。
function emitResourceModify(world: IWorld, resourceId: string, amount: number): void {
  if (!resourceId || amount === 0) return;
  const e = findByComponentId(world, 'Resource', 'id', resourceId);
  if (e) world.addComponent(e, { type: 'ResourceModify', resourceId, amount, scope: 'global' } as ResourceModify);
}

// idle 相位：读本 tick 选中信号（clickable 命中 BoardCell 时发），驱动选/换逻辑。
function handleIdleInput(world: IWorld, boardId: string, b: MatchBoard): void {
  let picked = -1;
  for (const [eid] of world.query('BoardCell', 'Signal')) {
    const bc = world.getComponent<BoardCell>(eid, 'BoardCell')!;
    if (bc.boardId !== boardId) continue;
    const sig = world.getComponent<Signal>(eid, 'Signal')!;
    if (sig.name !== b.selectAction) continue;
    if (picked === -1 || bc.index < picked) picked = bc.index; // 同 tick 多选取最小 index（确定性）
  }
  if (picked === -1) return;
  if (b.selIndex === -1) {
    b.selIndex = picked;
  } else if (picked === b.selIndex) {
    b.selIndex = -1; // 再点自己 = 取消
  } else if (adjacent(b.selIndex, picked, b.cols)) {
    swapCells(b.cells, b.selIndex, picked);
    b.swapA = b.selIndex;
    b.swapB = picked;
    b.selIndex = -1;
    b.phase = 'swapped';
    b.stepTimer = 0;
  } else {
    b.selIndex = picked; // 非相邻 = 改选
  }
}

export const match3BoardCapability = defineCapability({
  id: 't3-match3-board',
  version: '1.0.0',

  describe: {
    name: 'match3-board',
    summary: '三消棋盘机制：config 驱动的确定性相位状态机（交换/找连/消除产出/重力/补块/连锁）。消除按 kindResource 产料+币，视图同步到 BoardCell 实体外观。',
    semantic: ['tier3', 'mechanic', 'grid', 'match3', 'algorithm'],
    whenToUse:
      '三消/连连看/网格解谜。挂 MatchBoard 单例（config+cells+相位）+ RandomSeed；视图格 BoardCell+Clickable+Color+Text 由蓝图静态建。点格→clickable 发选中信号→本能力选/换/消，产料走 ResourceModify。',
    examples: [
      '6 色 8×8 缝纫三消：MatchBoard{ cols:8,rows:8,kindCount:6, kindResource:[...6 材料 id], coinResource:"coin", coinPerTile:1 }',
      '点相邻两格交换：clickable 在两格发选中 Signal → idle 选→换→swapped 首扫',
      '消除产料：3 连同色 → clear 发 ResourceModify(+matAmount 该材料)+coin → resource-apply 结算 → 升级链点亮',
    ],
  },

  components: {
    provides: {
      MatchBoard: {
        category: 'config',
        describe: '三消棋盘单例：尺寸/种类/cells 网格 + 产出映射 + 相位状态机字段。',
        fields: {
          cols: { type: 'number', describe: '列数' },
          rows: { type: 'number', describe: '行数' },
          kindCount: { type: 'number', describe: '棋子种类数' },
          cells: { type: 'number[]', describe: '长 cols*rows 的网格，值=种类 0..kindCount-1，-1=空' },
          kindResource: { type: 'string[]', describe: '种类→产出 Resource id' },
          matAmount: { type: 'number', describe: '每消一格给对应材料的量' },
          coinResource: { type: 'string', describe: '货币 Resource id（空串=不产币）' },
          coinPerTile: { type: 'number', describe: '每消一格给的货币' },
          kindTint: { type: 'number[]', describe: '种类→视图底色' },
          kindLabel: { type: 'string[]', describe: '种类→视图文字' },
          phase: { type: 'string', describe: "'idle'|'swapped'|'match'|'clear'|'fall'|'refill'" },
          selIndex: { type: 'number', describe: '当前选中格（-1=无）' },
          swapA: { type: 'number', describe: '本次交换格 A（-1=无）' },
          swapB: { type: 'number', describe: '本次交换格 B（-1=无）' },
          stepTimer: { type: 'number', describe: '相位节拍计数' },
          stepDelay: { type: 'number', describe: '相位间等待 tick（0=即时）' },
          selectAction: { type: 'string', describe: '选中格的信号名（clickable 发的 Signal.name）' },
          movesResource: { type: 'string', describe: '可选·步数 Resource id：合法交换（产生连线）-1，非法步弹回不扣；缺省/空=不限步' },
          kindSkinEntities: { type: 'string[]', describe: '可选·种类→皮肤定义实体 id（各持 Sprite{textureKey:"art:…"}）：view-sync 把已解析贴图 key 写到 BoardCell.Sprite——糖果式图片皮；缺省=色块+文字' },
        },
      },
      BoardCell: {
        category: 'config',
        describe: '视图格：把逻辑格 index 绑到一个可点/可显示的实体。',
        fields: {
          boardId: { type: 'EntityId', describe: '所属棋盘实体 id' },
          index: { type: 'number', describe: '逻辑格下标（0..cols*rows-1）' },
        },
      },
    },
    reads: ['MatchBoard', 'BoardCell', 'Signal', 'RandomSeed', 'Resource'],
    writes: ['MatchBoard', 'ResourceModify', 'Color', 'Text'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      // 相位状态机：推进逻辑网格、产出 ResourceModify。Update 相位（晚于 clickable 产选中信号、早于 resource-apply 结算）。
      id: 'match-resolve',
      reads: ['MatchBoard', 'BoardCell', 'Signal', 'RandomSeed', 'Resource'],
      writes: ['MatchBoard', 'ResourceModify'],
      consumes: [],
      // 定序（R10 修订·game-j 撞出四系统环 resource-apply→event-when→clickable→match-resolve→resource-apply）：
      // 显式排在 resource-apply **之后**压制 writer→consumer 自动边——产料/扣步**下一拍**被结算
      // （离散反馈一拍延迟=引擎教义·effect-apply 同款）；与 event-when/clickable 共存的世界不再成环。
      runsAfter: ['resource-apply'],
      execute(world: IWorld) {
        for (const [bid] of world.query('MatchBoard')) {
          const b = world.getComponent<MatchBoard>(bid, 'MatchBoard')!;

          if (b.phase === 'idle') {
            handleIdleInput(world, bid, b);
            continue;
          }

          // 结算相位按 stepDelay 节拍推进（让连锁可见；stepDelay=0 即时）。
          if (b.stepTimer < b.stepDelay) {
            b.stepTimer += 1;
            continue;
          }
          b.stepTimer = 0;

          switch (b.phase) {
            case 'swapped': {
              if (findMatches(b.cells, b.cols, b.rows).size > 0) {
                emitResourceModify(world, b.movesResource ?? '', -1); // 合法步扣 1（movesResource 缺省''=不限步）
                b.phase = 'clear';
              } else {
                // 无连线 → 回退交换（非法步）。
                if (b.swapA >= 0 && b.swapB >= 0) swapCells(b.cells, b.swapA, b.swapB);
                b.swapA = -1;
                b.swapB = -1;
                b.phase = 'idle';
              }
              break;
            }
            case 'match': {
              if (findMatches(b.cells, b.cols, b.rows).size > 0) {
                b.phase = 'clear';
              } else {
                b.swapA = -1;
                b.swapB = -1;
                b.phase = 'idle'; // 稳定，无连线
              }
              break;
            }
            case 'clear': {
              const matched = findMatches(b.cells, b.cols, b.rows);
              const gain = new Map<string, number>();
              let coinGain = 0;
              for (const i of matched) {
                const kind = b.cells[i];
                if (kind >= 0 && kind < b.kindResource.length) {
                  const rid = b.kindResource[kind];
                  gain.set(rid, (gain.get(rid) ?? 0) + b.matAmount);
                }
                coinGain += b.coinPerTile;
                b.cells[i] = -1;
              }
              for (const [rid, amt] of gain) emitResourceModify(world, rid, amt);
              emitResourceModify(world, b.coinResource, coinGain);
              b.phase = 'fall';
              break;
            }
            case 'fall': {
              applyGravity(b.cells, b.cols, b.rows);
              b.phase = 'refill';
              break;
            }
            case 'refill': {
              const seed = world.getComponent<RandomSeed>(bid, 'RandomSeed');
              if (seed) refillEmpty(b.cells, b.kindCount, seed);
              b.phase = 'match'; // 连锁再扫
              break;
            }
          }
        }
      },
    },
    {
      // 视图同步：把逻辑 cells 写到各 BoardCell 视图实体的 Color.tint/Text.content。Commit 相位（最终表现写入）。
      id: 'match-view-sync',
      phase: SystemPhase.Commit,
      reads: ['MatchBoard', 'BoardCell', 'Sprite'],
      writes: ['Color', 'Text', 'Sprite'],
      consumes: [],
      execute(world: IWorld) {
        for (const [bid] of world.query('MatchBoard')) {
          const b = world.getComponent<MatchBoard>(bid, 'MatchBoard')!;
          // 皮肤定义实体（可选）：种类→已解析贴图 key（美术管线换装即换全盘·糖果式图片皮）
          const skins = (b.kindSkinEntities ?? []).map((defId) => world.getComponent<Sprite>(defId, 'Sprite')?.textureKey ?? '');
          for (const [eid] of world.query('BoardCell')) {
            const bc = world.getComponent<BoardCell>(eid, 'BoardCell')!;
            if (bc.boardId !== bid) continue;
            const kind = b.cells[bc.index];
            const color = world.getComponent<Color>(eid, 'Color');
            if (color && kind >= 0 && kind < b.kindTint.length) color.tint = b.kindTint[kind];
            const text = world.getComponent<Text>(eid, 'Text');
            if (text) text.content = kind >= 0 && kind < b.kindLabel.length ? b.kindLabel[kind] : '';
            const sp = world.getComponent<Sprite>(eid, 'Sprite');
            if (sp && skins.length) sp.textureKey = kind >= 0 && kind < skins.length ? skins[kind] : '';
          }
        }
      },
    },
  ],
});
