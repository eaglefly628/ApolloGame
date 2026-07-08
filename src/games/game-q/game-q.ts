// Game Q · Neon Siege —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 【3D 盒庭版】渲染换成 ThreeRenderer（Camera3D 在场 → 引擎把 2D sim 实体落地面·微缩盒庭）。sim/HUD/胜负/重开一字未改。
// 职责（都在 sim 外）：建 Engine + ThreeRenderer + QueuedInputSource；把画布点击经**地面射线**逆投影成世界坐标入队
// （screenToWorld(clientX,clientY,0,'y') → 地面 y=0 交点 → sim x=交点.x、sim y=交点.z）；clickable/caster at:pointer 消费；
// 把 world 资源投影进 LayoutNode HUD；胜负浮层；重开；cleanup。响应式由 ThreeRenderer 的 ResizeObserver 自理。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（见其头注）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js'; // 具体类型（非 barrel）：直调 screenToWorld 地面逆投影
import { QueuedInputSource } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { GameFlow, Resource, Flag, Tag } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState } from './hud.js';
import { playQSfx, isMuted, setMuted } from './sounds.js';
import { NEON_THEME, TOP_BAR_H, BOTTOM_BAR_H, START_GOLD, START_LIVES, TOWER, WAVE_SCHEDULE, SKY_3D } from './theme.js';

