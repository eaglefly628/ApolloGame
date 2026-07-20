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
  playerCall, playerPass, isPlayerCallWindow,
  canAnkan, canKakan, ankanKinds, kakanKinds, declareAnkan, declareKakan,
  type MatchState,
} from './core/game-state.js';
import {
  buildPlayHud, PLAY_TILE, ACT_TSUMO, ACT_RIICHI, ACT_KAN, NEXT_ROUND, TOGGLE_LOG, BACK_MENU, COPY_LOG,
  CALL_PON, CALL_CHI, CALL_KAN, CALL_RON, CALL_PASS,
} from './play-ui.js';
import { FIELD_W, FIELD_H, MENU_W, MENU_H, MENU_BG, SAKURA, NIGHT, TINT } from './theme.js';

// 开局 seed：每局用**当前时钟（秒）**派生（gdd §十二·SessionIn.seed 缺省时钟种子·owner 2026-07-20）——
// 每局牌局不同。种子在 driver（非 sim）读一次、存进 match.rng.seed（日志面板标题可见）→ 全程走引擎
// RandomSeed PRNG，存 seed 即可复现整局（randomness.md「存初始 seed 复现」·不破 lockstep/回放）。
const clockSeed = (): number => Math.floor(Date.now() / 1000) % 0x7fffffff;
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
    // 新局=当前时钟（秒）种子（每局不同）·续局=沿用原种子（续同一副牌势）。3D 桌景与牌局同种子。
    const seed = resume ? resume.rng.seed : clockSeed();
    engine.load(buildTableBlueprint({ seed }));
    const renderer = new ThreeRenderer({
      width: FIELD_W, height: FIELD_H, background: TINT.stageBg,
      assets, antialias: false, dprCap: 1.5, shadowMapSize: 1024,
    });
    engine.attachRenderer(renderer, skel.scene);
    void ready.then(() => renderer.invalidate());
    engine.start();

    // ── 对局状态机（headless 逻辑核·§2/③）+ HUD 投影驱动 ────────────────────────────
    const match = resume ?? startMatch(seed);
    match.interactiveCalls = true; // 开鸣牌窗口（P4·owner 点名先上鸣牌·玩家可碰/吃/荣）
    const aiDelay = AI_DELAY_BY[settings.aiSpeed];
    let logOpen = settings.logDefault;
    let selectedKey: string | null = null; // 两步打牌：选中的手牌位（null=未选）
    let logCopied = false;                  // 日志复制反馈（短暂）
    let aiTimer: ReturnType<typeof setTimeout> | null = null;
    skel.overlayHost.style.pointerEvents = 'auto'; // 对局 HUD 全可点

    const render = (): void => { ui.update(buildPlayHud(match, { logOpen, selectedKey, logCopied }), SAKURA); };
    const clearAi = (): void => { if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } };
    // AI 席逐步推进（节奏可见）→ 到玩家行动 / 玩家待鸣窗口 / 局终 停。
    const scheduleAi = (): void => {
      clearAi();
      // 玩家待鸣窗口开着时绝不推进 AI（否则 aiTurn 会替玩家代决鸣牌）——停下等玩家点按钮。
      if (match.cur.phase === 'playing' && match.cur.turn !== 0 && match.cur.callWindow === null) {
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
      // ── 鸣牌窗口（P4·owner 点名先上鸣牌）：碰/吃/荣/过 → 应用后推进 ──────────────────
      [CALL_PON]: () => { if (isPlayerCallWindow(match)) { playerCall(match, { type: 'pon' }); selectedKey = null; render(); scheduleAi(); } },
      [CALL_CHI]: (arg?: string) => {
        const cand = match.cur.callWindow?.options.chi[Number(arg)];
        if (isPlayerCallWindow(match) && cand) { playerCall(match, { type: 'chi', chi: cand }); selectedKey = null; render(); scheduleAi(); }
      },
      [CALL_KAN]: () => { if (isPlayerCallWindow(match)) { playerCall(match, { type: 'minkan' }); selectedKey = null; render(); scheduleAi(); } }, // 大明杠
      [CALL_RON]: () => { if (isPlayerCallWindow(match)) { playerCall(match, { type: 'ron' }); selectedKey = null; render(); scheduleAi(); } },
      [CALL_PASS]: () => { if (isPlayerCallWindow(match)) { playerPass(match); selectedKey = null; render(); scheduleAi(); } },
      // 自家回合暗杠/加杠（首个可杠·杠后岭上摸→仍玩家回合待打；加杠被抢则本局终）。
      [ACT_KAN]: () => {
        if (canAnkan(match)) declareAnkan(match, ankanKinds(match)[0]!);
        else if (canKakan(match)) declareKakan(match, kakanKinds(match)[0]!);
        else return;
        selectedKey = null; render(); scheduleAi();
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
