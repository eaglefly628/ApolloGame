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
import { motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability } from '@skills/tier1/index.js';
import {
  clickableCapability, groupCountCapability, effectApplyCapability, launchCapability, pathFollowCapability, pathFollowAt,
  selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability, eventWhenCapability, textBindingCapability,
} from '@skills/tier2/index.js';
import { flowCapability, aggroCapability, prefabCapability, casterCapability } from '@skills/tier3/index.js';
import {
  PALETTE, CELL_BIT, CANNON_BIT, KEY_BIT, BELT_BIT, TRAY_BIT, ZONE_BIT, FIRE, FIELD_W, CONFIG,
  PIPE, PICTURE, BOARD_PAD, BOARD_GAP, TRAY, ACTION_BAR,
} from './theme.js';
import type { Level } from './levels.js';
import { LEVEL_1 } from './levels.js';

const XF = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const box = (w: number, h: number): Record<string, unknown> => ({ kind: 'box', width: w, height: h });
const circle = (r: number): Record<string, unknown> => ({ kind: 'circle', radius: r });
const col = (tint: number, alpha = 1): Record<string, unknown> => ({ tint, alpha });

// ── 环形轨道（core-experience-v2 §2.1·实机三图 IMG_6064）：绕像素画一周的跑道·色炮 PathFollow 沿它跑一圈 ──
// 轨道矩形 = PICTURE 外扩 margin（骑在管道内轨、包住画面）。**出发点=弹簧（左下角·约7点）**，实机流向：
// 下沿→右 · 右沿→上 · 上沿→左 · 左沿→下 · 回到弹簧收尾（loop:false·一圈即停在弹簧口→退役入平台）。
const TRACK_MARGIN = 34;      // 轨道离像素画外沿的间距（px·炮体贴着外沿向内开火）
const TRACK_STEP = 44;        // 航点采样步长（px·越小越贴合矩形）
const SPRING = { x: PICTURE.x - TRACK_MARGIN, y: PICTURE.y + PICTURE.h + TRACK_MARGIN } as const; // 弹簧口=轨道左下角（出发/收尾）
function trackWaypoints(): { x: number; y: number }[] {
  const x0 = PICTURE.x - TRACK_MARGIN, y0 = PICTURE.y - TRACK_MARGIN;
  const x1 = PICTURE.x + PICTURE.w + TRACK_MARGIN, y1 = PICTURE.y + PICTURE.h + TRACK_MARGIN;
  const wp: { x: number; y: number }[] = [];
  const edge = (ax: number, ay: number, bx: number, by: number): void => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / TRACK_STEP));
    for (let i = 0; i < n; i++) { const t = i / n; wp.push({ x: Math.round(ax + (bx - ax) * t), y: Math.round(ay + (by - ay) * t) }); }
  };
  edge(x0, y1, x1, y1); // 下沿（→·从弹簧出发向右）
  edge(x1, y1, x1, y0); // 右沿（↑）
  edge(x1, y0, x0, y0); // 上沿（←）
  edge(x0, y0, x0, y1); // 左沿（↓·回到弹簧）
  wp.push({ x: x0, y: y1 });  // 收尾=弹簧口（loop:false 停在此→退役入平台）
  return wp;
}

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
        // hp 归零→消除；钥匙格掉 keyblip(计分+钥匙+1)，普通格掉 scoreblip(计分)。
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: isKey ? 'keyblip' : 'scoreblip' },
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

