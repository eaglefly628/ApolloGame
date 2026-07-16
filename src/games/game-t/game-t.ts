// Game T ·《墨消》—— 宿主层（game-q 同款 mount/host 纪律·零玩法逻辑·规则全在 blueprint 数据+引擎能力）。
//
// 职责（都在 sim 外）：建 Engine + CanvasRenderer + QueuedInputSource；画布点击逆投影入队
// （clickable 消费 → match3 选/换）；world 资源/流程投影进 LayoutNode HUD；选关长卷 ↔ 关卡切换；
// 结算浮层与星级存档（localStorage·host 关卡进度非 sim 态）；音效 diff 同步；响应式缩放；cleanup。
// 胜负判定在 sim（t3-flow）——宿主只读 GameFlow.current 摆 UI，绝不代判。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import { apolloToon } from '@ui/apollo-toon-theme.js';
import type { GameFlow, Resource, MatchBoard } from '@engine/protocol/components.js';
import { buildLevelBlueprint } from './blueprint.js';
import { LEVELS, type LevelSpec, finalScore, starsFor, goalRequirements, progressStates } from './levels.js';
import { buildSelect, buildTopBar, buildBottomBar, buildResultOverlay, type HudState } from './hud.js';
import { playTSfx, isMuted, setMuted } from './sounds.js';
import { FIELD_W, FIELD_H, TOP_BAR_H, BOTTOM_BAR_H, BRUSH_PER_MOVE } from './theme.js';

// 宣纸底（宿主装饰层·棋盘容器真美术=S6 台账件）
const PAPER_BG =
  'radial-gradient(ellipse at 50% 16%, #f8f2e5 0%, #f0e7d3 55%, #e2d5b8 100%),' +
  'repeating-linear-gradient(0deg, rgba(120,100,70,0.028) 0 2px, transparent 2px 6px)';

const SAVE_KEY = 'apollo-t-progress-v1';
function loadStars(): Record<number, number> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVE_KEY) : null;
    const j = raw ? (JSON.parse(raw) as { stars?: Record<string, number> }) : null;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(j?.stars ?? {})) out[Number(k)] = Number(v) || 0;
    return out;
  } catch {
    return {};
  }
}
function saveStars(map: Record<number, number>): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ stars: map }));
  } catch {
    /* ignore */
  }
}

