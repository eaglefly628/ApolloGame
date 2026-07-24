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
  timerCapability, relationCapability, destroyCapability, overlapDetectCapability,
} from '@atom-skills/index.js';
import { lifetimeCapability } from '@skills/tier1/index.js';
import {
  clickableCapability, groupCountCapability, zoneOccupancyCapability, trayCapability,
  eventWhenCapability, effectApplyCapability, launchCapability, gaugeCapability,
  selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability,
} from '@skills/tier2/index.js';
import { flowCapability, aggroCapability, prefabCapability } from '@skills/tier3/index.js';
import {
  PALETTE, CELL_BIT, CANNON_BIT, KEY_BIT, ZONE_BIT, FIRE,
  PIPE, PICTURE, BOARD_PAD, BOARD_GAP, CONVEYOR, TRAY, SUPPLY, ACTION_BAR,
} from './theme.js';
import type { Level } from './levels.js';
import { LEVEL_1 } from './levels.js';

const XF = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const box = (w: number, h: number): Record<string, unknown> => ({ kind: 'box', width: w, height: h });
const col = (tint: number, alpha = 1): Record<string, unknown> => ({ tint, alpha });

// 棋盘格铺进 PICTURE 窗口：按 cols/rows 自适应格宽、居中。返回 {cell,ox,oy}（供 boardCells 用）。
function boardFit(level: Level): { cell: number; ox: number; oy: number } {
  const availW = PICTURE.w - BOARD_PAD * 2 - BOARD_GAP * (level.cols - 1);
  const availH = PICTURE.h - BOARD_PAD * 2 - BOARD_GAP * (level.rows - 1);
  const cell = Math.floor(Math.min(availW / level.cols, availH / level.rows));
  const gridW = level.cols * cell + BOARD_GAP * (level.cols - 1);
  const gridH = level.rows * cell + BOARD_GAP * (level.rows - 1);
  const ox = PICTURE.x + (PICTURE.w - gridW) / 2;
  const oy = PICTURE.y + (PICTURE.h - gridH) / 2;
  return { cell, ox, oy };
}
const paletteColor = (level: Level, idx: number): typeof PALETTE[string] => {
  const name = level.palette[idx];
  const col = name ? PALETTE[name] : undefined;
  if (!col) throw new Error(`game102 L${level.no}: bitmap 用色 index ${idx} 超出 palette（${level.palette.join(',')}）`);
  return col;
};

// 位图 → BoardCell 实体阵（一格一实体·铺进 PICTURE 窗口）。'.'=空；数字=palette[index]；hp 层可选。
function boardCells(level: Level): Record<string, EntityBlueprint> {
  const cells: Record<string, EntityBlueprint> = {};
  const keySet = new Set((level.keys ?? []).map(([c, r]) => `${c},${r}`));
  const { cell, ox, oy } = boardFit(level);
  for (let r = 0; r < level.rows; r++) {
    const row = level.bitmap[r] ?? '';
    for (let c = 0; c < level.cols; c++) {
      const ch = row[c];
      if (!ch || ch === '.') continue;
      const idx = Number(ch);
      if (Number.isNaN(idx)) continue;
      const pc = paletteColor(level, idx);
      const hpCh = level.hp?.[r]?.[c];
      const hp = hpCh && hpCh !== '.' ? Number(hpCh) || 1 : 1;
      const isKey = keySet.has(`${c},${r}`);
      const x = ox + c * (cell + BOARD_GAP) + cell / 2;
      const y = oy + r * (cell + BOARD_GAP) + cell / 2;
      cells[`cell-${c}-${r}`] = {
        Transform: XF(x, y),
        Shape: box(cell - 1, cell - 1),
        Tag: { flags: pc.bit | CELL_BIT | (isKey ? KEY_BIT : 0) },
        Resource: { id: 'hp', current: hp, min: 0, max: hp },
        Color: col(pc.tint, 1),
        Mortal: { resource: 'hp', atOrBelow: 0 }, // hp 归零→自毁（消除·被同色 zap 打掉）
      };
    }
  }
  return cells;
}

