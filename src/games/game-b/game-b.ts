// Game B ·《雀宴》—— 宿主层（主菜单 / 设置 / 牌桌三屏·mountHost 引擎公用件·零手写 DOM 骨架）。
// 三屏（皮=专属主题·两层 1:1 律「S4 结构」）：
//   ① 主菜单（NIGHT 夜宴皮·结构照 main-menu.dc.html）→ 开始上桌 / 继续上局（同 session 续局）/ 设置
//   ② 设置（NIGHT 皮·真接线选项：AI 速度 + 默认日志·治「设置=死键」）
//   ③ 牌桌（3D 氛围场景 + sakura HUD·真牌局全走 2D LayoutNode·点真牌面打牌）。
// 红线：UI 全 LayoutNode；3D 全 render-only 组件；随机只有蓝图 RandomSeed（宿主零随机）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap } from '@ui/components/index.js';
import { buildTableBlueprint } from './blueprint.js';
import { createGameBAssets } from './assets.js';
import { buildMenu, initialMenu, MENU_START, MENU_CONTINUE, MENU_SETTINGS } from './menu.js';
import { buildSettings, defaultSettings, SET_SPEED, SET_LOGDEFAULT, SETTINGS_BACK, type Settings, type AiSpeed } from './menu-settings.js';
import {
  startMatch, aiTurn, discard, declareTsumo, canTsumo, declareRiichi, nextRound, isPlayerTurn,
  type MatchState,
} from './core/game-state.js';
import { buildPlayHud, PLAY_TILE, ACT_TSUMO, ACT_RIICHI, NEXT_ROUND, TOGGLE_LOG, BACK_MENU, COPY_LOG } from './play-ui.js';
import { FIELD_W, FIELD_H, MENU_W, MENU_H, MENU_BG, SAKURA, NIGHT, TINT } from './theme.js';

// 开局 seed（gdd §十二·SessionIn.seed 缺省时钟种子入参化·S3 固定值可复现）。
const S3_SEED = 20260717;
// AI 逐步节奏（ms·设置屏可调·让玩家看清每家摸打·owner「太快跟不上」→放慢普通档）。
const AI_DELAY_BY: Record<AiSpeed, number> = { fast: 480, normal: 780, slow: 1150 };

// 牌桌和室夜宴底（宿主装饰层·真美术=S6 背景件）。
const STAGE_BG = 'radial-gradient(ellipse at 50% 38%, #41283a 0%, #2a1e2b 62%, #201722 100%)';