export function mount(container: HTMLElement): () => void {
  // ── DOM 骨架（host 层容器·非 sim）：wrapper > scene(定尺缩放盒) > [画布 + HUD hosts] ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;overflow:hidden;background:#171310;display:flex;align-items:center;justify-content:center;' +
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale';
  const scene = document.createElement('div');
  scene.style.cssText = `position:relative;width:${FIELD_W}px;height:${FIELD_H}px;flex:0 0 auto;transform-origin:center center;background:${PAPER_BG}`;

  const topHost = document.createElement('div');
  topHost.style.cssText = `position:absolute;left:0;right:0;top:0;height:${TOP_BAR_H}px;z-index:10`;
  const bottomHost = document.createElement('div');
  bottomHost.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${BOTTOM_BAR_H}px;z-index:10`;
  // overlayHost 双用途：选关长卷（无 sim 时）/ 结算浮层（终局时）——容器数对齐 game-q 宿主先例（5 个）。
  const overlayHost = document.createElement('div');
  overlayHost.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none';
  scene.append(topHost, bottomHost, overlayHost);
  wrapper.appendChild(scene);
  container.appendChild(wrapper);

  const input = new QueuedInputSource('t');
  let starsByNo = loadStars();

  // ── world → HUD 投影（纯读·outcome-first）───────────────────────────────────
  let levelSpec: LevelSpec | null = null;
  let resultFrozen: { stars: number; brush: number; finalScore: number } | null = null;

  function readState(engine: Engine): HudState {
    const w = engine.world;
    const spec = levelSpec!;
    const res = (id: string): number => {
      for (const [eid] of w.query('Resource')) {
        const r = w.getComponent<Resource>(eid, 'Resource');
        if (r?.id === id) return r.current;
      }
      return 0;
    };
    const flowCur = w.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? 'playing';
    const status = flowCur === 'victory' ? 'win' : flowCur === 'defeat' ? 'lose' : flowCur === 'lastcall' ? 'settling' : 'playing';
    const score = Math.round(res('score'));
    const moves = Math.round(res('moves'));
    return {
      levelNo: spec.no,
      levelName: spec.name,
      moves,
      score,
      goals: goalRequirements(spec).map((g) => ({ label: g.label, cur: Math.round(res(g.rid)), need: g.need })),
      status,
      stars: resultFrozen?.stars ?? 0,
      brush: resultFrozen?.brush ?? 0,
      finalScore: resultFrozen?.finalScore ?? score,
      selIndex: w.getComponent<MatchBoard>('board', 'MatchBoard')?.selIndex ?? -1,
      cols: spec.cols,
      muted: isMuted(),
      hasNext: LEVELS.some((l) => l.no === spec.no + 1),
    };
  }

  // ── 音效 diff（纯读世界变化 → 合成端口·不碰 sim/hash）───────────────────────────
  let prevScore = 0;
  let prevMoves = 0;
  let chainLevel = 0;
  let prevStatus: HudState['status'] = 'playing';
  function syncAudio(st: HudState): void {
    if (st.moves < prevMoves) {
      playTSfx('swap');
      chainLevel = 0;
    }
    if (st.score > prevScore) {
      chainLevel += 1;
      playTSfx(chainLevel >= 3 ? 'clear3' : chainLevel === 2 ? 'clear2' : 'clear');
    }
    if (st.status !== prevStatus) {
      if (st.status === 'win') {
        playTSfx('win');
        playTSfx('star');
      } else if (st.status === 'lose') playTSfx('lose');
    }
    prevScore = st.score;
    prevMoves = st.moves;
    prevStatus = st.status;
  }

  // ── UI 挂载（选关屏 / 关内 HUD / 结算浮层）──────────────────────────────────────
  let selectUi: MountHandle | null = null;
  let topUi: MountHandle | null = null;
  let bottomUi: MountHandle | null = null;
  let overlayUi: MountHandle | null = null;
  let lastSig = '';

  const handlers: HandlerMap = {
    play: (arg?: string) => {
      playTSfx('tap');
      const spec = LEVELS.find((l) => l.no === Number(arg));
      if (spec) startLevel(spec);
    },
    retry: () => {
      playTSfx('tap');
      if (levelSpec) startLevel(levelSpec);
    },
    next: () => {
      playTSfx('tap');
      const nxt = levelSpec && LEVELS.find((l) => l.no === levelSpec!.no + 1);
      if (nxt) startLevel(nxt);
    },
    back: () => {
      playTSfx('tap');
      showSelect();
    },
    toggle_mute: () => {
      setMuted(!isMuted());
      if (sim) {
        lastSig = '';
        refreshHud(sim.engine);
      } else showSelect();
    },
  };

  function closeOverlay(): void {
    overlayUi?.();
    overlayUi = null;
    overlayHost.style.pointerEvents = 'none';
  }
  function refreshHud(engine: Engine): void {
    const st = readState(engine);
    syncAudio(st);
    // 终局首见：冻结结算（星级/收笔）+ 存档（星取历史最高）
    if (st.status === 'win' && !resultFrozen && levelSpec) {
      const brush = Math.max(0, st.moves) * BRUSH_PER_MOVE;
      const total = finalScore(st.score, st.moves);
      resultFrozen = { stars: starsFor(total, levelSpec), brush, finalScore: total };
      starsByNo = { ...starsByNo, [levelSpec.no]: Math.max(starsByNo[levelSpec.no] ?? 0, resultFrozen.stars) };
      saveStars(starsByNo);
    }
    const view = resultFrozen ? { ...st, stars: resultFrozen.stars, brush: resultFrozen.brush, finalScore: resultFrozen.finalScore } : st;
    const sig = JSON.stringify([view.moves, view.score, view.goals, view.status, view.selIndex, view.muted]);
    if (sig !== lastSig) {
      lastSig = sig;
      topUi?.update(buildTopBar(view), apolloToon);
      bottomUi?.update(buildBottomBar(view), apolloToon);
    }
    if (view.status === 'win' || view.status === 'lose') {
      if (!overlayUi) {
        overlayHost.style.pointerEvents = 'auto';
        overlayUi = mountUI(overlayHost, buildResultOverlay(view), handlers, apolloToon, input);
      } else {
        overlayUi.update(buildResultOverlay(view), apolloToon);
      }
      engine.stop(); // 局终冻结 sim（浮层已盖·省 CPU·幂等）
    } else if (overlayUi) {
      closeOverlay();
    }
  }

  // ── sim 生命周期（每关一世界·可重开）─────────────────────────────────────────
  let sim: { engine: Engine; renderer: CanvasRenderer; canvas: HTMLCanvasElement; onDown: (e: PointerEvent) => void; unsub: () => void } | null = null;

  function stopSim(): void {
    if (!sim) return;
    sim.unsub();
    sim.engine.stop();
    sim.canvas.removeEventListener('pointerdown', sim.onDown);
    sim.renderer.destroy();
    sim = null;
  }

  function startLevel(spec: LevelSpec): void {
    selectUi?.();
    selectUi = null;
    closeOverlay();
    stopSim();
    levelSpec = spec;
    resultFrozen = null;
    prevScore = 0;
    prevMoves = spec.moves;
    chainLevel = 0;
    prevStatus = 'playing';
    lastSig = '';

    const engine = new Engine({ input });
    engine.load(buildLevelBlueprint(spec));
    const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
    engine.attachRenderer(renderer, scene);
    const canvas = scene.querySelector('canvas') as HTMLCanvasElement;
    canvas.style.zIndex = '0';
    const onDown = (e: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const p = canvasPointerToScreen(e.clientX, e.clientY, rect, canvas.width / dpr, canvas.height / dpr);
      input.enqueue({ source: 't', x: p.x, y: p.y, phase: 'down' });
    };
    canvas.addEventListener('pointerdown', onDown);
    const unsub = engine.subscribe(() => refreshHud(engine));

    const initial = readState(engine);
    topUi = mountUI(topHost, buildTopBar(initial), handlers, apolloToon, input);
    bottomUi = mountUI(bottomHost, buildBottomBar(initial), handlers, apolloToon, input);

    engine.start();
    sim = { engine, renderer, canvas, onDown, unsub };
    refreshHud(engine);
  }

  function showSelect(): void {
    stopSim();
    closeOverlay();
    topUi?.();
    topUi = null;
    bottomUi?.();
    bottomUi = null;
    levelSpec = null;
    resultFrozen = null;
    overlayHost.style.pointerEvents = 'auto'; // 选关屏借宿 overlayHost（无 sim 时它就是主屏）
    const state = { nodes: progressStates(LEVELS, starsByNo), muted: isMuted() };
    if (selectUi) selectUi.update(buildSelect(state), apolloToon);
    else selectUi = mountUI(overlayHost, buildSelect(state), handlers, apolloToon, input);
  }

  // ── 响应式缩放（定尺场景盒等比缩进容器·指针映射经 getBoundingClientRect 自动跟随）──
  const fit = (): void => {
    const cw = container.clientWidth || FIELD_W;
    const ch = container.clientHeight || FIELD_H;
    scene.style.transform = `scale(${Math.min(cw / FIELD_W, ch / FIELD_H)})`;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);
  fit();

  showSelect();

  // ── cleanup（launcher 卸载时调）────────────────────────────────────────────────
  return () => {
    stopSim();
    ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    overlayUi?.();
    topUi?.();
    bottomUi?.();
    selectUi?.();
    wrapper.remove();
  };
}
