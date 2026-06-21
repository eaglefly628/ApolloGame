// dice-roll.ts —— 掷命对决「10 颗十面骰」3D 物理表现（owner 2026-06-21）。纯表现·零判定：
//   点【投掷】→ 10 颗 d10 立方骰 3D 翻滚落定 → 点数一粒粒跳进进度条 → 看是否冲破「需要的门槛线」
//   （胜率低→门槛高·难；胜率高→门槛低·易）。骰子落点全部来自 clashDiceRoll(已与既定胜负对齐·绝不重新 RNG)。
//   挂在战场屏之上的独立浮层（驱动 mount·继续=perfResume），不碰 turn-battle-screen。
import type { ClashDice } from './turn-combat.js';

export interface DiceRollOpts {
  data: ClashDice;                       // { dice[10](0-9), sum, threshold, win }
  mine: { rank: string; suit: string; pEff: number };
  foe: { rank: string; suit: string; pEff: number };
  winPct: number;                        // 我方胜率 0~100
  laneName: string;
  sfx?: (ev: 'clashReveal' | 'select' | 'clashWin' | 'clashLose') => void;
}

const SUIT_SYM: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣', S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_RED = (su: string): boolean => su === 'h' || su === 'd' || su === 'H' || su === 'D';
const SCALE = 90; // 与 clashDiceRoll 同：10 颗 d10(0-9) → 0..90

// 注入一次性 CSS（3D 翻滚 + 进度条 + 浮层）。scope 在 .gg-dice-ov 下。
function ensureCSS(): void {
  if (typeof document === 'undefined' || document.getElementById('gg-dice-css')) return;
  const s = document.createElement('style'); s.id = 'gg-dice-css';
  s.textContent = `
.gg-dice-ov{position:fixed;inset:0;z-index:360;display:flex;align-items:center;justify-content:center;background:rgba(6,9,13,.86);backdrop-filter:blur(5px);font-family:system-ui;animation:gg-dov-in .22s ease both}
@keyframes gg-dov-in{from{opacity:0}to{opacity:1}}
.gg-dice-panel{width:min(94%,760px);background:linear-gradient(180deg,#161d2b,#0e1420);border:1px solid #2a3346;border-radius:16px;padding:18px 20px 20px;box-shadow:0 24px 70px rgba(0,0,0,.6);color:#e8eef6}
.gg-dice-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}
.gg-dice-vs{display:flex;align-items:center;gap:14px;flex:1;justify-content:center;font-size:13px;color:#9fb0c2}
.gg-dc{display:inline-flex;flex-direction:column;align-items:center;gap:1px;padding:5px 10px;border-radius:9px;background:#0b0f17;border:1px solid #2a3346;min-width:54px}
.gg-dc b{font-size:20px;font-family:ui-serif,Georgia,serif;line-height:1}
.gg-dc small{font-size:10px;color:#7d8b9a}
.gg-dice-tray{perspective:680px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:16px 0;min-height:62px}
.gg-die{width:46px;height:46px;position:relative;transform-style:preserve-3d;transform:rotateX(-22deg) rotateY(18deg)}
.gg-die.roll{animation:gg-tumble var(--dur,.9s) cubic-bezier(.3,.7,.3,1) both}
@keyframes gg-tumble{0%{transform:translateY(-60px) rotateX(0) rotateY(0)}70%{transform:translateY(6px) rotateX(720deg) rotateY(560deg)}100%{transform:translateY(0) rotateX(-22deg) rotateY(18deg)}}
.gg-die .f{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--fn,ui-monospace),monospace;font-weight:800;font-size:22px;color:#2a1a08;background:linear-gradient(150deg,#ffe9b0,#f0b95a);border:1px solid #b9852e;border-radius:9px;backface-visibility:hidden}
.gg-die .f.bk{transform:translateZ(-23px) rotateY(180deg);background:linear-gradient(150deg,#f0b95a,#caa04a)}
.gg-die .f.tp{transform:rotateX(90deg) translateZ(23px);opacity:.85}
.gg-die .f.bt{transform:rotateX(-90deg) translateZ(23px);opacity:.85}
.gg-die .f.lf{transform:rotateY(-90deg) translateZ(23px);opacity:.9}
.gg-die .f.rt{transform:rotateY(90deg) translateZ(23px);opacity:.9}
.gg-die.lit .f{box-shadow:0 0 0 2px #ffd27a, 0 0 16px rgba(255,210,122,.6)}
.gg-bar-wrap{position:relative;margin-top:6px}
.gg-bar{position:relative;height:26px;border-radius:13px;background:#0b0f17;border:1px solid #2a3346;overflow:hidden}
.gg-bar-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3a6ea5,#5ea0e0);transition:width .26s cubic-bezier(.3,.7,.3,1)}
.gg-bar-fill.win{background:linear-gradient(90deg,#1f9d57,#43d07f)}
.gg-bar-fill.lose{background:linear-gradient(90deg,#b03a3a,#e06a6a)}
.gg-bar-mark{position:absolute;top:-5px;bottom:-5px;width:2px;background:#ffd27a;z-index:2}
.gg-bar-mark::after{content:attr(data-l);position:absolute;top:-17px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;color:#ffd27a}
.gg-dice-sum{text-align:center;margin-top:14px;font-size:13px;color:#9fb0c2;min-height:24px}
.gg-dice-sum b{font-size:22px;font-family:var(--fn,ui-serif)}
.gg-dice-res{font-size:24px;font-weight:800;letter-spacing:.05em}
.gg-dice-btns{display:flex;justify-content:center;margin-top:14px}
.gg-dice-btn{padding:11px 34px;border-radius:11px;border:none;cursor:pointer;font-weight:800;font-size:16px;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;box-shadow:0 6px 18px rgba(238,90,37,.4)}
.gg-dice-btn:disabled{opacity:.4;cursor:default;box-shadow:none}
.gg-dice-btn.cont{background:linear-gradient(180deg,#5ea0e0,#3a6ea5)}`;
  document.head.appendChild(s);
}

