// game-103《幸存者核心原型》—— 卡带宿主层（mount/host·契约明许·零玩法逻辑）。
// 职责（都在 sim 外）：建 Engine + CanvasRenderer + 键盘输入源（WASD→move 命令·net applyCommands）；
// 把 world 资源/流程投影进 LayoutNode HUD；胜负浮层；重开；响应式缩放；皮肤资产；cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（见其头注）。相机=引擎 camera-follow（play-field 卷动）。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@assets/index.js';
import { KeyboardInputSource, QueuedInputSource, MultiInputSource } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { Resource, GameFlow } from '@engine/protocol/components.js';
import { mountHost } from '@engine/host/mount-host.js';
import { buildBlueprint } from './blueprint.js';
import { buildHud, buildResult, type HudState } from './hud.js';
import { VIEW_W, VIEW_H, PLAYER_DEF, LEVEL_XP, SURVIVOR_THEME } from './theme.js';

// 战场底纹（俯视网格·暗色渐晕·render-only）。
const FIELD_BG =
  'radial-gradient(120% 90% at 50% 55%, #0a1a24 0%, #04070c 82%),' +
  'repeating-linear-gradient(0deg, rgba(80,140,170,0.06) 0 1px, transparent 1px 26px),' +
  'repeating-linear-gradient(90deg, rgba(80,140,170,0.06) 0 1px, transparent 1px 26px)';

export function mount(container: HTMLElement): () => void {
  const { scene, overlayHost, teardown } = mountHost(container, {
    fieldW: VIEW_W, fieldH: VIEW_H,
    sceneBackground: FIELD_BG, wrapperBackground: '#04070c',
  });

  // ── HUD sink（稳定·跨重开不变）+ 键盘走位源，合流为引擎输入 ────────────────
  const hudQueue = new QueuedInputSource('hud');
  const keyboard = new KeyboardInputSource('p1');
  const input = new MultiInputSource([keyboard, hudQueue]);

  // ── HUD 读态：从 world 资源/流程投影出 HudState（纯读·outcome-first）────────
  function resOf(engine: Engine, eid: string): number { return engine.world.getComponent<Resource>(eid, 'Resource')?.current ?? 0; }
  function resMax(engine: Engine, eid: string): number { return engine.world.getComponent<Resource>(eid, 'Resource')?.max ?? 0; }
  function readState(engine: Engine): HudState {
    const cur = engine.world.getComponent<GameFlow>('flow', 'GameFlow')?.current;
    return {
      hp: Math.max(0, Math.round(resOf(engine, 'player'))),
      maxHp: PLAYER_DEF.maxHp,
      xp: Math.round(resOf(engine, 'collector')),
      xpMax: resMax(engine, 'collector') || LEVEL_XP,
      level: Math.round(resOf(engine, 'level')),
      elapsed: Math.round(resOf(engine, 'clock')),
      score: Math.round(resOf(engine, 'killbox')),
      status: cur === 'victory' ? 'victory' : cur === 'defeat' ? 'defeat' : 'playing',
    };
  }

  const handlers: HandlerMap = { restart: () => restart() };
  const initial: HudState = { hp: PLAYER_DEF.maxHp, maxHp: PLAYER_DEF.maxHp, xp: 0, xpMax: LEVEL_XP, level: 1, elapsed: 0, score: 0, status: 'playing' };
  overlayHost.style.pointerEvents = 'auto';
  const hudUi: MountHandle = mountUI(overlayHost, buildHud(initial), handlers, SURVIVOR_THEME, hudQueue);
  let showingResult = false;

  let lastSig = '';
  function refreshHud(engine: Engine): void {
    const st = readState(engine);
    if (st.status === 'playing') {
      const sig = `${st.hp}|${st.xp}|${st.level}|${st.elapsed}|${st.score}`;
      if (sig !== lastSig) { lastSig = sig; hudUi.update(buildHud(st), SURVIVOR_THEME); }
      if (showingResult) { showingResult = false; }
    } else {
      hudUi.update(buildResult(st), SURVIVOR_THEME);
      if (!showingResult) { showingResult = true; engine.stop(); } // 局终冻结 sim（浮层已盖·省 CPU）
    }
  }

  // ── 皮肤资产（美术就绪即换装·无 index/失败=回退 Shape 观感·美术是增量非依赖）──
  const skinAssets = new AssetManager(new ImageAssetLoader());
  void (async () => {
    try {
      const r = await fetch('/games/game-103/art/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      registerAssetIndex(skinAssets, parseAssetIndex(await r.json()));
      await skinAssets.loadAll();
    } catch { /* 无美术目录 → 回退程序化观感·不炸游戏 */ }
  })();

  // ── sim 生命周期（可重开）──────────────────────────────────────────────────
  let sim: { engine: Engine; renderer: CanvasRenderer; unsub: () => void } | null = null;

  function startSim(): void {
    const engine = new Engine({ input });
    engine.load(buildBlueprint());
    const renderer = new CanvasRenderer({ width: VIEW_W, height: VIEW_H, background: 'transparent', assets: skinAssets });
    engine.attachRenderer(renderer, scene);
    const canvas = scene.querySelector('canvas') as HTMLCanvasElement;
    canvas.style.zIndex = '0';
    const unsub = engine.subscribe(() => refreshHud(engine));
    engine.start();
    lastSig = '';
    refreshHud(engine);
    sim = { engine, renderer, unsub };
  }

  function stopSim(): void {
    if (!sim) return;
    sim.unsub();
    sim.engine.stop();
    sim.renderer.destroy();
    sim = null;
  }

  function restart(): void {
    showingResult = false;
    stopSim();
    hudUi.update(buildHud(initial), SURVIVOR_THEME);
    startSim();
  }

  startSim();

  // ── cleanup（launcher 卸载时调）──────────────────────────────────────────
  return () => {
    stopSim();
    hudUi();
    keyboard.dispose();
    teardown();
  };
}
