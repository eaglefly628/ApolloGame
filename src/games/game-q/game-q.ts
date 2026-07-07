// Game Q · Neon Siege —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（都在 sim 外）：建 Engine + CanvasRenderer + QueuedInputSource；把画布点击逆投影成世界坐标入队
// （clickable/caster at:pointer 消费）；把 world 资源投影进 LayoutNode HUD；胜负浮层；重开；响应式缩放；cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（见其头注）。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { GameFlow, Resource, Flag, Tag } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState } from './hud.js';
import { playQSfx, isMuted, setMuted } from './sounds.js';
import { NEON_THEME, FIELD_W, FIELD_H, TOP_BAR_H, BOTTOM_BAR_H, START_GOLD, START_LIVES, TOWER } from './theme.js';

const GRID_BG =
  'radial-gradient(circle at 50% 42%, #0d1a33 0%, #070c17 68%, #04070f 100%),' +
  'repeating-linear-gradient(0deg, rgba(56,189,248,0.05) 0 1px, transparent 1px 40px),' +
  'repeating-linear-gradient(90deg, rgba(56,189,248,0.05) 0 1px, transparent 1px 40px)';

export function mount(container: HTMLElement): () => void {
  // ── DOM 骨架（host 层容器·非 sim）：wrapper > scene(定尺缩放盒) > [stage(画布) + 三个 HUD host] ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;overflow:hidden;background:#04070f;display:flex;align-items:center;justify-content:center;' +
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale';

  // scene = 定尺缩放盒；画布(z0·渲染器 init 时挂入) 打底 + 三个 HUD host(z10/20) 叠上。
  const scene = document.createElement('div');
  scene.style.cssText = `position:relative;width:${FIELD_W}px;height:${FIELD_H}px;flex:0 0 auto;transform-origin:center center;background:${GRID_BG}`;

  const topHost = document.createElement('div');
  topHost.style.cssText = `position:absolute;left:0;right:0;top:0;height:${TOP_BAR_H}px;z-index:10`;
  const bottomHost = document.createElement('div');
  bottomHost.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${BOTTOM_BAR_H}px;z-index:10`;
  const overlayHost = document.createElement('div');
  overlayHost.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none';

  scene.append(topHost, bottomHost, overlayHost);
  wrapper.appendChild(scene);
  container.appendChild(wrapper);

  // ── 稳定输入源（跨重开不变 → HUD sink 始终有效）──────────────────────────
  const input = new QueuedInputSource('q');

  const initial: HudState = { lives: START_LIVES, gold: START_GOLD, enemies: 0, pending: null, status: 'playing', muted: isMuted() };

  // ── HUD 读态：从 world 资源/旗/流程投影出 HudState（纯读·outcome-first）──────
  function readState(engine: Engine): HudState {
    const w = engine.world;
    const res = (eid: string): number => w.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
    const flag = (eid: string): boolean => w.getComponent<Flag>(eid, 'Flag')?.active ?? false;
    const cur = w.getComponent<GameFlow>('flow', 'GameFlow')?.current;
    return {
      lives: Math.round(res('base')),
      gold: Math.round(res('gold')),
      enemies: Math.round(res('livecount')),
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
  let prevA = { towers: 0, lives: START_LIVES, enemies: 0, status: 'playing' as HudState['status'] };
  function syncAudio(st: HudState, towers: number): void {
    if (st.status !== prevA.status) {
      if (st.status === 'victory') playQSfx('win');
      else if (st.status === 'defeat') playQSfx('lose');
    }
    if (towers > prevA.towers) playQSfx('build');
    if (st.lives < prevA.lives) playQSfx('leak');
    else if (st.enemies < prevA.enemies) playQSfx('kill'); // 敌减 & 未漏 ≈ 塔杀
    prevA = { towers, lives: st.lives, enemies: st.enemies, status: st.status };
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
    const sig = `${st.lives}|${st.gold}|${st.enemies}|${st.pending}|${st.status}|${st.muted}`;
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
    } else if (overlayUi) {
      overlayUi();
      overlayUi = null;
      overlayHost.style.pointerEvents = 'none';
    }
  }

  // ── sim 生命周期（可重开）：engine + renderer + 画布指针胶水 + 逐帧 HUD 投影 ──
  let sim: { engine: Engine; renderer: CanvasRenderer; canvas: HTMLCanvasElement; onDown: (e: PointerEvent) => void; unsub: () => void } | null = null;

  function startSim(): void {
    const engine = new Engine({ input });
    engine.load(buildBlueprint());
    const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
    engine.attachRenderer(renderer, scene);
    const canvas = scene.querySelector('canvas') as HTMLCanvasElement;
    canvas.style.zIndex = '0';

    // 画布点击 → 逆投影为世界坐标（无相机=画布逻辑坐标）→ 入队；clickable(onlyFlag 门) + caster at:pointer 消费。
    const onDown = (e: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const p = canvasPointerToScreen(e.clientX, e.clientY, rect, canvas.width / dpr, canvas.height / dpr);
      input.enqueue({ source: 'q', x: p.x, y: p.y, phase: 'down' });
    };
    canvas.addEventListener('pointerdown', onDown);

    const unsub = engine.subscribe(() => refreshHud(engine));
    engine.start();
    lastSig = '';
    prevA = { towers: 0, lives: START_LIVES, enemies: 0, status: 'playing' };
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

  // ── 响应式缩放（定尺场景盒等比缩进容器·指针映射经 getBoundingClientRect 自动跟随）──
  const fit = (): void => {
    const cw = container.clientWidth || FIELD_W;
    const ch = container.clientHeight || FIELD_H;
    const k = Math.min(cw / FIELD_W, ch / FIELD_H);
    scene.style.transform = `scale(${k})`;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);
  fit();

  startSim();

  // ── cleanup（launcher 卸载时调）──────────────────────────────────────────
  return () => {
    stopSim();
    ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    overlayUi?.();
    topUi();
    bottomUi();
    wrapper.remove();
  };
}
