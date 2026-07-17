// Game A ·《掼蛋夜宴》—— 宿主层（S3 骨架·mount-host helper·零手写 DOM·零玩法逻辑）。
//
// 职责（都在 sim 外）：mountHost 搭容器骨架（引擎公用件）；SC-1 菜单壳 ⇄ 牌桌骨架切换；
// 上桌=建 Engine + load 牌桌蓝图 + start（固定步长循环）→ world 纯读投影进 LayoutNode 骨架屏。
// 出牌交互/发牌/AI/结算全属 S4 玩法关——本层 handler 只有宿主生命周期动作（进桌/回菜单），零游戏逻辑。
// UI 全 LayoutNode（mountUI）·随机全在 sim 侧 RandomSeed（宿主零随机）。
import { Engine } from '../../runtime/engine.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { GameFlow, Resource, CardPile } from '@engine/protocol/components.js';
import { buildTableBlueprint } from './blueprint.js';
import { buildMenu, buildTable, type TableView, type SeatView } from './hud.js';
import { SEATS, DRESS_TIERS } from './rules.js';
import { FIELD_W, FIELD_H, MANOR_BG, WRAPPER_BG } from './theme.js';

// 骨架期固定 run 种子（确定性·同种子同世界）；S4 起 run 种子随存档快照管理。
const SKELETON_SEED = 20260717;

export function mount(container: HTMLElement): () => void {
  const skel = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    sceneBackground: MANOR_BG,
    wrapperBackground: WRAPPER_BG,
  });
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto'; // 骨架期两屏都走浮层 host（画布渲染线 S4/S5 接）

  let ui: MountHandle | null = null;
  let engine: Engine | null = null;
  let unsub: (() => void) | null = null;
  let lastSig = '';

  // ── world → 骨架屏投影（纯读·outcome-first）────────────────────────────────
  function readView(e: Engine): TableView {
    const w = e.world;
    const res = (id: string): number => {
      for (const [eid] of w.query('Resource')) {
        const r = w.getComponent<Resource>(eid, 'Resource');
        if (r?.id === id) return r.current;
      }
      return 0;
    };
    const pile = (owner: string): CardPile | null => {
      for (const [eid] of w.query('CardPile')) {
        const p = w.getComponent<CardPile>(eid, 'CardPile');
        if (p?.owner === owner) return p;
      }
      return null;
    };
    const seatView = (id: SeatView['seat']['id']): SeatView => ({
      seat: SEATS.find((s) => s.id === id)!,
      cards: pile(id)?.hand.length ?? 0,
      dress: res(`dress-${id}`) || DRESS_TIERS,
    });
    return {
      wallet: res('wallet'),
      stake: res('stake'),
      round: res('round'),
      levelOurs: res('level-ours'),
      levelTheirs: res('level-theirs'),
      flowState: w.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '—',
      deckCount: pile('dealer')?.deck.length ?? 0,
      partner: seatView('partner'),
      west: seatView('west'),
      east: seatView('east'),
      hero: seatView('hero'),
    };
  }

  function refreshTable(): void {
    if (!engine || !ui) return;
    const v = readView(engine);
    const sig = JSON.stringify([v.wallet, v.round, v.flowState, v.deckCount, v.hero.cards]);
    if (sig === lastSig) return;
    lastSig = sig;
    ui.update(buildTable(v));
  }

  function stopSim(): void {
    unsub?.();
    unsub = null;
    engine?.stop();
    engine = null;
  }

  function showMenu(): void {
    stopSim();
    ui?.();
    ui = mountUI(overlayHost, buildMenu(), handlers);
  }

  function enterTable(): void {
    stopSim();
    engine = new Engine();
    engine.load(buildTableBlueprint({ seed: SKELETON_SEED }));
    ui?.();
    lastSig = '';
    ui = mountUI(overlayHost, buildTable(readView(engine)), handlers);
    unsub = engine.subscribe(refreshTable);
    engine.start();
  }

  const handlers: HandlerMap = {
    'menu.start': () => enterTable(),
    'table.back': () => showMenu(),
  };

  showMenu();

  return () => {
    stopSim();
    ui?.();
    ui = null;
    skel.teardown();
  };
}
