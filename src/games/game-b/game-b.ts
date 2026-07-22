// Game B ·《雀宴》—— 宿主层（主菜单 / 设置 / 牌桌三屏·mountHost 引擎公用件·零手写 DOM 骨架）。
// 三屏（皮=专属主题·两层 1:1 律「S4 结构」）：
//   ① 主菜单（NIGHT 夜宴皮·结构照 main-menu.dc.html）→ 开始上桌 / 继续上局（同 session 续局）/ 设置
//   ② 设置（NIGHT 皮·真接线选项：AI 速度 + 默认日志·治「设置=死键」）
//   ③ 牌桌（3D 氛围场景 + sakura HUD·真牌局全走 2D LayoutNode·点真牌面打牌）。
// 红线：UI 全 LayoutNode；3D 全 render-only 组件；随机只有蓝图 RandomSeed（宿主零随机）。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap } from '@ui/components/index.js';
import { buildMenu, initialMenu, MENU_START, MENU_CONTINUE, MENU_SETTINGS } from './menu.js';
import { buildSettings, defaultSettings, SET_SPEED, SET_LOGDEFAULT, SETTINGS_BACK, type Settings, type AiSpeed } from './menu-settings.js';
import {
  startMatch, aiTurn, discard, declareTsumo, canTsumo, declareRiichi, nextRound, isPlayerTurn,
  playerCall, playerPass, isPlayerCallWindow,
  canAnkan, canKakan, ankanKinds, kakanKinds, declareAnkan, declareKakan, STRIP_ITEMS,
  type MatchState,
} from './core/game-state.js';
import {
  resolveSeatCards, seatNamesFrom, buildSessionOut, SEAT_IDS, SEAT_INDEX,
  type GameBSessionIn, type SeatId, type SeatOutcome, type SeatSessionOut,
} from './seat-cards.js';
import {
  buildPlayHud, PLAY_TILE, ACT_TSUMO, ACT_RIICHI, ACT_KAN, NEXT_ROUND, TOGGLE_LOG, BACK_MENU, COPY_LOG,
  CALL_PON, CALL_CHI, CALL_KAN, CALL_RON, CALL_PASS, MENU_OPEN, RULES_OPEN, TOGGLE_SOUND, SET_LANG,
} from './play-ui.js';
import type { Lang } from './strings.js';
import { PLAY_W, PLAY_H, MENU_W, MENU_H, MENU_BG, NIGHT } from './theme.js';

// 开局 seed：每局用**当前时钟（秒）**派生（gdd §十二·SessionIn.seed 缺省时钟种子·owner 2026-07-20）——
// 每局牌局不同。种子在 driver（非 sim）读一次、存进 match.rng.seed（日志面板标题可见）→ 全程走引擎
// RandomSeed PRNG，存 seed 即可复现整局（randomness.md「存初始 seed 复现」·不破 lockstep/回放）。
const clockSeed = (): number => Math.floor(Date.now() / 1000) % 0x7fffffff;
// AI 出牌节奏基线（ms·设置屏可调）——owner 2026-07-21「每家出牌控制在 1–3 秒」：基线 + 确定性抖动落在 1000–3000ms。
const AI_BASE_BY: Record<AiSpeed, number> = { fast: 1000, normal: 1500, slow: 2400 };

// 牌桌和室夜宴底（宿主装饰层·真美术=S6 背景件）。
const STAGE_BG = 'radial-gradient(ellipse at 50% 38%, #41283a 0%, #2a1e2b 62%, #201722 100%)';

