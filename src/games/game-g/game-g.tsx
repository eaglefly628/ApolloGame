import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from './three-renderer.js';
import { buildGameGArmyMatch, standardArmy } from './index.js';
import type { State, Resource } from '@engine/protocol/components.js';

// Game G ·《翻命扑克》—— 大厅 ↔ 出征 闭环（launcher 卡带槽：export mount(container)→cleanup）。自包含于本目录。
// outcome-first：每张牌按 favor 跑确定性种子硬币**先定生死**，3D 翻牌是**反推的表现**（抛飞→相撞→落定翻面）。
// 闭环：大厅看材料/牌组 → 花材料改造牌组(升 favor) → 出征打一关(buildGameGMatch) → 赢取材料、关卡递增 → 再改造。
// 进度本地存档；胜负=数据决策（不回灌）；3D 只在 ThreeRenderer 表现层。是 gameF 大厅式挂载编排，复用现成能力。
const W = 600;
const H = 540;
const DECK_SIZE = 52;
const SAVE_KEY = 'gameG-save-v1';

interface Save {
  materials: number;
  stage: number;
  deck: number[]; // 我方 52 张的 favor（0..95）
}

function freshSave(): Save {
  return { materials: 0, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2) }; // 44..62 起步
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (Array.isArray(s.deck) && s.deck.length === DECK_SIZE) return s;
    }
  } catch {
    /* localStorage 不可用 → 用全新存档 */
  }
  return freshSave();
}
function persist(s: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
}

const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
const avg = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
// 牌组均 favor → 全军 favor 偏置（改造越多越强）；敌方偏置随关卡递增。
const myBias = (deck: number[]): number => avg(deck) - 50;
const enemyBias = (stage: number): number => -8 + stage * 2;

export function mount(container: HTMLElement): () => void {
  const save = loadSave();
  let engine: Engine | null = null;
  let renderer: ThreeRenderer | null = null;

  const root = document.createElement('div');
  root.style.cssText =
    'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#cbd5e1;font:13px system-ui';
  container.appendChild(root);

  const teardownEngine = (): void => {
    if (engine) engine.stop();
    if (renderer) renderer.destroy();
    engine = null;
    renderer = null;
  };
  const clear = (): void => {
    teardownEngine();
    root.replaceChildren();
  };

  // ───────────────────────── 大厅 ─────────────────────────
  function showLobby(): void {
    clear();
    const title = el('div', 'font:600 20px system-ui;color:#eab308', '翻命扑克 · 大厅');
    const stat = el(
      'div',
      'text-align:center;line-height:1.7',
      `材料 <b style="color:#eab308">${save.materials}</b> ｜ 第 <b>${save.stage}</b> 关<br>` +
        `你的牌组：${DECK_SIZE} 张，favor 均 <b>${avg(save.deck)}</b>（最低 ${Math.min(...save.deck)} / 最高 ${Math.max(...save.deck)}）<br>` +
        `<span style="opacity:.7">favor 越高越易翻正面(活)。改造牌组让更多牌活下来。</span>`,
    );

    const shop = el('div', 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:560px');
    const buy = (label: string, cost: number, apply: () => void): HTMLButtonElement => {
      const b = mkBtn(`${label}（${cost} 材料）`);
      b.disabled = save.materials < cost;
      if (b.disabled) b.style.opacity = '0.45';
      b.onclick = () => {
        if (save.materials < cost) return;
        save.materials -= cost;
        apply();
        persist(save);
        showLobby();
      };
      return b;
    };
    shop.append(
      buy('强化全军 +3 favor', 12, () => {
        save.deck = save.deck.map((f) => clampFavor(f + 3));
      }),
      buy('精炼弱牌 +8（最弱 12 张）', 8, () => {
        const order = save.deck.map((f, i) => [f, i] as const).sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < 12; k++) save.deck[order[k][1]] = clampFavor(save.deck[order[k][1]] + 8);
      }),
    );

    const go = mkBtn(`⚔ 出征 · 第 ${save.stage} 关`);
    go.style.cssText += ';background:#1e3a2a;border-color:#22c55e;font-weight:600';
    go.onclick = () => showMatch();

    const reset = mkBtn('重置进度');
    reset.style.cssText += ';opacity:.6;font-size:11px';
    reset.onclick = () => {
      Object.assign(save, freshSave());
      persist(save);
      showLobby();
    };

    root.append(title, stat, shop, go, reset);
  }

  // ───────────────────────── 出征（一局 3D 掷命）─────────────────────────
  function showMatch(): void {
    clear();
    const hint = el(
      'div',
      'max-width:560px;text-align:center;line-height:1.5;opacity:.85',
      `第 ${save.stage} 关 · 54 vs 54 三路军阵：上/中/下三路各 18 张，军衔=点数(亮牌=主将)。<br>` +
        `逐路掷命相撞翻面，<b>主将生死牵动全路</b>（活则士气、亡则溃散）；<b>胜 2/3 路即赢</b>。金=我方活/青=敌方活/石板=死。`,
    );
    const stage = document.createElement('div');
    stage.style.cssText = `width:${W}px;height:${H}px;border:1px solid #334155;border-radius:10px;overflow:hidden`;
    const label = el('div', 'min-width:300px;text-align:center;font-weight:600', '掷命中…');
    const back = mkBtn('← 返回大厅');
    back.onclick = showLobby;
    const bar = el('div', 'display:flex;gap:10px;align-items:center');
    bar.append(label, back);
    root.append(hint, stage, bar);

    engine = new Engine({ tickRate: 60 });
    engine.load(buildGameGArmyMatch(standardArmy('a', myBias(save.deck)), standardArmy('b', enemyBias(save.stage)), Math.floor(Math.random() * 1e9)));
    renderer = new ThreeRenderer({ width: W, height: H });
    engine.attachRenderer(renderer, stage);

    let settled = false;
    const onFrame = (): void => {
      if (settled || !engine) return;
      const w = engine.world;
      const winner = w.getComponent<State>('winner', 'State')?.current ?? 'pending';
      if (winner === 'pending') return;
      settled = true;
      const r = (eid: string): number => w.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
      const survA = r('res_a0') + r('res_a1') + r('res_a2');
      const survB = r('res_b0') + r('res_b1') + r('res_b2');
      const lanesA = r('res_alanes');
      const lanesB = r('res_blanes');
      // 结算奖励：存活的我方牌都算战利品；胜利额外 +15 并推进关卡（敌方更强）。
      const gain = survA + (winner === 'a' ? 15 : 0);
      save.materials += gain;
      if (winner === 'a') save.stage += 1;
      persist(save);
      const who = winner === 'a' ? '我方胜（best-of-3）' : winner === 'b' ? '敌方胜' : '平局';
      const color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
      label.innerHTML = `<span style="color:${color}">${who}</span> ｜ 三路 ${lanesA}:${lanesB} ｜ 存活 我 ${survA}:${survB} 敌 ｜ +${gain} 材料`;
      back.textContent = winner === 'a' ? '← 回大厅（关卡推进）' : '← 回大厅';
    };
    engine.subscribe(onFrame);
    engine.start();
  }

  showLobby();
  return () => {
    teardownEngine();
    root.remove();
  };
}

function el(tag: string, css: string, html = ''): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.innerHTML = html;
  return e;
}
function mkBtn(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'padding:8px 13px;border-radius:8px;border:1px solid #334155;background:#15202b;color:#e2e8f0;cursor:pointer;font:12px system-ui';
  return b;
}
