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
  resourceCapability, flagCapability, randomCapability, velocityCapability,
  timerCapability, relationCapability, destroyCapability, overlapDetectCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability } from '@skills/tier1/index.js';
import {
  clickableCapability, groupCountCapability, effectApplyCapability, launchCapability,
  selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability,
} from '@skills/tier2/index.js';
import { flowCapability, aggroCapability, prefabCapability, casterCapability } from '@skills/tier3/index.js';
import {
  PALETTE, CELL_BIT, CANNON_BIT, KEY_BIT, BELT_BIT, TRAY_BIT, ZONE_BIT, FIRE, FIELD_W,
  PIPE, PICTURE, BOARD_PAD, BOARD_GAP, TRAY, SUPPLY, ACTION_BAR,
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

// group-count 计数器（机读态·对齐验收剧本 remain.*/conveyor.count/tray.count）：
//   remain.<color>=在板同色格 · remain.total=全盘格 · conveyor.count=带上炮 · tray.count=槽中炮。
function counters(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const name of level.palette) {
    const pc = PALETTE[name];
    if (!pc) continue;
    out[`remain-${name}`] = {
      GroupCount: { countResource: `remain.${name}`, requiredTag: pc.bit | CELL_BIT },
      Resource: { id: `remain.${name}`, current: 0, min: 0, max: 99999 },
    };
  }
  out['remain-total'] = {
    GroupCount: { countResource: 'remain.total', requiredTag: CELL_BIT },
    Resource: { id: 'remain.total', current: 0, min: 0, max: 99999 },
  };
  out['conveyor-count'] = {
    GroupCount: { countResource: 'conveyor.count', requiredTag: CANNON_BIT | BELT_BIT },
    Resource: { id: 'conveyor.count', current: 0, min: 0, max: 999 },
  };
  out['tray-count'] = {
    GroupCount: { countResource: 'tray.count', requiredTag: CANNON_BIT | TRAY_BIT },
    Resource: { id: 'tray.count', current: 0, min: 0, max: 999 },
  };
  return out;
}

// 补给区：每色一个**可点分发器**（点→Caster 生成一门"上带色炮"·= 1 move·gdd §1）。reserve 两排装饰保留。
function supplies(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const { colLeft, w, h, frontTop, midTop, backTop } = SUPPLY;
  const n = level.palette.length;
  const spanL = 40, spanR = FIELD_W - 40 - w;
  level.palette.forEach((name, i) => {
    const pc = PALETTE[name];
    if (!pc) return;
    const lx = n > 1 ? Math.round(spanL + (spanR - spanL) * (i / (n - 1))) : spanL;
    out[`supply-${name}`] = {
      Transform: XF(lx + w / 2, frontTop + h / 2),
      Shape: box(w - 8, h - 8),
      Color: col(pc.tint, 1),
      Clickable: { action: `tapSupply_${name}`, phase: 'down' },
      Caster: { onSignal: `tapSupply_${name}`, at: 'self', template: `cannon_${name}` },
    };
  });
  const reserve = (tag: string, top: number, alpha: number): void => {
    colLeft.forEach((lx, i) => {
      const name = level.palette[(i + 1) % level.palette.length];
      const pc = PALETTE[name];
      if (!pc) return;
      out[`reserve-${tag}-${i}`] = { Transform: XF(lx + w / 2, top + h / 2), Shape: box(w - 8, h - 8), Color: col(pc.tint, alpha) };
    });
  };
  reserve('mid', midTop, 0.62);
  reserve('back', backTop, 0.34);
  return out;
}

