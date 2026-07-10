// Game K · Zombie Slots —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（都在 sim 外）：建 Engine + QueuedInputSource；把 SPIN/BET 按钮 action 入队（keybind→Signal→dice-roll/slot-payout）；
// outcome-first 读世界（RolledDice 网格 / LineWins 结算 / 资源）→ 驱动转轴演出（表现）+ 投影 LayoutNode HUD + 中奖浮层；
// 重开；响应式缩放；cleanup。**所有玩法规则**在 blueprint.ts 数据 + 引擎能力里（转轴=dice-roll，判线赔付=t3-slot-payout）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import type { Resource, RolledDice, LineWins } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState, type OverlayKind } from './hud.js';
import { playKSfx, isMuted, setMuted } from './sounds.js';
import { drawSymbol, prewarm, registerSkin } from './art.js';
import {
  FIELD_W, FIELD_H, TOP_BAR_H, BOTTOM_BAR_H, REELS, ROWS, PAYLINES, REEL_WEIGHTS,
  ZOMBIE_THEME, BET_MIN, winTier, SYMBOLS,
} from './theme.js';

// 皮肤槽加载（美术替换工作流 · fail-soft）：拉本地 art index → 按 skinKey 匹配符号 → 载真图 registerSkin
// （就绪即换装·盖过程序化占位）。无 index / 404 / 解析失败 → 程序化观感照旧，绝不炸游戏。
function loadSkins(): void {
  if (typeof fetch === 'undefined') return;
  void (async () => {
    try {
      const r = await fetch('/games/game-k/art/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      const raw = await r.json();
      const entries: Array<{ id?: string; path?: string }> = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
      const byId = new Map(entries.filter((e) => e.id && e.path).map((e) => [e.id as string, e.path as string]));
      for (const s of SYMBOLS) {
        const path = byId.get(s.skin);
        if (!path) continue;
        const img = new Image();
        img.onload = () => registerSkin(s.id, img);
        img.src = path;
      }
    } catch { /* 无美术目录/解析失败 → 回退程序化·不炸游戏 */ }
  })();
}

const STAGE_BG =
  'radial-gradient(circle at 50% 30%, #16281a 0%, #0a130c 62%, #05080600 100%),' +
  'radial-gradient(circle at 50% 120%, rgba(94,240,138,0.10), transparent 60%)';

export function mount(container: HTMLElement): () => void {
  prewarm();
  loadSkins();

  // ── DOM 骨架（host 容器·非 sim）：wrapper > scene > [reelCanvas(z0) + 三个 HUD host] ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#050806;display:flex;align-items:center;justify-content:center';
  const scene = document.createElement('div');
  scene.style.cssText = `position:relative;width:${FIELD_W}px;height:${FIELD_H}px;flex:0 0 auto;transform-origin:center center;background:${STAGE_BG}`;
  const canvas = document.createElement('canvas');
  canvas.width = FIELD_W; canvas.height = FIELD_H;
  canvas.style.cssText = 'position:absolute;inset:0;z-index:0';
  const topHost = document.createElement('div');
  topHost.style.cssText = `position:absolute;left:0;right:0;top:0;height:${TOP_BAR_H}px;z-index:10`;
  const bottomHost = document.createElement('div');
  bottomHost.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${BOTTOM_BAR_H}px;z-index:10`;
  const overlayHost = document.createElement('div');
  overlayHost.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none';
  scene.append(canvas, topHost, bottomHost, overlayHost);
  wrapper.appendChild(scene);
  container.appendChild(wrapper);
  const ctx = canvas.getContext('2d')!;

  // ── 稳定输入源（跨重开不变）──
  const input = new QueuedInputSource('k');

  // ── 转轴演出状态（纯表现·不进 sim/hash）──
  const strips = REEL_WEIGHTS;
  const initGrid = (): number[][] => Array.from({ length: REELS }, (_, r) => Array.from({ length: ROWS }, (_, y) => strips[r][(r * 3 + y) % strips[r].length]));
  let display: number[][] = initGrid();
  let anim: { scrollStart: number; target: number[][] | null; stops: number[] | null } | null = null;
  let spinning = false;
  let lastSpin = 0;
  let highlightCells: Set<string> = new Set();
  let highlightUntil = 0;
  let pending: { total: number; tier: ReturnType<typeof winTier>; triggeredFree: number; scatter: number } | null = null;
  let overlay: HudState['overlay'] = null;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ── outcome-first 读世界 ──
  function res(engine: Engine, id: string): Resource | undefined {
    for (const [eid] of engine.world.query('Resource')) { const r = engine.world.getComponent<Resource>(eid, 'Resource'); if (r && r.id === id) return r; }
    return undefined;
  }
  function readState(engine: Engine): HudState {
    return {
      balance: Math.round(res(engine, 'balance')?.current ?? 0),
      bet: Math.round(res(engine, 'bet')?.current ?? 0),
      win: Math.round(res(engine, 'win')?.current ?? 0),
      free: Math.round(res(engine, 'freespins')?.current ?? 0),
      spinning,
      muted: isMuted(),
      overlay,
    };
  }

  // ── 结算到达：抓目标网格 → 起演出 ──
  function onResolve(engine: Engine): void {
    const rolled = engine.world.getComponent<RolledDice>('reels', 'RolledDice');
    const lw = engine.world.getComponent<LineWins>('machine', 'LineWins');
    if (!rolled || !lw) return;
    const target: number[][] = [];
    for (let r = 0; r < REELS; r++) { const col: number[] = []; for (let y = 0; y < ROWS; y++) col.push(rolled.results[r * ROWS + y]?.value ?? 0); target.push(col); }
    const tr = now();
    anim = { scrollStart: anim?.scrollStart ?? tr, target, stops: [0, 1, 2, 3, 4].map((i) => tr + 360 + i * 170) };
    pending = { total: lw.total, tier: winTier(lw.total, Math.round(res(engine, 'bet')?.current ?? 1)), triggeredFree: lw.triggeredFree, scatter: lw.scatterCount };
  }

  // ── 演出结束：定格 + 高亮 + 音效 + 浮层/续免费 ──
  function onSettled(engine: Engine): void {
    spinning = false;
    if (anim?.target) display = anim.target;
    anim = null;
    const lw = engine.world.getComponent<LineWins>('machine', 'LineWins');
    highlightCells = new Set();
    if (lw) for (const w of lw.wins) { const line = PAYLINES[w.line]; for (let r = 0; r < w.count; r++) highlightCells.add(`${r},${line[r]}`); }
    highlightUntil = now() + 2400;

    const p = pending; pending = null;
    if (!p) return;
    if (p.scatter >= 3) playKSfx('scatter');
    if (p.triggeredFree > 0) { playKSfx('free'); overlay = { kind: 'free', amount: p.total, free: Math.round(res(engine, 'freespins')?.current ?? 0) }; }
    else if (p.tier === 'zombie' || p.tier === 'mega' || p.tier === 'big') { playKSfx('bigwin'); overlay = { kind: p.tier as OverlayKind, amount: p.total, free: 0 }; }
    else if (p.total > 0) playKSfx('win');
    refreshHud(engine);
    if (!overlay) afterIdle(engine);
  }

  // ── 空闲后：续免费旋转 / 破产判定 ──
  function afterIdle(engine: Engine): void {
    const free = Math.round(res(engine, 'freespins')?.current ?? 0);
    const bal = Math.round(res(engine, 'balance')?.current ?? 0);
    const bet = Math.round(res(engine, 'bet')?.current ?? 0);
    if (free > 0) { autoTimer = setTimeout(() => doSpin(engine), 650); return; }
    if (bal < Math.max(BET_MIN, bet)) { overlay = { kind: 'broke', amount: 0, free: 0 }; playKSfx('broke'); refreshHud(engine); }
  }

  function doSpin(engine: Engine): void {
    if (spinning || overlay) return;
    const free = Math.round(res(engine, 'freespins')?.current ?? 0);
    const bal = Math.round(res(engine, 'balance')?.current ?? 0);
    const bet = Math.round(res(engine, 'bet')?.current ?? 0);
    if (free <= 0 && bal < bet) return;
    spinning = true;
    anim = { scrollStart: now(), target: null, stops: null };
    playKSfx('spin');
    input.enqueueAction('spin');
    refreshHud(engine);
  }

  // ── 转轴渲染（每帧·纯表现）──
  const GRID_TOP = TOP_BAR_H + 14;
  const GRID_BOT = FIELD_H - BOTTOM_BAR_H - 14;
  const GRID_H = GRID_BOT - GRID_TOP;
  const GRID_W = Math.min(FIELD_W - 80, GRID_H / ROWS * REELS);
  const CELL = GRID_H / ROWS;
  const GRID_L = (FIELD_W - GRID_W) / 2;

  function drawFrame(): void {
    ctx.clearRect(0, 0, FIELD_W, FIELD_H);
    // 机台底框
    ctx.save();
    roundRect(ctx, GRID_L - 16, GRID_TOP - 16, GRID_W + 32, GRID_H + 32, 20);
    const g = ctx.createLinearGradient(0, GRID_TOP, 0, GRID_BOT);
    g.addColorStop(0, '#14251a'); g.addColorStop(1, '#0b160e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(94,240,138,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    const t = now();
    for (let r = 0; r < REELS; r++) {
      const cx = GRID_L + r * (GRID_W / REELS);
      const cw = GRID_W / REELS;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx + 3, GRID_TOP, cw - 6, GRID_H); ctx.clip();
      // 列底
      ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(cx, GRID_TOP, cw, GRID_H);

      const settled = anim?.target && anim.stops && t >= anim.stops[r];
      if (!anim || settled) {
        const col = settled ? anim!.target![r] : display[r];
        for (let y = 0; y < ROWS; y++) drawCell(cx, GRID_TOP + y * CELL, cw, CELL, col[y], settled ? highlightCells.has(`${r},${y}`) && t < highlightUntil : highlightCells.has(`${r},${y}`) && t < highlightUntil);
      } else {
        // 滚动中：按该列权重带循环滚动（确定性·无 Math.random）
        const strip = strips[r];
        const speed = 0.026; // rows per ms
        const offR = (t - anim.scrollStart) * speed + r * 0.4;
        const base = Math.floor(offR); const frac = offR - base;
        for (let y = -1; y < ROWS + 1; y++) {
          const sym = strip[((base + y) % strip.length + strip.length) % strip.length];
          drawCell(cx, GRID_TOP + (y - frac) * CELL, cw, CELL, sym, false);
        }
      }
      ctx.restore();
      // 列分隔光
      if (r > 0) { ctx.strokeStyle = 'rgba(94,240,138,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, GRID_TOP); ctx.lineTo(cx, GRID_BOT); ctx.stroke(); }
    }
  }

  function drawCell(x: number, y: number, w: number, h: number, sym: number, glow: boolean): void {
    const pad = Math.min(w, h) * 0.08;
    const s = Math.min(w, h) - pad * 2;
    const px = x + (w - s) / 2, py = y + (h - s) / 2;
    if (glow) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(now() / 140);
      ctx.shadowColor = `rgba(255,209,102,${0.5 + 0.4 * pulse})`;
      ctx.shadowBlur = 26 + 14 * pulse;
      roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 12);
      ctx.fillStyle = `rgba(255,209,102,${0.1 + 0.08 * pulse})`; ctx.fill();
      ctx.restore();
    }
    drawSymbol(ctx, sym, px, py, s);
  }

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ── HUD 挂载 ──
  const handlers: HandlerMap = {
    spin: () => { if (sim) doSpin(sim.engine); },
    betup: () => { if (sim && !spinning && !overlay) { input.enqueueAction('betup'); playKSfx('bet'); } },
    betdown: () => { if (sim && !spinning && !overlay) { input.enqueueAction('betdown'); playKSfx('bet'); } },
    toggle_mute: () => { setMuted(!isMuted()); if (sim) refreshHud(sim.engine); },
    ack: () => { overlay = null; if (sim) { refreshHud(sim.engine); afterIdle(sim.engine); } },
    reset: () => restart(),
  };
  const initial: HudState = { balance: 0, bet: 0, win: 0, free: 0, spinning: false, muted: isMuted(), overlay: null };
  const topUi: MountHandle = mountUI(topHost, buildTopBar(initial), handlers, ZOMBIE_THEME, input);
  const bottomUi: MountHandle = mountUI(bottomHost, buildBottomBar(initial), handlers, ZOMBIE_THEME, input);
  let overlayUi: MountHandle | null = null;

  let lastSig = '';
  function refreshHud(engine: Engine): void {
    const st = readState(engine);
    const sig = `${st.balance}|${st.bet}|${st.win}|${st.free}|${st.spinning}|${st.muted}`;
    if (sig !== lastSig) { lastSig = sig; topUi.update(buildTopBar(st), ZOMBIE_THEME); bottomUi.update(buildBottomBar(st), ZOMBIE_THEME); }
    if (st.overlay) {
      if (!overlayUi) { overlayHost.style.pointerEvents = 'auto'; overlayUi = mountUI(overlayHost, buildOverlay(st), handlers, ZOMBIE_THEME, input); }
      else overlayUi.update(buildOverlay(st), ZOMBIE_THEME);
    } else if (overlayUi) { overlayUi(); overlayUi = null; overlayHost.style.pointerEvents = 'none'; }
  }

  // ── sim 生命周期 ──
  let sim: { engine: Engine; unsub: () => void } | null = null;
  function onFrame(engine: Engine): void {
    const lw = engine.world.getComponent<LineWins>('machine', 'LineWins');
    if (lw && lw.spin !== lastSpin) { lastSpin = lw.spin; onResolve(engine); }
    // 演出：全部轮停 → 定格
    if (spinning && anim?.target && anim.stops && now() >= anim.stops[REELS - 1]) onSettled(engine);
    drawFrame();
    refreshHud(engine);
  }
  function startSim(): void {
    const engine = new Engine({ input });
    engine.load(buildBlueprint());
    display = initGrid(); spinning = false; anim = null; lastSpin = 0; highlightCells = new Set(); overlay = null; pending = null;
    const unsub = engine.subscribe(() => onFrame(engine));
    engine.start();
    lastSig = '';
    refreshHud(engine);
    sim = { engine, unsub };
  }
  function stopSim(): void {
    if (!sim) return;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    sim.unsub(); sim.engine.stop(); sim = null;
  }
  function restart(): void {
    if (overlayUi) { overlayUi(); overlayUi = null; overlayHost.style.pointerEvents = 'none'; }
    stopSim(); startSim();
  }

  // ── 响应式缩放 ──
  const fit = (): void => {
    const cw = container.clientWidth || FIELD_W, ch = container.clientHeight || FIELD_H;
    scene.style.transform = `scale(${Math.min(cw / FIELD_W, ch / FIELD_H)})`;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);
  fit();

  startSim();

  return () => {
    stopSim();
    ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    overlayUi?.(); topUi(); bottomUi();
    wrapper.remove();
  };
}