// 位图逐色像素数（递进队列按此守恒配炮）。
function colorCounts(level: Level): Record<string, number> {
  const cnt: Record<string, number> = {};
  for (const row of level.bitmap) for (const ch of row) {
    if (!ch || ch === '.') continue;
    const idx = Number(ch); if (Number.isNaN(idx)) continue;
    const name = level.palette[idx]; if (name) cnt[name] = (cnt[name] ?? 0) + 1;
  }
  return cnt;
}
// 待发弹库 = **递进队列**（core-gameplay §2）：由像素图逐色格数守恒配炮（每色 ceil(格数/ammo) 门·打蛋器图标+弹数）。
// 每门**独立可点部署**（唯一 deploy_i 信号·点→Caster 生成上带色炮 + Effect 自毁本槽=消费）。非无限分发器。
const POOL = { top: 1052, rowH: 66, perRow: 6, marginX: 46 } as const;
function deployQueue(level: Level): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const counts = colorCounts(level);
  // 按 palette 顺序（外→内约定序）展开每色所需炮数。
  const queue: string[] = [];
  for (const name of level.palette) {
    const need = Math.ceil((counts[name] ?? 0) / Math.max(1, level.ammo));
    for (let k = 0; k < need; k++) queue.push(name);
  }
  const gapX = (FIELD_W - POOL.marginX * 2) / (POOL.perRow - 1);
  queue.forEach((name, i) => {
    const pc = PALETTE[name];
    if (!pc) return;
    const cx = POOL.marginX + (i % POOL.perRow) * gapX;
    const cy = POOL.top + Math.floor(i / POOL.perRow) * POOL.rowH;
    const sig = `deploy_${i}`;
    out[`pool-${i}`] = {
      Transform: XF(cx, cy),
      Shape: box(CG.bodyW, CG.bodyH),
      Color: col(pc.tint, 1),
      Clickable: { action: sig, phase: 'down' },
      Caster: { onSignal: sig, at: 'self', template: `cannon_${name}` },   // 点→在此位生成上带色炮（PathFollow 驾其上轨）
      Effect: { onSignal: sig, kind: 'destroy', targetEntity: '@signal-source', value: true }, // 消费本槽（递进队列取走）
    };
    const parts = eggBeaterParts(`pool-${i}`, pc.tint, level.ammo, false);
    for (const [k, v] of Object.entries(parts)) out[`pool-${i}-${k}`] = v;
  });
  return out;
}

// ── 炮台矢量图（打蛋器·实机特写 IMG_6063）：圆角方体炮身 + 顶部两根竖柱（打蛋器丝）+ 面上动态弹数 ──
// 渲染器只有 box/circle/text → 用 box 近似圆角方体、两 box 作竖柱、Text+text-binding 投 ammo 到面上。
// 竖柱/弹数皆 hierarchy 子件（parentId=同模板 '@local:body'）→ 随炮身移动；hierarchy-cascade 随炮身销毁。
const CG = { bodyW: 46, bodyH: 54, prongW: 12, prongH: 24, prongDX: 13, prongDY: -30, numSize: 26 } as const;
const hkid = (parentRef: string, lx: number, ly: number): Record<string, unknown> =>
  ({ parentId: parentRef, localX: lx, localY: ly, localRotation: 0, localScaleX: 1, localScaleY: 1 });