export function mount(container: HTMLElement): () => void {
  let teardown: (() => void) | null = null;
  const clear = (): void => { teardown?.(); teardown = null; };

  const settings: Settings = defaultSettings(); // 菜单↔设置↔牌桌之间存活
  let savedMatch: MatchState | null = null;     // 同 session 续局（返回菜单时暂存·未终局才可续）
  const canContinue = (): boolean => savedMatch !== null && !savedMatch.over;

  // ── 主菜单屏（NIGHT 皮·结构照稿·全 UI 无 3D·overlayHost auto 让按钮可点）───────────
  function showMenu(): void {
    clear();
    const skel = mountHost(container, { fieldW: MENU_W, fieldH: MENU_H, sceneBackground: MENU_BG, wrapperBackground: '#160d1b' });
    skel.overlayHost.style.pointerEvents = 'auto';
    const ui = mountUI(skel.overlayHost, buildMenu({ ...initialMenu(), hasSave: canContinue() }), {
      [MENU_START]: () => { savedMatch = null; showTable(); },              // 新局：弃旧续局
      [MENU_CONTINUE]: () => { if (canContinue()) showTable(savedMatch!); }, // 续同 session 未终局
      [MENU_SETTINGS]: () => showSettings(),
    }, NIGHT);
    teardown = () => { ui(); skel.teardown(); };
  }

  // ── 设置屏（NIGHT 皮·真接线选项·改了回菜单即生效）───────────────────────────────────
  function showSettings(): void {
    clear();
    const skel = mountHost(container, { fieldW: MENU_W, fieldH: MENU_H, sceneBackground: MENU_BG, wrapperBackground: '#160d1b' });
    skel.overlayHost.style.pointerEvents = 'auto';
    const render = (): void => { ui.update(buildSettings(settings), NIGHT); };
    const ui = mountUI(skel.overlayHost, buildSettings(settings), {
      [SET_SPEED]: (arg?: string) => { if (arg === 'fast' || arg === 'normal' || arg === 'slow') { settings.aiSpeed = arg; render(); } },
      [SET_LOGDEFAULT]: () => { settings.logDefault = !settings.logDefault; render(); },
      [SETTINGS_BACK]: () => showMenu(),
    }, NIGHT);
    teardown = () => { ui(); skel.teardown(); };
  }

  // ── 牌桌屏（3D 氛围场景 + LayoutNode 对局 HUD·driver 驱动一局跑起来）──────────────────
  function showTable(resume?: MatchState): void {
    clear();
    const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: STAGE_BG, wrapperBackground: '#1c141d' });

    // 3D 牌桌 = 氛围场景（桌/牌山/席位牌背·真引擎渲染·对局交互全走 2D HUD）。
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
    const match = resume ?? startMatch(S3_SEED);
    const aiDelay = AI_DELAY_BY[settings.aiSpeed];
    let logOpen = settings.logDefault;
    let selectedKey: string | null = null; // 两步打牌：选中的手牌位（null=未选）
    let logCopied = false;                  // 日志复制反馈（短暂）
    let aiTimer: ReturnType<typeof setTimeout> | null = null;
    skel.overlayHost.style.pointerEvents = 'auto'; // 对局 HUD 全可点

    const render = (): void => { ui.update(buildPlayHud(match, { logOpen, selectedKey, logCopied }), SAKURA); };
    const clearAi = (): void => { if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } };
    // AI 席逐步推进（节奏可见）→ 到玩家/局终停。
    const scheduleAi = (): void => {
      clearAi();
      if (match.cur.phase === 'playing' && match.cur.turn !== 0) {
        aiTimer = setTimeout(() => { aiTurn(match); render(); scheduleAi(); }, aiDelay);
      }
    };
    // 手牌位 key（'0'..'12'/'d'）→ 牌码（两步打牌第二下映射·打出用真牌码）。
    const keyToCode = (key: string): number | null => (key === 'd' ? match.cur.drawn : (match.cur.hands[0]![Number(key)] ?? null));

    const handlers: HandlerMap = {
      // 两步打牌（owner 需求）：第一下选中站起·同一张再点=打出·点别张=改选。
      [PLAY_TILE]: (arg?: string) => {
        if (!isPlayerTurn(match) || arg == null) return;
        if (selectedKey === arg) {
          const code = keyToCode(arg);
          if (code != null) { discard(match, code); selectedKey = null; render(); scheduleAi(); }
        } else { selectedKey = arg; render(); }
      },
      [ACT_TSUMO]: () => { if (canTsumo(match)) { declareTsumo(match); selectedKey = null; render(); } },
      [ACT_RIICHI]: () => { declareRiichi(match); selectedKey = null; render(); scheduleAi(); }, // 内含 canRiichi 门·宣言牌打出后推进
      [NEXT_ROUND]: () => { if (!match.over) { nextRound(match); selectedKey = null; render(); scheduleAi(); } },
      [TOGGLE_LOG]: () => { logOpen = !logOpen; render(); },
      [COPY_LOG]: () => { // 复制完整日志到剪贴板（查 bug·贴给 owner）
        try {
          void navigator.clipboard?.writeText(match.log.dump());
          logCopied = true; render();
          setTimeout(() => { logCopied = false; render(); }, 1600);
        } catch { /* 无剪贴板权限=静默（面板仍可肉眼读） */ }
      },
      [BACK_MENU]: () => { savedMatch = match.over ? null : match; showMenu(); }, // 未终局暂存→菜单可续
    };

    const ui = mountUI(skel.overlayHost, buildPlayHud(match, { logOpen, selectedKey, logCopied }), handlers, SAKURA);
    scheduleAi(); // 若当前为 AI 席（续局可能停在 AI 手）则自动推进
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
