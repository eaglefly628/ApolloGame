// Game G · 战斗演出时间线宿主（owner 2026-07-03「用 timeline 重编·不手写排程·一切是数据·弱强模型都能确定地配」）——
// 把散在 game-g.tsx 的 setTimeout 演出时序收编到引擎 `t3-timeline`（确定性 tick cue 调度器）。
//
// 分工铁律（timeline 手册）：**timeline 管「何时」，表现层订阅信号自演「怎么演」**。本模块 = game-g 侧的
// timeline 宿主：起一个只跑 `timeline` capability 的 World（同 makeCoachWorld 只作数据宿主的先例·非 sim 核），
// 逐帧 pump 一 tick、把该 tick timeline 发出的 Signal 交给表现层回调。绝不在回调里塞自由时序——时序全在数据里。
//
// 提供两种消费：
//   ① play(spec)     —— 多拍编排（战后 slay→survivor→resume）：一条 Timeline 多 cue，订阅信号自演。
//   ② delay(ticks,cb)—— 单发延时（替手写 setTimeout：banner/思考/cue）：内部即一条**单 cue timeline**（延时 N→回调）。
// 「延时→回调」不新增引擎能力：manifesto §4 先重组——timeline 单 cue / Timer 原子早已覆盖（评判见 requests.md）。
// 多条并发（不同 id 各一实体）+ 播完(timeline:done)自动销实体防泄漏。绝不走墙钟推进演出编排逻辑（时序=数据）。
import { World } from '@engine/core/world.js';
import { timelineCapability } from '@skills/tier3/timeline.js';
import type { Component, IWorld } from '@engine/core/types.js';
import type { Timeline, TimelineCue, Signal } from '@engine/protocol/components.js';

export interface TimelineSpec { id: string; cues: TimelineCue[]; speed?: number }
export interface EmittedSignal { name: string; arg?: string }

// 低层可测核：起 World + 装 timeline 系统；play() 注册并起播（并发·各 id 一实体）；pump() 走一 tick 返回该 tick 信号；
// destroyTimeline() 销毁一条 timeline 实体（播完清理防泄漏）。rAF 无关 → 单测可手动 pump 逐 tick 断言·headless 安全。
export function createBattleTimeline(): {
  world: IWorld;
  play: (spec: TimelineSpec) => void;
  pump: () => EmittedSignal[];
  destroyTimeline: (id: string) => void;
  markDone: (id: string) => void;
  activeCount: () => number;
} {
  const world = new World();
  for (const sys of timelineCapability.systems) world.addSystem(sys);
  const pendingPlays: string[] = []; // 本 pump 待注入的起播信号名（支持并发·一次 pump 多条一起注入）
  const active = new Set<string>();  // 在播 timeline id（play 时加·收到 done 时由 destroyTimeline 移）
  const eid = (id: string): string => `gg-tl-${id}`;

  const play = (spec: TimelineSpec): void => {
    const e = eid(spec.id);
    // **复用实体重播**（勿 destroy+recreate）：TimelinePlayback(pb) 须留存——系统靠它下 tick 清上 tick 发的瞬时信号；
    //   destroy 会连 pb 一起没 → 旧 `tl:<id>#seq` 无人清 → 下次同 id 起播撞「already exists」。playOnSignal 会把 t/cursor 归零重播。
    const ex = world.getComponent<Timeline>(e, 'Timeline');
    if (ex) { ex.cues = spec.cues; ex.speed = spec.speed; }
    else { world.createEntity(e); world.addComponent(e, { type: 'Timeline', id: spec.id, cues: spec.cues, playOnSignal: `play:${spec.id}`, speed: spec.speed } as unknown as Component); }
    pendingPlays.push(`play:${spec.id}`);
    active.add(spec.id);
  };
  const destroyTimeline = (id: string): void => { try { world.destroyEntity(eid(id)); } catch { /* 已销 */ } active.delete(id); };
  const markDone = (id: string): void => { active.delete(id); }; // 播完标空闲（固定 id 实体留存复用·仅从「在播」集移除·驱动 loop 收敛）

  const pump = (): EmittedSignal[] => {
    const injected: string[] = [];
    for (let i = 0; i < pendingPlays.length; i++) { const sid = `gg-tl-play-${i}`; try { world.destroyEntity(sid); } catch { /* noop */ } world.createEntity(sid); world.addComponent(sid, { type: 'Signal', name: pendingPlays[i], source: 'gg-tl' } as unknown as Component); injected.push(sid); }
    pendingPlays.length = 0;
    world.tick();
    const out: EmittedSignal[] = [];
    for (const [id] of world.query('Signal')) {
      if (!id.startsWith('tl:')) continue; // 只收 timeline 自发的瞬时信号（tl:<id>#seq）
      const s = world.getComponent<Signal>(id, 'Signal');
      if (s) out.push({ name: s.name, arg: (s as { arg?: string }).arg });
    }
    for (const sid of injected) { try { world.destroyEntity(sid); } catch { /* noop */ } } // 起播信号用后即销（否则每 tick 重触发重播）
    return out;
  };

  return { world, play, pump, destroyTimeline, markDone, activeCount: () => active.size };
}

