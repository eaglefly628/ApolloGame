// Game 102 · Pixel Pour —— play-field 世界 = 纯数据（WorldBlueprint）。零游戏层 system 代码（Lead 裁①）。
//
//   中央棋盘   = 一格一实体 BoardCell（Transform+Shape+Tag(色位|CELL)+Resource(hp)+Color）
//                —— **不用 tilemap**（tilemap 只做墙碰撞+画格·无 per-cell hp/消除/按色计数·瓦片非实体）。
//   按色计数   = t2-group-count（Tag 掩码数在板同色格 → 写 Resource remain_<color>·补给角标/无同色目标判定）
//   补给取炮   = t2-clickable（点补给源发 take_<color> 信号·S4 由 event-when/effect-apply 生成色炮入传送带）
//   传送带     = t2-zone-occupancy（容量占用/队首·outFlag conveyor_full）
//   待命槽     = t2-tray（5 槽·弹尽色炮入槽·点击复用）
//   抛射       = t2-launch（发射位向同色格抛彩球·S4 接线）
//   胜负流程   = t3-flow（GameFlow：playing →(全清/门开)victory /(限额尽)defeat）
//   计量       = f1-resource（得分/连击/钥匙/门目标）· 确定性随机 = w1-random（关卡 seed）
// 能力总览：docs/design/game102/capability-plan.md（Lead 裁①：先组合表达·零运行时游戏层例外）。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, shapeCapability, tagCapability, colorCapability,
  resourceCapability, flagCapability, randomCapability,
} from '@atom-skills/index.js';
import {
  clickableCapability, groupCountCapability, zoneOccupancyCapability, trayCapability,
  eventWhenCapability, effectApplyCapability, launchCapability, gaugeCapability,
} from '@skills/tier2/index.js';
import { flowCapability } from '@skills/tier3/index.js';
import {
  PALETTE, CELL_BIT, CANNON_BIT, KEY_BIT, CELL_SIZE, BOARD_X, BOARD_Y,
  CONVEYOR, TRAY, SUPPLY,
} from './theme.js';
import type { Level } from './levels.js';
import { LEVEL_1 } from './levels.js';

const XF = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const paletteColor = (level: Level, idx: number): typeof PALETTE[string] => {
  const name = level.palette[idx];
  const col = name ? PALETTE[name] : undefined;
  if (!col) throw new Error(`game102 L${level.no}: bitmap 用色 index ${idx} 超出 palette（${level.palette.join(',')}）`);
  return col;
};

// 位图 → BoardCell 实体阵（一格一实体）。'.'=空；数字=palette[index]；hp 层可选。
function boardCells(level: Level): Record<string, EntityBlueprint> {
  const cells: Record<string, EntityBlueprint> = {};
  const keySet = new Set((level.keys ?? []).map(([c, r]) => `${c},${r}`));
  for (let r = 0; r < level.rows; r++) {
    const row = level.bitmap[r] ?? '';
    for (let c = 0; c < level.cols; c++) {
      const ch = row[c];
      if (!ch || ch === '.') continue;
      const idx = Number(ch);
      if (Number.isNaN(idx)) continue;
      const col = paletteColor(level, idx);
      const hpCh = level.hp?.[r]?.[c];
      const hp = hpCh && hpCh !== '.' ? Number(hpCh) || 1 : 1;
      const isKey = keySet.has(`${c},${r}`);
      const x = BOARD_X + c * CELL_SIZE + CELL_SIZE / 2;
      const y = BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2;
      cells[`cell-${c}-${r}`] = {
        Transform: XF(x, y),
        Shape: { kind: 'box', width: CELL_SIZE - 2, height: CELL_SIZE - 2 },
        Tag: { flags: col.bit | CELL_BIT | (isKey ? KEY_BIT : 0) },
        Resource: { id: 'hp', current: hp, min: 0, max: hp },
        Color: { tint: col.tint, alpha: 1 },
      };
    }
  }
  return cells;
}

