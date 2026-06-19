import { describe, it, expect } from 'vitest';
import { renderLobby, renderLobbyDoc, type LobbyView, type LobbyShopItem } from './lobby-screen.js';

// 大厅忠实港 · 视觉回归（无头）：真渲染器 → 自包含 HTML golden（浏览器开 = 真大厅，同 battle-screen 套路）。
// 数据接真存档（材料/能量/牌组 favor/天罡牌/地支牌/闪艺/战役进度）；此处喂代表性样例 view。
const J = (id: string, name: string, cost: number, owned: boolean, buyable: boolean): LobbyShopItem => ({ id, name, sub: `${name} 效果`, cost, owned, buyable });
const view = (skin: 'onyx' | 'rosy' = 'onyx'): LobbyView => ({
  skin, coin: 1200, energy: 4, energyMax: 6, foilCount: 1,
  name: '不翻就赢_07', mainCard: '黑桃A「掷命尖兵」', rankText: '战役 3/5',
  stageLabel: '第 3 战 / 共 5 · 终局 Boss【方块J·诡牌】',
  archLine: '你的流派 <b>将领流</b>（主将士气碾压）　<b style="color:var(--club)">⮞ 克制 Boss</b>',
  bossLine: '花哨赌徒 · 流派【牌型流】— 据其针对布阵',
  deckAvg: 53, deckMin: 44, deckMax: 62, deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2),
  jokers: [J('comrade', '同袍', 18, true, false), J('gambler', '赌徒', 16, false, true), J('warlord', '枭雄', 24, false, false)],
  planets: [{ id: 'saturn', name: '星球·命', sub: '命线 +1/级', cost: 24, owned: false, level: 1, buyable: true }, { id: 'mars', name: '星球·军', sub: '兵档 +3/级', cost: 14, owned: false, level: 0, buyable: true }],
  foils: [{ id: 'gilt', name: '鎏金', sub: '金箔流光', cost: 30, owned: true, buyable: false }, { id: 'azure', name: '碧霄', sub: '青碧全息', cost: 45, owned: false, buyable: true }],
  ladderLines: ['<h2>⚔️ 战役进度</h2><div class="bigrank">第 3 / 5 战</div><div class="meta">命 ❤❤❤</div>', '<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--heart)">方块J·诡牌</div>'],
});

describe('Game G · lobby-screen 视觉回归（忠实港大厅 · 真渲染器 → HTML golden · 接真存档数据）', () => {
  it('大厅 HOME 帧匹配 golden（绿呢牌桌 + 漂浮对决卡掷emblem + sheen出征 + 货币接真 + 玄铁皮）', async () => {
    const html = renderLobbyDoc(view(), 'home');
    expect(html).toContain('戏牌师');
    expect(html).toContain('出征 ·'); // sheen 大 CTA（SVG 图标 + 出征文本）
    expect(html).toContain('class="vs">掷'); // 漂浮对决卡 掷 emblem（招牌）
    expect(html).toContain('1.2k'); // 货币接真存档
    expect(html).toContain('将领流'); // 真流派↔Boss
    expect(html).toContain('--felt:radial-gradient(120% 110% at 50% 26%,#1d6f4e'); // 玄铁绿呢牌桌
    expect(html).toContain('📖 新手指导');
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-home.html');
  });

  it('牌组帧 = 真 52 张 favor 网格匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'decks');
    expect((html.match(/class="pcard[^-]/g) || []).length).toBe(52); // 真牌组 52 张（排除 pcard-wm/pcard-info 等子类）
    expect(html).toContain('favor 均 53');
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-decks.html');
  });

  it('收藏帧（天罡牌 + 闪艺·接真拥有态）匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'coll');
    expect(html).toContain('同袍'); // 天罡牌
    expect(html).toContain('✨ 碧霄'); // 闪艺
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-coll.html');
  });

  it('改造坊帧（天罡货架 + 地支升档·接真材料/拥有）匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'craft');
    expect(html).toContain('改造台');
    expect(html).toContain('🪐 星球·命');
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-craft.html');
  });

  it('锦霞皮帧匹配 golden', async () => {
    const html = renderLobbyDoc(view('rosy'), 'home');
    expect(html).toContain('#c97f86'); // 锦霞红呢牌桌 felt
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-rosy.html');
  });

  it('新手指导 overlay：渲染含对局流程图要点', () => {
    const html = renderLobby(view(), 'home', true);
    expect(html).toContain('新手指导 · 一局怎么打');
    expect(html).toContain('对决核');
    expect(html).toContain('先破者胜');
  });
});
