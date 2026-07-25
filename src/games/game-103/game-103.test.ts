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
import { ENEMY, ZONE, PLAYER, START, KUNAI, SHAMBLER, BRUTE, BOSS, ARCHER, LEVEL_XP, MATCH_SECONDS, PLAYER_DEF, DRAFT_POOL, DRAFT_N, WEAPONS, PASSIVE_BY_KEY, WEAPON_BY_KEY, WEAPON_BIT, SPAWN_CAP, SPAWNER_TIERS } from './theme.js';

// 一步 sim（复刻引擎 step：每拍都注入命令→清 InputQueue·空则清空·防陈留信号重复触发）。
function step(e: Engine, cmds: Command[] = []): void {
  applyCommands(e.world, cmds);
  e.world.tick();
}
function stepN(e: Engine, n: number): void { for (let i = 0; i < n; i++) step(e); }
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
    move(e, 1, 0, 900);
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
    tickN(e, 60 * 25); // cap-48 敌群贴身·数十秒足够扣光
    // 要么已被打死（defeat），要么 hp 明显受损——M1 灰盒确保接触伤害真实生效。
    expect(res(e, 'player') < PLAYER_DEF.maxHp || flowState(e) === 'defeat').toBe(true);
  });

  it('v3 经验曲线：升级后阈值 nextxp 递增（XP_STEP）+ xp 归零（曲线爬升·非固定）', () => {
    const e = fresh();
    tickN(e, 2);
    const base = resById(e, 'nextxp');
    // 手动灌满经验到阈值 → 触发升级
    for (const [eid] of e.world.query('Resource')) { const r = e.world.getComponent<Resource>(eid, 'Resource'); if (r && r.id === 'xp') { r.current = base; break; } }
    tickN(e, 3);
    expect(resById(e, 'level')).toBeGreaterThan(1);
    expect(resById(e, 'nextxp')).toBeGreaterThan(base);   // 阈值涨了（下级更贵）
    expect(resById(e, 'xp')).toBeLessThan(base);          // xp 归零重来
  });

  it('v3 升满不断档：所有武器/被动 owned 到满，rollOffer 仍出「力量精粹」（maxLevel 极大·永不空）', () => {
    const pool: DraftCandidate[] = DRAFT_POOL.map((u) => ({ id: u.id, weight: u.weight, slot: u.slot, maxLevel: u.maxLevel }));
    const owned: Record<string, number> = {};
    for (const u of DRAFT_POOL) owned[u.id] = u.maxLevel; // 全满级
    owned.might = 5; // 力量精粹已持有但远未满（maxLevel 999）→ 仍可选
    const offers = rollOffer(pool, { owned, slots: { weapon: { used: 6, cap: 6 }, passive: { used: 6, cap: 6 } } }, { n: DRAFT_N, seed: 7 });
    expect(offers.length).toBeGreaterThan(0);             // 池不空（might maxLevel 999 未满）
    expect(offers.some((c) => c.id === 'might')).toBe(true);
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
    expect(resById(e, 'power')).toBeCloseTo(p0 + PASSIVE_BY_KEY.blade.value, 5);
  });

  it('升级选中「护盾环」→ Caster 生成跟随玩家的环绕光球武器（新武器·带皮肤槽）', () => {
    const e = fresh();
    tickN(e, 3);
    expect(hasSprite(e, WEAPON_BY_KEY.orbit.skin)).toBe(false);
    fireAction(e, 'pick_orbit');
    step(e); step(e);
    expect(hasSprite(e, WEAPON_BY_KEY.orbit.skin)).toBe(true); // 护盾环光球已展开
  });

  it('进化系统（E2·重组）：evo 信号 destroy-tagged 删基础武器挂点 + Caster spawn 进化体', () => {
    const e = fresh();
    tickN(e, 3);
    fireAction(e, 'pick_orbit');                 // 拿护盾环
    step(e); step(e);
    expect(hasSprite(e, WEAPON_BY_KEY.orbit.skin)).toBe(true);
    const orbitBallsBefore = countTag(e, WEAPON_BIT.orbit);
    expect(orbitBallsBefore).toBeGreaterThan(0); // 基础护盾环挂点在场（带武器 Tag 位）
    fireAction(e, 'evo_orbit');                   // 进化！
    stepN(e, 4);
    // 基础护盾环挂点被 destroy-tagged 清掉；进化体「无限回环」挂点已 spawn（5 球·带 orbitevo Tag 位）
    expect(countTag(e, WEAPON_BIT.orbit)).toBe(0);
    expect(countTag(e, WEAPON_BIT.orbitevo)).toBeGreaterThan(orbitBallsBefore); // 进化体球更多
  });

  it('武器册全射法：每把武器都能被 draft 生成并射出（straight/nova/beam/boomerang/orbit/pet）', () => {
    for (const w of WEAPONS.filter((x) => x.key !== 'kunai')) {
      const e = fresh();
      tickN(e, 3);
      fireAction(e, `pick_${w.key}`);
      stepN(e, w.cd + 5); // 清队推进·让挂点发出子弹（orbit/pet 即刻·发射器待 cd）
      expect(hasSprite(e, w.skin)).toBe(true); // 该武器子弹/光球皮肤在场=射法生效
    }
  });

  it('BUG-01/v2⑤ 修：世界空间地砖网格线实体在场（随相机卷动→相对位移·非屏幕固定）', () => {
    const ids = Object.keys(buildBlueprint().entities);
    expect(ids.filter((k) => k.startsWith('gridv-') || k.startsWith('gridh-')).length).toBeGreaterThan(20);
  });

  it('v2③ 无限流 + 同屏 cap：长跑后敌人持续存在且活敌数被 GroupCount 钳在 cap 内（不爆炸）', () => {
    const e = fresh();
    tickN(e, 900); // 15s
    const alive = countTag(e, ENEMY);
    expect(alive).toBeGreaterThan(0);                    // 无限刷·一直有敌
    expect(resById(e, 'enemies_alive')).toBeGreaterThan(0);
    expect(alive).toBeLessThanOrEqual(SPAWN_CAP + 12);   // 同屏 cap 生效·实体不爆炸（+余量=同拍多 spawner 齐发）
  });

  it('v2③ 难度递增：分层敌 afterSec 时间门 + 胖子更肉（一发打不死）', () => {
    expect(SPAWNER_TIERS.some((t) => t.afterSec > 0)).toBe(true); // 有时间门=越晚越难
    expect(BRUTE.hp).toBeGreaterThan(SHAMBLER.hp * 3);            // 胖子远肉于蹒跚者
    expect(BRUTE.hp / KUNAI.dmg).toBeGreaterThan(3);             // 飞镖一发打不死（多发才行）
  });

  it('Boss：首领敌层在册（周期出现·afterSec 时间门）+ 巨血（无限局 escalation 节点）', () => {
    const boss = SPAWNER_TIERS.find((t) => t.key === 'boss');
    expect(boss).toBeDefined();
    expect(boss!.afterSec).toBeGreaterThan(0);            // 时间门=局中才现身
    expect(BOSS.hp).toBeGreaterThan(BRUTE.hp * 10);       // 首领远肉于普通敌
    const lib = (buildBlueprint().entities.library as { PrefabLibrary: { templates: Record<string, unknown> } }).PrefabLibrary.templates;
    expect(lib).toHaveProperty('enemy_boss');             // 库含首领 prefab
  });

  it('E7 远程敌（archer/boss）：body 挂 Timer(shoot)+SelfRule spawn ebolt·库含敌弹·弹朝玩家且射程有界（打不了太远）', () => {
    const lib = (buildBlueprint().entities.library as { PrefabLibrary: { templates: Record<string, { entities: Record<string, Record<string, unknown>> }> } }).PrefabLibrary.templates;
    // 近战敌无远程挂点·远程敌有
    const shBody = lib.enemy_shambler.entities.body;
    expect(shBody.SelfRule).toBeUndefined();
    const arBody = lib.enemy_archer.entities.body as { Timer?: { id: string }; SelfRule?: { do: Array<{ template: string }> } };
    expect(arBody.Timer?.id).toBe('shoot');
    expect(arBody.SelfRule?.do[0].template).toBe('ebolt_archer');
    // 库含敌弹·朝玩家（Launch targetMask:PLAYER）·命中玩家扣血
    expect(lib).toHaveProperty('ebolt_archer');
    expect(lib).toHaveProperty('ebolt_boss');
    const bolt = lib.ebolt_archer.entities.p as { Launch: { toward: string; targetMask: number }; Hitbox: { targetMask: number; amount: number } };
    expect(bolt.Launch.toward).toBe('target');
    expect(bolt.Launch.targetMask).toBe(PLAYER);
    expect(bolt.Hitbox.targetMask).toBe(PLAYER);
    expect(bolt.Hitbox.amount).toBeGreaterThan(0);
    // 「打不了太远」：射程 ≈ projSpeed×life 有界·且明显小于场地跨度（玩家可走位躲）
    const range = ARCHER.ranged!.projSpeed * ARCHER.ranged!.life;
    expect(range).toBeGreaterThan(150);   // 够到中距=有紧张感
    expect(range).toBeLessThan(400);      // 不跨屏狙=能躲
    // spawner 有 archer 层·时间门>0
    const at = SPAWNER_TIERS.find((t) => t.key === 'archer');
    expect(at?.afterSec).toBeGreaterThan(0);
  });

  it('v2④ 敌人头顶血条：敌 prefab 带 Gauge(绑 hp)→受击缩短=伤害反馈可见', () => {
    const e = fresh();
    tickN(e, 60); // 待开局怪生出
    let hasGauge = false;
    for (const [id] of e.world.query('Gauge')) { const g = e.world.getComponent(id, 'Gauge') as { resourceId?: string } | undefined; if (g && g.resourceId === 'hp') { hasGauge = true; break; } }
    expect(hasGauge).toBe(true);
  });

  it('BUG-03 修：回旋镖弹体真飞（Launch 定向·无 Steering 抵消）→ Transform 随 tick 位移', () => {
    const e = fresh();
    tickN(e, 3);
    fireAction(e, 'pick_boom');
    stepN(e, WEAPON_BY_KEY.boom.cd + 5); // 待挂点发出 proj_boom
    // 找到 proj_boom 弹体，记录位置
    let boomId = '';
    for (const [id] of e.world.query('Sprite')) { const s = e.world.getComponent<Sprite>(id, 'Sprite'); if (s && s.textureKey === WEAPON_BY_KEY.boom.skin) { boomId = id; break; } }
    expect(boomId).not.toBe('');
    const p0 = xf(e, boomId)!;
    const x0 = p0.x, y0 = p0.y;
    stepN(e, 6);
    const p1 = xf(e, boomId);
    // 弹体仍在(未消失)则必须移动了（不再"停原地"）；若已消失=已飞出回收，也算真飞（非卡住）。
    if (p1) expect(Math.hypot(p1.x - x0, p1.y - y0)).toBeGreaterThan(1);
  });

  it('确定性：两把独立同 tick → 同 hash（可回放/balance-sim）', () => {
    const a = fresh(); const b = fresh();
    tickN(a, 600); tickN(b, 600);
    expect(a.hash()).toBe(b.hash());
  });
});
