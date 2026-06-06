import { Engine } from '../runtime/engine.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import type { IWorld, WorldSnapshot } from '@engine/core/types.js';
import type { Camera } from '@engine/protocol/components.js';
import { collectRenderables, getCameraView } from '@renderer/renderable.js';

// ═══════════════════════════════════════════════════════════════
//  ApolloBench —— 执行落地的游戏体检 (借鉴 OpenGame-Bench)
//
//  OpenGame 的核心洞见：别信 LLM 写的代码，**跑起来验**——启动游戏、驱动它、核验可玩性
//  (渲染/操作/循环推进/胜负)，按 Build Health / Visual Usability / Intent Alignment 打分。
//  这正是本项目的老软肋(从没在浏览器里看过一帧)。这里把它"拿过来"成无浏览器也能跑的数据级体检：
//  把每份蓝图喂进真实引擎、跑 N tick、从世界状态核验。
//
//  轴(权重合 100)：
//    Structure   装配/意图：能力+实体+(空间游戏要相机&可渲染 / 非空间要展示内容)。  ≈ Intent Alignment
//    Load        能否加载成世界。                                                  ≈ Build Health
//    Determinism 两次独立跑到同 tick hash 一致(本引擎 lockstep 签名，OpenGame 没有)。
//    Numeric     跑完无 NaN/∞(抓物理炸裂/除零)。
//    Visual      数据级"看得见"代理：空间游戏看渲染项是否有限且落在视口内；非空间游戏看展示内容存在。 ≈ Visual Usability
//
//  诚实边界：真·视觉可用性(像素/VLM 评审)仍需浏览器，本体检是其数据级代理(见 docs/ref/opengame.md)。
// ═══════════════════════════════════════════════════════════════

export interface BenchAxis {
  name: string;
  score: number;
  max: number;
  notes: string[];
}
export interface BenchReport {
  game: string;
  total: number; // 0..100
  passed: boolean;
  spatial: boolean;
  evolves: boolean; // tick 后世界状态是否变化(信息项，不计分：VN 无输入可不变)
  axes: BenchAxis[];
}

const TICKS = 120;
const PASS = 70;

type Comps = Record<string, Record<string, unknown>>;

function isSpatial(bp: WorldBlueprint): boolean {
  return Object.values(bp.entities as unknown as Record<string, Comps[string]>).some(
    (c) => 'Transform' in (c as object),
  );
}

function entityComps(bp: WorldBlueprint): Array<Record<string, unknown>> {
  return Object.values(bp.entities as unknown as Record<string, Record<string, unknown>>);
}

function hasAnyComponent(bp: WorldBlueprint, types: string[]): boolean {
  return entityComps(bp).some((c) => types.some((t) => t in c));
}

// 递归找非有限数值，路径记到 bad。
function scanNonFinite(v: unknown, path: string, bad: string[]): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) bad.push(path);
    return;
  }
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      scanNonFinite(val, `${path}.${k}`, bad);
    }
  }
}

function collectNonFinite(snap: WorldSnapshot): string[] {
  const bad: string[] = [];
  for (const [eid, comps] of Object.entries(snap)) {
    for (const [ct, data] of Object.entries(comps as Record<string, unknown>)) {
      scanNonFinite(data, `${eid}.${ct}`, bad);
    }
  }
  return bad;
}

function viewportOf(world: IWorld): { w: number; h: number } {
  for (const [e] of world.query('Camera')) {
    const c = world.getComponent<Camera>(e, 'Camera');
    if (c) return { w: c.viewportW || 640, h: c.viewportH || 400 };
  }
  return { w: 640, h: 400 };
}

function runToTick(build: () => WorldBlueprint): Engine {
  const e = new Engine({ tickRate: 60 });
  e.load(build());
  for (let i = 0; i < TICKS; i++) e.world.tick();
  return e;
}