const card = (c: { rank: string; suit: string; pEff: number }, who: string): string => {
  const sym = SUIT_SYM[c.suit] ?? '';
  return `<span class="gg-dc"><b style="color:${SUIT_RED(c.suit) ? '#e06a6a' : '#e8eef6'}">${c.rank}${sym}</b><small>${who} · 战力 ${c.pEff}</small></span>`;
};
// 一颗 3D 立方骰：正面落点 v，其余面随机点数（纯装饰）。
const dieHTML = (v: number, i: number): string => {
  const r = (): number => Math.floor((Math.abs(Math.sin((i + 1) * (v + 2) * 1.7)) * 10)) % 10;
  return `<div class="gg-die" data-i="${i}" style="--dur:${(0.78 + (i % 5) * 0.05).toFixed(2)}s">
    <div class="f fr" data-face>${v}</div><div class="f bk">${r()}</div><div class="f tp">${r()}</div><div class="f bt">${r()}</div><div class="f lf">${r()}</div><div class="f rt">${r()}</div></div>`;
};

/** 挂掷命骰浮层。返回 destroy()（离场清理计时器+移除）。继续按钮 → onDone()。 */
export function mountDiceRoll(host: HTMLElement, opts: DiceRollOpts, onDone: () => void): { destroy: () => void } {
  ensureCSS();
  const { data, mine, foe, winPct, laneName } = opts;
  const sfx = opts.sfx ?? ((): void => {});
  const timers: number[] = [];
  const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };

  const ov = document.createElement('div'); ov.className = 'gg-dice-ov';
  ov.innerHTML = `<div class="gg-dice-panel">
    <div class="gg-dice-head"><b style="font-size:15px;color:#ffd27a">⚔ 掷命对决 · ${laneName}</b><span style="font-size:12px;color:#9fb0c2">我方胜率 ${winPct}%</span></div>
    <div class="gg-dice-vs">${card(mine, '我')}<span style="font-size:18px;color:#6b7891">⚔</span>${card(foe, '敌')}</div>
    <div class="gg-dice-tray">${data.dice.map((v, i) => dieHTML(v, i)).join('')}</div>
    <div class="gg-bar-wrap"><div class="gg-bar"><div class="gg-bar-fill"></div></div>
      <div class="gg-bar-mark" data-l="需冲破 ${data.threshold}" style="left:${Math.round((data.threshold / SCALE) * 100)}%"></div></div>
    <div class="gg-dice-sum">点【投掷】，让命运骰决出生死</div>
    <div class="gg-dice-btns"><button class="gg-dice-btn throw">🎲 投 掷</button></div>
  </div>`;
  host.appendChild(ov);

  const q = <T extends Element>(sel: string): T => ov.querySelector(sel) as T;
  const tray = q<HTMLElement>('.gg-dice-tray');
  const fill = q<HTMLElement>('.gg-bar-fill');
  const sumEl = q<HTMLElement>('.gg-dice-sum');
  const btns = q<HTMLElement>('.gg-dice-btns');
  const throwBtn = q<HTMLButtonElement>('.gg-dice-btn.throw');

  const destroy = (): void => { for (const t of timers) clearTimeout(t); timers.length = 0; ov.remove(); };

  throwBtn.onclick = (): void => {
    throwBtn.disabled = true; sfx('clashReveal');
    const dice = Array.from(tray.querySelectorAll<HTMLElement>('.gg-die'));
    dice.forEach((d, i) => after(i * 55, () => d.classList.add('roll'))); // 错峰翻滚
    const landMs = 1000;
    after(landMs, () => { sumEl.innerHTML = '点数跳入命运槽……'; }); // 落定 → 逐粒入槽
    let acc = 0;
    data.dice.forEach((v, i) => after(landMs + 140 + i * 130, () => {
      acc += v; dice[i]?.classList.add('lit'); sfx('select');
      fill.style.width = `${Math.round((acc / SCALE) * 100)}%`;
      sumEl.innerHTML = `命运槽 <b>${acc}</b> / 门槛 ${data.threshold}`;
    }));
    const doneMs = landMs + 140 + data.dice.length * 130 + 320;
    after(doneMs, () => { // 揭晓：冲破=我胜 / 未破=我负
      fill.classList.add(data.win ? 'win' : 'lose'); sfx(data.win ? 'clashWin' : 'clashLose');
      sumEl.innerHTML = `命运槽 <b>${data.sum}</b> ${data.win ? '＞' : '≤'} 门槛 ${data.threshold} → <span class="gg-dice-res" style="color:${data.win ? '#43d07f' : '#e06a6a'}">${data.win ? '冲破！我方胜 ⚔' : '未破 · 我方亡 ✕'}</span>`;
      btns.innerHTML = '<button class="gg-dice-btn cont">看明白了 →</button>';
      (btns.querySelector('.cont') as HTMLButtonElement).onclick = (): void => { destroy(); onDone(); };
    });
  };

  return { destroy };
}