export function mount(container: HTMLElement, host?: { exit?: () => void; sessionIn?: GameBSessionIn }): () => void {
  let teardown: (() => void) | null = null;
  const clear = (): void => { teardown?.(); teardown = null; };

  // 角色卡消费（REQ-CHARCARD·character-card.md §⑤）：mount 一次性解四席规范卡（纯确定性·必开成年硬闸
  // requireAdult·姨太题材不得省）；平台未接线（host.sessionIn=undefined）→ 内置默认卡·显示零变。
  const seatCards = resolveSeatCards(host?.sessionIn);
  const seatNames = seatNamesFrom(seatCards);   // 席名走卡桥（默认=主角/绫/莉世/小夜·显示零变）
  let lastSessionOut: Record<string, SeatSessionOut> | null = null; // 终局回传（card.id 键控·平台尚未消费·held ready）
  // 终局 SessionOut（§④·以 card.id 键控·passthrough 原样回带）：名次=按最终点数降序·脱衣=STRIP_ITEMS-剩余。
  const computeSessionOut = (m: MatchState): Record<string, SeatSessionOut> => {
    const rankBySeat = new Map<number, number>();
    [0, 1, 2, 3].slice().sort((a, b) => m.scores[b]! - m.scores[a]!).forEach((seat, i) => rankBySeat.set(seat, i + 1));
    const outcomes = {} as Record<SeatId, SeatOutcome>;
    for (const id of SEAT_IDS) {
      const seat = SEAT_INDEX[id];
      outcomes[id] = { rank: rankBySeat.get(seat)!, score: m.scores[seat]!, stripped: STRIP_ITEMS - m.clothing[seat]! };
    }
    return buildSessionOut(seatCards, outcomes);
  };

  const settings: Settings = defaultSettings(); // 菜单↔设置↔牌桌之间存活
  let lang: Lang = 'ja';                         // 语言（默认日文·owner 2026-07-21·三屏共用·牌桌菜单切换）
  let savedMatch: MatchState | null = null;     // 同 session 续局（返回菜单时暂存·未终局才可续）
  const canContinue = (): boolean => savedMatch !== null && !savedMatch.over;

  // ── 主菜单屏（NIGHT 皮·结构照稿·全 UI 无 3D·overlayHost auto 让按钮可点）───────────
  function showMenu(): void {
    clear();
    const skel = mountHost(container, { fieldW: MENU_W, fieldH: MENU_H, sceneBackground: MENU_BG, wrapperBackground: '#160d1b' });
    skel.overlayHost.style.pointerEvents = 'auto';
    const ui = mountUI(skel.overlayHost, buildMenu({ ...initialMenu(), hasSave: canContinue() }, lang), {
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
    const render = (): void => { ui.update(buildSettings(settings, lang), NIGHT); };
    const ui = mountUI(skel.overlayHost, buildSettings(settings, lang), {
      [SET_SPEED]: (arg?: string) => { if (arg === 'fast' || arg === 'normal' || arg === 'slow') { settings.aiSpeed = arg; render(); } },
      [SET_LOGDEFAULT]: () => { settings.logDefault = !settings.logDefault; render(); },
      [SETTINGS_BACK]: () => showMenu(),
    }, NIGHT);
    teardown = () => { ui(); skel.teardown(); };
  }

  // ── 牌桌屏（3D 氛围场景 + LayoutNode 对局 HUD·driver 驱动一局跑起来）──────────────────
  function showTable(resume?: MatchState): void {
    clear();
    const skel = mountHost(container, { fieldW: PLAY_W, fieldH: PLAY_H, sceneBackground: STAGE_BG, wrapperBackground: '#160d1b' });

    // SC-play v2（owner 2026-07-20 新稿 506ef9d6）：对局屏第一波**纯 2D LayoutNode**——出牌区 2D 牌河先行，
    // 3D 麻将区留下一波尝试（owner「先用 2D 做·我要交付版本」）。种子仍每局时钟（秒）·续局沿用。
    const seed = resume ? resume.rng.seed : clockSeed();

    // ── 对局状态机（headless 逻辑核·§2/③）+ HUD 投影驱动 ────────────────────────────
    const match = resume ?? startMatch(seed, seatNames); // 席名走角色卡桥（REQ-CHARCARD）
    match.interactiveCalls = true; // 开鸣牌窗口（P4·owner 点名先上鸣牌·玩家可碰/吃/荣）
    let logOpen = settings.logDefault;
    let selectedKey: string | null = null; // 两步打牌：选中的手牌位（null=未选）
    let logCopied = false;                  // 日志复制反馈（短暂）
    let menuOpen = false;                   // 游戏内菜单浮层（菜单钮开）
    let rulesOpen = false;                  // 规则说明浮层（菜单→规则）
    let soundOn = true;                     // 声音开关（视觉态·音频系统待接）
    let aiTimer: ReturnType<typeof setTimeout> | null = null;
    skel.overlayHost.style.pointerEvents = 'auto'; // 对局 HUD 全可点

    const render = (): void => {
      if (match.over) lastSessionOut = computeSessionOut(match); // 终局回传就绪（REQ-CHARCARD·纯确定性·平台尚未消费）
      ui.update(buildPlayHud(match, { logOpen, selectedKey, logCopied, menuOpen, rulesOpen, soundOn, lang }), NIGHT);
    };
    const clearAi = (): void => { if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } };
    // AI 出牌用时（owner「1–3 秒」）：速度档基线 + 据牌局状态的确定性抖动（非裸随机·可复现）→ 落 1000–3000ms。
    const aiDelay = (): number => Math.min(3000, AI_BASE_BY[settings.aiSpeed] + (match.cur.wall.length * 37 + match.cur.turn * 101 + match.honba * 7) % 1500);
    // AI 席逐步推进（节奏可见）→ 到玩家行动 / 玩家待鸣窗口 / 菜单浮层 / 局终 停。
    const scheduleAi = (): void => {
      clearAi();
      if (menuOpen || rulesOpen) return; // 菜单/规则浮层开着=暂停 AI（读秒停·别在浮层后偷跑）
      // 玩家待鸣窗口开着时绝不推进 AI（否则 aiTurn 会替玩家代决鸣牌）——停下等玩家点按钮。
      if (match.cur.phase === 'playing' && match.cur.turn !== 0 && match.cur.callWindow === null) {
        aiTimer = setTimeout(() => { aiTurn(match); render(); scheduleAi(); }, aiDelay());
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
      // 游戏内菜单浮层：菜单钮开/关（开时暂停 AI 读秒·关时恢复）；规则说明子浮层；声音开关（视觉态）。
      [MENU_OPEN]: () => { menuOpen = !menuOpen; if (!menuOpen) rulesOpen = false; if (menuOpen) clearAi(); else scheduleAi(); render(); },
      [RULES_OPEN]: () => { rulesOpen = !rulesOpen; render(); },
      [TOGGLE_SOUND]: () => { soundOn = !soundOn; render(); },
      [SET_LANG]: () => { lang = lang === 'ja' ? 'zh' : 'ja'; render(); }, // 日 ⇄ 中 即时切换（默认日文）

      [BACK_MENU]: () => { savedMatch = match.over ? null : match; showMenu(); }, // 未终局暂存→菜单可续
    };

    const ui = mountUI(skel.overlayHost, buildPlayHud(match, { logOpen, selectedKey, logCopied, lang }), handlers, NIGHT);
    scheduleAi(); // 若当前为 AI 席（续局可能停在 AI 手）则自动推进
    render();

    teardown = () => {
      clearAi();
      ui();
      skel.teardown();
    };
  }

  showMenu();
  // 返回句柄挂 getSessionOut（REQ-CHARCARD·暴露终局回传·平台/runner 尚未消费·供未来接线与测试读）。
  return Object.assign((): void => clear(), { getSessionOut: (): Record<string, SeatSessionOut> | null => lastSessionOut });
}