/** 给一份蓝图打体检分。build 须每次产新蓝图(determinism 要独立两跑)。 */
export function benchBlueprint(game: string, build: () => WorldBlueprint): BenchReport {
  const axes: BenchAxis[] = [];
  const bp0 = build();
  const spatial = isSpatial(bp0);

  // ── Structure（意图/装配，静态） ──
  {
    const notes: string[] = [];
    let pass = 0;
    let total = 0;
    const check = (ok: boolean, label: string) => {
      total++;
      if (ok) pass++;
      else notes.push(`缺：${label}`);
    };
    check((bp0.capabilities?.length ?? 0) > 0, '能力(capabilities)');
    check(Object.keys(bp0.entities).length > 0, '实体');
    if (spatial) {
      check(hasAnyComponent(bp0, ['Camera']), '相机');
      check(
        entityComps(bp0).some(
          (c) => 'Transform' in c && ('Shape' in c || 'Sprite' in c || 'Text' in c),
        ),
        '可渲染实体(Transform+Shape/Sprite/Text)',
      );
    } else {
      check(hasAnyComponent(bp0, ['Text', 'Resource', 'State', 'Flag']), '展示内容(Text/Resource/State/Flag)');
      notes.push('非空间游戏：视觉由自定义 UI 承载，非 ECS 画布');
    }
    axes.push({ name: 'Structure', score: Math.round((20 * pass) / total), max: 20, notes });
  }

  // ── Load ──
  let world: Engine['world'] | null = null; // 具体 World(含 tick/snapshot)，IWorld 只是只读视图
  {
    const notes: string[] = [];
    let ok = false;
    try {
      const e = new Engine({ tickRate: 60 });
      e.load(bp0);
      world = e.world;
      ok = world.getAllEntities().length > 0;
      if (!ok) notes.push('load 后世界为空');
    } catch (err) {
      notes.push(`load 抛异常：${(err as Error).message}`);
    }
    axes.push({ name: 'Load', score: ok ? 15 : 0, max: 15, notes });
  }

  // ── 在已加载世界上跑 ticks（供 Numeric / Visual 评估） ──
  let snapBefore: WorldSnapshot = {};
  let snapAfter: WorldSnapshot = {};
  let runOk = false;
  if (world) {
    try {
      snapBefore = world.snapshot();
      for (let i = 0; i < TICKS; i++) world.tick();
      snapAfter = world.snapshot();
      runOk = true;
    } catch {
      runOk = false;
    }
  }
  const evolves = JSON.stringify(snapBefore) !== JSON.stringify(snapAfter);

  // ── Determinism（lockstep 签名） ──
  {
    const notes: string[] = [];
    let det = false;
    try {
      const a = runToTick(build);
      const b = runToTick(build);
      det = a.hash() === b.hash();
      if (!det) notes.push('两次独立跑到同 tick，hash 不一致');
    } catch (err) {
      notes.push(`determinism 跑挂：${(err as Error).message}`);
    }
    axes.push({ name: 'Determinism', score: det ? 20 : 0, max: 20, notes });
  }

  // ── Numeric（无 NaN/∞） ──
  {
    const notes: string[] = [];
    let score = 0;
    if (!runOk) {
      notes.push('未能运行 ticks');
    } else {
      const bad = collectNonFinite(snapAfter);
      if (bad.length === 0) score = 20;
      else notes.push(`非有限数值：${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` …(+${bad.length - 5})` : ''}`);
    }
    axes.push({ name: 'Numeric', score, max: 20, notes });
  }

  // ── Visual（数据级"看得见"代理） ──
  {
    const notes: string[] = [];
    let score = 0;
    if (!world || !runOk) {
      notes.push('未能运行，无法评估');
    } else if (spatial) {
      const rs = collectRenderables(world);
      const finite = rs.every((r) => Number.isFinite(r.x) && Number.isFinite(r.y));
      if (rs.length > 0) score += 5;
      else notes.push('空间游戏却无可渲染实体(没东西画)');
      if (rs.length > 0 && finite) score += 10;
      else if (rs.length > 0) notes.push('有渲染项坐标非有限(NaN/∞)');
      const cam = getCameraView(world);
      const { w, h } = viewportOf(world);
      const onScreen = rs.some((r) => {
        const sx = cam ? w / 2 + (r.x - cam.centerX) * cam.zoom : r.x;
        const sy = cam ? h / 2 + (r.y - cam.centerY) * cam.zoom : r.y;
        return sx >= -50 && sx <= w + 50 && sy >= -50 && sy <= h + 50;
      });
      if (onScreen) score += 10;
      else if (rs.length > 0) notes.push('没有任何渲染项落在视口内(全在画面外)');
    } else {
      const hasContent = hasAnyComponent(bp0, ['Text', 'Resource', 'State', 'Flag']);
      score = hasContent ? 25 : 0;
      notes.push('非空间游戏：ECS 画布视觉 N/A；真·视觉可用性需浏览器+VLM(见 docs/ref/opengame.md)');
    }
    axes.push({ name: 'Visual', score, max: 25, notes });
  }

  const total = axes.reduce((s, a) => s + a.score, 0);
  return { game, total: Math.round(total), passed: total >= PASS, spatial, evolves, axes };
}

export const BENCH_PASS_THRESHOLD = PASS;
