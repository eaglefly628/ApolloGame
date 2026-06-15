import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from './three-renderer.js';
import { buildGameGArmyMatch, prepareArmies, armyFromFormation, laneEstimates, quartermasterEnergy, FORMATION_PRESETS, PRESET_NAMES, LEVER_CATALOG, LEVER_START, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, jokerKeyBuffs, BOSS_ROSTER, bossFor, GAME_G_JOKERS, JOKER_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, GAME_G_PLANETS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, type Formation, type Intervention, type LeverKind, type RunBuff } from './index.js';
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
  bossIdx: number; // 本 run 终局 Boss（每 run 轮换一名，开 run 随机定，供针对性布阵）
  jokers: string[]; // 已融小丑牌 id（局外持久 · 跨 run 不清零 · 牌组身份养成）
  planets: Record<string, number>; // 星球牌等级（局外持久 · 可叠加升档 · 第二养成轴）
}

const rollBoss = (): number => Math.floor(Math.random() * BOSS_ROSTER.length);
function freshSave(): Save {
  return { materials: 0, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2), lastOfficers: [10, 10, 10], leverEnergy: LEVER_START, lives: RUN_LIVES, bossIdx: rollBoss(), jokers: [], planets: {} }; // 44..62 起步；stage=当前战 1..5
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (Array.isArray(s.deck) && s.deck.length === DECK_SIZE) {
        if (!Array.isArray(s.lastOfficers) || s.lastOfficers.length !== 3) s.lastOfficers = [10, 10, 10]; // 旧存档兼容
        if (typeof s.leverEnergy !== 'number') s.leverEnergy = LEVER_START;
        if (typeof s.bossIdx !== 'number') s.bossIdx = rollBoss();
        if (!Array.isArray(s.jokers)) s.jokers = [];
        if (typeof s.planets !== 'object' || s.planets === null) s.planets = {};
        if (typeof s.lives !== 'number') s.lives = effectiveLives(s.planets);
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
// 场间三选一：从增益池随机取 3 张（Fisher–Yates；元层奖励，非确定性 gameplay，用 Math.random 即可）。
function pick3<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
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
        `终局 Boss：<b style="color:#f87171">${bossFor(save.bossIdx).name}</b>（${bossFor(save.bossIdx).persona}）— 据其流派针对性布阵<br>` +
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

    // 改造坊 · 融小丑（局外持久，跨 run 不清零 → 牌组身份养成；融了它在揭晓前改你军阵规则）。
    const forgeTitle = el('div', 'font:600 13px system-ui;color:#a78bfa;margin-top:2px', '⚒ 改造坊 · 融小丑牌（持久牌组身份）');
    const forge = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:560px');
    forge.replaceChildren(...GAME_G_JOKERS.map((j) => {
      const owned = save.jokers.includes(j.id);
      const b = mkBtn(owned ? `✓ ${j.name}` : `融 ${j.name}（${j.cost}）`);
      b.title = j.text;
      if (owned) b.style.cssText += ';border-color:#a78bfa;background:#1e1b2e;opacity:.85;cursor:default';
      else { b.disabled = save.materials < j.cost; if (b.disabled) b.style.opacity = '0.45'; }
      b.onclick = () => {
        if (owned || save.materials < j.cost) return;
        save.materials -= j.cost; save.jokers.push(j.id); persist(save); showLobby();
      };
      return b;
    }));
    const forgeDesc = el('div', 'font-size:11px;opacity:.72;max-width:540px;text-align:center;line-height:1.5',
      save.jokers.length
        ? '已融：' + save.jokers.map((id) => `<b style="color:#c4b5fd">${JOKER_BY_ID.get(id)?.name ?? id}</b>`).join('、') + '（悬停看效果 · 出征时自动生效）'
        : '（未融小丑 · 鼠标悬停看效果；融了它持久改你牌组的掷命规则 = 流派身份）');

    // 星球牌：第二养成轴（可叠加升档 · 持久）。改 run 参数 / 军阵底盘，与小丑(改规则·身份)正交。
    const planetTitle = el('div', 'font:600 13px system-ui;color:#60a5fa;margin-top:2px', '🪐 星球牌 · 升档（可叠加 · 持久 · 第二养成轴）');
    const planetShop = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:560px');
    planetShop.replaceChildren(...GAME_G_PLANETS.map((p) => {
      const lv = save.planets[p.id] ?? 0;
      const b = mkBtn(`${p.name} Lv.${lv} → 升（${p.cost}）`);
      b.title = p.text;
      b.disabled = save.materials < p.cost;
      if (b.disabled) b.style.opacity = '0.45';
      else b.style.cssText += ';border-color:#1e3a5a;background:#0e1726';
      b.onclick = () => {
        if (save.materials < p.cost) return;
        save.materials -= p.cost; save.planets[p.id] = (save.planets[p.id] ?? 0) + 1; persist(save); showLobby();
      };
      return b;
    }));

    // 流派身份 + 克制网：由已融小丑浮现主流派，对比本 run 终局 Boss 的流派 → 克制提示（指导针对性布阵）。
    const arch = detectArchetype(save.jokers);
    const bossArchId = bossFor(save.bossIdx).archetype;
    const bossArchName = ARCHETYPES.find((a) => a.id === bossArchId)?.name ?? bossArchId;
    let archHtml: string;
    if (arch) {
      const m = archetypeMatchup(arch.id, bossArchId);
      const rel = m === 'counter' ? '<b style="color:#22c55e">⮞ 克制</b>' : m === 'countered' ? '<b style="color:#f87171">⮜ 被克于</b>' : '<span style="opacity:.7">≈ 互不克</span>';
      archHtml = `你的流派：<b style="color:#c4b5fd">${arch.name}</b>（${arch.desc}）　${rel}　终局 Boss 流派【<b style="color:#f87171">${bossArchName}</b>】`;
    } else {
      archHtml = `你的流派：<span style="opacity:.7">未成型</span>（融小丑/取流派钥匙以确立身份）　｜　终局 Boss 流派【<b style="color:#f87171">${bossArchName}</b>】`;
    }
    const archEl = el('div', 'font-size:12px;max-width:560px;text-align:center;line-height:1.5;border-top:1px solid #1e293b;padding-top:7px', archHtml);

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

    root.append(title, stat, shop, forgeTitle, forge, forgeDesc, planetTitle, planetShop, archEl, go, reset);
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
      energyEl.innerHTML = `能量 ◈ <b style="color:#22d3ee">${save.leverEnergy}</b> / ${effectiveLeverCap(save.planets)}`;
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

  // ───────────────────────── 场间整备 · 三选一增益（roguelike 养成核 · 胜后短窗）─────────────────────────
  // 胜一场后进军前的短窗：三随机里选一项 → 选择即流派。池=资源增益 + **流派钥匙(白嫖未拥有小丑)**，
  // 后者把场间选择做成 StS/Balatro 式构筑分叉（design reply#10），不只 +stat。改后落存档、回大厅看下一战。
  function showBetween(nextLabel: string): void {
    clear();
    const title = el('div', 'font:600 18px system-ui;color:#22c55e', '🎉 战间整备 · 三选一');
    const sub = el('div', 'max-width:520px;text-align:center;opacity:.82;line-height:1.6',
      `胜一场！<b>${nextLabel}</b>前选<b>一项</b>——资源增益，或<b style="color:#c4b5fd">🃏流派钥匙</b>(白嫖小丑、定你的构筑分叉)。`);
    const pool: RunBuff[] = [...BETWEEN_BUFFS, ...jokerKeyBuffs(save.jokers)]; // 资源增益 + 未拥有小丑钥匙
    const cardsBox = el('div', 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap');
    cardsBox.replaceChildren(...pick3(pool).map((bf: RunBuff) => {
      const isKey = bf.kind === 'joker';
      const accent = isKey ? '#a78bfa' : '#22c55e';
      const card = el('div', `width:158px;padding:14px 10px;border:1px solid ${isKey ? '#4c1d95' : '#334155'};border-radius:10px;text-align:center;cursor:pointer;line-height:1.55;background:${isKey ? '#160f24' : '#10161f'}`,
        `<div style="font:600 15px system-ui;color:${isKey ? '#c4b5fd' : '#eab308'}">${bf.name}</div><div style="opacity:.85;font-size:12px;margin-top:6px">${bf.desc}</div>`);
      card.onmouseenter = () => { card.style.borderColor = accent; };
      card.onmouseleave = () => { card.style.borderColor = isKey ? '#4c1d95' : '#334155'; };
      card.onclick = () => { applyBuff(save, bf); persist(save); showLobby(); };
      return card;
    }));
    const skip = mkBtn('跳过，直接回大厅');
    skip.style.cssText += ';opacity:.6;font-size:11px';
    skip.onclick = showLobby;
    root.append(title, sub, cardsBox, skip);
  }

  // ───────────────────────── 出征（一局 3D 三路掷命）─────────────────────────
  function showMatch(formation: Formation, myName: string, interventions: Intervention[]): void {
    clear();
    const spec = battleSpec(save.stage - 1); // stage 1→战 0
    const boss = spec.boss ? bossFor(save.bossIdx) : null; // 终局 → 本 run 的牌王座
    const aiForm = boss ? boss.formation : aiFormation();
    const enemyBias = boss ? boss.favorBias : spec.enemyBias;
    const aiName = boss ? boss.name : describeFormation(aiForm.officers);
    const hint = el(
      'div',
      'max-width:560px;text-align:center;line-height:1.5;opacity:.85',
      `第 ${save.stage}/${RUN_BATTLES} 战 · <b>${spec.label}</b> ｜ 命 ${'❤'.repeat(save.lives)} ｜ 你的阵 <b>${myName}</b>/敌阵暗。<br>` +
        (boss ? `<span style="color:#f87171">⚔ ${boss.name}（${boss.persona}）：「${boss.taunt}」起手干预已落场——见招拆招！</span><br>` : '') +
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
    // 揭晓前完整编排（融小丑→玩家干预→Boss 起手→士气倍率+结局联动），与测试共用 prepareArmies、杜绝漂移；均 outcome-first。
    const { a, b, moraleA, linksA } = prepareArmies({ formation, deckBias: myBias(save.deck), jokers: save.jokers, planets: save.planets, interventions, enemyForm: aiForm, enemyBias, boss });
    engine.load(buildGameGArmyMatch(a, b, Math.floor(Math.random() * 1e9), undefined, moraleA, linksA));
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
      let route: () => void = showLobby; // 结算后"继续"去向
      let cont = '回大厅';
      if (winner === 'a') {
        save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + effectiveLeverRegen(save.planets)); // 回能◈（星球·能 升档）
        if (save.stage >= RUN_BATTLES) { // 打穿终局 Boss → 通关
          save.materials += 50;
          tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开新战役';
          save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); // 新 run：命线读星球·命、轮换 Boss
        } else { // 胜非终局 → 进军 + 场间三选一养成窗
          save.stage += 1;
          tail = `进军 第 ${save.stage}/${RUN_BATTLES} 战`;
          cont = '战间整备（三选一）';
          const nl = `进军第 ${save.stage} 战`;
          route = () => showBetween(nl);
        }
      } else { // 败/平 → 扣命
        save.lives -= 1;
        if (save.lives <= 0) { tail = '💀 <b>命尽，战役结束</b> 回大厅重整'; save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); } // 新 run：命线读星球·命、轮换 Boss
        else { tail = `命 −1（剩 ${save.lives}）重整旗鼓再战本场`; cont = '重整再战'; route = () => showFormation([...save.lastOfficers] as [number, number, number]); }
      }
      const qm = quartermasterEnergy(save.jokers, lanesA); // 督粮：每胜一路 +◈ 入下场 run 能量（post-resolve）
      if (qm > 0) { save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + qm); tail += `（督粮 +${qm}◈）`; }
      persist(save);
      const who = winner === 'a' ? '我方胜（best-of-3）' : winner === 'b' ? '敌方胜' : '平局';
      const color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
      label.innerHTML = `<span style="color:${color}">${who}</span> ｜ 三路 ${lanesA}:${lanesB} ｜ 敌阵【${aiName}】 ｜ +${gain} 材料 ｜ ${tail}`;
      back.textContent = `→ ${cont}`;
      back.onclick = route;
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
