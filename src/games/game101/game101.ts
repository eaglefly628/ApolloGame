// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 玩法+美术**结合**：完整 S1 漂亮界面（HUD+顾客订单+Twemoji 板+导航）+ **活板**——
//   引擎 sim 跑（生成器点击产出/资源/体力恢复/自动合并·headless 测过），每帧把世界态投影进 S1 板格
//   （物品显真 Twemoji·合并即变·生成器格可点·体力/金币实时）。宿主只搭 UI/输入/投影胶水·零玩法逻辑。
// 交互：生成器格 Panel.action=tap_<id> → mountUI ActionSink 入队 → KeyBinding 转信号 → craft-recipe/caster。
// 交付（G2 核心 meta·已接）：拖成品落顾客卡 → DeliverDrop{item,order} → t2-order-fulfill 裁模板匹配未满槽
//   → 销毁该实例 + 置满槽 + 集齐发奖（钳限·可重置）。多槽（最多 3·orders.json needItems 数组）天然内建。
// ⚠ 缺口（主程/PUI 域·数据已备待接）：加权掉落 REQ-TAPSPAWN（现固定产出）；异型限时菜单卡 REQ-UI-异型容器（PUI·现矩形卡顶着）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap, MountHandle } from '@ui/components/index.js';
import type { Resource, PrefabOrigin, Transform, MergeDrop, Order, DeliverDrop, Timer, Blocker } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildS1Live, type S1State, type CellView, type OrderView, type SlotView } from './s1.js';
import { GAME101_THEME } from './ui-theme.js';
import { GAME, RES, GENERATORS, ORDERS, ORDER_SAT_MAX, TICKS_PER_SEC, ITEM_EMOJI, moodFace, cellIndexOf, cellCenter } from './theme.js';

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
  // 拖拽手感·宿主容器设定：禁文字多选高亮（游戏里拖拽不该像选文字）+ 禁触摸滚动/长按菜单（拖拽独占手势）。
  scene.style.userSelect = 'none';
  (scene.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
  scene.style.touchAction = 'none';
  (scene.style as CSSStyleDeclaration & { webkitTouchCallout?: string }).webkitTouchCallout = 'none';

  const input = new QueuedInputSource('101');
  const engine = new Engine({ input });
  engine.load(buildBlueprint());

  // cell index → 物品实例 id（拖拽用·readState 每帧刷新）。
  const TOTAL_CELLS = GAME.board.cols * GAME.board.rows;
  const cellEntity: (string | null)[] = new Array(TOTAL_CELLS).fill(null);
  const coveredCells = new Set<number>(); // 阻碍层覆盖格（不可拖入/不可落子·readState 每帧刷新）

  // 生成器产出落点修正：caster at:'self' 把新物产在生成器**自己那格**（被生成器盖住=不可见/不可拖）。
  // 宿主每帧扫描落在生成器格上的物 → 用 merge-on-place 的**移动意图**把它挪到最近空格（引擎做实际移动·
  // 宿主只挑目标空格=同拖拽落点合成·非游戏逻辑）。让「点生成器→物弹进空格」真正可见可玩。
  function relocateGenSpawns(): void {
    const w = engine.world;
    const occupied = new Set<number>([...GENERATORS.map((g) => g.cell), ...coveredCells]); // 覆盖格也不占用产出
    const stray: string[] = [];
    for (const [eid] of w.query('PrefabOrigin')) {
      const t = w.getComponent<Transform>(eid, 'Transform');
      if (!t) continue;
      const idx = cellIndexOf(t.x, t.y);
      if (idx < 0) continue;
      if (GEN_CELLS.has(idx)) stray.push(eid); // 落在生成器格 = 待挪
      else occupied.add(idx);
    }
    for (const eid of stray) {
      let free = -1;
      for (let i = 0; i < TOTAL_CELLS; i++) if (!occupied.has(i)) { free = i; break; }
      if (free < 0) break; // 板满
      occupied.add(free);
      const p = cellCenter(free);
      const cid = `reloc-${eid}`;
      if (!w.hasComponent(cid, 'MergeDrop')) w.createEntity(cid);
      w.addComponent(cid, { type: 'MergeDrop', from: eid, x: p.x, y: p.y } as MergeDrop); // 无 to = 移动到空格
    }
  }

  // 世界态 → S1State（纯读·outcome-first）：板格=生成器(可点)/物品 Twemoji；HUD=真资源。同帧刷新 cellEntity。
  function readState(): S1State {
    const w = engine.world;
    const res = (id: string): number => w.getComponent<Resource>(id, 'Resource')?.current ?? 0;
    const cells: (CellView | null)[] = new Array(GAME.board.cols * GAME.board.rows).fill(null);
    cellEntity.fill(null);
    coveredCells.clear();
    for (const g of GENERATORS) cells[g.cell] = { emoji: g.emoji, gen: g.id };
    // 阻碍层覆盖格（挖掘解锁）：占格、盖住、不可拖；邻近二消由引擎 merge-proximity-clear 挖开。
    for (const [bid] of w.query('Blocker')) {
      const bk = w.getComponent<Blocker>(bid, 'Blocker');
      const t = w.getComponent<Transform>(bid, 'Transform');
      if (!bk || !t || bk.layers <= 0) continue;
      const idx = cellIndexOf(t.x, t.y);
      if (idx >= 0 && !cells[idx]) {
        // 沙下埋的奖励预览（对齐原图：特殊格锁着也显里面是 ⚡/💎/🎁）。物品 reveal 不预览（纯沙）。
        const rv = bk.reveal;
        let coverReward: string | undefined;
        if (rv?.kind === 'resource') coverReward = rv.resourceId === 'energy' ? `⚡${rv.amount ?? ''}` : rv.resourceId === 'stars' ? '💎' : rv.resourceId === 'coins' ? '🎁' : undefined;
        cells[idx] = { emoji: '🔒', cover: bk.layers, coverReward }; coveredCells.add(idx);
      }
    }
    const onBoard = new Set<string>(); // 板上现有的物品模板集（订单可交付判定）
    const cellTpl: (string | null)[] = new Array(cells.length).fill(null);
    for (const [eid] of w.query('PrefabOrigin')) {
      const po = w.getComponent<PrefabOrigin>(eid, 'PrefabOrigin');
      const t = w.getComponent<Transform>(eid, 'Transform');
      if (!po || !t) continue;
      onBoard.add(po.templateId);
      const idx = cellIndexOf(t.x, t.y);
      if (idx >= 0 && !cells[idx]) {
        cells[idx] = { emoji: ITEM_EMOJI[po.templateId] ?? '❓' }; cellEntity[idx] = eid; cellTpl[idx] = po.templateId;
        // 限时物：读 id='life' 的 Timer → 剩余秒（到 0 由 lifetime 销毁）。
        const tm = w.getComponent<Timer>(eid, 'Timer');
        if (tm && tm.id === 'life') cells[idx]!.timer = Math.max(0, Math.ceil((tm.duration - tm.elapsed) / TICKS_PER_SEC));
      }
    }
    // 限时特惠订单倒计时（读共享 menu Timer 剩余秒·循环）。
    const menuTm = w.getComponent<Timer>('menu-timer', 'Timer');
    const menuLeft = menuTm ? Math.max(0, Math.ceil((menuTm.duration - menuTm.elapsed) / TICKS_PER_SEC)) : undefined;
    // 订单交付态（读 Order 组件·多槽）：各 slot filled/需求物；want=板上有该物且此槽未满。
    const wanted = new Set<string>(); // 当前被某订单未满槽需要的模板集（板格 ✓ 提示）
    const orders: OrderView[] = ORDERS.map((o) => {
      const ord = w.getComponent<Order>(`order-${o.id}`, 'Order');
      const need = ord?.needItems ?? o.needItems;
      const filledArr = ord?.filled ?? o.needItems.map(() => false);
      const slots: SlotView[] = need.map((tpl, j) => {
        const filled = !!filledArr[j];
        if (!filled) wanted.add(tpl);
        return { itemEmoji: ITEM_EMOJI[tpl] ?? '❓', filled, want: !filled && onBoard.has(tpl) };
      });
      const sat = res(`sat_${o.id}`);
      return { char: o.char, slots, coins: o.reward.coins, stars: o.reward.stars ?? 0, deliverable: slots.some((sl) => sl.want), mood: sat / ORDER_SAT_MAX, moodFace: moodFace(sat), timed: o.timed, timeLeft: o.timed ? menuLeft : undefined };
    });
    // 板格 ✓ = 该成品被某订单未满槽需要（可拖去交付）。
    for (let i = 0; i < cells.length; i++) if (cells[i] && cellTpl[i] && wanted.has(cellTpl[i]!)) cells[i]!.deliverable = true;
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
  // 找落点所属**顾客卡 Panel**（id=ord-<i>）——跳过内层槽/头像（ord-<i>-... 也匹配前缀·会误解析）。
  const orderIdxFromEl = (el: Element | null): number => {
    let cur: Element | null = el?.closest?.('[id^="ord-"]') ?? null;
    while (cur) {
      const m = /^ord-(\d+)$/.exec(cur.id);
      if (m) return Number(m[1]);
      cur = cur.parentElement?.closest?.('[id^="ord-"]') ?? null;
    }
    return -1;
  };
  // 拖拽跟手飞影：指针视口坐标 → Screen(1080×1920) 坐标（scene 被 CSS 缩放·按 rect 反算）。
  const sceneToScreen = (cx: number, cy: number): { x: number; y: number } => {
    const r = scene.getBoundingClientRect();
    return { x: (cx - r.left) * (SCREEN_W / r.width), y: (cy - r.top) * (SCREEN_H / r.height) };
  };
  const emojiAt = (idx: number): string => {
    const eid = cellEntity[idx];
    if (!eid) return '❓';
    const po = engine.world.getComponent<PrefabOrigin>(eid, 'PrefabOrigin');
    return po ? (ITEM_EMOJI[po.templateId] ?? '❓') : '❓';
  };
  let dragFrom = -1;
  let dragGhost: { emoji: string; x: number; y: number } | null = null; // 跟手飞影态（render-only）
  let ghostRaf = 0; // rAF 节流句柄（拖动每帧至多重绘一次）
  const onDown = (ev: PointerEvent): void => {
    const idx = cellIdxFromEl(ev.target as Element);
    if (idx >= 0 && !GEN_CELLS.has(idx) && cellEntity[idx]) {
      dragFrom = idx; // 只拖物品格（非生成器/空格）
      dragGhost = { emoji: emojiAt(idx), ...sceneToScreen(ev.clientX, ev.clientY) }; // 拿起=飞影跟手
      paint(readState());
    }
  };
  const onMove = (ev: PointerEvent): void => {
    if (dragFrom < 0 || !dragGhost) return;
    dragGhost = { emoji: dragGhost.emoji, ...sceneToScreen(ev.clientX, ev.clientY) };
    if (!ghostRaf) ghostRaf = requestAnimationFrame(() => { ghostRaf = 0; paint(readState()); }); // 每帧至多一次重绘
  };
  const onUp = (ev: PointerEvent): void => {
    if (dragFrom < 0) return;
    const from = cellEntity[dragFrom]; const fromIdx = dragFrom; dragFrom = -1;
    if (dragGhost) { dragGhost = null; if (ghostRaf) { cancelAnimationFrame(ghostRaf); ghostRaf = 0; } paint(readState()); } // 落下=收飞影
    if (!from) return;
    const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
    // ① 落在顾客卡 → 交付意图（DeliverDrop）：引擎 order-fulfill 裁模板匹配→销毁实例+置满槽+集齐发奖。
    const ordIdx = orderIdxFromEl(dropEl);
    if (ordIdx >= 0 && ordIdx < ORDERS.length) {
      const cid = 'host-deliver';
      if (!engine.world.hasComponent(cid, 'DeliverDrop')) engine.world.createEntity(cid);
      engine.world.addComponent(cid, { type: 'DeliverDrop', item: from, order: `order-${ORDERS[ordIdx].id}` } as DeliverDrop);
      pendingDeliverIdx = ordIdx; // 供发奖飞行轨迹归位（金币从该卡飞进钱包）
      return;
    }
    // ② 落在板格 → 合并/移动/交换意图（MergeDrop）。
    const toIdx = cellIdxFromEl(dropEl);
    if (toIdx < 0 || toIdx === fromIdx || GEN_CELLS.has(toIdx) || coveredCells.has(toIdx)) return; // 落生成器/覆盖格/空放/原格=忽略
    const to = cellEntity[toIdx] ?? undefined; const p = cellCenter(toIdx);
    // 合成迸发（juice）：落格同模板=真合成 → 该格叠一次性星光爆。
    if (to) {
      const fpo = engine.world.getComponent<PrefabOrigin>(from, 'PrefabOrigin');
      const tpo = engine.world.getComponent<PrefabOrigin>(to, 'PrefabOrigin');
      if (fpo && tpo && fpo.templateId === tpo.templateId) fireBurst(toIdx);
    }
    const cid = 'host-drop';
    if (!engine.world.hasComponent(cid, 'MergeDrop')) engine.world.createEntity(cid);
    engine.world.addComponent(cid, { type: 'MergeDrop', from, ...(to ? { to } : {}), x: p.x, y: p.y } as MergeDrop);
  };
  scene.addEventListener('pointerdown', onDown);
  scene.addEventListener('pointermove', onMove);
  scene.addEventListener('pointerup', onUp);

  // 导航信号占位（真弹层=后续 slice）；生成器 tap_<id> **不放 handler** → 走 ActionSink 入队 → sim。
  const noop = (): void => {};
  const handlers: HandlerMap = { open_shop: noop, open_menu: noop, open_tasks: noop, open_reno: noop, open_events: noop, deliver_order: noop, gen_left: noop, gen_right: noop, delete_sel: noop };

  const ui: MountHandle = mountUI(scene, buildS1Live(readState()), handlers, GAME101_THEME, input);

  // 交付发奖飞行轨迹（juice·render-only·不进 sim/hash）：金币从顾客卡沿弧飞进 HUD 钱包。
  // 用基座 layout.flyTo（唯一飞行原语·非自造）。activeFly 短暂注入进 OrderView·播完清（setTimeout=纯表现层清理）。
  let activeFly: { idx: number; id: string; label: string } | null = null;
  let activeBurst = -1; // 合成迸发格（juice·render-only）
  let dissolving: number[] = []; // 刚被挖到的格（沙/蛛网消融·render-only）
  let flySeq = 0;
  let pendingDeliverIdx = -1;
  let lastCoins = Math.round(readState().coins);
  const prevCover = new Map<number, number>(); // cell → 上帧阻碍层数（挖到=层减/消失→消融）
  const flyTimers = new Set<ReturnType<typeof setTimeout>>();
  const paint = (st: S1State): void => {
    const orders = activeFly ? st.orders.map((o, i) => (i === activeFly!.idx ? { ...o, fly: { id: activeFly!.id, label: activeFly!.label }, celebrate: true } : o)) : st.orders;
    ui.update(buildS1Live({ ...st, orders, burstCell: activeBurst >= 0 ? activeBurst : undefined, dragGhost: dragGhost ?? undefined, liftedCell: dragFrom >= 0 ? dragFrom : undefined, dissolveCells: dissolving.length ? dissolving : undefined }), GAME101_THEME);
  };
  // 沙/蛛网消融：对比上帧阻碍层，被挖到的格（层减或清）叠尘土 Particles，600ms 后清。
  function detectDissolve(st: S1State): void {
    const dug: number[] = [];
    const nowCover = new Map<number, number>();
    st.cells.forEach((c, i) => { if (c?.cover != null) nowCover.set(i, c.cover); });
    for (const [cell, prev] of prevCover) { const cur = nowCover.get(cell); if (cur === undefined || cur < prev) dug.push(cell); }
    prevCover.clear(); for (const [c, l] of nowCover) prevCover.set(c, l);
    if (dug.length) {
      dissolving = dug;
      const t = setTimeout(() => { dissolving = []; flyTimers.delete(t); paint(readState()); }, 600);
      flyTimers.add(t);
    }
  }
  // 合成迸发：该格叠一次性星光爆，700ms 后清（纯表现层）。
  function fireBurst(cell: number): void {
    activeBurst = cell;
    paint(readState());
    const t = setTimeout(() => { if (activeBurst === cell) activeBurst = -1; flyTimers.delete(t); paint(readState()); }, 700);
    flyTimers.add(t);
  }

  let lastSig = '';
  const unsub = engine.subscribe(() => {
    relocateGenSpawns(); // 生成器产出弹进空格（不然盖在生成器下不可见=像点了没反应）
    const st = readState();
    detectDissolve(st); // 沙/蛛网被挖到 → 消融尘土
    const coins = Math.round(st.coins);
    // 金币增加（仅交付发奖来源）+ 有待归位交付 → 触发飞行轨迹。
    if (coins > lastCoins && pendingDeliverIdx >= 0) {
      const gain = coins - lastCoins;
      const id = `fly-${flySeq++}`;
      activeFly = { idx: pendingDeliverIdx, id, label: `🪙+${gain}` };
      pendingDeliverIdx = -1;
      paint(st);
      const t = setTimeout(() => { activeFly = null; flyTimers.delete(t); paint(readState()); }, 900);
      flyTimers.add(t);
      lastCoins = coins;
      lastSig = ''; // 强制下一帧重绘（fly 清除后）
      return;
    }
    lastCoins = coins;
    const sig = `${Math.round(st.energy)}|${coins}|${st.cells.map((c) => (c ? c.emoji : '') + (c?.gen ?? '') + (c?.deliverable ? '✓' : '') + (c?.timer != null ? `t${c.timer}` : '') + (c?.cover != null ? `k${c.cover}` : '')).join(',')}|${st.orders.map((o) => o.slots.map((sl) => (sl.filled ? 'F' : sl.want ? 'W' : '.')).join('') + o.moodFace + (o.timeLeft ?? '')).join('|')}`;
    if (sig !== lastSig) { lastSig = sig; paint(st); }
  });

  engine.start();

  return () => {
    unsub();
    for (const t of flyTimers) clearTimeout(t);
    flyTimers.clear();
    engine.stop();
    if (ghostRaf) cancelAnimationFrame(ghostRaf);
    scene.removeEventListener('pointerdown', onDown);
    scene.removeEventListener('pointermove', onMove);
    scene.removeEventListener('pointerup', onUp);
    ui();
    teardown();
  };
}