// 每关颜色 → 一个 group-count 计数器（在板同色格数 → Resource remain_<color>）。
function colorCounters(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const name of level.palette) {
    const col = PALETTE[name];
    if (!col) continue;
    out[`remain-${name}`] = {
      GroupCount: { countResource: `remain_${name}`, requiredTag: col.bit | CELL_BIT },
      Resource: { id: `remain_${name}`, current: 0, min: 0, max: 9999 },
    };
  }
  return out;
}

// 补给源（每色一个·点击发 take_<color> 信号）。
function supplies(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  level.palette.forEach((name, i) => {
    const col = PALETTE[name];
    if (!col) return;
    out[`supply-${name}`] = {
      Transform: XF(SUPPLY.originX + i * SUPPLY.gap, SUPPLY.originY),
      Shape: { kind: 'box', width: 48, height: 48 },
      Color: { tint: col.tint, alpha: 1 },
      Clickable: { action: `take_${name}`, phase: 'down' },
      Tag: { flags: col.bit },
    };
  });
  return out;
}

// 计量资源单例（得分/连击/钥匙/门目标）。
function meters(level: Level): Record<string, EntityBlueprint> {
  const keyGoal = level.goals.find((g) => g.kind === 'keys') as { n: number } | undefined;
  const doorGoal = level.goals.find((g) => g.kind === 'door') as { target: number } | undefined;
  return {
    score: { Resource: { id: 'score', current: 0, min: 0, max: 9_999_999 } },
    combo: { Resource: { id: 'combo', current: 0, min: 0, max: 999 } },
    keys: { Resource: { id: 'keys', current: 0, min: 0, max: keyGoal?.n ?? (level.keys?.length ?? 0) } },
    door: { Resource: { id: 'door', current: 0, min: 0, max: doorGoal?.target ?? 100 } },
  };
}

export function buildBlueprint(level: Level = LEVEL_1): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 确定性随机源（关卡 seed → 摆盘/补给出色·禁裸 Math.random）。
    rng: { RandomSeed: { seed: level.seed, sequence: 0 } },
    // 传送带容量区（队首=发射位·outFlag 满位）。
    conveyor: {
      Zone: {
        outFlag: 'conveyor_full',
        minX: CONVEYOR.minX, minY: CONVEYOR.minY, maxX: CONVEYOR.maxX, maxY: CONVEYOR.maxY,
        requiredTag: CANNON_BIT, count: level.conveyorCap,
      },
    },
    // 待命槽（5 槽）。
    tray: {
      Tray: {
        originX: TRAY.originX, originY: TRAY.originY, gap: TRAY.gap,
        capacity: level.slots, requiredTag: CANNON_BIT,
      },
    },
    // 宝箱门装饰件（render 计量·非可射）。
    'door-marker': level.door
      ? {
          Transform: XF(
            BOARD_X + (level.door.col + level.door.w / 2) * CELL_SIZE,
            BOARD_Y + (level.door.row + level.door.h / 2) * CELL_SIZE,
          ),
          Shape: { kind: 'box', width: level.door.w * CELL_SIZE, height: level.door.h * CELL_SIZE },
          Color: { tint: PALETTE.gold.tint, alpha: 0.85 },
        }
      : {},
    // 关卡流程状态机。
    flow: {
      GameFlow: {
        id: 'main',
        current: 'playing',
        states: [
          { id: 'playing', transitions: [] },
          { id: 'victory' },
          { id: 'defeat' },
        ],
      },
    },
    ...meters(level),
    ...colorCounters(level),
    ...supplies(level),
    ...boardCells(level),
  };

  return {
    capabilities: [
      // atoms
      transformCapability, shapeCapability, tagCapability, colorCapability,
      resourceCapability, flagCapability, randomCapability, clickableCapability,
      // tier2 玩法能力（S4 接线·S3 先立位）
      groupCountCapability, zoneOccupancyCapability, trayCapability,
      eventWhenCapability, effectApplyCapability, launchCapability, gaugeCapability,
      // tier3 流程
      flowCapability,
    ],
    entities,
  };
}
