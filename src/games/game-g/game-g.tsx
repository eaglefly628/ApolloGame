import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from './three-renderer.js';
import { buildGameGArmyMatch, armyFromFormation, applyInterventions, laneEstimates, FORMATION_PRESETS, PRESET_NAMES, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, battleSpec, RUN_BATTLES, RUN_LIVES, type Formation, type Intervention, type LeverKind } from './index.js';
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
  lastOfficers: number[]; // 上次布阵的三路军官数 [上,中,下]（默认选中 + AI 克制依据）
  leverEnergy: number; // 干预能量◈（开局 3 / 每胜 +2 / 上限 6）
  lives: number; // 战役命线（开 run 3 命，输一场 −1，命尽=run 结束）
}

function freshSave(): Save {
  return { materials: 0, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2), lastOfficers: [10, 10, 10], leverEnergy: LEVER_START, lives: RUN_LIVES }; // 44..62 起步；stage=当前战 1..5
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (Array.isArray(s.deck) && s.deck.length === DECK_SIZE) {
        if (!Array.isArray(s.lastOfficers) || s.lastOfficers.length !== 3) s.lastOfficers = [10, 10, 10]; // 旧存档兼容
        if (typeof s.leverEnergy !== 'number') s.leverEnergy = LEVER_START;
        if (typeof s.lives !== 'number') s.lives = RUN_LIVES;
        if (s.stage < 1 || s.stage > RUN_BATTLES) s.stage = 1;
        return s;
      }
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
// AI 暗布阵：低关固定均衡 / 中关变化 / 高关克制你上局阵型（石头剪刀布闭环）。对玩家隐藏，开战揭晓。
const PRESET_DESC: Record<string, string> = { 均衡: '10/10/10 · 三路均摊', 锋矢: '6/18/6 · 攻中', 两翼: '13/4/13 · 弃中', 田忌: '2/14/14 · 弃上' };
const LANE_NAME = ['上', '中', '下'];
// 布阵 → 名称（命中预设则用预设名，否则"自定义 x/y/z"），用于战后揭晓敌阵。
function describeFormation(off: number[]): string {
  for (const n of PRESET_NAMES) {
    const p = FORMATION_PRESETS[n].officers;
    if (p[0] === off[0] && p[1] === off[1] && p[2] === off[2]) return n;
  }
  return `自定义 ${off[0]}/${off[1]}/${off[2]}`;
}

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
      `材料 <b style="color:#eab308">${save.materials}</b> ｜ 战役 第 <b>${save.stage}/${RUN_BATTLES}</b> 战 ｜ 命 ${'❤'.repeat(save.lives)} ｜ 能量 ◈${save.leverEnergy}<br>` +
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

    const go = mkBtn(`⚔ 出征 · 第 ${save.stage}/${RUN_BATTLES} 战（${battleSpec(save.stage - 1).label}）`);
    go.style.cssText += ';background:#1e3a2a;border-color:#22c55e;font-weight:600';
    go.onclick = () => showFormation([...save.lastOfficers] as [number, number, number]);

    const reset = mkBtn('重置进度');
    reset.style.cssText += ';opacity:.6;font-size:11px';
    reset.onclick = () => {
      Object.assign(save, freshSave());
      persist(save);
      showLobby();
    };

    root.append(title, stat, shop, go, reset);
  }

  // ───────────────────────── 布阵（田忌赛马 · 开战前核心博弈）─────────────────────────
  const aiFormation = (): Formation => {
    const s = save.stage;
    if (s <= 2) return FORMATION_PRESETS['均衡']; // 低关：固定均衡
    if (s <= 5) return FORMATION_PRESETS[PRESET_NAMES[(s + save.materials) % 4]]; // 中关：变化
    const weak = save.lastOfficers.indexOf(Math.min(...save.lastOfficers)); // 高关：猛攻你最弱的一路
    const off: [number, number, number] = [6, 6, 6];
    off[weak] = 18;
    return { officers: off };
  };
  // 布阵屏：4 预设一键套 + ± 自定义分兵（军官跨路、兵自动补平）+ 三路实时预估条。
  function showFormation(officers: [number, number, number]): void {
    clear();
    const f: Formation = { officers };
    const title = el('div', 'font:600 18px system-ui;color:#eab308', `布阵 · 第 ${save.stage} 关`);
    const sub = el('div', 'max-width:560px;text-align:center;opacity:.82;line-height:1.6',
      '三路只需<b>赢两路</b>：均摊赌险胜，还是<b>弃一路</b>、把 30 名军官堆进两路稳拿 2:1？敌方也在<b>暗布阵</b>。<br>套预设或用 ± 自定义分兵（军官越多该路越强；兵自动补平 18/路）。');
    const presetBar = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center');
    presetBar.replaceChildren(...PRESET_NAMES.map((name) => {
      const b = mkBtn(name);
      b.title = PRESET_DESC[name];
      const p = FORMATION_PRESETS[name].officers;
      if (p[0] === officers[0] && p[1] === officers[1] && p[2] === officers[2]) b.style.cssText += ';border-color:#eab308;background:#2a2410;font-weight:700';
      b.onclick = () => showFormation([...FORMATION_PRESETS[name].officers] as [number, number, number]);
      return b;
    }));
    // ± 维持总数 30：+ 从最多的另一路取一军官，− 给最少的另一路（兵自动补平）。
    const otherLane = (i: number, wantMax: boolean): number => {
      const cands = [0, 1, 2].filter((j) => j !== i && (wantMax ? officers[j] > 0 : officers[j] < 18));
      return cands.length ? cands.reduce((bj, j) => ((wantMax ? officers[j] > officers[bj] : officers[j] < officers[bj]) ? j : bj), cands[0]) : -1;
    };
    const est = laneEstimates(armyFromFormation('a', myBias(save.deck), f));
    const lanesBox = el('div', 'display:flex;gap:10px');
    lanesBox.replaceChildren(...[0, 1, 2].map((i) => {
      const box = el('div', 'width:150px;padding:9px;border:1px solid #334155;border-radius:8px;text-align:center;line-height:1.55',
        `<b>${LANE_NAME[i]}路</b><br>军官 <b>×${officers[i]}</b> ｜ 主将 <b>${est[i].general}</b><br>Σfavor <b style="color:#eab308">${est[i].sumFavor}</b>`);
      const ctl = el('div', 'display:flex;gap:6px;justify-content:center;margin-top:6px');
      const minus = mkBtn('−');
      const plus = mkBtn('＋');
      minus.onclick = () => { const r = otherLane(i, false); if (officers[i] > 0 && r >= 0) { officers[i]--; officers[r]++; showFormation(officers); } };
      plus.onclick = () => { const d = otherLane(i, true); if (officers[i] < 18 && d >= 0) { officers[d]--; officers[i]++; showFormation(officers); } };
      ctl.append(minus, plus);
      box.appendChild(ctl);
      return box;
    }));
    const go = mkBtn('⚔ 确认出征');
    go.style.cssText += ';background:#1e3a2a;border-color:#22c55e;font-weight:600';
    go.onclick = () => { save.lastOfficers = [...officers]; persist(save); showPrep(f, describeFormation(officers)); };
    const back = mkBtn('← 返回大厅');
    back.onclick = showLobby;
    const btnRow = el('div', 'display:flex;gap:10px');
    btnRow.append(go, back);
    root.append(title, sub, presetBar, lanesBox, btnRow);
  }

  // ───────────────────────── 备战 · 干预相位（开战前用◈改命，揭晓前生效）─────────────────────────
  function showPrep(formation: Formation, myName: string): void {
    clear();
    const interventions: Intervention[] = [];
    const title = el('div', 'font:600 18px system-ui;color:#eab308', `备战 · 干预（第 ${save.stage} 关 · 你的阵 ${myName}）`);
    const sub = el('div', 'max-width:560px;text-align:center;opacity:.82;line-height:1.6',
      '开战前用<b>干预能量◈</b>改命：祝福/诅咒改 favor、<b>斩首令</b>擒贼先擒王(敌主将必掉→该路溃散)、增援铺场。<br>全在<b>揭晓前</b>生效——胜负仍由规则定、可回放。能量有限：这关花，还是攒？');
    const energyEl = el('div', 'font-weight:600');
    const queueEl = el('div', 'min-height:20px;opacity:.85;font-size:12px');
    const cardsBox = el('div', 'display:flex;flex-direction:column;gap:7px');
    const refresh = (): void => {
      energyEl.innerHTML = `能量 ◈ <b style="color:#22d3ee">${save.leverEnergy}</b> / ${LEVER_CAP}`;
      queueEl.innerHTML = interventions.length
        ? '已打出：' + interventions.map((iv) => `${LEVER_CATALOG[iv.kind].name}→${LANE_NAME[iv.lane]}路`).join('，')
        : '（未打出干预）';
    };
    const KINDS = Object.keys(LEVER_CATALOG) as LeverKind[]; // 6 卡自动全列
    cardsBox.replaceChildren(...KINDS.map((kind) => {
      const c = LEVER_CATALOG[kind];
      const row = el('div', 'display:flex;gap:7px;align-items:center;justify-content:center');
      row.appendChild(el('div', 'width:250px;text-align:right;font-size:12px', `<b>${c.name}</b> <span style="opacity:.6">${c.cost}◈ · ${c.desc}</span>`));
      [0, 1, 2].forEach((lane) => {
        const b = mkBtn(LANE_NAME[lane]);
        b.style.cssText += ';padding:5px 9px';
        b.onclick = () => {
          if (save.leverEnergy >= c.cost) { save.leverEnergy -= c.cost; interventions.push({ kind, lane }); persist(save); refresh(); }
        };
        row.appendChild(b);
      });
      return row;
    }));
    const go = mkBtn('⚔ 出征');
    go.style.cssText += ';background:#1e3a2a;border-color:#22c55e;font-weight:600';
    go.onclick = () => showMatch(formation, myName, interventions);
    const back = mkBtn('← 改布阵');
    back.onclick = () => showFormation([...save.lastOfficers] as [number, number, number]);
    const btnRow = el('div', 'display:flex;gap:10px');
    btnRow.append(go, back);
    root.append(title, sub, energyEl, el('div', 'font-size:12px;opacity:.6', '（点卡名右侧 上/中/下 选目标路打出）'), cardsBox, queueEl, btnRow);
    refresh();
  }

  // ───────────────────────── 出征（一局 3D 三路掷命）─────────────────────────
  function showMatch(formation: Formation, myName: string, interventions: Intervention[]): void {
    clear();
    const aiForm = aiFormation();
    const aiName = describeFormation(aiForm.officers);
    const hint = el(
      'div',
      'max-width:560px;text-align:center;line-height:1.5;opacity:.85',
      `第 ${save.stage}/${RUN_BATTLES} 战 · <b>${battleSpec(save.stage - 1).label}</b> ｜ 命 ${'❤'.repeat(save.lives)} ｜ 你的阵 <b>${myName}</b>/敌阵暗。<br>` +
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
    const armyA = armyFromFormation('a', myBias(save.deck), formation);
    const spec = battleSpec(save.stage - 1); // stage 1→战 0
    const armyB = armyFromFormation('b', spec.enemyBias, aiForm);
    const { a, b } = applyInterventions(armyA, armyB, interventions, myBias(save.deck)); // 揭晓前施加干预
    engine.load(buildGameGArmyMatch(a, b, Math.floor(Math.random() * 1e9)));
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
      let tail = '';
      if (winner === 'a') {
        save.leverEnergy = Math.min(LEVER_CAP, save.leverEnergy + LEVER_REGEN); // 回能◈
        if (save.stage >= RUN_BATTLES) { // 打穿终局 Boss → 通关
          save.materials += 50;
          tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开新战役';
          save.stage = 1; save.lives = RUN_LIVES;
        } else { save.stage += 1; tail = `进军 第 ${save.stage}/${RUN_BATTLES} 战`; }
      } else { // 败/平 → 扣命
        save.lives -= 1;
        tail = save.lives <= 0 ? '💀 <b>命尽，战役结束</b> 回大厅重整' : `命 −1（剩 ${save.lives}）重整旗鼓再战本场`;
        if (save.lives <= 0) { save.stage = 1; save.lives = RUN_LIVES; }
      }
      persist(save);
      const who = winner === 'a' ? '我方胜（best-of-3）' : winner === 'b' ? '敌方胜' : '平局';
      const color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
      label.innerHTML = `<span style="color:${color}">${who}</span> ｜ 三路 ${lanesA}:${lanesB} ｜ 敌阵【${aiName}】 ｜ +${gain} 材料 ｜ ${tail}`;
      back.textContent = '← 回大厅';
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
