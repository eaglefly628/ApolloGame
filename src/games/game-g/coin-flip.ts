// coin-flip.ts —— 战胜硬币「人面/字面」3D 抛掷表现（owner 2026-06-21）。纯表现·零判定：
//   一枚硬币 3D 翻腾抛向空中 → 落定 人面(留场继续) / 字面(回牌库+返还源泉)。结果来自 ClashEvent.winStays(种子化·已定)，
//   硬币只把既定结果演出来（玩家"操作"一下=点掷·AI 方自动掷）；**投掷之后才揭晓**·明细里不剧透（owner 2026-06-21·要仪式感）。
export interface CoinFlipOpts {
  winnerName: string;   // 战胜的那张牌名
  winnerMine: boolean;  // 胜者是我方？(我方→玩家点掷·敌方→自动掷)
  heads: boolean;       // 人面(true)=留场 / 字面(false)=回库（种子化既定结果·投掷后才揭晓）
  sfx?: (ev: 'select' | 'clashWin' | 'clashLose' | 'confirm') => void;
}

function ensureCSS(): void {
  if (typeof document === 'undefined' || document.getElementById('gg-coin-css')) return;
  const s = document.createElement('style'); s.id = 'gg-coin-css';
  s.textContent = `
.gg-coin-ov{position:fixed;inset:0;z-index:380;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,9,13,.78);backdrop-filter:blur(4px);font-family:system-ui;animation:gg-cov .2s ease both}
@keyframes gg-cov{from{opacity:0}to{opacity:1}}
.gg-coin-panel{width:min(92%,460px);text-align:center;background:linear-gradient(180deg,#161d2b,#0e1420);border:1px solid #2a3346;border-radius:16px;padding:20px;color:#e8eef6;box-shadow:0 24px 70px rgba(0,0,0,.6)}
.gg-coin-stage{perspective:760px;height:130px;display:flex;align-items:center;justify-content:center;margin:8px 0 14px}
.gg-coin{width:96px;height:96px;position:relative;transform-style:preserve-3d;transform:rotateX(-12deg)}
.gg-coin.flip{animation:gg-flip var(--dur,1.15s) cubic-bezier(.25,.6,.3,1) both}
@keyframes gg-flip{0%{transform:translateY(0) rotateX(-12deg)}40%{transform:translateY(-66px) rotateX(900deg)}100%{transform:translateY(0) rotateX(var(--end))}}
.gg-coin .face{position:absolute;inset:0;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;backface-visibility:hidden;border:3px solid;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.gg-coin .face b{font-size:22px;line-height:1}.gg-coin .face small{font-size:10px;margin-top:2px;opacity:.8}
.gg-coin .heads{background:radial-gradient(circle at 38% 34%,#ffe9a8,#e0a838);border-color:#b9852e;color:#5a3a08}
.gg-coin .tails{background:radial-gradient(circle at 38% 34%,#dfe6ee,#9aa7b6);border-color:#6b7891;color:#2a3346;transform:rotateX(180deg)}
.gg-coin-cap{font-size:14px;color:#9fb0c2;min-height:22px}
.gg-coin-res{font-size:20px;font-weight:800;margin-top:6px}
.gg-coin-btn{margin-top:14px;padding:11px 32px;border-radius:11px;border:none;cursor:pointer;font-weight:800;font-size:16px;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;box-shadow:0 6px 18px rgba(238,90,37,.4)}
.gg-coin-btn:disabled{opacity:.4;cursor:default;box-shadow:none}
.gg-coin-btn.cont{background:linear-gradient(180deg,#5ea0e0,#3a6ea5)}`;
  document.head.appendChild(s);
}

/** 挂战胜硬币浮层。返回 destroy()。结果(heads)已定·此处只演。继续 → onDone()。 */
export function mountCoinFlip(host: HTMLElement, opts: CoinFlipOpts, onDone: () => void): { destroy: () => void } {
  ensureCSS();
  const sfx = opts.sfx ?? ((): void => {});
  const timers: number[] = [];
  const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };

  const ov = document.createElement('div'); ov.className = 'gg-coin-ov';
  ov.innerHTML = `<div class="gg-coin-panel">
    <div style="font-size:15px;font-weight:700;color:#ffd27a;margin-bottom:2px">⚔ ${esc(opts.winnerName)} 战胜！</div>
    <div class="gg-coin-cap">${opts.winnerMine ? '掷硬币决定它的去留' : '敌方掷硬币决定去留'}</div>
    <div class="gg-coin-stage"><div class="gg-coin"><div class="face heads"><b>人面</b><small>留场</small></div><div class="face tails"><b>字面</b><small>回库</small></div></div></div>
    <div class="gg-coin-btns">${opts.winnerMine ? '<button class="gg-coin-btn throw">🪙 掷 硬 币</button>' : ''}</div>
  </div>`;
  host.appendChild(ov);

  const coin = ov.querySelector('.gg-coin') as HTMLElement;
  const cap = ov.querySelector('.gg-coin-cap') as HTMLElement;
  const btns = ov.querySelector('.gg-coin-btns') as HTMLElement;
  const destroy = (): void => { for (const t of timers) clearTimeout(t); timers.length = 0; ov.remove(); };

  const flip = (): void => {
    btns.innerHTML = ''; sfx('select');
    coin.style.setProperty('--end', `${5 * 360 + (opts.heads ? 0 : 180)}deg`); // 多转几圈·落定人头(0)/人面(180)
    coin.classList.add('flip');
    cap.textContent = '硬币翻腾中……';
    after(1250, () => { // 落定揭晓
      sfx(opts.heads ? 'clashWin' : 'clashLose');
      cap.innerHTML = `<span class="gg-coin-res" style="color:${opts.heads ? '#43d07f' : '#9aa7b6'}">${opts.heads ? '🪙 人面！留在场上继续作战 ⚔' : '🪙 字面！光荣回牌库 · 返还源泉'}</span>`;
      btns.innerHTML = '<button class="gg-coin-btn cont">继续 →</button>';
      (btns.querySelector('.cont') as HTMLButtonElement).onclick = (): void => { sfx('confirm'); destroy(); onDone(); };
    });
  };

  if (opts.winnerMine) (ov.querySelector('.throw') as HTMLButtonElement).onclick = flip; // 我方：玩家点掷
  else after(650, flip); // 敌方：自动掷

  return { destroy };
}

function esc(s: string): string { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
