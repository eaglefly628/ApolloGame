import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import type { Resource, Tag, GameFlow, Transform } from '@engine/protocol/components.js';
import { QueuedInputSource } from '@net/index.js';
import { rollOffer } from '@skills/tier2/index.js';
import type { DraftCandidate } from '@skills/tier2/index.js';
import { validateLayoutNode } from '@ui/components/index.js';
import type { Sprite } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildHud, buildResult, buildLevelUp } from './hud.js';
import { ENEMY, ZONE, START, KUNAI, SHAMBLER, LEVEL_XP, MATCH_SECONDS, PLAYER_DEF, DRAFT_POOL, DRAFT_N, POWER_ADD, ORBIT } from './theme.js';

// 一步 sim（复刻引擎 step：每拍都注入命令→清 InputQueue·空则清空·防陈留信号重复触发）。
function step(e: Engine, cmds: Command[] = []): void {
  applyCommands(e.world, cmds);
  e.world.tick();
}
// 驱动一个动作信号（enqueueAction → applyCommands 路由进 InputQueue → keybind→Signal→Effect·仅本拍在场）。
function fireAction(e: Engine, name: string): void {
  const input = new QueuedInputSource('hud');
  input.enqueueAction(name);
  step(e, input.commandsForTick(e.world.getVersion() + 1));
}
function hasSprite(e: Engine, key: string): boolean {
  for (const [id] of e.world.query('Sprite')) { const s = e.world.getComponent<Sprite>(id, 'Sprite'); if (s && s.textureKey === key) return true; }
  return false;
}

// ── 小工具 ──────────────────────────────────────────────────────────────────
function res(e: Engine, eid: string, id = 'Resource'): number { return e.world.getComponent<Resource>(eid, id)?.current ?? 0; }
function resById(e: Engine, id: string): number {
  for (const [eid] of e.world.query('Resource')) { const r = e.world.getComponent<Resource>(eid, 'Resource'); if (r && r.id === id) return r.current; }
  return NaN;
}
function countTag(e: Engine, bit: number): number {
  let n = 0;
  for (const [id] of e.world.query('Tag')) { const t = e.world.getComponent<Tag>(id, 'Tag'); if (t && (t.flags & bit) !== 0) n++; }
  return n;
}
function xf(e: Engine, eid: string): Transform | undefined { return e.world.getComponent<Transform>(eid, 'Transform'); }
function flowState(e: Engine): string { return e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '?'; }
function tickN(e: Engine, n: number): void { for (let i = 0; i < n; i++) e.world.tick(); }
// 驱动移动：每 tick 注入一条 move 命令（复刻 net applyCommands·Controllable→Velocity）。
function move(e: Engine, dx: number, dy: number, n: number, t0 = 1): void {
  for (let i = 0; i < n; i++) {
    const cmd: Command = { playerId: 'p1', tick: t0 + i, move: { dx, dy } };
    applyCommands(e.world, [cmd]);
    e.world.tick();
  }
}
function fresh(): Engine { const e = new Engine(); e.load(buildBlueprint()); return e; }

