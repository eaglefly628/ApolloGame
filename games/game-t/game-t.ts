// Game T ·《墨消》—— 宿主层（run2·mount-host helper + PointerInputSource·零手写 DOM 骨架·零玩法逻辑）。
//
// 职责（都在 sim 外）：mountHost 搭五容器骨架（引擎公用件·REQ-AUDIT-守门 C）；每关建 Engine +
// CanvasRenderer + PointerInputSource（down=点选起点·up 自动合成 drag → t2-match3-drag-swap 桥）；
// world 资源/流程投影进 LayoutNode HUD；选关长卷 ⇄ 关卡切换；结算浮层与星级存档（localStorage·
// host 关卡进度非 sim 态）；音效 diff。胜负判定在 sim（t3-flow）——宿主只读 GameFlow.current 摆 UI。
//
// 输入闸双保险：sim 侧 Clickable.onlyFlag='can-play'（flow 终局/结算窗 onEnter 落闸）；宿主侧在
// status 离开 playing 时 dispose 输入源——t2-match3-drag-swap 现不查邻格 onlyFlag（缺口已提主池
// REQ-INPUT-拖拽-onlyFlag），宿主停喂 drag 动作把窗口关死。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { CanvasRenderer } from '@zerocraft/engine/renderer/index.js';
import { mountHost } from '@zerocraft/engine/engine/host/mount-host.js';
import { PointerInputSource, type InputSource, type Command } from '@zerocraft/engine/net/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { MountHandle, HandlerMap } from '@zerocraft/engine/ui/components/index.js';
import { apolloToon } from '@zerocraft/engine/ui/apollo-toon-theme.js';
import type { GameFlow, Resource, MatchBoard } from '@zerocraft/engine/engine/protocol/components.js';
import { buildLevelBlueprint } from './blueprint.js';
import { LEVELS, type LevelSpec, finalScore, starsFor, goalRequirements, progressStates, chapterStartingAt } from './levels.js';
import { buildSelect, buildTopBar, buildBottomBar, buildResultOverlay, buildChapterIntro, type HudState } from './hud.js';
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
  // ── 宿主骨架 = 引擎公用件（五容器+等比缩放+teardown 全在 helper·本层零 DOM 手作）──
  const skel = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    topBarH: TOP_BAR_H,
    bottomBarH: BOTTOM_BAR_H,
    sceneBackground: PAPER_BG,
    wrapperBackground: '#171310',
  });
  const { scene, topHost, bottomHost, overlayHost } = skel;

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

  // ── UI 挂载（选关屏 / 关内 HUD / 结算浮层·选关屏借宿 overlayHost）────────────────
  let selectUi: MountHandle | null = null;
  let topUi: MountHandle | null = null;
  let bottomUi: MountHandle | null = null;
  let overlayUi: MountHandle | null = null;
  let chapterUi: MountHandle | null = null; // 章节过场（章首关未过时·借宿 overlayHost）
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
    chapter_go: () => {
      playTSfx('tap');
      closeChapter();
    },
  };

  function closeChapter(): void {
    if (!chapterUi) return;
    chapterUi();
    chapterUi = null;
    overlayHost.style.pointerEvents = 'none';
  }

  function closeOverlay(): void {
    overlayUi?.();
    overlayUi = null;
    overlayHost.style.pointerEvents = 'none';
  }
  function refreshHud(engine: Engine): void {
    const st = readState(engine);
    syncAudio(st);
    // 输入闸宿主半：离开 playing 即断输入源（drag 桥不查 onlyFlag 的缺口由此关死·见头注）
    if (st.status !== 'playing' && sim && !sim.inputDead) {
      sim.input.dispose();
      sim.seam.current = null; // 断流：已入队未消费的指针命令一并作废
      sim.inputDead = true;
    }
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
        overlayUi = mountUI(overlayHost, buildResultOverlay(view), handlers, apolloToon);
      } else {
        overlayUi.update(buildResultOverlay(view), apolloToon);
      }
      engine.stop(); // 局终冻结 sim（浮层已盖·省 CPU·幂等）
    } else if (overlayUi) {
      closeOverlay();
    }
  }

  // ── sim 生命周期（每关一世界·可重开）─────────────────────────────────────────
  let sim: {
    engine: Engine;
    renderer: CanvasRenderer;
    input: PointerInputSource;
    seam: { current: InputSource | null };
    inputDead: boolean;
    unsub: () => void;
  } | null = null;

  function stopSim(): void {
    if (!sim) return;
    sim.unsub();
    sim.engine.stop();
    if (!sim.inputDead) sim.input.dispose();
    sim.renderer.destroy();
    sim = null;
  }

  function startLevel(spec: LevelSpec): void {
    selectUi?.();
    selectUi = null;
    closeChapter();
    closeOverlay();
    stopSim();
    levelSpec = spec;
    resultFrozen = null;
    prevScore = 0;
    prevMoves = spec.moves;
    chainLevel = 0;
    prevStatus = 'playing';
    lastSig = '';

    // 输入接缝：Engine 构造期需 InputSource，而 PointerInputSource 需画布（attachRenderer 后才有）——
    // 薄转发器先占位、画布就绪后接真源（纯转发·零输入逻辑；down=点选起点·up 合成 drag/click·dpr 校正全在 Pointer 源）。
    const seam: InputSource & { current: InputSource | null } = {
      current: null,
      commandsForTick(tick: number): Command[] {
        return this.current?.commandsForTick(tick) ?? [];
      },
    };
    const engine = new Engine({ input: seam });
    engine.load(buildLevelBlueprint(spec));
    const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
    engine.attachRenderer(renderer, scene);
    const canvas = scene.querySelector('canvas') as HTMLCanvasElement;
    canvas.style.zIndex = '0';
    const input = new PointerInputSource('t', canvas);
    seam.current = input;

    const unsub = engine.subscribe(() => refreshHud(engine));
    const initial = readState(engine);
    topUi = mountUI(topHost, buildTopBar(initial), handlers, apolloToon, input);
    bottomUi = mountUI(bottomHost, buildBottomBar(initial), handlers, apolloToon, input);

    engine.start();
    sim = { engine, renderer, input, seam, inputDead: false, unsub };
    refreshHud(engine);

    // 章节过场（GDD §二点五）：章首关且未过 → 弹师父登场卡（盖板可见开局落子·点「领训」开打）
    const ch = chapterStartingAt(spec.no);
    if (ch && !((starsByNo[spec.no] ?? 0) > 0)) {
      overlayHost.style.pointerEvents = 'auto';
      chapterUi = mountUI(overlayHost, buildChapterIntro(ch), handlers, apolloToon);
    }
  }

  function showSelect(): void {
    stopSim();
    closeChapter();
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
    else selectUi = mountUI(overlayHost, buildSelect(state), handlers, apolloToon);
  }

  showSelect();

  // ── cleanup（launcher 卸载时调）────────────────────────────────────────────────
  return () => {
    stopSim();
    chapterUi?.();
    overlayUi?.();
    topUi?.();
    bottomUi?.();
    selectUi?.();
    skel.teardown();
  };
}