// live 宿主：逐帧 pump·把信号交表现层。返回 { play, delay, destroy }。空闲（无在播 timeline + 无待回调）自动停·省电。
// ⚠ 用 `setTimeout(16)` 而非 requestAnimationFrame——① 假计时器(vi.runAllTimers)能推进（战斗流程测试靠它快进演出·
//   rAF 不受控会挂死 OOM）；② 只在还有活时重排、收敛即停（有限步·非自增死循环）；真机 setTimeout(16)≈60fps 够演出粗粒度。
export function mountBattleTimeline(onSignal: (sig: EmittedSignal) => void): { play: (spec: TimelineSpec) => void; delay: (ticks: number, cb: () => void) => void; destroy: () => void } {
  const core = createBattleTimeline();
  const delayCbs = new Map<string, () => void>();
  let timer = 0; let seq = 0;
  let pendingDestroy: string[] = []; // 上一 pump 播完的**单发延时** timeline id（延一 pump 再销·让系统本 tick 先清它发的瞬时信号·防泄漏）
  const FRAME = 16;
  const kick = (): void => { if (!timer) timer = window.setTimeout(loop, FRAME); };
  function loop(): void {
    timer = 0;
    const doneDelays: string[] = [];
    for (const s of core.pump()) {
      const dl = s.name.startsWith('ggdl:') ? s.name.slice(5) : '';
      if (dl && delayCbs.has(dl)) { const cb = delayCbs.get(dl)!; delayCbs.delete(dl); cb(); continue; } // 延时到点→回调（timeline 实体延一 pump 再销·下面 done 处理）
      if (s.name.startsWith('timeline:done:')) { const id = s.name.slice('timeline:done:'.length); core.markDone(id); if (id.startsWith('dl-')) doneDelays.push(id); continue; } // 播完标空闲（驱动 loop 收敛）；固定 id(clash-settle/move)复用不销·仅单发延时销
      onSignal(s);
    }
    for (const id of pendingDestroy) core.destroyTimeline(id); // 销上一 pump 播完的延时（其瞬时信号本 tick 已被系统清）
    pendingDestroy = doneDelays;
    if (core.activeCount() > 0 || delayCbs.size > 0 || pendingDestroy.length > 0) timer = window.setTimeout(loop, FRAME); // 还有活 → 续泵；全收敛 → 停
  }
  return {
    play: (spec) => { core.play(spec); kick(); },
    // 单发延时（替手写 setTimeout·时序=数据·不新增引擎能力=timeline 单 cue 已覆盖）：延到第 ticks tick 发 ggdl:<id> → 回调。
    delay: (ticks, cb) => { const id = `d${seq++}`; delayCbs.set(id, cb); core.play({ id: `dl-${id}`, cues: [{ at: Math.max(0, Math.round(ticks)), do: { kind: 'signal', signal: `ggdl:${id}` } }] }); kick(); },
    destroy: () => { if (timer) clearTimeout(timer); timer = 0; delayCbs.clear(); pendingDestroy = []; },
  };
}
