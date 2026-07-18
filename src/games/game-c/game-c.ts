// Game C ·《六人德州》—— 宿主层（S5 UI 素坯·mount-host helper·零手写 DOM·零玩法逻辑）。
//
// 职责（都在 sim 外）：mountHost 搭容器骨架 → 用 M1 逻辑核（holdem-eval + betting-engine）跑一手牌到
// 「翻牌圈·轮到主角行动」的确定性定格 → 牌局状态纯读投影进 LayoutNode 屏（mountUI·夜宴主题皮）。
// 两屏：主菜单(SC-1) ⇄ 牌桌屏；牌桌屏叠衣柜面板 + 游戏日志面板（owner 2026-07-17 查 bug 需求·确定性事件流）。
// UI 全 LayoutNode（UI 铁律）；随机全在 M1 sim 侧种子 PRNG（宿主零 Math.random）。
//
// S5 边界（诚实记账）：① 下注交互（act_*）真接 betting-engine 推进=需五家 AI（M2）到位后于 M4 接；素坯期发信号不推进。
// ② 典当（pawn_item）真接引擎 t2-craft-recipe=M4；素坯期宿主本地标记（视觉演示·不碰 sim/hash）。③ 3D 牌房=M3 render-only。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { FIELD_W, FIELD_H, ROOM_BG, WRAPPER_BG, GAME_C_THEME, OPPONENT_ANCHORS, HAND_NAME_CN } from './theme.js';
import { buildTable, buildMenu, type TableView, type SeatView, type WardrobeView, type MenuView } from './hud.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { bestOf7, HOLDEM_TYPE_ORDER } from './holdem-eval.js';
import type { BettingConfig } from './betting-engine.js';
import { HoldemSession } from './game-session.js';
import { build3DTableBlueprint } from './build3d.js';
import { Chip3D } from './chip3d.js';

const CFG: BettingConfig = { smallBlind: 25, bigBlind: 50 }; // GDD §11.5-1 现金局默认盲注
const DEMO_SEED = 20260717; // 素坯定格种子（确定性·同种子同牌面同日志）
const HERO = 0; // 主角=座位 0（正南底带·§5.2）
const STARTING_STACK = 1000; // GDD §3 默认起始筹码
// 玩家档案占位（REQ-C-104 角色卡通道落地前的兜底·PST 通道接入即换真档案）。
const PLAYER = { name: '夜阑君', chips: 12860 };

