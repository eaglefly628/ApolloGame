// Game G · 战斗演出时间线（owner 2026-07-03「用 timeline 重编·不手写排程」）——把散在 game-g.tsx 的
// setTimeout 手写演出时序收编到引擎 `t3-timeline`（确定性 tick cue 调度器）。
//
// 分工铁律（timeline 手册）：**timeline 管「何时」，表现层订阅信号自演「怎么演」**。本模块 = game-g 侧的
// timeline 宿主：起一个只跑 `timeline` capability 的 World（同 makeCoachWorld 只作数据宿主的先例·非 sim 核），
// 逐帧 pump 一 tick、把该 tick timeline 发出的 Signal 交给表现层回调（showClashCue/playGhost/掷骰… 自演）。
// 绝不在回调里塞自由时序逻辑——时序全在 Timeline 数据里（cue 的 at）。玩家可打断的段（等点掷命/看明白了）
// 拆成多条一次性 Timeline，玩家点击桥接；本模块只负责「一段自动演出」的确定性节拍。
import { World } from '@engine/core/world.js';
import { timelineCapability } from '@skills/tier3/timeline.js';
import type { Component, IWorld } from '@engine/core/types.js';
import type { Timeline, TimelineCue, Signal } from '@engine/protocol/components.js';

export interface TimelineSpec { id: string; cues: TimelineCue[]; speed?: number }
export interface EmittedSignal { name: string; arg?: string }

// 低层可测核：起 World + 装 timeline 系统；play() 注册并起播一条一次性 timeline；pump() 走一 tick 返回该 tick 发出的信号。
// （rAF 无关 → 单测可手动 pump 逐 tick 断言·headless 安全。）
export function createBattleTimeline(): {
  world: IWorld;
  play: (spec: TimelineSpec) => void;
  pump: () => EmittedSignal[];
} {
  const world = new World();
  for (const sys of timelineCapability.systems) world.addSystem(sys);
  let pendingPlay: string | null = null;
  const PLAY_SIG = 'gg-tl-play-sig';

  const play = (spec: TimelineSpec): void => {
    const eid = `gg-tl-${spec.id}`;
    try { world.destroyEntity(eid); } catch { /* 首次无 */ }
    world.createEntity(eid);
    world.addComponent(eid, { type: 'Timeline', id: spec.id, cues: spec.cues, playOnSignal: `play:${spec.id}`, speed: spec.speed } as unknown as Component);
    pendingPlay = `play:${spec.id}`;
  };

  const pump = (): EmittedSignal[] => {
    // 起播：本 tick 注入 play 信号（timeline 系统 tick 内 query 到 → 从 t=0 播）。用后即销（否则每 tick 重触发重播）。
    if (pendingPlay) { try { world.destroyEntity(PLAY_SIG); } catch { /* noop */ } world.createEntity(PLAY_SIG); world.addComponent(PLAY_SIG, { type: 'Signal', name: pendingPlay, source: 'gg-tl' } as unknown as Component); }
    world.tick();
    const out: EmittedSignal[] = [];
    for (const [id] of world.query('Signal')) {
      if (!id.startsWith('tl:')) continue; // 只收 timeline 自发的瞬时信号（tl:<id>#seq）
      const s = world.getComponent<Signal>(id, 'Signal');
      if (s) out.push({ name: s.name, arg: (s as { arg?: string }).arg });
    }
    if (pendingPlay) { try { world.destroyEntity(PLAY_SIG); } catch { /* noop */ } pendingPlay = null; }
    return out;
  };

  return { world, play, pump };
}

// live 宿主：rAF 逐帧 pump·把信号交表现层。onSignal 收 timeline 每条 cue 信号（含播完 `timeline:done:<id>`）。
// 返回 { play(一次性 timeline), destroy() }。空闲（无在播 timeline）自动停 rAF·省电；再 play 自动续。
export function mountBattleTimeline(onSignal: (sig: EmittedSignal) => void): { play: (spec: TimelineSpec) => void; destroy: () => void } {
  const core = createBattleTimeline();
  let raf = 0; let live = 0; // live=还需泵几帧（收到 done 前持续）
  const loop = (): void => {
    const sigs = core.pump();
    for (const s of sigs) { onSignal(s); if (s.name.startsWith('timeline:done:')) live = Math.min(live, 6); }
    live -= 1;
    if (live > 0) raf = requestAnimationFrame(loop); else raf = 0;
  };
  return {
    play: (spec) => { core.play(spec); live = 6000; if (!raf) raf = requestAnimationFrame(loop); }, // 起播·上限 100s 兜底防泄漏（正常收到 done 即停）
    destroy: () => { if (raf) cancelAnimationFrame(raf); raf = 0; live = 0; },
  };
}
