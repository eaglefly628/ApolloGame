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
import { FIELD_W, FIELD_H, ROOM_BG, WRAPPER_BG, GAME_C_THEME, OPPONENT_ANCHORS, HAND_NAME_CN } from './theme.js';
import { buildTable, buildMenu, type TableView, type SeatView, type WardrobeView, type MenuView } from './hud.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { legalActions, type BettingConfig } from './betting-engine.js';
import { replayDemoHand, type GameEvent } from './game-log.js';

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
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto'; // 素坯全走浮层 host（3D 画布渲染线 M3 接）

  // ── M1 逻辑核 replay（确定性定格 + 游戏日志事件流·查 bug）─────────────────────
  const { st, deal, flop, heroHandType, events } = replayDemoHand(DEMO_SEED, CFG);

  // ── 宿主本地态（非 sim·素坯生命周期）─────────────────────────────────────────
  let screen: 'menu' | 'table' = 'menu';
  let muted = false;
  let openWardrobe: number | null = null;
  let showLog = false;
  let raiseValue = legalActions(st).raise?.min ?? CFG.bigBlind;
  const pawnedBySeat: Record<number, Set<string>> = {}; // 素坯本地典当标记（M4 真接 craft-recipe）
  const pawnedSet = (seat: number): Set<string> => (pawnedBySeat[seat] ??= new Set());

  const seatName = (seat: number): string =>
    seat === HERO ? '主角' : OPPONENT_ANCHORS.find((a) => a.seat === seat)?.name ?? `座位${seat}`;
  const clothesCount = (seat: number): number => CLOTHING_ITEMS.length - pawnedSet(seat).size;
  const pawnedValue = (seat: number): number =>
    CLOTHING_ITEMS.filter((it) => pawnedSet(seat).has(it.id)).reduce((s, it) => s + it.value, 0);

  function seatView(seat: number): SeatView {
    const p = st.players.find((x) => x.seat === seat)!;
    return {
      seat, name: seatName(seat),
      chips: p.stack + pawnedValue(seat), committed: p.committed, clothes: clothesCount(seat),
      folded: p.folded, allIn: p.allIn, out: false,
      isActor: st.actor === seat, isHero: seat === HERO, isButton: st.pos.button === seat,
    };
  }
  function wardrobeView(seat: number): WardrobeView {
    const pawned = pawnedSet(seat);
    return {
      seat, name: seatName(seat), isHero: seat === HERO,
      rows: CLOTHING_ITEMS.map((it) => ({ id: it.id, name: it.name, value: it.value, pawned: pawned.has(it.id) })),
    };
  }
  function tableView(): TableView {
    const la = st.actor === HERO ? legalActions(st) : { fold: true as const };
    return {
      blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}`, handNo: 1,
      pot: st.players.reduce((s, p) => s + p.total, 0),
      board: flop, heroHole: deal.holes[HERO], heroHandName: HAND_NAME_CN[heroHandType] ?? '',
      seats: [0, 1, 2, 3, 4, 5].map(seatView),
      toCall: la.call ?? 0, canRaise: !!la.raise, minRaise: la.raise?.min ?? CFG.bigBlind,
      maxRaise: la.raise?.max ?? STARTING_STACK, raiseValue, muted,
      openWardrobe, wardrobe: openWardrobe !== null ? wardrobeView(openWardrobe) : undefined,
      showLog, log: events,
    };
  }
  const menuView = (): MenuView => ({ playerName: PLAYER.name, playerChips: PLAYER.chips, blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}` });

  let ui: MountHandle | null = null;
  const tree = (): ReturnType<typeof buildMenu> => (screen === 'menu' ? buildMenu(menuView()) : buildTable(tableView()));
  const rerender = (): void => ui?.update(tree()); // 屏内增量更新
  // 切屏=重新 mountUI（换根 Screen id·diff 不适用·同 game-a enterTable/showMenu 先例）。
  const remount = (): void => { ui?.(); ui = mountUI(overlayHost, tree(), handlers, GAME_C_THEME); };

  const handlers: HandlerMap = {
    // 屏切换（remount）
    start_game: () => { screen = 'table'; remount(); },
    continue_game: () => { screen = 'table'; remount(); },
    back_menu: () => { screen = 'menu'; openWardrobe = null; showLog = false; remount(); },
    menu_open: () => { screen = 'menu'; openWardrobe = null; showLog = false; remount(); }, // ⚙/设置 → 回主菜单（launcher 壳退出另走 overlay 菜单）
    // 牌桌屏内更新（update）
    sound_toggle: () => { muted = !muted; rerender(); },
    toggle_log: () => { showLog = !showLog; rerender(); },
    seat_view: (arg) => { openWardrobe = Number(arg); rerender(); },
    panel_close: () => { openWardrobe = null; rerender(); },
    // 素坯本地典当演示（M4 改：pawn_item → enqueueAction → 引擎 t2-craft-recipe 原子扣衣加筹）。
    pawn_item: (arg) => {
      if (openWardrobe === null || !arg) return;
      const set = pawnedSet(openWardrobe);
      if (set.size < CLOTHING_ITEMS.length && CLOTHING_ITEMS.some((it) => it.id === arg)) set.add(arg);
      rerender();
    },
    set_raise: (arg) => { raiseValue = Number(arg) || raiseValue; rerender(); },
    // 下注交互素坯期不推进（真接 betting-engine=M4·需 M2 AI 五家）——发信号占位（日志已记 M1 历史步骤）。
    act_fold: () => { /* M4 接 sim */ },
    act_check_call: () => { /* M4 接 sim */ },
    act_raise: () => { /* M4 接 sim */ },
  };
  void host; // launcher 壳退出钩子（游戏内经 ⚙ 回主菜单；壳级退出由 launcher overlay 菜单接）

  ui = mountUI(overlayHost, buildMenu(menuView()), handlers, GAME_C_THEME);
  return () => { ui?.(); skel.teardown(); };
}
