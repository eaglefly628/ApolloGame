// Game T ·《墨消》—— 每关世界蓝图 = 纯数据（WorldBlueprint）。规则零 TS：
//   棋盘全机制 = t3-match3-board（换/连/消/重力/补块/连锁/特殊棋子/格层·config 驱动确定性相位机）
//   胜负判定   = t3-flow GameFlow：playing →(目标达成)victory / (moves 尽)lastcall 结算窗 →(窗过)defeat
//                （lastcall 让末步连锁把目标补齐仍算胜=CC 惯例；进窗即锁输入）
//   产出/目标  = Resource（score/moves/washed/cracked/ink*）← ResourceModify ← 引擎 resource-apply 结算
//   输入       = clickable 点选两格交换（REQ-INPUT-拖拽落地后换手势·产同名信号·sim 零改动）
// 本文件只做 level-schema §一 明许的「装配映射·纯转换零逻辑」：字符画 → cells/jelly/blockers；goals → 资源阈值。
//
// 视图现状（点选先行装配·owner 2026-07-16）：BoardCell=色块 tile（match-view-sync 写 Color.tint）；
//   特殊棋子外观/格层实时视图/选中高亮/手感动画 = REQ-M3-三期①④（挂起待 owner 拉起）落地后接——
//   格层在此先以静态摆盘参考色呈现（进度看 HUD 活计数），缺口台账见 docs/design/game-t/requests.md。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { ConditionExpr } from '@engine/protocol/components.js';
import {
  transformCapability, shapeCapability, colorCapability,
  resourceCapability, flagCapability, randomCapability,
} from '@atom-skills/index.js';
import { clickableCapability } from '@skills/tier2/index.js';
import { match3BoardCapability, flowCapability } from '@skills/tier3/index.js';
import { type LevelSpec, parseLayout, goalRequirements } from './levels.js';
import {
  CELL, TILE, STEP_DELAY, SETTLE_TICKS, SCORE_PER_TILE,
  INK_TINTS, INK_LABELS, TINT_JELLY, TINT_PORCELAIN, TINT_STONE, TINT_EMPTY, cellCenter,
} from './theme.js';

const XF = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });

/** 一关 → 可运行世界（纯数据·可 JSON 序列化）。 */
export function buildLevelBlueprint(spec: LevelSpec): WorldBlueprint {
  const L = parseLayout(spec);
  const reqs = goalRequirements(spec);

  // 胜利条件：全部目标资源过阈（mixed=and）。
  const conds: ConditionExpr[] = reqs.map((g) => ({ kind: 'resource', id: g.rid, cmp: 'gte', value: g.need }));
  const winWhen: ConditionExpr = conds.length === 1 ? conds[0] : { kind: 'and', of: conds };

  const inkIds = Array.from({ length: spec.kinds }, (_, k) => `ink${k}`);

  const entities: Record<string, EntityBlueprint> = {};

  // ── 资源（一种一实体·resource-apply 结算 → Condition 判目标）──────────────────
  entities.score = { Resource: { id: 'score', current: 0, min: 0, max: 9_999_999 } };
  entities.moves = { Resource: { id: 'moves', current: spec.moves, min: 0, max: spec.moves } };
  entities.washed = { Resource: { id: 'washed', current: 0, min: 0, max: 999 } };
  entities.cracked = { Resource: { id: 'cracked', current: 0, min: 0, max: 999 } };
  for (const [k, rid] of inkIds.entries()) {
    entities[`ink-${k}`] = { Resource: { id: rid, current: 0, min: 0, max: 9999 } };
  }

  // ── 输入门：moves 用尽/终局即锁点（Clickable.onlyFlag 读它）────────────────────
  entities['can-play'] = { Flag: { id: 'can-play', active: true } };

  // ── 墨渍摆盘参考底衬（静态·先于 cell 插入=画在珠下；实时层视图=三期① LayerCell）──
  if (L.jelly) {
    for (let i = 0; i < L.jelly.length; i++) {
      const layers = L.jelly[i];
      if (layers <= 0) continue;
      const p = cellCenter(spec.cols, i);
      entities[`wash-${i}`] = {
        Transform: XF(p.x, p.y),
        Shape: { kind: 'box', width: CELL - 4, height: CELL - 4 },
        Color: { tint: TINT_JELLY, alpha: layers >= 2 ? 0.5 : 0.28 },
      };
    }
  }

  // ── 棋盘单例 + 确定性种子（一切随机=引擎 PRNG·游戏层零 Math.random）────────────
  entities.board = {
    MatchBoard: {
      cols: spec.cols,
      rows: spec.rows,
      kindCount: spec.kinds,
      cells: L.cells,
      kindResource: inkIds,
      matAmount: 1,
      coinResource: 'score',
      coinPerTile: SCORE_PER_TILE,
      kindTint: INK_TINTS.slice(0, spec.kinds),
      kindLabel: INK_LABELS.slice(0, spec.kinds),
      // '.'=随机补：开局从 refill 相位起步 → 空位确定性补齐 → match 相位消解开局连线后稳定
      phase: 'refill',
      selIndex: -1,
      swapA: -1,
      swapB: -1,
      stepTimer: 0,
      stepDelay: STEP_DELAY,
      selectAction: 'pick',
      movesResource: 'moves',
      ...(L.jelly ? { jelly: L.jelly, jellyResource: 'washed' } : {}),
      ...(L.blockers ? { blockers: L.blockers, blockerResource: 'cracked' } : {}),
    },
    RandomSeed: { seed: spec.seed, sequence: 0 },
  };

  // ── 视图格（静态实体·match-view-sync 写 Color.tint；clickable 命中发 'pick'）────
  for (let i = 0; i < L.cells.length; i++) {
    const p = cellCenter(spec.cols, i);
    const blk = L.blockers?.[i] ?? 0;
    const tint = blk === -1 ? TINT_STONE : blk > 0 ? TINT_PORCELAIN : TINT_EMPTY;
    entities[`cell-${i}`] = {
      Transform: XF(p.x, p.y),
      Shape: { kind: 'box', width: TILE, height: TILE },
      Color: { tint, alpha: 1 },
      Clickable: { action: 'pick', onlyFlag: 'can-play' },
      BoardCell: { boardId: 'board', index: i },
    };
  }

  // ── 胜负流程（声明式状态机·纯数据）──────────────────────────────────────────
  entities.flow = {
    GameFlow: {
      id: 'match',
      current: 'playing',
      states: [
        {
          id: 'playing',
          transitions: [
            { when: winWhen, to: 'victory' }, // 数组序=先判胜（末步同时达成→胜）
            { when: { kind: 'resource', id: 'moves', cmp: 'lte', value: 0 }, to: 'lastcall' },
          ],
        },
        {
          id: 'lastcall', // 终步结算窗：锁输入·等连锁收尾；窗内补齐目标仍算胜
          onEnter: [{ kind: 'set-flag', targetId: 'can-play', value: false }],
          transitions: [
            { when: winWhen, to: 'victory' },
            { after: SETTLE_TICKS, to: 'defeat' },
          ],
        },
        { id: 'victory', onEnter: [{ kind: 'set-flag', targetId: 'can-play', value: false }] },
        { id: 'defeat' },
      ],
    },
  };

  return {
    capabilities: [
      transformCapability, shapeCapability, colorCapability,
      resourceCapability, flagCapability, randomCapability,
      clickableCapability,
      match3BoardCapability, flowCapability,
    ],
    entities,
  };
}
