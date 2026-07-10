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
  ZOMBIE_THEME, BET_MIN, winTier, SYMBOLS, CHROME_ART, CHROME,
} from './theme.js';

// ── 皮肤槽注册表（美术替换工作流 · fail-soft·宿主表现层）───────────────────────
// 符号皮肤经 art.registerSkin；非符号（背景/机台/UI/横幅/金币）存这里。真图就绪即用·无则程序化/CSS 占位。
const CHROME_IMG: Record<string, HTMLImageElement> = {};   // skinKey → 已载图
const SKIN_URL: Record<string, string> = {};               // skinKey → url（供 LayoutNode Button.skin / Image.src）
let skinsDirty = true;                                      // 有新皮到位 → 触发 HUD 重建
const cimg = (key: string): HTMLImageElement | null => { const i = CHROME_IMG[key]; return i && i.complete && i.naturalWidth > 0 ? i : null; };

// 拉本地 art index → 按 skinKey 匹配符号/chrome → 载真图。无 index/404/解析失败 → 程序化照旧，绝不炸游戏。
function loadSkins(onLoad: () => void): void {
  if (typeof fetch === 'undefined') return;
  void (async () => {
    try {
      const r = await fetch('/games/game-k/art/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      const raw = await r.json();
      // index 形态：{version, assets:[{id,path,...}]}（batchGenerate 写回·同 game-j/game-m）。兼容裸数组/entries。
      const entries: Array<{ id?: string; path?: string }> = Array.isArray(raw) ? raw : Array.isArray(raw?.assets) ? raw.assets : Array.isArray(raw?.entries) ? raw.entries : [];
      const byId = new Map(entries.filter((e) => e.id && e.path).map((e) => [e.id as string, e.path as string]));
      const symBySkin = new Map(SYMBOLS.map((s) => [s.skin, s.id]));
      for (const [id, path] of byId) {
        SKIN_URL[id] = path;
        const img = new Image();
        img.onload = () => {
          const symId = symBySkin.get(id);
          if (symId !== undefined) registerSkin(symId, img); else CHROME_IMG[id] = img;
          skinsDirty = true; onLoad();
        };
        img.src = path;
      }
    } catch { /* 无美术目录/解析失败 → 回退程序化·不炸游戏 */ }
  })();
}
// 供 hud 读的皮肤 URL（LayoutNode 数据·仅在真图就绪时带上·否则控件走主题色）。
function hudSkins(): { logo?: string; panel?: string; btnSpin?: string; btnPlus?: string; btnMinus?: string; btnMute?: string; btnInfo?: string } {
  return {
    logo: SKIN_URL[CHROME.logo], panel: SKIN_URL[CHROME.hud_panel],
    btnSpin: SKIN_URL[CHROME.btn_spin], btnPlus: SKIN_URL[CHROME.btn_plus], btnMinus: SKIN_URL[CHROME.btn_minus],
    btnMute: SKIN_URL[CHROME.btn_mute], btnInfo: SKIN_URL[CHROME.btn_info],
  };
}

const STAGE_BG =
  'radial-gradient(circle at 50% 30%, #16281a 0%, #0a130c 62%, #05080600 100%),' +
  'radial-gradient(circle at 50% 120%, rgba(94,240,138,0.10), transparent 60%)';

export function mount(container: HTMLElement): () => void {
  prewarm();
  loadSkins(() => { if (sim) { skinsDirty = false; lastSig = ''; refreshHud(sim.engine); } });

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
  let inFree = false; // 免费旋转态（驱动血月背景切换·纯表现）

  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ── outcome-first 读世界 ──
  function res(engine: Engine, id: string): Resource | undefined {
    for (const [eid] of engine.world.query('Resource')) { const r = engine.world.getComponent<Resource>(eid, 'Resource'); if (r && r.id === id) return r; }
    return undefined;
  }
  function readState(engine: Engine): HudState {
    const free = Math.round(res(engine, 'freespins')?.current ?? 0);
    inFree = free > 0;
    return {
      balance: Math.round(res(engine, 'balance')?.current ?? 0),
      bet: Math.round(res(engine, 'bet')?.current ?? 0),
      win: Math.round(res(engine, 'win')?.current ?? 0),
      free,
      spinning,
      muted: isMuted(),
      overlay,
      skins: hudSkins(),
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
    if (p.total > 0) spawnCoins(p.tier === 'zombie' ? 90 : p.tier === 'mega' ? 60 : p.tier === 'big' ? 40 : 18); // 金币迸溅按档
    const bannerKey: Record<string, string> = { big: CHROME.banner_big, mega: CHROME.banner_mega, zombie: CHROME.banner_zombie, free: CHROME.banner_free };
    const bannerOf = (k: OverlayKind): string | undefined => SKIN_URL[bannerKey[k]];
    if (p.scatter >= 3) playKSfx('scatter');
    if (p.triggeredFree > 0) { playKSfx('free'); overlay = { kind: 'free', amount: p.total, free: Math.round(res(engine, 'freespins')?.current ?? 0), banner: bannerOf('free') }; }
    else if (p.tier === 'zombie' || p.tier === 'mega' || p.tier === 'big') { playKSfx('bigwin'); const k = p.tier as OverlayKind; overlay = { kind: k, amount: p.total, free: 0, banner: bannerOf(k) }; }
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
    // 皮肤槽·背景（fail-soft）：真图铺满 scene；freespins 用血月变体；无图 → 透明（CSS STAGE_BG 打底）。
    const bg = cimg(inFree ? CHROME.bg_free : CHROME.bg_main) || cimg(CHROME.bg_main);
    if (bg) ctx.drawImage(bg, 0, 0, FIELD_W, FIELD_H);

    // 皮肤槽·机台框（fail-soft）：真图罩在网格外；无图 → 程序化底框。
    const frame = cimg(CHROME.reel_frame);
    if (frame) {
      ctx.drawImage(frame, GRID_L - 24, GRID_TOP - 24, GRID_W + 48, GRID_H + 48);
    } else {
      ctx.save();
      roundRect(ctx, GRID_L - 16, GRID_TOP - 16, GRID_W + 32, GRID_H + 32, 20);
      const g = ctx.createLinearGradient(0, GRID_TOP, 0, GRID_BOT);
      g.addColorStop(0, '#14251a'); g.addColorStop(1, '#0b160e');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(94,240,138,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }

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
      // 列分隔光（仅程序化框时·真机台框自带分隔）
      if (r > 0 && !cimg(CHROME.reel_frame)) { ctx.strokeStyle = 'rgba(94,240,138,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, GRID_TOP); ctx.lineTo(cx, GRID_BOT); ctx.stroke(); }
    }
    drawCoins(t);
  }

  function drawCell(x: number, y: number, w: number, h: number, sym: number, glow: boolean): void {
    const pad = Math.min(w, h) * 0.08;
    const s = Math.min(w, h) - pad * 2;
    const px = x + (w - s) / 2, py = y + (h - s) / 2;
    // 皮肤槽·符号底板（fail-soft）：真图衬在符号下。
    const tile = cimg(CHROME.sym_tile);
    if (tile) ctx.drawImage(tile, x + 2, y + 2, w - 4, h - 4);
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

  // ── 中奖金币迸溅（皮肤槽 k/coin·fail-soft 回退画金圆）─────────────────────────
  let coins: Array<{ x: number; y: number; vx: number; vy: number; rot: number; vr: number; t0: number }> = [];
  let coinsPrev = now();
  function spawnCoins(n: number): void {
    const cx = FIELD_W / 2, cy = GRID_TOP + GRID_H / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, sp = 3 + (i % 5) * 0.7;
      coins.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, rot: a, vr: 0.2 - (i % 4) * 0.1, t0: now() });
    }
    if (coins.length > 160) coins = coins.slice(-160);
  }
  function drawCoins(t: number): void {
    if (!coins.length) return;
    const dt = Math.min(40, t - coinsPrev); coinsPrev = t;
    const coin = cimg(CHROME.coin);
    coins = coins.filter((c) => t - c.t0 < 1400);
    for (const c of coins) {
      c.vy += 0.02 * dt; c.x += c.vx * dt * 0.06; c.y += c.vy * dt * 0.06; c.rot += c.vr * dt * 0.06;
      const life = 1 - (t - c.t0) / 1400, sz = 26;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, life * 1.6)); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      if (coin) ctx.drawImage(coin, -sz / 2, -sz / 2, sz, sz);
      else { const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, sz / 2); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#ffd166'); g.addColorStop(1, '#b8860b'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, sz / 2 * (0.6 + 0.4 * Math.abs(Math.cos(c.rot))), sz / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
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
