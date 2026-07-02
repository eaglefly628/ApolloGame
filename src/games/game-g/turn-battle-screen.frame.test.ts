// turn-battle-screen 视觉回归（无头 · doc24 回合制战斗屏·忠实端口 Cloud Design「Game G 回合制战场.dc.html」）。
// 渲 HTML golden（固定 1340×858·非 cqw）：棋盘静息态 / 掷命特写 / 锦霞皮。改了视觉 → toMatchFileSnapshot 当场 diff。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './combat-types.js';
import { initTurnBattle, type TurnUnit, type PokerCard, type TengangHandCard } from './turn-combat.js';
import { buildTurnBattleView, renderTurnBattleDoc, type TurnClashView } from './turn-battle-screen.js';

const u = (id: string, rank: string, suit: string, slot: number, buff = 0): TurnUnit =>
  ({ id, rank, suit, points: cardPoints(rank), buff, general: false, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });
const nm = (id: string): string => (({ hufu: '虎符', jixing: '疾行' } as Record<string, string>)[id] || id);

// 确定性中局态：三路布兵（中路前锋相邻→clash ring）+ 6 召唤源泉 + 放牌动作锁定 + 手牌(兵×4 + 天罡×2)。
const setup = (): ReturnType<typeof initTurnBattle> => {
  const b = initTurnBattle({ seed: 1 });
  b.turn = 4; b.active = 'a'; b.homeA = 3; b.homeB = 2; b.a.mana = 6; b.actionTaken = 'deploy';
  b.gatesOpen[0] = true; b.gatesOpen[3] = true; // 默认全闭 ✕·翻开两道通路(◉)·看开/闭双态梯子
  b.lanes[0].a = [u('a0', 'K', 'S', 2)]; b.lanes[0].b = [u('b0', 'Q', 'H', 6)];
  b.lanes[1].a = [u('a1', 'A', 'S', 4), u('a2', '7', 'D', 1)]; b.lanes[1].b = [u('b1', '9', 'H', 5), u('b2', 'J', 'H', 7)];
  b.lanes[2].a = [u('a3', '10', 'C', 2)]; b.lanes[2].b = [u('b3', 'K', 'D', 7)];
  const pk = (id: string, rank: string, suit: string): PokerCard => ({ kind: 'poker', id, rank, suit, general: false, buff: 0 });
  const tg = (id: string): TengangHandCard => ({ kind: 'tengang', id });
  b.a.hand = [pk('h0', 'A', 'S'), pk('h1', 'K', 'H'), pk('h2', '9', 'C'), pk('h3', '7', 'D'), tg('hufu'), tg('jixing')];
  return b;
};

describe('Game G · turn-battle-screen（doc24 回合制战斗屏 · 忠实端口 Cloud Design · 无头 golden）', () => {
  it('棋盘帧（三路9格 slot + 堡垒3血 + 召唤源泉 + 动作菜单 + 手牌）匹配 golden', async () => {
    const html = renderTurnBattleDoc(buildTurnBattleView(setup(), { theme: 'onyx', tengangName: nm }));
    expect(html).toContain('回合制 · 翻命扑克'); // topbar battleLabel 默认值
    expect(html).toContain('召唤源泉'); // 召唤源泉横条
    for (const k of ['draw', 'deploy', 'cast', 'discard']) expect(html).toContain(`data-action="${k}"`); // 四动作钩子已迁数据驱动动作菜单(LayoutNode·UI 铁律)→ data-action；统一委托接
    expect(html).toContain('--accent:#ff7a45'); // 玄铁皮
    expect(html).toContain('地煞牌'); // 敌堡垒地煞
    await expect(html).toMatchFileSnapshot('./__frames__/turn-board.html');
  });

  it('绝命对决特写帧（各自掷战力骰·两骰掷值对比 + 我方/敌方战力明细 + 战损对折）匹配 golden', async () => {
    const clash: TurnClashView = {
      laneName: '中路',
      mine: { rank: 'A', suit: 's', name: '黑桃A', zod: '虎', won: true },
      foe: { rank: '9', suit: 'h', name: '红桃9', zod: '蛇', won: false },
      oddsMine: 62, rollPct: 0, rollMine: 22, rollFoe: 9, // 各自掷战力骰：我掷 22(范围[1,30]) > 敌掷 9(范围[1,25]) → 我胜
      bonusMine: [['点数(基础)', 14], ['经营(养成)', 22], ['天罡(法术)', 18], ['士气(主将)', 30], ['　战力上限 · 封顶 30（超出截断）', -54]],
      bonusFoe: [['点数(基础)', 9], ['经营(养成)', 10], ['天罡(法术)', 6], ['士气(主将)', 0]],
      pEffMine: 30, pEffFoe: 25,
      extras: ['⚖ 掷平 → 战力高者胜', '⚔ 黑桃A 战胜（第 1 连胜）→ 疲劳战损：战力对折 −15（−50%）· 留场续战·越打越弱'],
    };
    const html = renderTurnBattleDoc(buildTurnBattleView(setup(), { theme: 'onyx', tengangName: nm, clash }));
    expect(html).toContain('绝命对决'); expect(html).not.toContain('掷命对决'); // 命名：绝命对决（非旧掷命对决）
    expect(html).toContain('我方加成明细'); expect(html).toContain('敌方加成明细');
    expect(html).toContain('额外效果'); expect(html).toContain('封顶 30'); // 来源清晰：额外效果区 + 封顶对齐行（owner 2026-06-21）
    expect(html).toContain('掷命预报'); expect(html).not.toContain('CoinFlip'); // 各自掷战力骰·揭晓无掷币（owner 2026-07-01）
    expect(html).toContain('各自掷战力骰'); expect(html).toContain('🎲'); expect(html).toContain('掷高'); // 两骰摆牌下 + 掷高者胜（owner 2026-07-02）
    expect(html).toContain('>22<'); expect(html).toContain('>9<'); // 两骰掷值（我 22 / 敌 9·各在独立骰位）
    expect(html).toContain('战力对折'); // 战损：写清对折削减（owner 2026-07-01）
    expect(html).toContain('留场续战'); expect(html).toContain('阵亡 · 离场'); // 胜者留场 / 败者离场
    await expect(html).toMatchFileSnapshot('./__frames__/turn-clash.html');
  });

  it('锦霞皮帧匹配 golden', async () => {
    const html = renderTurnBattleDoc(buildTurnBattleView(setup(), { theme: 'brocade', tengangName: nm }));
    expect(html).toContain('--accent:#cf5070'); // 锦霞皮
    await expect(html).toMatchFileSnapshot('./__frames__/turn-brocade.html');
  });
});