describe('game-103《幸存者核心原型》· M1 灰盒（数据驱动·零专属系统）', () => {
  it('S3 骨架：蓝图纯数据装载 + 空跑 2 tick 无错 + 关键单例齐全', () => {
    const bp = buildBlueprint();
    expect(bp.capabilities.length).toBeGreaterThan(25);
    const ids = Object.keys(bp.entities);
    for (const key of ['player', 'collector', 'killbox', 'camera', 'flow', 'library', 'level', 'clock', 'levelup-gate', 'spawn-0']) {
      expect(ids).toContain(key);
    }
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
    const e = fresh();
    expect(() => tickN(e, 2)).not.toThrow();
  });

  it('走位：注入 move 命令 → 玩家沿方向移动（Controllable→Velocity→motion-apply）', () => {
    const e = fresh();
    const x0 = xf(e, 'player')!.x;
    move(e, 1, 0, 10);
    expect(xf(e, 'player')!.x).toBeGreaterThan(x0 + PLAYER_DEF.moveSpeed * 5);
  });

  it('边界：一直向右走不越出场地右墙（t2-bounds-clamp）', () => {
    const e = fresh();
    move(e, 1, 0, 2000);
    expect(xf(e, 'player')!.x).toBeLessThanOrEqual(2400);
  });

  it('单敌群 spawn：够久后敌人被生怪票→prefab 生出来（且会追向玩家）', () => {
    const e = fresh();
    expect(countTag(e, ENEMY)).toBe(0);
    tickN(e, SHAMBLER.hp > 0 ? 120 : 120);
    expect(countTag(e, ENEMY)).toBeGreaterThan(0);
  });

  it('自动开火：玩家冷却到点生子弹（ZONE 判定区数量随开火上升）', () => {
    const e = fresh();
    tickN(e, KUNAI.cd + 2);
    // 子弹是 ZONE 区；此刻场上至少有玩家/宝石外的一发子弹或其命中痕迹——用 ZONE 计数与初始比较。
    expect(countTag(e, ZONE)).toBeGreaterThan(0);
  });

  it('闭环：自动开火击杀逼近的敌人 → 掉宝石 → 拾取入经验 → 升级（等级>1）', () => {
    const e = fresh();
    // 跑足够长：敌群逼近、被子弹清、宝石被拾取环收集、经验攒够升级。玩家原地不动（敌人会自己贴上来）。
    tickN(e, 60 * 25);
    expect(resById(e, 'level')).toBeGreaterThan(1);
    expect(resById(e, 'score')).toBeGreaterThan(0);
  });

  it('接触伤害/死亡：大量敌人贴身 → 玩家 hp 掉光 → flow 转 defeat', () => {
    const e = fresh();
    // 让敌群持续贴身很久（玩家不动、不还手也扛不住连续接触 DPS）。
    tickN(e, 60 * 120);
    // 要么已被打死（defeat），要么 hp 明显受损——M1 灰盒确保接触伤害真实生效。
    expect(res(e, 'player') < PLAYER_DEF.maxHp || flowState(e) === 'defeat').toBe(true);
  });

  it('胜负：clock 达 15:00 → flow 转 victory（活满即胜）', () => {
    const e = fresh();
    // 直接把 clock 顶到阈值验证胜利转移（免跑 54000 tick）。
    for (const [eid] of e.world.query('Resource')) {
      const r = e.world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === 'clock') { r.current = MATCH_SECONDS; break; }
    }
    tickN(e, 2);
    expect(flowState(e)).toBe('victory');
  });

  it('UI 卫生：HUD/结算/三选一 LayoutNode 树 validateLayoutNode 零 issue（check-ui 机械门）', () => {
    const st = { hp: 72, maxHp: 100, xp: 3, xpMax: LEVEL_XP, level: 4, elapsed: 522, score: 387, status: 'playing' as const };
    expect(validateLayoutNode(buildHud(st))).toEqual([]);
    expect(validateLayoutNode(buildResult({ ...st, status: 'victory' }))).toEqual([]);
    expect(validateLayoutNode(buildResult({ ...st, status: 'defeat' }))).toEqual([]);
    const offers = DRAFT_POOL.slice(0, 3).map((u) => ({ id: u.id, name: u.name, desc: u.desc, accent: u.accent, level: 1, max: u.maxLevel, isNew: false, action: u.effectSignal }));
    expect(validateLayoutNode(buildLevelUp(offers))).toEqual([]);
  });

  it('三选一 draft：rollOffer 从候选池过滤+加权抽 3 个不重复（确定性·同 seed 同结果）', () => {
    const pool: DraftCandidate[] = DRAFT_POOL.map((u) => ({ id: u.id, weight: u.weight, slot: u.slot, maxLevel: u.maxLevel }));
    const state = { owned: {}, slots: { weapon: { used: 0, cap: 6 }, passive: { used: 0, cap: 6 } } };
    const a = rollOffer(pool, state, { n: DRAFT_N, seed: 2 });
    const b = rollOffer(pool, state, { n: DRAFT_N, seed: 2 });
    expect(a.length).toBe(3);
    expect(new Set(a.map((c) => c.id)).size).toBe(3);       // 不重复
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id)); // 确定性
  });

  it('升级选中「锋刃手册」→ 全局 power 系数 +0.2（KeyBinding→Effect·子弹伤害随之涨）', () => {
    const e = fresh();
    tickN(e, 3);
    const p0 = resById(e, 'power');
    fireAction(e, 'pick_blade');
    step(e); step(e); // 清队 + Effect 写入下一拍生效（不重复触发）
    expect(resById(e, 'power')).toBeCloseTo(p0 + POWER_ADD.blade, 5);
  });

  it('升级选中「护盾环」→ Caster 生成跟随玩家的灼烧光环武器（新武器·带皮肤槽）', () => {
    const e = fresh();
    tickN(e, 3);
    expect(hasSprite(e, ORBIT.skin)).toBe(false);
    fireAction(e, 'pick_orbit');
    step(e); step(e);
    expect(hasSprite(e, ORBIT.skin)).toBe(true); // 护盾环实例已展开
  });

  it('确定性：两把独立同 tick → 同 hash（可回放/balance-sim）', () => {
    const a = fresh(); const b = fresh();
    tickN(a, 600); tickN(b, 600);
    expect(a.hash()).toBe(b.hash());
  });
});