// prefab 模板库：每色一套 cannon(上带·连喷 ammo 发)/bullet(可见子弹·单格)/tray(弹尽入槽·点击复用)。
function prefabs(level: Level): Record<string, EntityBlueprint> {
  const templates: Record<string, unknown> = {};
  const { w, h } = SUPPLY;
  for (const name of level.palette) {
    const pc = PALETTE[name];
    if (!pc) continue;
    // 上带色炮：ammo 发 → 每 reload 拍喷 1 发子弹打最近同色 + ammo-1 → 弹尽(ammo≤0) Mortal 自毁掉一门 tray 炮。
    templates[`cannon_${name}`] = { entities: { body: {
      Transform: XF(0, 0),
      Shape: box(w - 8, h - 8),
      Color: col(pc.tint, 1),
      Tag: { flags: CANNON_BIT | BELT_BIT },
      Resource: { id: 'ammo', current: level.ammo, min: -1, max: level.ammo },
      Perception: { targetTag: pc.bit, sightRadius: FIRE.sightRadius },
      Relation: { kind: 'target', targetId: '' },
      Timer: { id: 'reload', elapsed: 0, duration: FIRE.reload, loop: true },
      // 逐发喷子弹：ammo≥0 时每 reload 拍向最近同色格 spawn 子弹 + ammo-1。fire ammo+1 次·最后一发（ammo0→-1）
      // 恰被同拍 Mortal(atOrBelow:-1) 回收（生成实体死于同拍·确定性）→ 净落弹 = ammo·弹尽入槽（弹尽入槽时序）。
      SelfRule: {
        when: { kind: 'and', of: [
          { kind: 'timer', id: 'reload', cmp: 'gte', value: FIRE.reload - 1 }, // 装填峰值
          { kind: 'resource', id: 'ammo', cmp: 'gte', value: 0 },             // 含最后一发缓冲
        ] },
        do: [ { kind: 'spawn', template: `bullet_${name}`, at: 'target' }, { kind: 'modify-resource', op: 'add', value: -1 } ],
        once: true, armed: false,
      },
      Mortal: { resource: 'ammo', atOrBelow: -1, dropTemplate: `tray_${name}` },
    } } };
    // 子弹命中：在"当前最近同色格"生成即时命中区（aggro 每拍重锁 → 逐发打不同格·一发一格·无穿隧）。
    templates[`bullet_${name}`] = { entities: { b: {
      Transform: XF(0, 0),
      Shape: { kind: 'circle', radius: FIRE.bulletRadius },
      Color: col(pc.tint, 0.9),
      Sensor: {},
      Tag: { flags: ZONE_BIT },
      Hitbox: { resource: 'hp', amount: 1, targetMask: pc.bit, consumeOnHit: true },
      Timer: { id: 'life', elapsed: 0, duration: FIRE.bulletLife, loop: false },
    } } };
    // 待命槽炮：弹尽入槽·点它 → Caster 重新部署一门满弹上带炮（redeploy-fx 同信号自毁本槽炮）。
    templates[`tray_${name}`] = { entities: { slot: {
      Transform: XF(0, 0),
      Shape: box(w - 8, h - 8),
      Color: col(pc.tint, 0.85),
      Tag: { flags: CANNON_BIT | TRAY_BIT },
      Clickable: { action: 'tapSlot', phase: 'down' },
      Caster: { onSignal: 'tapSlot', at: 'self', template: `cannon_${name}` },
    } } };
  }
  return { prefabs: { PrefabLibrary: { seq: 0, templates } } };
}

// 计量 + moves + 复用自毁 Effect。
function meters(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {
    score: { Resource: { id: 'score', current: 0, min: 0, max: 9_999_999 } },
    combo: { Resource: { id: 'combo', current: 0, min: 0, max: 999 } },
    moves: { Resource: { id: 'moves', current: level.limit.kind === 'moves' ? level.limit.n : 9999, min: 0, max: 9999 } },
  };
  // tapSlot → 销毁被点的 tray 炮（@signal-source）；同信号 tray 炮身上的 Caster 已生成满弹上带炮。
  out['redeploy-fx'] = { Effect: { onSignal: 'tapSlot', kind: 'destroy', targetEntity: '@signal-source', value: true } };
  // 每色 tapSupply → moves-1（gdd：取炮 = 1 move）。
  for (const name of level.palette) {
    out[`move-fx-${name}`] = { Effect: { onSignal: `tapSupply_${name}`, kind: 'modify-resource', targetId: 'moves', op: 'add', value: -1 } };
  }
  return out;
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
  const movesLimit = level.limit.kind === 'moves';
  const entities: Record<string, EntityBlueprint> = {
    // 确定性随机源（关卡 seed·禁裸 Math.random）。
    rng: { RandomSeed: { seed: level.seed, sequence: 0 } },
    // 关卡流程：清空全部像素块 → victory；moves 尽仍有格 → defeat（首拍 remain.total=0 是"未填充"假象·after≥2 再判）。
    flow: {
      GameFlow: {
        id: 'main',
        current: 'playing',
        states: [
          { id: 'playing', transitions: [
            { when: { kind: 'resource', id: 'remain.total', cmp: 'lte', value: 0 }, after: 2, to: 'victory' },
            ...(movesLimit ? [{ when: { kind: 'and', of: [
              { kind: 'resource', id: 'moves', cmp: 'lte', value: 0 },
              { kind: 'resource', id: 'remain.total', cmp: 'gte', value: 1 },
            ] }, after: 2, to: 'defeat' }] : []),
          ] },
          { id: 'victory' },
          { id: 'defeat' },
        ],
      },
    },
    ...meters(level),
    ...counters(level),
    ...prefabs(level),
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
      resourceCapability, flagCapability, randomCapability, velocityCapability,
      timerCapability, relationCapability, destroyCapability, overlapDetectCapability,
      // tier1（子弹运动 + 生命期）
      motionApplyCapability, lifetimeCapability,
      // tier2 玩法能力
      clickableCapability, groupCountCapability, effectApplyCapability, launchCapability,
      selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability,
      // tier3（生成 + 索敌 + 流程）
      flowCapability, aggroCapability, prefabCapability, casterCapability,
    ],
    entities,
  };
}
