import { describe, it, expect } from 'vitest';
import { prepareArmies, FORMATION_PRESETS, bossFor } from './index.js';
import { initLiveBattle, stepLiveBattle, liveActive, HOME_BLOOD, type DeployCmd } from './live-combat.js';
import { renderBattleDoc, renderClashSvg, type ClashView, type BattleFx } from './battle-screen.js';
import { armyToDeploys, buildBattleViewLive, canDrawFrom, freshSave } from './game-g.js';

// ═══════════════════════════════════════════════════════════════
//  Game G 战斗屏视觉回归（无头）—— WIRE-MARCH：真 live-combat 逐拍 sim → buildBattleViewLive → battle-screen 真渲染器 → 自包含 HTML。
//  owner 钉死「一格格慢慢走、接敌才翻、几十秒一局」：不同 tick 出帧 = 兵沿三路真 slot 一格格往前的铁证（非 2.5s 刷过去）。
//  渲 HTML 而非 PNG：node 无 GL（既定）；HTML 自带 CSS+字体，浏览器开即真画面。改了视觉 → toMatchFileSnapshot 当场 diff。
// ═══════════════════════════════════════════════════════════════
const setup = (): { live: ReturnType<typeof initLiveBattle>; deploys: ReturnType<typeof armyToDeploys> } => {
  const boss = bossFor(2); // 方块J·诡牌（终局牌王座）
  const { a, b } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, tiangangs: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
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

  it('出牌坞帧（CR 经济：点数圣水条 + 普通/天罡手牌 + 花点数摸牌选库 · 砍读秒暂停 · doc21）匹配 golden', async () => {
    const { live, deploys } = setup();
    while (live.tick < 40) stepLiveBattle(live, deploys);
    const control = { // 样例 CR 控盘态：普通手牌 4 张(选中第2张) + 天罡手牌 2 张 + 点数 6/10
      hand: [{ id: 'h0', rank: 'K', suit: 's' as const, general: true }, { id: 'h1', rank: '9', suit: 'h' as const, general: false }, { id: 'h2', rank: 'Q', suit: 'd' as const, general: false }, { id: 'h3', rank: '4', suit: 'c' as const, general: false }],
      selectedCard: 1, deckCount: 33,
      tengang: [{ id: 'gambler', name: '赌徒' }, { id: 'warlord', name: '枭雄' }], selectedTengang: -1, tengangDeckCount: 3,
      points: 6, pointsMax: 10, normalDrawCost: 1, tengangDrawCost: 2, canDrawNormal: true, canDrawTengang: true, migrateSource: -1,
    };
    const html = renderBattleDoc(buildBattleViewLive(live, save(), bossFor(2).name, bossFor(2).persona, 'd', control));
    expect(html).toContain('手牌 · 出牌'); // 出牌坞标题
    expect(html).toContain('点数 · 圣水'); // CR 圣水条（局内经济核心）
    expect(html).toContain('摸普通'); expect(html).toContain('摸天罡'); // 花点数摸牌(玩家选库)
    expect(html).toContain('普通库 33 · 天罡库 3'); // 两库余量
    expect(html).toContain('赌徒'); // 天罡手牌(法术)
    expect(html).not.toContain('暂停思考'); // 砍读秒暂停（CR 纯实时）
    await expect(html).toMatchFileSnapshot('./__frames__/battle-dock.html');
  });

  it('对决特写帧（命运一掷 · 点数/经营/士气=战力 主Buff明细 + 胜率区间 + 掷点落区间定生死 · owner 战斗表演）匹配 golden（HTML + SVG）', async () => {
    const { live, deploys } = setup();
    while (live.tick < 400 && live.clashSeq === 0) stepLiveBattle(live, deploys); // 跑到首次对决，取真 clash 事件
    const ev = live.lastClash!;
    const card = (c: typeof ev.a): ClashView['a'] => ({ rank: c.rank, suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general, points: c.points, buff: c.buff, morale: c.morale, tengang: c.tengang, pEff: c.pEff });
    const clash: ClashView = { lane: ev.lane, winrate: ev.winrate, roll: ev.roll, aWins: ev.aWins, tie: ev.tie, a: card(ev.a), b: card(ev.b) };
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

  it('一格格慢慢走 + 默认无迷雾（owner 2026-06-18）：最前兵 pos01 单调前推；默认即显形(face-up)、不再起手面朝下', () => {
    const { live, deploys } = setup();
    const s = save();
    const snap = (): { front: number; revealed: number; total: number } => {
      const v = buildBattleViewLive(live, s, 'X', 'p', 'd');
      const aPos = v.units.filter((u) => u.side === 'a').map((u) => u.pos01);
      return { front: aPos.length ? Math.max(...aPos) : 0, revealed: v.units.filter((u) => u.revealed).length, total: v.units.length };
    };
    const step = (to: number): void => { while (live.tick < to) stepLiveBattle(live, deploys); };
    step(6); const t6 = snap();
    step(15); const t15 = snap();
    step(25); const t25 = snap();
    expect(t15.front).toBeGreaterThan(t6.front); // 一格格往前（单调）
    expect(t25.front).toBeGreaterThan(t15.front);
    expect(t25.front).toBeGreaterThan(0.4); // ~中线
    // 默认无迷雾：所有牌一上场即显形（owner：迷雾=附魔专属、默认没有）
    expect(t6.total).toBeGreaterThan(0);
    expect(t6.revealed).toBe(t6.total);
    expect(t25.revealed).toBe(t25.total);
  });

  it('迷雾=附魔专属（owner 2026-06-18）：fogged 牌面朝下、越过本侧短线(0.18)才显形；非 fogged 即显形', () => {
    const live = initLiveBattle(9);
    const dep: DeployCmd[] = [
      { tick: 1, side: 'a', lane: 0, unit: { id: 'fog', rank: '7', suit: 'S', general: false, fogged: true } },
      { tick: 1, side: 'a', lane: 1, unit: { id: 'open', rank: '7', suit: 'H', general: false } },
    ];
    const rev = (id: string): boolean | undefined => buildBattleViewLive(live, save(), 'X', 'p', 'd').units.find((u) => u.id === id)?.revealed;
    stepLiveBattle(live, dep); // tick1 出场（pos≈0）
    expect(rev('open')).toBe(true); // 非 fogged 即显形
    expect(rev('fog')).toBe(false); // fogged 面朝下
    while ((live.lanes[0].a[0]?.pos ?? 99) < 18 && live.tick < 200) stepLiveBattle(live, dep); // 推到越过 0.18 短线
    expect(rev('fog')).toBe(true); // 过短线 → 显形（迷雾时间短）
  });

  it('板上瞬时特效（A6 斩残影 + A2 出牌啪嗒 · fx 层按 t 淡出放大）匹配 golden + 看得见淡出', async () => {
    const { live, deploys } = setup();
    while (live.tick < 30) stepLiveBattle(live, deploys);
    const fx: BattleFx[] = [
      { kind: 'death', lane: 0, side: 'b', pos01: 0.56, rank: '7', suit: 'h', general: false, t: 0.35 }, // 敌7 阵亡残影（半程淡出）
      { kind: 'death', lane: 1, side: 'a', pos01: 0.5, rank: 'K', suit: 's', general: true, t: 0.1 },     // 我方主将 K 刚斩
      { kind: 'deploy', lane: 2, side: 'a', pos01: 0.08, suit: 's', general: true, t: 0.45 },             // 出牌啪嗒（己·上场）
      { kind: 'deploy', lane: 1, side: 'b', pos01: 0.92, suit: 'd', general: false, t: 0.2 },             // 敌滴投啪嗒
    ];
    const html = renderBattleDoc(buildBattleViewLive(live, save(), bossFor(2).name, bossFor(2).persona, 'd', undefined, null, fx));
    expect(html).toContain('斩'); // 死亡闪帧（板上斩残影·非凭空消失）
    expect(html).toContain('0 0 24px #ff5d2e'); // 出牌啪嗒环（己方橙·入场反馈）
    await expect(html).toMatchFileSnapshot('./__frames__/battle-fx.html');
    // 「看得见的淡出」：刚阵亡(t≈0)斩残影最实、将散(t≈1)趋透明 —— 同一特效随 t 单调淡出（juice 是真动的，非静态贴图）。
    const death = (t: number): string => renderBattleDoc(buildBattleViewLive(live, save(), 'X', 'p', 'd', undefined, null, [{ kind: 'death', lane: 1, side: 'b', pos01: 0.5, rank: '7', suit: 'h', general: false, t }]));
    expect(death(0.05)).toContain('opacity:0.950'); // 刚阵亡 → 最实
    expect(death(0.95)).toContain('opacity:0.050'); // 将散 → 淡出
  });

  it('CR 经济摸牌门槛（doc21 §二.5）：点数不够/到上限/库空 → 不可摸；满足 → 可摸', () => {
    expect(canDrawFrom(2, 1, 3, 7, 30)).toBe(true);  // 点数够 + 未满 + 库有 → 可摸普通
    expect(canDrawFrom(0, 1, 3, 7, 30)).toBe(false); // 点数不够 → 攒点数
    expect(canDrawFrom(5, 2, 5, 5, 4)).toBe(false);  // 天罡到 cap5 → 打掉才补（play-to-draw）
    expect(canDrawFrom(5, 1, 6, 7, 0)).toBe(false);  // 库空 → 没得摸
    expect(canDrawFrom(2, 2, 0, 5, 3)).toBe(true);   // 点数刚够摸天罡(cost2)
  });

  it('确定性：同帧两次渲染逐字符一致（回归基线稳）', () => {
    expect(frameAt(60)).toBe(frameAt(60));
  });
});