export function mount(container: HTMLElement, host?: { exit: () => void }): () => void {
  const skel = mountHost(container, {
    fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: ROOM_BG, wrapperBackground: WRAPPER_BG,
  });
  const { scene, overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto'; // UI 浮层（透明区透出 scene 层 3D 牌房）

  // ── 3D 牌房（capability-plan §4-e·render-only·ThreeRenderer 消费·渲染线本体归 P3D 我只接线）─────
  const engine = new Engine();
  engine.load(build3DTableBlueprint());
  const renderer = new ThreeRenderer({ width: FIELD_W, height: FIELD_H, background: 0x140c08, antialias: false, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, scene);
  let running = false;
  const start3D = (): void => { if (!running) { engine.start(); running = true; } };
  const stop3D = (): void => { if (running) { engine.stop(); running = false; } };

  // ── 3D 物理筹码（owner 强调「筹码 3D 真实物理扔上去」·render-only·diff 下注→抛掷·§4-e）─────
  const chip3d = new Chip3D(engine, DEMO_SEED);
  let chipHandNo = 0;
  const prevTotal: Record<number, number> = {};
  const syncChips = (): void => {
    if (!running || screen !== 'table') return;
    if (session.handNo !== chipHandNo) { chip3d.clear(); for (const k of Object.keys(prevTotal)) delete prevTotal[Number(k)]; chipHandNo = session.handNo; }
    for (let seat = 0; seat < 6; seat++) {
      const cur = session.totalOf(seat), prev = prevTotal[seat] ?? 0;
      if (cur > prev) { chip3d.throwBet(seat, Math.ceil((cur - prev) / 50)); prevTotal[seat] = cur; } // 每 50 一枚·物理抛向底池
    }
  };

  // ── 玩法会话（真交互闭环：发牌→下注→AI→摊牌→结算→轮转→淘汰→局终·§4-d 线性编排）────
  let session = new HoldemSession(DEMO_SEED, CFG, STARTING_STACK);

  // ── 宿主本地态（UI 生命周期·非 sim）─────────────────────────────────────────
  let screen: 'menu' | 'table' = 'menu';
  let muted = false;
  let openWardrobe: number | null = null;
  let showLog = false;
  let raiseValue = session.legalForHero()?.raise?.min ?? CFG.bigBlind;

  const seatName = (seat: number): string =>
    seat === HERO ? '主角' : OPPONENT_ANCHORS.find((a) => a.seat === seat)?.name ?? `座位${seat}`;

  function seatView(seat: number): SeatView {
    const ss = session.seats[seat];
    const stt = session.seatState(seat);
    return {
      seat, name: seatName(seat),
      chips: session.stackOf(seat), committed: session.committedOf(seat), clothes: session.wardrobeLeft(seat),
      folded: stt.folded, allIn: stt.allIn, out: ss.eliminated,
      isActor: session.hand?.actor === seat && session.phase === 'betting',
      isHero: seat === HERO, isButton: session.buttonSeat === seat,
      lastAction: session.lastAction[seat],
    };
  }
  function wardrobeView(seat: number): WardrobeView {
    const pawned = session.seats[seat].pawned;
    return {
      seat, name: seatName(seat), isHero: seat === HERO,
      rows: CLOTHING_ITEMS.map((it) => ({ id: it.id, name: it.name, value: it.value, pawned: pawned.has(it.id) })),
    };
  }
  function heroHandName(): string {
    const hole = session.holeOf(HERO), comm = session.community;
    if (hole.length < 2 || comm.length < 3) return '';
    return HAND_NAME_CN[HOLDEM_TYPE_ORDER[bestOf7([...hole, ...comm]).value[0]]] ?? '';
  }
  function tableView(): TableView {
    const la = session.legalForHero();
    if (la?.raise && (raiseValue < la.raise.min || raiseValue > la.raise.max)) raiseValue = la.raise.min;
    const sd = session.showdown;
    return {
      blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}`, handNo: session.handNo,
      pot: session.pot(), board: session.community, heroHole: session.holeOf(HERO), heroHandName: heroHandName(),
      seats: [0, 1, 2, 3, 4, 5].map(seatView),
      toCall: la?.call ?? 0, canRaise: !!la?.raise, minRaise: la?.raise?.min ?? CFG.bigBlind,
      maxRaise: la?.raise?.max ?? STARTING_STACK, raiseValue, muted,
      openWardrobe, wardrobe: openWardrobe !== null ? wardrobeView(openWardrobe) : undefined,
      showLog, log: session.events,
      phase: session.phase, isHeroTurn: session.isHeroTurn,
      showdown: sd ? {
        rows: sd.rows.map((r) => ({ name: seatName(r.seat), type: r.type, best: r.best, hole: r.hole, won: r.won, isWinner: sd.winners.includes(r.seat) })),
        potTotal: sd.potTotal,
      } : undefined,
      finale: session.phase === 'gameover' ? { win: session.winnerSide === 'hero', ...session.stats() } : undefined,
    };
  }
  const menuView = (): MenuView => ({ playerName: PLAYER.name, playerChips: PLAYER.chips, blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}` });

  let ui: MountHandle | null = null;
  const tree = (): ReturnType<typeof buildMenu> => (screen === 'menu' ? buildMenu(menuView()) : buildTable(tableView()));
  const rerender = (): void => { ui?.update(tree()); syncChips(); };
  const remount = (): void => { ui?.(); ui = mountUI(overlayHost, tree(), handlers, GAME_C_THEME); syncChips(); };

  // ── AI 逐步演出（宿主 timer·每拍推进一个 AI·可观察「轮到谁思考/行动」·标准德州节奏·owner 2026-07-18）──
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  const AI_DELAY = 850; // 每个 AI 行动间隔 ms（看清轮到谁·不拖沓）
  const clearAiTimer = (): void => { if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; } };
  const runAITurns = (): void => {
    clearAiTimer();
    if (screen !== 'table' || !session.pendingAI) return; // 主角轮 / 摊牌 / 局终 → 停，等玩家
    aiTimer = setTimeout(() => { session.stepAI(); rerender(); runAITurns(); }, AI_DELAY);
  };
  // 主角行动 → 重渲 → 启动 AI 逐步节奏。
  const heroAct = (a: Parameters<HoldemSession['heroAct']>[0]): void => {
    if (!session.isHeroTurn) return;
    session.heroAct(a); rerender(); runAITurns();
  };
  const raiseTo = (arg?: string): number => {
    const la = session.legalForHero();
    if (!la?.raise) return 0;
    const pot = session.pot();
    const to = arg === 'half' ? session.hand!.currentBet + Math.round(pot * 0.5)
      : arg === 'twoThird' ? session.hand!.currentBet + Math.round(pot * 0.667)
        : arg === 'pot' ? session.hand!.currentBet + pot
          : arg === 'allin' ? la.raise.max
            : raiseValue; // 'slider'
    return Math.max(la.raise.min, Math.min(la.raise.max, to));
  };

  const handlers: HandlerMap = {
    // 屏切换（进桌启动 AI 逐步节奏·回菜单停 timer）
    start_game: () => { screen = 'table'; start3D(); remount(); runAITurns(); },
    continue_game: () => { screen = 'table'; start3D(); remount(); runAITurns(); },
    back_menu: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); remount(); },
    menu_open: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); remount(); },
    // UI 开关
    sound_toggle: () => { muted = !muted; rerender(); },
    toggle_log: () => { showLog = !showLog; rerender(); },
    seat_view: (arg) => { openWardrobe = Number(arg); rerender(); },
    panel_close: () => { openWardrobe = null; rerender(); },
    // 典当续命（真接 session·主角衣柜可点·扣衣加筹）
    pawn_item: (arg) => { if (openWardrobe !== null && arg) { session.pawn(openWardrobe, arg); rerender(); } },
    set_raise: (arg) => { raiseValue = Number(arg) || raiseValue; rerender(); },
    // 下注交互（真接 betting-engine·经 session）
    act_fold: () => heroAct({ kind: 'fold' }),
    act_check_call: () => { const la = session.legalForHero(); heroAct(la?.check ? { kind: 'check' } : { kind: 'call' }); },
    act_raise: (arg) => { const to = raiseTo(arg); if (to > 0) heroAct({ kind: 'raise', to }); },
    // 摊牌「继续」→ 下一手（发牌+启动 AI 节奏）；局终「再来一局」→ 新会话。
    continue_showdown: () => { session.nextHand(); rerender(); runAITurns(); },
    restart: () => { session = new HoldemSession(DEMO_SEED + session.handNo * 101 + 1, CFG, STARTING_STACK); raiseValue = session.legalForHero()?.raise?.min ?? CFG.bigBlind; rerender(); runAITurns(); },
  };
  void host; // launcher 壳退出钩子（游戏内经 ⚙ 回主菜单；壳级退出由 launcher overlay 菜单接）

  ui = mountUI(overlayHost, buildMenu(menuView()), handlers, GAME_C_THEME);
  return () => { clearAiTimer(); stop3D(); ui?.(); skel.teardown(); };
}
