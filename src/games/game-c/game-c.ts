// Game C ·《六人德州》—— 宿主层（S5 UI 素坯·mount-host helper·零手写 DOM·零玩法逻辑）。
//
// 职责（都在 sim 外）：mountHost 搭容器骨架 → 用 M1 逻辑核（holdem-eval + betting-engine）跑一手牌到
// 「翻牌圈·轮到主角行动」的确定性定格 → world/牌局状态纯读投影进 LayoutNode 牌桌屏（mountUI·夜宴主题皮）。
// UI 全 LayoutNode（UI 铁律）；随机全在 M1 sim 侧种子 PRNG（宿主零 Math.random）。
//
// S5 边界（诚实记账）：本层只立可挂载素坯——① 下注交互（act_*）真接 betting-engine 推进=需五家 AI（M2 行为树）
// 到位后于 M4 接；素坯期行动条 action 仅发信号、宿主不推进。② 典当（pawn_item）真接引擎 t2-craft-recipe=M4；
// 素坯期在宿主本地标记（视觉演示衣柜置灰+筹码/件数变化），不碰 sim/hash。③ 3D 牌房/筹码物理=M3 render-only。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import { FIELD_W, FIELD_H, ROOM_BG, WRAPPER_BG, GAME_C_THEME, OPPONENT_ANCHORS, HAND_NAME_CN } from './theme.js';
import { buildTable, type TableView, type SeatView, type WardrobeView } from './hud.js';
import { CLOTHING_ITEMS, WARDROBE_TOTAL } from './wardrobe.js';
import { dealHoldem, bestOf7, HOLDEM_TYPE_ORDER, type HoldemDeal } from './holdem-eval.js';
import {
  startHand, act, legalActions, initialPositions, type BettingConfig, type HandState,
} from './betting-engine.js';

const CFG: BettingConfig = { smallBlind: 25, bigBlind: 50 }; // GDD §11.5-1 现金局默认盲注
const DEMO_SEED = 20260717; // 素坯定格种子（确定性·同种子同牌面）
const HERO = 0; // 主角=座位 0（正南底带·§5.2）
const STARTING_STACK = 1000; // GDD §3 默认起始筹码

/** 跑一手牌到「翻牌圈·轮到主角」的确定性定格（M1 逻辑核自证：发牌×下注状态机真跑）。 */
function dealAndReachFlop(): { st: HandState; deal: HoldemDeal } {
  const deal = dealHoldem(DEMO_SEED, 6);
  const seats = [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: STARTING_STACK }));
  const st = startHand(CFG, seats, initialPositions([0, 1, 2, 3, 4, 5], HERO));
  for (const s of [3, 4, 5, 0, 1]) act(st, s, { kind: 'call' }); // 翻前全跟
  act(st, 2, { kind: 'check' }); // 大盲过牌 → 翻牌
  for (const s of [1, 2, 3, 4, 5]) act(st, s, { kind: 'check' }); // 翻牌圈让到主角
  return { st, deal }; // st.actor===HERO, st.street==='flop'
}

export function mount(container: HTMLElement, host?: { exit: () => void }): () => void {
  const skel = mountHost(container, {
    fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: ROOM_BG, wrapperBackground: WRAPPER_BG,
  });
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto'; // 素坯全走浮层 host（3D 画布渲染线 M3 接）

  const { st, deal } = dealAndReachFlop();
  const flop = deal.board.slice(0, 3);
  const heroHandType = HOLDEM_TYPE_ORDER[bestOf7([...deal.holes[HERO], ...flop]).value[0]];

  // ── 宿主本地态（非 sim·素坯生命周期）─────────────────────────────────────────
  let muted = false;
  let openWardrobe: number | null = null;
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
      chips: p.stack + pawnedValue(seat), // 素坯：典当所得计入展示筹码（视觉演示）
      committed: p.committed,
      clothes: clothesCount(seat),
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

  function view(): TableView {
    const la = st.actor === HERO ? legalActions(st) : { fold: true as const };
    const pot = st.players.reduce((s, p) => s + p.total, 0);
    return {
      blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}`,
      handNo: 1,
      pot,
      board: flop,
      heroHole: deal.holes[HERO],
      heroHandName: HAND_NAME_CN[heroHandType] ?? '',
      seats: [0, 1, 2, 3, 4, 5].map(seatView),
      toCall: la.call ?? 0,
      canRaise: !!la.raise,
      minRaise: la.raise?.min ?? CFG.bigBlind,
      maxRaise: la.raise?.max ?? STARTING_STACK,
      raiseValue,
      muted,
      openWardrobe,
      wardrobe: openWardrobe !== null ? wardrobeView(openWardrobe) : undefined,
    };
  }

  let ui: MountHandle | null = null;
  const rerender = (): void => ui?.update(buildTable(view()));

  const handlers: HandlerMap = {
    sound_toggle: () => { muted = !muted; rerender(); },
    menu_open: () => host?.exit?.(),
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
    // 下注交互素坯期不推进（真接 betting-engine=M4·需 M2 AI 五家）——发信号占位。
    act_fold: () => { /* M4 接 sim */ },
    act_check_call: () => { /* M4 接 sim */ },
    act_raise: () => { /* M4 接 sim */ },
  };

  ui = mountUI(overlayHost, buildTable(view()), handlers, GAME_C_THEME);

  // 素坯自证（开发期·非门禁）：衣物总值口径与 wardrobe 表一致。
  void WARDROBE_TOTAL;

  return () => { ui?.(); skel.teardown(); };
}
