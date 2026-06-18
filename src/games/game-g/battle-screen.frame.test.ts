import { describe, it, expect } from 'vitest';
import { prepareArmies, FORMATION_PRESETS, bossFor } from './index.js';
import { initLiveBattle, stepLiveBattle, liveActive, HOME_BLOOD } from './live-combat.js';
import { renderBattleDoc, renderClashSvg, type ClashView } from './battle-screen.js';
import { armyToDeploys, buildBattleViewLive, freshSave } from './game-g.js';

// ═══════════════════════════════════════════════════════════════
//  Game G 战斗屏视觉回归（无头）—— WIRE-MARCH：真 live-combat 逐拍 sim → buildBattleViewLive → battle-screen 真渲染器 → 自包含 HTML。
//  owner 钉死「一格格慢慢走、接敌才翻、几十秒一局」：不同 tick 出帧 = 兵沿三路真 slot 一格格往前的铁证（非 2.5s 刷过去）。
//  渲 HTML 而非 PNG：node 无 GL（既定）；HTML 自带 CSS+字体，浏览器开即真画面。改了视觉 → toMatchFileSnapshot 当场 diff。
// ═══════════════════════════════════════════════════════════════
const setup = (): { live: ReturnType<typeof initLiveBattle>; deploys: ReturnType<typeof armyToDeploys> } => {
  const boss = bossFor(2); // 方块J·诡牌（终局牌王座）
  const { a, b } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, jokers: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
  const live = initLiveBattle(7, HOME_BLOOD);
  const deploys = [...armyToDeploys(a, 'a'), ...armyToDeploys(b, 'b')];
  return { live, deploys };
};
const save = (): ReturnType<typeof freshSave> => { const s = freshSave(); s.materials = 28; return s; };
// 跑到第 ticks 拍（live-combat 真 sim）→ 真渲染器出帧。doc/UI 三路战场忠实港。
const frameAt = (ticks: number, theme: 'onyx' | 'brocade' = 'onyx'): string => {
  const { live, deploys } = setup();
  while (live.tick < ticks && live.winner === 'pending') { stepLiveBattle(live, deploys); if (live.winner === 'pending' && !liveActive(live)) break; }
  return renderBattleDoc(buildBattleViewLive(live, save(), bossFor(2).name, bossFor(2).persona, 'd'), theme);
};