// 打蛋器竖柱×2 + 面上弹数（子件·挂 parentRef 下）。bindAmmo=true → 数字随宿主 ammo 实时（text-binding fromParent）。
function eggBeaterParts(parentRef: string, tint: number, ammo: number, bindAmmo: boolean): Record<string, EntityBlueprint> {
  return {
    prongL: { Transform: XF(0, 0), Hierarchy: hkid(parentRef, -CG.prongDX, CG.prongDY), Shape: box(CG.prongW, CG.prongH), Color: col(tint, 1) },
    prongR: { Transform: XF(0, 0), Hierarchy: hkid(parentRef, CG.prongDX, CG.prongDY), Shape: box(CG.prongW, CG.prongH), Color: col(tint, 1) },
    num: {
      Transform: XF(0, 0), Hierarchy: hkid(parentRef, 0, 3),
      Text: { content: String(ammo), fontSize: CG.numSize, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: col(0xffffff, 1),
      ...(bindAmmo ? { TextBinding: { resourceId: 'ammo', fromParent: true } } : {}),
    },
  };
}

// prefab 模板库：每色一套 cannon(上带·连喷 ammo 发)/bullet(可见子弹·单格)/tray(弹尽入槽·点击复用)。
function prefabs(level: Level): Record<string, EntityBlueprint> {
  const templates: Record<string, unknown> = {};
  for (const name of level.palette) {
    const pc = PALETTE[name];
    if (!pc) continue;
    // 上带色炮（环形轨道·实机核心）：生成于补给口 → PathFollow 驾其**绕像素画一周**（可见于轨道上）；
    // 绕行中 aggro 只锁 sightRadius 内（=当前所经边外沿）同色格 → 每 reload 拍 ①炮口喷可见曳光弹 ②在该格
    // 生成即时命中区结算消除（过位剥离·从外向里啃）③ammo(巡逻预算)-1 → 预算尽 Mortal 自毁掉一门 tray 炮。
    // 选错色/该边无暴露同色 → sightRadius 内无目标 → 不开火（at:'target' 天然跳过）→ 绕一圈啥也没打。
    templates[`cannon_${name}`] = { entities: {
      body: {
        Transform: XF(0, 0), // 落点=补给口（prefab 展开时按 spawn 位偏移）→ PathFollow 驾其从弹簧上轨绕一圈
        Shape: box(CG.bodyW, CG.bodyH), // 打蛋器圆角方体炮身（近似）
        Color: col(pc.tint, 1),
        Tag: { flags: CANNON_BIT | BELT_BIT },
        Resource: { id: 'ammo', current: level.ammo, min: -1, max: level.ammo },
        Perception: { targetTag: pc.bit, sightRadius: FIRE.sightRadius }, // 有限视野=只打当前经过边的暴露同色（过位剥离）
        Relation: { kind: 'target', targetId: '' },
        // 从弹簧口出发沿轨道跑**一圈**（loop:false·跑完停在弹簧口→由 Mortal 退役入平台）。PathFollow 写 Velocity。
        PathFollow: pathFollowAt(trackWaypoints(), FIRE.moveSpeed, { loop: false, arriveRadius: FIRE.moveSpeed + 2 }),
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Timer: { id: 'reload', elapsed: 0, duration: FIRE.reload, loop: true },
        // 逐发喷子弹：每 reload 拍 ①在炮口发可见曳光(tracer·飞向暴露同色) ②在该同色格生成即时命中区结算消除。
        // ⚠ per-shot 扣弹待引擎 REQ-SPENDONFIRE 落地（现 ammo 为巡逻预算·每拍-1·近似绕一圈退役；面上数字先按此显示）。
        SelfRule: {
          when: { kind: 'and', of: [
            { kind: 'timer', id: 'reload', cmp: 'gte', value: FIRE.reload - 1 }, // 装填峰值
            { kind: 'resource', id: 'ammo', cmp: 'gte', value: 0 },
          ] },
          do: [
            { kind: 'spawn', template: `bullet_${name}`, at: 'target' }, // 即时命中结算（确定性消除·逐发重锁）
            { kind: 'modify-resource', op: 'add', value: -1 },
          ],
          once: true, armed: false,
        },
        Mortal: { resource: 'ammo', atOrBelow: -1, dropTemplate: `tray_${name}` }, // 巡逻尽→退役入待命平台
      },
      // 曳光发射口（invisible·随炮身移动·同 reload 节拍发可见曳光弹）。一实体一 SpawnRequest·body 那拍已被 bullet
      // 占用 → 曳光挂此独立子件发射·不与 body 争 SpawnRequest。
      emitter: {
        Transform: XF(0, 0),
        Hierarchy: hkid('@local:body', 0, 0),
        Timer: { id: 'muzzle', elapsed: 0, duration: FIRE.reload, loop: true },
        SelfRule: {
          when: { kind: 'timer', id: 'muzzle', cmp: 'gte', value: FIRE.reload - 1 },
          do: [ { kind: 'spawn', template: `tracer_${name}`, at: 'self' } ],
          once: true, armed: false,
        },
      },
      // 打蛋器双竖柱 + 面上动态弹数（随 body.ammo 实时·text-binding fromParent）。
      ...eggBeaterParts('@local:body', pc.tint, level.ammo, true),
    } };
    // 可见曳光弹（render-only·无 Hitbox/Sensor）：从炮口发射、朝最近同色格直飞、寿命到自毁。只做可见弹道，
    // 不参与消除结算（消除由 bullet 即时命中区确定性完成）→ 不影响 sim 计数/胜负（验收剧本数不变）。
    templates[`tracer_${name}`] = { entities: { t: {
      Transform: XF(0, 0),
      Shape: circle(FIRE.bulletRadius),
      Color: col(pc.tint, 1),
      Launch: { speed: FIRE.bulletSpeed / 6, toward: 'target', targetMask: pc.bit },
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Timer: { id: 'life', elapsed: 0, duration: 24, loop: false },
    } } };
    // 子弹命中：在"当前最近同色格"生成即时命中区（aggro 每拍重锁 → 逐发打不同格·一发一格·无穿隧）。
    templates[`bullet_${name}`] = { entities: { b: {
      Transform: XF(0, 0),
      Shape: circle(FIRE.bulletRadius),
      Color: col(pc.tint, 0.9),
      Sensor: {},
      Tag: { flags: ZONE_BIT },
      Hitbox: { resource: 'hp', amount: 1, targetMask: pc.bit, consumeOnHit: true },
      Timer: { id: 'life', elapsed: 0, duration: FIRE.bulletLife, loop: false },
    } } };
    // 待命槽炮（返回平台态·打蛋器图标同款）：点它 → Caster 重新部署一门满弹上带炮（redeploy-fx 同信号自毁本槽炮）。
    templates[`tray_${name}`] = { entities: {
      slot: {
        Transform: XF(0, 0),
        Shape: box(CG.bodyW, CG.bodyH),
        Color: col(pc.tint, 0.9),
        Tag: { flags: CANNON_BIT | TRAY_BIT },
        Resource: { id: 'ammo', current: level.ammo, min: -1, max: level.ammo }, // 面上弹数（返回态·静态显示）
        Clickable: { action: 'tapSlot', phase: 'down' },
        Caster: { onSignal: 'tapSlot', at: 'self', template: `cannon_${name}` },
      },
      ...eggBeaterParts('@local:slot', pc.tint, level.ammo, true),
    } };
  }
  // 计分粒子：像素块消除时 Mortal 掉此件 → ResourceModify 全局 +SCORE_CLEAR → 1 拍后自毁。
  templates['scoreblip'] = { entities: { s: {
    Transform: XF(0, 0),
    ResourceModify: { resourceId: 'score', amount: CONFIG.SCORE_CLEAR, scope: 'global' },
    Timer: { id: 'life', elapsed: 0, duration: 1, loop: false },
  } } };
  // 钥匙粒子：钥匙格消除时掉此件 → 计分 + 钥匙 +1（两粒·各一 ResourceModify·全局）。
  templates['keyblip'] = { entities: {
    s: { Transform: XF(0, 0), ResourceModify: { resourceId: 'score', amount: CONFIG.SCORE_CLEAR, scope: 'global' }, Timer: { id: 'life', elapsed: 0, duration: 1, loop: false } },
    k: { Transform: XF(0, 0), ResourceModify: { resourceId: 'keys', amount: 1, scope: 'global' }, Timer: { id: 'life', elapsed: 0, duration: 1, loop: false } },
  } };
  return { prefabs: { PrefabLibrary: { seq: 0, templates } } };
}

// 计量 + moves + 钥匙/门 + 复用自毁 Effect。
function meters(level: Level): Record<string, EntityBlueprint> {
  const doorGoal = level.goals.find((g) => g.kind === 'door') as { needKeys: number } | undefined;
  const keyGoal = level.goals.find((g) => g.kind === 'keys') as { n: number } | undefined;
  const needKeys = doorGoal?.needKeys ?? keyGoal?.n ?? (level.keys?.length ?? 0);
  const out: Record<string, EntityBlueprint> = {
    score: { Resource: { id: 'score', current: 0, min: 0, max: 9_999_999 } },
    combo: { Resource: { id: 'combo', current: 0, min: 0, max: 999 } },
    moves: { Resource: { id: 'moves', current: level.limit.kind === 'moves' ? level.limit.n : 9999, min: 0, max: 9999 } },
    keys: { Resource: { id: 'keys', current: 0, min: 0, max: 999 } },
    doorflag: { Flag: { id: 'doorOpen', active: false } },
  };
  // tapSlot → 销毁被点的 tray 炮（@signal-source）；同信号 tray 炮身上的 Caster 已生成满弹上带炮。
  out['redeploy-fx'] = { Effect: { onSignal: 'tapSlot', kind: 'destroy', targetEntity: '@signal-source', value: true } };
  // 每色 tapSupply → moves-1（gdd：取炮 = 1 move）。
  for (const name of level.palette) {
    out[`move-fx-${name}`] = { Effect: { onSignal: `tapSupply_${name}`, kind: 'modify-resource', targetId: 'moves', op: 'add', value: -1 } };
  }
  // 钥匙集齐 needKeys → 发 open_door 信号 → 置 doorOpen 旗（gdd §2.4·event-when 边沿 + effect-apply）。
  if (needKeys > 0) {
    out['door-when'] = { EventWhen: { signal: 'open_door', when: { kind: 'resource', id: 'keys', cmp: 'gte', value: needKeys }, mode: 'edge' } };
    out['door-open-fx'] = { Effect: { onSignal: 'open_door', kind: 'set-flag', targetId: 'doorOpen', value: true } };
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
    ...deployQueue(level),
    ...boardCells(level),
    'door-marker': doorMarker,
  };

  return {
    capabilities: [
      // atoms
      transformCapability, shapeCapability, tagCapability, colorCapability,
      resourceCapability, flagCapability, randomCapability, velocityCapability,
      timerCapability, relationCapability, destroyCapability, overlapDetectCapability,
      // tier1（子弹运动 + 生命期 + 炮口子件挂接/级联销毁）
      motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability,
      // tier2 玩法能力
      clickableCapability, groupCountCapability, effectApplyCapability, launchCapability, pathFollowCapability,
      selfRuleCapability, hitboxCapability, mortalCapability, triggerZoneCapability, eventWhenCapability, textBindingCapability,
      // tier3（生成 + 索敌 + 流程）
      flowCapability, aggroCapability, prefabCapability, casterCapability,
    ],
    entities,
  };
}