// play-field 装饰件（render-only·非 sim 逻辑·design-ref 定尺布局）。金属/圆角/内阴影观感留 S6 Sprite 皮。
function decor(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const rect = (id: string, x: number, y: number, w: number, h: number, tint: number, alpha = 1): void => {
    out[id] = { Transform: XF(x + w / 2, y + h / 2), Shape: box(w, h), Color: col(tint, alpha) };
  };
  // 管道框（分层灰盒近似双轨圆管）。
  rect('pipe-outer', PIPE.x, PIPE.y, PIPE.w, PIPE.h, 0x8891b8);
  rect('pipe-groove', PIPE.x + 13, PIPE.y + 13, PIPE.w - 26, PIPE.h - 26, 0x4a5379);
  rect('pipe-rail', PIPE.x + 22, PIPE.y + 22, PIPE.w - 44, PIPE.h - 44, 0x7e88b0);
  rect('pipe-floor', PIPE.x + 40, PIPE.y + 40, PIPE.w - 80, PIPE.h - 80, 0x3b4468);
  // 像素画窗口底衬（board_picture.png 底图待 S6·此为暗底占位）。
  rect('picture-window', PICTURE.x, PICTURE.y, PICTURE.w, PICTURE.h, PICTURE.bg);
  // 待命槽 ×5（top:956·104×80·left=40+i*118）。
  for (let i = 0; i < level.slots; i++) {
    rect(`tray-slot-${i}`, 40 + i * 118, TRAY.top, TRAY.w, TRAY.h, 0x333a5c);
  }
  // 底部红色操作栏底衬（4 圆钮=PUI chrome）。
  rect('action-bar', ACTION_BAR.x, ACTION_BAR.y, ACTION_BAR.w, ACTION_BAR.h, 0xd1332f);
  return out;
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

// 补给区（design-ref README「Supply — 12 canisters」）：前排 4 个可点色罐 + 后备两排装饰罐。
// 罐身「20」标 + 金属观感 = S6 Sprite（can_<color>.png 皮）；S3 素坯用色块 + 选中金框。
function supplies(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const { colLeft, w, h, frontTop, midTop, backTop } = SUPPLY;
  // 前排（可点开火·每列一色·index 对齐 palette·超出列数则循环取色）。
  // 点炮 → 置 firing_<color> 旗 → SelfRule 每 reload 拍向最近同色格 spawn 命中区 zap（game-q 塔开火同构）。
  // Tag **不带色位**（否则 Perception 会把补给炮当同色目标·自打自）——只有棋盘格带色位。
  colLeft.forEach((lx, i) => {
    const name = level.palette[i % level.palette.length];
    const pc = PALETTE[name];
    if (!pc) return;
    out[`cannon-${name}`] = {
      Transform: XF(lx + w / 2, frontTop + h / 2),
      Shape: box(w - 8, h - 8),
      Color: col(pc.tint, 1),
      Clickable: { action: `fire_${name}`, phase: 'down' },
      Perception: { targetTag: pc.bit | CELL_BIT, sightRadius: FIRE.sightRadius }, // 索最近同色棋盘格→Relation(target)
      Relation: { kind: 'target', targetId: '' },                                   // aggro 写入位（初值空）
      Timer: { id: 'reload', elapsed: 0, duration: FIRE.reload, loop: true },
      SelfRule: {
        whenGlobal: { kind: 'flag', id: `firing_${name}` },                         // 点炮后才开火
        when: { kind: 'timer', id: 'reload', cmp: 'gte', value: FIRE.reload - 1 },  // 装填峰值
        do: [{ kind: 'spawn', template: `zap_${name}`, at: 'target' }],             // 在目标格生成命中区
        once: true, armed: false,
      },
    };
  });
  // 后备两排（装饰·render-only·半透）。
  const reserve = (tag: string, top: number, alpha: number): void => {
    colLeft.forEach((lx, i) => {
      const name = level.palette[(i + 1) % level.palette.length];
      const pc = PALETTE[name];
      if (!pc) return;
      out[`reserve-${tag}-${i}`] = {
        Transform: XF(lx + w / 2, top + h / 2),
        Shape: box(w - 8, h - 8),
        Color: col(pc.tint, alpha),
      };
    });
  };
  reserve('mid', midTop, 0.62);
  reserve('back', backTop, 0.34);
  return out;
}

// 命中判定区模板（zap·game-q zapTemplate 同构）：隐形 Sensor 区·命中同色格扣 hp·consumeOnHit 单发·Timer 兜底回收。
function zapTemplate(pc: typeof PALETTE[string]): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      hit: {
        Transform: XF(0, 0),
        Visibility: { visible: false, active: true },
        Shape: { kind: 'circle', radius: FIRE.zapRadius },
        Color: col(pc.tint, 0),
        Sensor: {},
        Tag: { flags: ZONE_BIT },
        Hitbox: { resource: 'hp', amount: 1, targetMask: pc.bit | CELL_BIT, consumeOnHit: true },
        Timer: { id: 'life', elapsed: 0, duration: FIRE.zapLife, loop: false },
      },
    },
  };
}