describe('Game G · 战斗屏视觉回归（真 live-combat → HTML golden · 无头 · design/UI 三路战场）', () => {
  it('行军中帧（tick6 · 兵面朝下沿三路一格格爬、还没接敌）匹配 golden', async () => {
    const html = frameAt(6);
    expect(html).toContain('我方老家'); // 顶部 HUD（真渲染器输出·非空）
    expect(html).toContain('干预卡 · Levers'); // 左栏
    expect(html).toContain('占领敌方老家'); // 相位条
    expect(html).toContain('--accent:#ff5d2e'); // 玄铁皮
    await expect(html).toMatchFileSnapshot('./__frames__/battle-march.html');
  });

  it('接敌帧（tick25 · 三路最前两张相邻、翻牌成波对决）匹配 golden', async () => {
    await expect(frameAt(25)).toMatchFileSnapshot('./__frames__/battle-clash.html');
  });

  it('破家帧（跑到底 · 幸存突破·攻克敌 3 血老家）匹配 golden', async () => {
    await expect(frameAt(400)).toMatchFileSnapshot('./__frames__/battle-break.html');
  });

  it('锦霞皮帧匹配 golden', async () => {
    const html = frameAt(70, 'brocade');
    expect(html).toContain('--accent:#d8607b'); // 锦霞皮
    await expect(html).toMatchFileSnapshot('./__frames__/battle-brocade.html');
  });

  it('出牌坞帧（底部手牌 + 选牌派三路 + 读秒银行 · doc18 控盘层）匹配 golden', async () => {
    const { live, deploys } = setup();
    while (live.tick < 40) stepLiveBattle(live, deploys);
    const control = { // 样例控盘态：手牌 5 张(选中第2张)、抽牌堆 33、读秒银行 64/90s
      hand: [{ id: 'h0', rank: 'K', suit: 's' as const, general: true }, { id: 'h1', rank: '9', suit: 'h' as const, general: false }, { id: 'h2', rank: 'Q', suit: 'd' as const, general: false }, { id: 'h3', rank: '4', suit: 'c' as const, general: false }, { id: 'h4', rank: '★', suit: 's' as const, general: true }],
      selectedCard: 1, deckCount: 33, pauseBank: 64000, pauseMax: 90000, paused: false,
    };
    const html = renderBattleDoc(buildBattleViewLive(live, save(), bossFor(2).name, bossFor(2).persona, 'd', control));
    expect(html).toContain('手牌 · 出牌'); // 出牌坞标题
    expect(html).toContain('抽牌堆 33'); // 抽牌堆余量
    expect(html).toContain('⏸ 暂停思考 (空格)'); // 读秒暂停
    await expect(html).toMatchFileSnapshot('./__frames__/battle-dock.html');
  });

  it('对决特写帧（命运一掷 · 点数/经营/士气=战力 主Buff明细 + 胜率区间 + 掷点落区间定生死 · owner 战斗表演）匹配 golden（HTML + SVG）', async () => {
    const { live, deploys } = setup();
    while (live.tick < 400 && live.clashSeq === 0) stepLiveBattle(live, deploys); // 跑到首次对决，取真 clash 事件
    const ev = live.lastClash!;
    const card = (c: typeof ev.a): ClashView['a'] => ({ rank: c.rank, suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general, points: c.points, buff: c.buff, morale: c.morale, pEff: c.pEff });
    const clash: ClashView = { lane: ev.lane, winrate: ev.winrate, roll: ev.roll, aWins: ev.aWins, a: card(ev.a), b: card(ev.b) };
    const html = renderBattleDoc(buildBattleViewLive(live, save(), bossFor(2).name, bossFor(2).persona, 'd', undefined, clash));
    expect(html).toContain('命运一掷'); // 特写标题
    expect(html).toContain('经营'); // 主 Buff 明细：点数·经营·士气
    expect(html).toContain('＝ 战力');
    expect(live.clashSeq).toBeGreaterThan(0); // 真发生了对决（roll/winrate/buff/morale 来自真 sim）
    await expect(html).toMatchFileSnapshot('./__frames__/battle-clash-closeup.html');
    // SVG 看帧（矢量图·客户端可内联预览，解「HTML 看不到」）：同款明细。
    const svg = renderClashSvg(clash);
    expect(svg).toContain('<svg');
    expect(svg).toContain('经营');
    await expect(svg).toMatchFileSnapshot('./__frames__/battle-clash-closeup.svg');
  });

  it('一格格慢慢走（owner 钉死）：最前兵 pos01 随 tick 单调前推；行军面朝下、接敌才翻（非一次全翻/瞬移）', () => {
    const { live, deploys } = setup();
    const s = save();
    const snap = (): { front: number; revealed: number } => {
      const v = buildBattleViewLive(live, s, 'X', 'p', 'd');
      const aPos = v.units.filter((u) => u.side === 'a').map((u) => u.pos01);
      return { front: aPos.length ? Math.max(...aPos) : 0, revealed: v.units.filter((u) => u.revealed).length };
    };
    const step = (to: number): void => { while (live.tick < to) stepLiveBattle(live, deploys); };
    step(6); const t6 = snap();
    step(15); const t15 = snap();
    step(25); const t25 = snap();
    expect(t6.revealed).toBe(0); // 行军中：面朝下、没接敌（非一次全翻）
    expect(t6.front).toBeGreaterThan(0); // 已离家往前爬
    expect(t15.front).toBeGreaterThan(t6.front); // 一格格往前（单调）
    expect(t25.front).toBeGreaterThan(t15.front);
    expect(t25.front).toBeGreaterThan(0.4); // ~中线接敌
    expect(t25.revealed).toBeGreaterThan(0); // 接敌才翻（成波）
  });

  it('确定性：同帧两次渲染逐字符一致（回归基线稳）', () => {
    expect(frameAt(60)).toBe(frameAt(60));
  });
});