export function mount(container: HTMLElement): () => void {
  // ── DOM 骨架（host 层容器·非 sim）：wrapper > stage(3D 画布满幅) + 三个 HUD host 叠上 ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;overflow:hidden;background:#04070f;' +
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale';

  // stage = 3D 画布容器（满幅·ThreeRenderer init 时挂 canvas·其 ResizeObserver 观察本容器自适应）。
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;inset:0;z-index:0;line-height:0';

  const topHost = document.createElement('div');
  topHost.style.cssText = `position:absolute;left:0;right:0;top:0;height:${TOP_BAR_H}px;z-index:10`;
  const bottomHost = document.createElement('div');
  bottomHost.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${BOTTOM_BAR_H}px;z-index:10`;
  const overlayHost = document.createElement('div');
  overlayHost.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none';

  wrapper.append(stage, topHost, bottomHost, overlayHost);
  container.appendChild(wrapper);

  // ── 稳定输入源（跨重开不变 → HUD sink 始终有效）──────────────────────────
  const input = new QueuedInputSource('q');

  const initial: HudState = { lives: START_LIVES, gold: START_GOLD, remaining: WAVE_SCHEDULE.length, pending: null, status: 'playing', muted: isMuted() };

  // ── HUD 读态：从 world 资源/旗/流程投影出 HudState（纯读·outcome-first）──────
  function readState(engine: Engine): HudState {
    const w = engine.world;
    const res = (eid: string): number => w.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
    const flag = (eid: string): boolean => w.getComponent<Flag>(eid, 'Flag')?.active ?? false;
    const cur = w.getComponent<GameFlow>('flow', 'GameFlow')?.current;
    return {
      lives: Math.round(res('base')),
      gold: Math.round(res('gold')),
      remaining: Math.round(res('ticketcount') + res('livecount')),
      pending: flag('flag-pending-pulse') ? 'pulse' : flag('flag-pending-cannon') ? 'cannon' : null,
      status: cur === 'victory' ? 'victory' : cur === 'defeat' ? 'defeat' : 'playing',
      muted: isMuted(),
    };
  }
  function countTowers(engine: Engine): number {
    let n = 0;
    for (const [id] of engine.world.query('Tag')) {
      const t = engine.world.getComponent<Tag>(id, 'Tag');
      if (t && (t.flags & TOWER) !== 0) n++;
    }
    return n;
  }

  // ── 音效同步（outcome-first·纯读世界 diff → 合成端口·不碰 sim/hash）─────────
  let prevA = { towers: 0, lives: START_LIVES, remaining: WAVE_SCHEDULE.length, status: 'playing' as HudState['status'] };
  function syncAudio(st: HudState, towers: number): void {
    if (st.status !== prevA.status) {
      if (st.status === 'victory') playQSfx('win');
      else if (st.status === 'defeat') playQSfx('lose');
    }
    if (towers > prevA.towers) playQSfx('build');
    if (st.lives < prevA.lives) playQSfx('leak');
    else if (st.remaining < prevA.remaining) playQSfx('kill'); // 剩余减 & 未漏 ≈ 塔杀
    prevA = { towers, lives: st.lives, remaining: st.remaining, status: st.status };
  }

  // ── HUD 挂载（稳定·input 作 ActionSink：无本地 handler 的 action → 信号入队 → sim）──
  const handlers: HandlerMap = {
    restart: () => restart(),
    toggle_mute: () => { setMuted(!isMuted()); if (sim) refreshHud(sim.engine); },
  };
  const topUi: MountHandle = mountUI(topHost, buildTopBar(initial), handlers, NEON_THEME, input);
  const bottomUi: MountHandle = mountUI(bottomHost, buildBottomBar(initial), handlers, NEON_THEME, input);
  let overlayUi: MountHandle | null = null;

  let lastSig = '';
  function refreshHud(engine: Engine): void {
    const st = readState(engine);
    syncAudio(st, countTowers(engine));
    const sig = `${st.lives}|${st.gold}|${st.remaining}|${st.pending}|${st.status}|${st.muted}`;
    if (sig !== lastSig) {
      lastSig = sig;
      topUi.update(buildTopBar(st), NEON_THEME);
      bottomUi.update(buildBottomBar(st), NEON_THEME);
    }
    if (st.status !== 'playing') {
      if (!overlayUi) {
        overlayHost.style.pointerEvents = 'auto';
        overlayUi = mountUI(overlayHost, buildOverlay(st), handlers, NEON_THEME, input);
      } else {
        overlayUi.update(buildOverlay(st), NEON_THEME);
      }
      engine.stop(); // 局终冻结 sim（浮层已盖·省 CPU·停止后 subscribe 不再触发·幂等）
    } else if (overlayUi) {
      overlayUi();
      overlayUi = null;
      overlayHost.style.pointerEvents = 'none';
    }
  }

  // ── sim 生命周期（可重开）：engine + 3D renderer + 地面射线点击胶水 + 逐帧 HUD 投影 ──
  let sim: { engine: Engine; renderer: ThreeRenderer; canvas: HTMLCanvasElement; onDown: (e: PointerEvent) => void; unsub: () => void } | null = null;

  function startSim(): void {
    const engine = new Engine({ input });
    engine.load(buildBlueprint());
    const renderer = new ThreeRenderer({
      width: container.clientWidth || 960,
      height: container.clientHeight || 560,
      background: SKY_3D.top,
    });
    engine.attachRenderer(renderer, stage);
    const canvas = stage.querySelector('canvas') as HTMLCanvasElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';

    // 画布点击 → 地面(y=0)射线逆投影为世界坐标 → sim(x=交点.x, y=交点.z) 入队；clickable(onlyFlag 门) + caster at:pointer 消费。
    const onDown = (e: PointerEvent): void => {
      const hit = renderer.screenToWorld(e.clientX, e.clientY, 0, 'y');
      if (hit) input.enqueue({ source: 'q', x: hit.x, y: hit.z, phase: 'down' });
    };
    canvas.addEventListener('pointerdown', onDown);

    const unsub = engine.subscribe(() => refreshHud(engine));
    engine.start();
    lastSig = '';
    prevA = { towers: 0, lives: START_LIVES, remaining: WAVE_SCHEDULE.length, status: 'playing' };
    refreshHud(engine);
    sim = { engine, renderer, canvas, onDown, unsub };
  }

  function stopSim(): void {
    if (!sim) return;
    sim.unsub();
    sim.engine.stop();
    sim.canvas.removeEventListener('pointerdown', sim.onDown);
    sim.renderer.destroy();
    sim = null;
  }

  function restart(): void {
    if (overlayUi) { overlayUi(); overlayUi = null; overlayHost.style.pointerEvents = 'none'; }
    stopSim();
    startSim();
  }

  startSim();

  // ── cleanup（launcher 卸载时调）──────────────────────────────────────────
  return () => {
    stopSim();
    overlayUi?.();
    topUi();
    bottomUi();
    wrapper.remove();
  };
}