// 开火链数据：每色一面 firing 旗 + 点炮信号→置旗 Effect + zap 模板库。
function fireChain(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const templates: Record<string, unknown> = {};
  for (const name of level.palette) {
    const pc = PALETTE[name];
    if (!pc) continue;
    out[`firing-${name}`] = { Flag: { id: `firing_${name}`, active: false } };
    out[`fire-fx-${name}`] = { Effect: { onSignal: `fire_${name}`, kind: 'set-flag', targetId: `firing_${name}`, value: true } };
    templates[`zap_${name}`] = zapTemplate(pc);
  }
  out['prefabs'] = { PrefabLibrary: { seq: 0, templates } };
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
  const { cell, ox, oy } = boardFit(level);
  const doorMarker: EntityBlueprint = level.door
    ? {
        Transform: XF(
          ox + (level.door.col + level.door.w / 2) * (cell + BOARD_GAP),
          oy + (level.door.row + level.door.h / 2) * (cell + BOARD_GAP),
        ),
        Shape: box(level.door.w * cell, level.door.h * cell),
        Color: col(0xf7c948, 0.85),
      }
    : {};
  const entities: Record<string, EntityBlueprint> = {
    // 确定性随机源（关卡 seed → 摆盘/补给出色·禁裸 Math.random）。
    rng: { RandomSeed: { seed: level.seed, sequence: 0 } },
    // 传送带容量区（队首=发射位·outFlag 满位·逻辑不可见）。
    conveyor: {
      Zone: {
        outFlag: 'conveyor_full',
        minX: CONVEYOR.minX, minY: CONVEYOR.minY, maxX: CONVEYOR.maxX, maxY: CONVEYOR.maxY,
        requiredTag: CANNON_BIT, count: level.conveyorCap,
      },
    },
    // 待命槽逻辑件（5 槽·render 槽位由 decor 画）。
    tray: {
      Tray: {
        originX: TRAY.originX, originY: TRAY.originY, gap: TRAY.gap,
        capacity: level.slots, requiredTag: CANNON_BIT,
      },
    },
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
    ...fireChain(level),
    // render 顺序（后画覆盖先画）：装饰底衬 → 补给/后备 → 棋盘格 → 门标。
    ...decor(level),
    ...supplies(level),
    ...boardCells(level),
    'door-marker': doorMarker,
  };

  return {
    capabilities: [
      // atoms
      transformCapability, shapeCapability, tagCapability, colorCapability,
      resourceCapability, flagCapability, randomCapability,
      timerCapability, relationCapability, destroyCapability, overlapDetectCapability,
      // tier1
      lifetimeCapability,
      // tier2 玩法能力
      clickableCapability, groupCountCapability, zoneOccupancyCapability, trayCapability,
      eventWhenCapability, effectApplyCapability, launchCapability, gaugeCapability,
      selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability,
      // tier3
      flowCapability, aggroCapability, prefabCapability,
    ],
    entities,
  };
}
