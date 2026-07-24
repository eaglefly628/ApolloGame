// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 玩法+美术**结合**：完整 S1 漂亮界面（HUD+顾客订单+Twemoji 板+导航）+ **活板**——
//   引擎 sim 跑（生成器点击产出/资源/体力恢复/自动合并·headless 测过），每帧把世界态投影进 S1 板格
//   （物品显真 Twemoji·合并即变·生成器格可点·体力/金币实时）。宿主只搭 UI/输入/投影胶水·零玩法逻辑。
// 交互：生成器格 Panel.action=tap_<id> → mountUI ActionSink 入队 → KeyBinding 转信号 → craft-recipe/caster。
// ⚠ 缺口（主程域·数据已备待接）：真·拖拽合并 REQ-MERGE-ON-PLACE（现自动合并）；加权掉落 REQ-TAPSPAWN（现固定产出）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap, MountHandle } from '@ui/components/index.js';
import type { Resource, PrefabOrigin, Transform, MergeDrop } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildS1Live, type S1State, type CellView, type OrderView } from './s1.js';
import { GAME101_THEME } from './ui-theme.js';
import { GAME, RES, GENERATORS, ORDERS, ITEM_EMOJI, cellIndexOf, cellCenter } from './theme.js';

const GEN_CELLS = new Set(GENERATORS.map((g) => g.cell));

const SCREEN_W = 1080;
const SCREEN_H = 1920;

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: SCREEN_W,
    fieldH: SCREEN_H,
    sceneBackground: GAME101_THEME.pageBg,
    wrapperBackground: '#2a1c12',
  });

  const input = new QueuedInputSource('101');
  const engine = new Engine({ input });
  engine.load(buildBlueprint());

  // cell index → 物品实例 id（拖拽用·readState 每帧刷新）。
  const cellEntity: (string | null)[] = new Array(GAME.board.cols * GAME.board.rows).fill(null);

  // 世界态 → S1State（纯读·outcome-first）：板格=生成器(可点)/物品 Twemoji；HUD=真资源。同帧刷新 cellEntity。
  function readState(): S1State {
    const w = engine.world;
    const res = (id: string): number => w.getComponent<Resource>(id, 'Resource')?.current ?? 0;
    const cells: (CellView | null)[] = new Array(GAME.board.cols * GAME.board.rows).fill(null);
    cellEntity.fill(null);
    for (const g of GENERATORS) cells[g.cell] = { emoji: g.emoji, gen: g.id };
    const onBoard = new Set<string>(); // 板上现有的物品模板集（订单可交付判定）
    const cellTpl: (string | null)[] = new Array(cells.length).fill(null);
    for (const [eid] of w.query('PrefabOrigin')) {
      const po = w.getComponent<PrefabOrigin>(eid, 'PrefabOrigin');
      const t = w.getComponent<Transform>(eid, 'Transform');
      if (!po || !t) continue;
      onBoard.add(po.templateId);
      const idx = cellIndexOf(t.x, t.y);
      if (idx >= 0 && !cells[idx]) { cells[idx] = { emoji: ITEM_EMOJI[po.templateId] ?? '❓' }; cellEntity[idx] = eid; cellTpl[idx] = po.templateId; }
    }
    // 订单可交付 = 板上有该 needItem；对应板格标✓。
    const need = new Set(ORDERS.filter((o) => onBoard.has(o.needItem)).map((o) => o.needItem));
    for (let i = 0; i < cells.length; i++) if (cells[i] && cellTpl[i] && need.has(cellTpl[i]!)) cells[i]!.deliverable = true;
    const orders: OrderView[] = ORDERS.map((o) => ({
      char: o.char, itemEmoji: ITEM_EMOJI[o.needItem] ?? '❓', coins: o.reward.coins, stars: o.reward.stars ?? 0, deliverable: onBoard.has(o.needItem),
    }));
    return { energy: res(RES.energy), coins: res(RES.coins), gems: 8, level: 12, cells, orders };
  }

  // ── 拖拽合并（宿主手势 → MergeDrop 意图 → merge-on-place 引擎裁决）──────────────
  // 板格 DOM id=t-live-<idx>；按下物品格→记源，抬起于目标格→注入 MergeDrop{from,to?}（引擎裁合并/移动/交换）。
  // 找到落点所属**格 Panel**（id=t-live-<idx>）——跳过内层 Label（t-live-<idx>-l 也匹配前缀·会误解析）。
  const cellIdxFromEl = (el: Element | null): number => {
    let cur: Element | null = el?.closest?.('[id^="t-live-"]') ?? null;
    while (cur) {
      const m = /^t-live-(\d+)$/.exec(cur.id);
      if (m) return Number(m[1]);
      cur = cur.parentElement?.closest?.('[id^="t-live-"]') ?? null;
    }
    return -1;
  };
  let dragFrom = -1;
  const onDown = (ev: PointerEvent): void => {
    const idx = cellIdxFromEl(ev.target as Element);
    if (idx >= 0 && !GEN_CELLS.has(idx) && cellEntity[idx]) dragFrom = idx; // 只拖物品格（非生成器/空格）
  };
  const onUp = (ev: PointerEvent): void => {
    if (dragFrom < 0) return;
    const from = cellEntity[dragFrom]; const fromIdx = dragFrom; dragFrom = -1;
    const toIdx = cellIdxFromEl(document.elementFromPoint(ev.clientX, ev.clientY));
    if (!from || toIdx < 0 || toIdx === fromIdx || GEN_CELLS.has(toIdx)) return; // 落生成器/空放/原格=忽略
    const to = cellEntity[toIdx] ?? undefined; const p = cellCenter(toIdx);
    const cid = 'host-drop';
    if (!engine.world.hasComponent(cid, 'MergeDrop')) engine.world.createEntity(cid);
    engine.world.addComponent(cid, { type: 'MergeDrop', from, ...(to ? { to } : {}), x: p.x, y: p.y } as MergeDrop);
  };
  scene.addEventListener('pointerdown', onDown);
  scene.addEventListener('pointerup', onUp);

  // 导航信号占位（真弹层=后续 slice）；生成器 tap_<id> **不放 handler** → 走 ActionSink 入队 → sim。
  const noop = (): void => {};
  const handlers: HandlerMap = { open_shop: noop, open_menu: noop, open_tasks: noop, open_reno: noop, open_events: noop, deliver_order: noop, gen_left: noop, gen_right: noop, delete_sel: noop };

  const ui: MountHandle = mountUI(scene, buildS1Live(readState()), handlers, GAME101_THEME, input);
  let lastSig = '';
  const unsub = engine.subscribe(() => {
    const st = readState();
    const sig = `${Math.round(st.energy)}|${Math.round(st.coins)}|${st.cells.map((c) => (c ? c.emoji : '') + (c?.gen ?? '') + (c?.deliverable ? '✓' : '')).join(',')}|${st.orders.map((o) => o.deliverable ? '1' : '0').join('')}`;
    if (sig !== lastSig) { lastSig = sig; ui.update(buildS1Live(st), GAME101_THEME); }
  });

  engine.start();

  return () => {
    unsub();
    engine.stop();
    scene.removeEventListener('pointerdown', onDown);
    scene.removeEventListener('pointerup', onUp);
    ui();
    teardown();
  };
}
