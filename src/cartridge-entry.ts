import { createPlatformPort, firstBootAchievement } from './services/platform/index.js';

interface GameModule { mount: (el: HTMLElement) => () => void }

const GAMES: Record<string, { title: string; subtitle: string }> = {
  'game-e': { title: 'Game E: Balatro-like',         subtitle: '小丑牌 · 卡牌构建' },
  'game-f': { title: 'Game F: Pixel Three Kingdoms', subtitle: '像素三分天下 · 自走棋' },
  'game-g': { title: 'Game G: Fateflip Poker',       subtitle: '翻命扑克 · 3D 掷命骨架' },
  'game-i': { title: 'Game I: UI Gallery',           subtitle: '控件测试场 · 数据驱动 UI' },
  'game-x': { title: 'Game X: Living Companion',     subtitle: '残响 · 掌上伴侣 Desk Mode' },
};

// Statically-analyzable import chain — Rollup can DCE dead branches when
// __TARGET_GAME__ is replaced by a string literal at build time.
//   '__inline__' = 数据卡带离线单文件：跑 window.__APOLLO_INLINE_CART__ 内联 manifest
//   （scripts/package-web.mjs 打包库卡带走此分支；工程游戏各自静态 import 不受牵连、不进数据运行时）。
function startLoad(id: string): Promise<GameModule> {
  if (id === '__inline__') return import('./cartridge-inline-run.js') as Promise<GameModule>;
  if (id === 'game-e') return import('./game-e.js') as Promise<GameModule>;
  if (id === 'game-f') return import('./games/game-f/game-f.js') as Promise<GameModule>;
  if (id === 'game-g') return import('./games/game-g/game-g.js') as Promise<GameModule>;
  if (id === 'game-i') return import('./games/game-i/game-i.js') as Promise<GameModule>;
  if (id === 'game-x') return import('./games/game-x/game-x.js') as Promise<GameModule>;
  return Promise.reject(new Error(`Unknown game: ${id}`));
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const el = (id: string) => document.getElementById(id) as HTMLElement;

function log(msg: string, type: 'ok' | 'warn' = 'ok') {
  const div = document.createElement('div');
  div.className = `log-line${type === 'warn' ? ' warn' : ''}`;
  div.innerHTML = `<span class="log-pfx">${type === 'warn' ? '!' : '>'}</span><span class="log-txt">${msg}</span>`;
  el('boot-log').appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));
}

function setProgress(pct: number, status: string) {
  (el('prog-fill') as HTMLElement).style.width = `${pct}%`;
  el('prog-pct').textContent = `${pct}%`;
  el('prog-status').textContent = status;
}

function updateClock() {
  const d = new Date();
  el('sys-clock').textContent =
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function main() {
  const gameId = __TARGET_GAME__;
  // 内联数据卡带：标题/副标题由 package-web.mjs 注入的 __APOLLO_INLINE_META__ 提供（无静态 GAMES 条目）。
  const inlineMeta = gameId === '__inline__' ? (window.__APOLLO_INLINE_META__ ?? {}) : undefined;
  const meta = inlineMeta
    ? { title: inlineMeta.title || 'ZEROCRAFT CARTRIDGE', subtitle: inlineMeta.subtitle || '数据驱动卡带' }
    : (GAMES[gameId] ?? { title: gameId.toUpperCase(), subtitle: '' });
  const cartLabel = inlineMeta ? (meta.title || 'CARTRIDGE') : gameId.toUpperCase();

  updateClock();
  setInterval(updateClock, 15_000);

  el('cart-title').textContent = meta.title;
  el('cart-subtitle').textContent = meta.subtitle;
  el('cart-id').textContent = `${cartLabel} · ZEROCRAFT PREVIEW`;

  // Fire game load immediately (parallel with animation)
  const gamePromise = startLoad(gameId);

  await sleep(250);
  el('cart-card').classList.add('show');

  await sleep(450);
  log('SYSTEM INITIALIZED');

  await sleep(280);
  log(`CARTRIDGE: ${cartLabel}`);

  await sleep(320);
  log('ENGINE CHECKSUM... OK');

  await sleep(280);
  el('prog-wrap').classList.add('show');
  setProgress(25, 'LOADING ASSETS');

  await sleep(300);
  log('MOUNTING RENDERER...');
  setProgress(55, 'MOUNTING RENDERER');

  await sleep(280);
  log('INITIALIZING WORLD...');
  setProgress(80, 'INITIALIZING WORLD');

  // Await game module (should already be ready by now)
  let mod: GameModule;
  try {
    mod = await gamePromise;
  } catch (e) {
    log(`LOAD FAILED: ${String(e)}`, 'warn');
    return;
  }

  setProgress(100, 'READY');
  log('STARTING GAME...');
  await sleep(380);

  // Mount game behind shell, then crossfade
  const gameRoot = el('game-root');
  gameRoot.style.transition = 'opacity 0.55s ease';
  mod.mount(gameRoot);

  await sleep(80);
  gameRoot.style.opacity = '1';

  // 平台层（Steam / 假 Steam · sim 外）：上报富状态 + 解锁「首次启动」成就。
  // 无原生壳且未开假 Steam → createPlatformPort 返回 Null，全部 no-op（生产静默，零副作用）。
  // 开假 Steam（?steammock=1 或 localStorage['apollo:steam:mock']=1）→ 右下角弹 Steam 风格成就。
  try {
    const platform = createPlatformPort();
    if (platform.isAvailable()) {
      platform.setRichPresence('status', meta.subtitle || meta.title);
      const boot = firstBootAchievement(gameId);
      if (boot) platform.unlockAchievement(boot);
      platform.store();
      log('PLATFORM: CONNECTED');
    }
  } catch (e) { /* 平台不可用绝不影响游戏启动 */ }

  const shell = el('shell');
  shell.classList.add('fade-out');
  shell.addEventListener('transitionend', () => shell.remove(), { once: true });
}

main().catch(console.error);
