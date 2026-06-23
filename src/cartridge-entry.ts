interface GameModule { mount: (el: HTMLElement) => () => void }

const GAMES: Record<string, { title: string; subtitle: string }> = {
  'game-a': { title: 'Game A: Co-op Adventure',     subtitle: '双人协作冒险' },
  'game-b': { title: 'Game B: Otome VN',             subtitle: '乙游视觉小说' },
  'game-c': { title: 'Game C: Stitch & Style',       subtitle: '缝纫物语 · 换装三消' },
  'game-d': { title: 'Game D: Diablo-like ARPG',     subtitle: '暗黑类 ARPG 切片' },
  'game-e': { title: 'Game E: Balatro-like',         subtitle: '小丑牌 · 卡牌构建' },
  'game-f': { title: 'Game F: Pixel Three Kingdoms', subtitle: '像素三分天下 · 自走棋' },
  'game-g': { title: 'Game G: Fateflip Poker',       subtitle: '翻命扑克 · 3D 掷命骨架' },
  'game-i': { title: 'Game I: UI Gallery',           subtitle: '控件测试场 · 数据驱动 UI' },
};

// Statically-analyzable import chain — Rollup can DCE dead branches when
// __TARGET_GAME__ is replaced by a string literal at build time.
function startLoad(id: string): Promise<GameModule> {
  if (id === 'game-a') return import('./game-a.js') as Promise<GameModule>;
  if (id === 'game-b') return import('./game-b.js') as Promise<GameModule>;
  if (id === 'game-c') return import('./game-c.js') as Promise<GameModule>;
  if (id === 'game-d') return import('./game-d.js') as Promise<GameModule>;
  if (id === 'game-e') return import('./game-e.js') as Promise<GameModule>;
  if (id === 'game-f') return import('./games/game-f/game-f.js') as Promise<GameModule>;
  if (id === 'game-g') return import('./games/game-g/game-g.js') as Promise<GameModule>;
  if (id === 'game-i') return import('./games/game-i/game-i.js') as Promise<GameModule>;
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
  const meta = GAMES[gameId] ?? { title: gameId.toUpperCase(), subtitle: '' };

  updateClock();
  setInterval(updateClock, 15_000);

  el('cart-title').textContent = meta.title;
  el('cart-subtitle').textContent = meta.subtitle;
  el('cart-id').textContent = `${gameId.toUpperCase()} · APOLLO ENGINE`;

  // Fire game load immediately (parallel with animation)
  const gamePromise = startLoad(gameId);

  await sleep(250);
  el('cart-card').classList.add('show');

  await sleep(450);
  log('SYSTEM INITIALIZED');

  await sleep(280);
  log(`CARTRIDGE: ${gameId.toUpperCase()}`);

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

  const shell = el('shell');
  shell.classList.add('fade-out');
  shell.addEventListener('transitionend', () => shell.remove(), { once: true });
}

main().catch(console.error);
