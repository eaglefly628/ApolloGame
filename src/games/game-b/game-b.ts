// Game B ·《雀宴》—— 宿主层（S3 骨架 + 主菜单屏·mountHost 引擎公用件·零手写 DOM 骨架·零玩法逻辑）。
//
// 两屏（两层 1:1 律「S4 结构」·结构照 mockups/·皮=专属主题·S5 精修）：
//   ① 主菜单（NIGHT 夜宴皮·凤翎/明朝/粉金·结构照 main-menu.dc.html）→ 点「开始上桌」→
//   ② 牌桌（3D 世界 + sakura HUD·结构照 ui-mockup.dc.html §四·手牌 Pickable3D 拾取）。
// 红线：UI 全 LayoutNode；3D 全 render-only 组件；随机只有蓝图 RandomSeed（宿主零随机）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap } from '@ui/components/index.js';
import { buildTableBlueprint } from './blueprint.js';
import { createGameBAssets } from './assets.js';
import { buildMenu, initialMenu, MENU_START, MENU_CONTINUE, MENU_SETTINGS } from './menu.js';
import {
  startMatch, aiTurn, discard, declareTsumo, canTsumo, declareRiichi, nextRound, isPlayerTurn, isWinLikeEnd,
} from './core/game-state.js';
import { buildPlayHud, PLAY_TILE, ACT_TSUMO, ACT_RIICHI, NEXT_ROUND, TOGGLE_LOG, BACK_MENU } from './play-ui.js';
import { FIELD_W, FIELD_H, MENU_W, MENU_H, MENU_BG, SAKURA, NIGHT, TINT } from './theme.js';

// 开局 seed（gdd §十二·SessionIn.seed 缺省时钟种子入参化·S3 固定值可复现）。
const S3_SEED = 20260717;
const AI_DELAY = 560; // AI 逐步节奏（ms·让玩家看清每家摸打）

// 牌桌和室夜宴底（宿主装饰层·真美术=S6 背景件）。
const STAGE_BG = 'radial-gradient(ellipse at 50% 38%, #41283a 0%, #2a1e2b 62%, #201722 100%)';

export function mount(container: HTMLElement): () => void {
  let teardown: (() => void) | null = null;
  const clear = (): void => { teardown?.(); teardown = null; };

  // ── 主菜单屏（NIGHT 皮·结构照稿·全 UI 无 3D·overlayHost auto 让按钮可点）───────────
  function showMenu(): void {
    clear();
    const skel = mountHost(container, { fieldW: MENU_W, fieldH: MENU_H, sceneBackground: MENU_BG, wrapperBackground: '#160d1b' });
    skel.overlayHost.style.pointerEvents = 'auto';
    const ui = mountUI(skel.overlayHost, buildMenu(initialMenu()), {
      [MENU_START]: () => showTable(),
      [MENU_CONTINUE]: () => showTable(),
      [MENU_SETTINGS]: () => { /* S5 设置屏（结构照稿后补） */ },
    }, NIGHT);
    teardown = () => { ui(); skel.teardown(); };
  }

  // ── 牌桌屏（3D 氛围场景 + LayoutNode 对局 HUD·driver 驱动一局跑起来）──────────────────
  function showTable(): void {
    clear();
    const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: STAGE_BG, wrapperBackground: '#1c141d' });

    // 3D 牌桌 = 氛围场景（桌/牌山/席位/手牌展示·真引擎渲染·对局交互走 HUD）。
    const { assets, ready } = createGameBAssets();
    const engine = new Engine();
    engine.load(buildTableBlueprint({ seed: S3_SEED }));
    const renderer = new ThreeRenderer({
      width: FIELD_W, height: FIELD_H, background: TINT.stageBg,
      assets, antialias: false, dprCap: 1.5, shadowMapSize: 1024,
    });
    engine.attachRenderer(renderer, skel.scene);
    void ready.then(() => renderer.invalidate());
    engine.start();

    // ── 对局状态机（headless 逻辑核·§2/③）+ HUD 投影驱动 ────────────────────────────
    const match = startMatch(S3_SEED);
    let logOpen = false;
    let aiTimer: ReturnType<typeof setTimeout> | null = null;
    skel.overlayHost.style.pointerEvents = 'auto'; // 对局 HUD 全可点

    const render = (): void => { ui.update(buildPlayHud(match, { logOpen }), SAKURA); };
    const clearAi = (): void => { if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } };
    // AI 席逐步推进（节奏可见）→ 到玩家/局终停。
    const scheduleAi = (): void => {
      clearAi();
      if (match.cur.phase === 'playing' && match.cur.turn !== 0) {
        aiTimer = setTimeout(() => { aiTurn(match); render(); scheduleAi(); }, AI_DELAY);
      }
    };

    const handlers: HandlerMap = {
      [PLAY_TILE]: (arg?: string) => { if (isPlayerTurn(match) && arg != null) { discard(match, Number(arg)); render(); scheduleAi(); } },
      [ACT_TSUMO]: () => { if (canTsumo(match)) { declareTsumo(match); render(); } },
      [ACT_RIICHI]: () => { declareRiichi(match); render(); scheduleAi(); }, // 内含 canRiichi 门·宣言牌打出后推进
      [NEXT_ROUND]: () => { if (!match.over) { nextRound(match); render(); scheduleAi(); } },
      [TOGGLE_LOG]: () => { logOpen = !logOpen; render(); },
      [BACK_MENU]: () => showMenu(),
    };

    const ui = mountUI(skel.overlayHost, buildPlayHud(match, { logOpen }), handlers, SAKURA);
    scheduleAi(); // 若开局非玩家先手则自动推进（东1 庄=玩家·此处等玩家点牌）
    render();

    teardown = () => {
      clearAi();
      engine.stop();
      renderer.destroy();
      ui();
      skel.teardown();
    };
  }

  showMenu();
  return () => clear();
}
