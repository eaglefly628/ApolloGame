// Game Q · Neon Siege —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（都在 sim 外）：建 Engine + CanvasRenderer + QueuedInputSource；把画布点击逆投影成世界坐标入队
// （clickable/caster at:pointer 消费）；把 world 资源投影进 LayoutNode HUD；胜负浮层；重开；响应式缩放；cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（见其头注）。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@assets/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { GameFlow, Resource, Flag, Tag } from '@engine/protocol/components.js';
import { mountHost } from '@engine/host/mount-host.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState } from './hud.js';
import { playQSfx, isMuted, setMuted } from './sounds.js';
import { NEON_THEME, FIELD_W, FIELD_H, TOP_BAR_H, BOTTOM_BAR_H, START_GOLD, START_LIVES, TOWER, WAVE_SCHEDULE } from './theme.js';

const GRID_BG =
  'radial-gradient(circle at 50% 42%, #0d1a33 0%, #070c17 68%, #04070f 100%),' +
  'repeating-linear-gradient(0deg, rgba(56,189,248,0.05) 0 1px, transparent 1px 40px),' +
  'repeating-linear-gradient(90deg, rgba(56,189,248,0.05) 0 1px, transparent 1px 40px)';

export function mount(container: HTMLElement): () => void {
  // ── 宿主骨架（render-only·下沉引擎公用 helper·非 sim）：wrapper > scene(定尺缩放盒) > [画布 + 三 HUD host] ──
  // 五容器 + 定尺缩放/卸载全在 mountHost；本层只搭渲染器/输入/HUD 胶水（见头注）。
  const { scene, topHost, bottomHost, overlayHost, teardown } = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    topBarH: TOP_BAR_H,
    bottomBarH: BOTTOM_BAR_H,
    sceneBackground: GRID_BG,
    wrapperBackground: '#04070f',
  });

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

  // ── sim 生命周期（可重开）：engine + renderer + 画布指针胶水 + 逐帧 HUD 投影 ──
  let sim: { engine: Engine; renderer: CanvasRenderer; canvas: HTMLCanvasElement; onDown: (e: PointerEvent) => void; unsub: () => void } | null = null;

  // 皮肤资产（R2 ①·美术替换工作流写回端）：拉本地美术 index → 皮肤 key（q/tower-pulse…）就绪即换装；
  // 无 index/加载失败 = 纯程序化观感照旧（chooseRenderMode 回退 Shape）——美术是增量，不是依赖。
  const skinAssets = new AssetManager(new ImageAssetLoader());
  void (async () => {
    try {
      const r = await fetch('/games/game-q/art/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      registerAssetIndex(skinAssets, parseAssetIndex(await r.json())); // path 已是站点绝对路径 → baseUrl ''
      await skinAssets.loadAll();
    } catch { /* 无美术目录/解析失败 → 回退程序化观感·不炸游戏 */ }
  })();

  function startSim(): void {
    const engine = new Engine({ input });
    engine.load(buildBlueprint());
    const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent', assets: skinAssets });
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
    teardown(); // 停 ResizeObserver + 摘 resize 监听 + 移除 wrapper（宿主骨架 helper 所有）
  };
}
