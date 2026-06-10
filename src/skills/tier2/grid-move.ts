import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { HexBoard, HexPos, GridMover, Relation, Transform } from '@engine/protocol/components.js';
import { hexNextStep, type Hex } from './hex.js';

// ═══════════════════════════════════════════════════════════════
//  grid-move —— 六边形网格逐格移动（REQ-024；金铲铲/TFT 式自动战斗移动）。
//
//  读自身 Relation(kind:'target')(aggro 写的索敌目标) → 取目标 HexPos → 用 hex A*(hex.ts) 求**下一格**
//  (避开被占格、到目标相邻格停) → 每 GridMover.period 个 tick 走一格 → 写自身 HexPos + 投影 Transform。
//  取代 steering 在网格场景：aggro 仍写目标，grid-move 替算"下一格"(steering 是贪婪直线、绕不开占格)。
//
//  占位(一格一单位)：blocked = 全场其它 HexPos 单位所在格(target 格自然在内→A* 不踏、停相邻)。
//  确定性：A* 纯整数确定(见 hex.ts)；占位集与遍历序无关；HexPos 整数进 hash；Transform 由 HexPos 经
//  精确二进制分数(1/2,3/4)投影(不碰 sqrt/超越函数)→ 跨端无漂移、lockstep 安全。
//  节奏：每 period tick 才走一格(整数计数)，免每拍瞬移。
// ═══════════════════════════════════════════════════════════════

const TARGET = 'target';

// HexPos → Transform 像素(flat-ish hex；1/2、3/4 为精确二进制分数，跨端一致)。
function project(board: HexBoard, q: number, r: number): { x: number; y: number } {
  return {
    x: board.originX + q * board.tileSize + r * (board.tileSize / 2),
    y: board.originY + r * (board.tileSize * 0.75),
  };
}
function syncTransform(world: IWorld, eid: string, board: HexBoard, hp: HexPos): void {
  const t = world.getComponent<Transform>(eid, 'Transform');
  if (t) { const p = project(board, hp.q, hp.r); t.x = p.x; t.y = p.y; }
}

export const gridMoveCapability = defineCapability({
  id: 't2-grid-move',
  version: '1.0.0',

  describe: {
    name: 'grid-move',
    summary: '六边形网格逐格移动：读 Relation(target)→hex A* 求下一格(避占格、到相邻停)→每 period tick 走一格→写 HexPos+投影 Transform。网格场景替代 steering 贪婪直线。',
    semantic: ['tier2', 'movement', 'grid', 'pathfind'],
    whenToUse:
      '六边形棋盘自动战斗(自走棋/战棋/塔防)：单位沿格寻路走向目标。挂 HexPos{q,r}+GridMover{period}+Relation(target,由 aggro 写)；世界放一个 HexBoard{cols,rows,tileSize,origin}。aggro 索敌、grid-move 走位、hitbox/mortal 结算。',
    examples: [
      '棋子追击：HexPos{q,r} + GridMover{period:8} + Relation{kind:"target",targetId:敌} → 每 8 tick 沿 A* 走一格、到相邻停（攻击距离）',
    ],
  },

  components: {
    provides: {
      HexBoard: {
        category: 'config',
        describe: '六边形棋盘(矩形区域 0≤q<cols,0≤r<rows) + 像素投影参数。单例。',
        fields: {
          cols: { type: 'number', describe: '列数' }, rows: { type: 'number', describe: '行数' },
          tileSize: { type: 'number', describe: '每格像素' },
          originX: { type: 'number', describe: '格(0,0)世界 x' }, originY: { type: 'number', describe: '格(0,0)世界 y' },
        },
      },
      HexPos: {
        category: 'config',
        describe: '单位当前所在格(axial q,r)。网格移动 SIM 真相(进 hash)；Transform 由它投影。',
        fields: { q: { type: 'number', describe: 'axial q' }, r: { type: 'number', describe: 'axial r' } },
      },
      GridMover: {
        category: 'config',
        describe: '网格移动器：每 period tick 沿 A* 走一格。',
        fields: { period: { type: 'number', describe: '每多少 tick 走一格(>=1)' }, elapsed: { type: 'number', describe: '内部计时' } },
      },
    },
    reads: ['HexBoard', 'HexPos', 'GridMover', 'Relation'],
    writes: ['HexPos', 'GridMover', 'Transform'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'grid-move',
      phase: SystemPhase.Update,
      reads: ['HexBoard', 'HexPos', 'GridMover', 'Relation'],
      writes: ['HexPos', 'GridMover', 'Transform'],
      consumes: [],
      execute(world: IWorld) {
        // 棋盘单例。
        let board: HexBoard | undefined;
        for (const [bid] of world.query('HexBoard')) { board = world.getComponent<HexBoard>(bid, 'HexBoard'); break; }
        if (!board) return;

        // 占位集：全场 HexPos 单位所在格 cellKey(r*cols+q)。
        const occupied = new Set<number>();
        const posOf = new Map<string, HexPos>();
        for (const [eid] of world.query('HexPos')) {
          const hp = world.getComponent<HexPos>(eid, 'HexPos');
          if (hp) { occupied.add(hp.r * board.cols + hp.q); posOf.set(eid, hp); }
        }

        for (const [eid] of world.query('HexPos', 'GridMover')) {
          const hp = posOf.get(eid)!;
          const mover = world.getComponent<GridMover>(eid, 'GridMover')!;
          syncTransform(world, eid, board, hp); // 每拍保持 Transform 与格同步（即便不移动）

          const rel = world.getComponent<Relation>(eid, 'Relation');
          if (!rel || rel.kind !== TARGET) continue;
          const tHp = posOf.get(rel.targetId);
          if (!tHp) continue;

          // 节奏：未到 period 不移动（但 elapsed 累计）。
          mover.elapsed = (mover.elapsed ?? 0) + 1;
          if (mover.elapsed < mover.period) continue;

          // 占位集排除自身格（自身不挡自己）。
          const blocked = new Set(occupied);
          blocked.delete(hp.r * board.cols + hp.q);
          const next: Hex | null = hexNextStep(board.cols, board.rows, hp, tHp, blocked);
          if (next) {
            // 移动：更新占位(腾出旧格、占新格) + HexPos + Transform。
            occupied.delete(hp.r * board.cols + hp.q);
            hp.q = next.q; hp.r = next.r;
            occupied.add(hp.r * board.cols + hp.q);
            syncTransform(world, eid, board, hp);
            mover.elapsed = 0;
          }
        }
      },
    },
  ],
});
