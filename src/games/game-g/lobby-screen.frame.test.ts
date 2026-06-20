import { describe, it, expect } from 'vitest';
import { renderLobby, renderLobbyDoc, type LobbyView, type LobbyShopItem } from './lobby-screen.js';

// 大厅忠实港 · 视觉回归（无头）：真渲染器 → 自包含 HTML golden（浏览器开 = 真大厅，同 battle-screen 套路）。
// 数据接真存档（材料/能量/牌组 favor/天罡牌/地支牌/闪艺/战役进度）；此处喂代表性样例 view。
const J = (id: string, name: string, cost: number, owned: boolean, buyable: boolean, kind = 'morale'): LobbyShopItem => ({ id, name, sub: `${name} 效果`, cost, owned, buyable, kind });
const view = (skin: 'onyx' | 'rosy' = 'onyx'): LobbyView => ({
  skin, coin: 1200, diamond: 18, dizhiShards: 12, tiangangShards: 45, dizhiOwned: { 子: 2, 丑: 1 }, energy: 4, energyMax: 6, foilCount: 1,
  name: '不翻就赢_07', mainCard: '黑桃A「掷命尖兵」', rankText: '战役 3/5',
  stageLabel: '第 3 战 / 共 5 · 终局 Boss【方块J·诡牌】',
  archLine: '你的流派 <b>将领流</b>（主将士气碾压）　<b style="color:var(--club)">⮞ 克制 Boss</b>',
  bossLine: '花哨赌徒 · 流派【牌型流】— 据其针对布阵',
  deckAvg: 53, deckMin: 44, deckMax: 62, deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2),
  tiangangs: [{ ...J('comrade', '同袍', 18, true, false, 'combo'), inDeck: true }, J('gambler', '赌徒', 16, false, true, 'polarize'), J('warlord', '枭雄', 24, false, false, 'morale')],
  decks: [{ id: 'deck1', name: '将领流', size: 1, active: true }, { id: 'deck2', name: '斩首流', size: 0, active: false }],
  deckSize: 12, activeDeckName: '将领流', canAddDeck: true,
  campaignMax: 4,
  campaign: { stage: 3, boss: '曹操', battle: '赤壁（翻命）', oneLiner: '挟天子·连环船·火攻可破', stars: 2, unlock: '不屈', intro: '建安十三年，赤壁。曹操列八十万众于江北、铁索连环。这一回，你是那把火。', bossLines: { open: '孤提百万雄师，踏平江东。', mid: '区区火攻，也敢撼我连环巨舰？', lose: '……华容道上，孤竟败于这一炬。' }, fiends: [{ name: '大军压境', desc: '兵海·额外铺兵' }, { name: '连环船', desc: '串联共享战力·可火攻一并烧' }, { name: '挟天子', desc: '全军士气 +' }] },
  planets: [{ id: 'saturn', name: '星球·命', sub: '命线 +1/级', cost: 24, owned: false, level: 1, buyable: true }, { id: 'mars', name: '星球·军', sub: '兵档 +3/级', cost: 14, owned: false, level: 0, buyable: true }],
  foils: [{ id: 'gilt', name: '鎏金', sub: '金箔流光', cost: 30, owned: true, buyable: false }, { id: 'azure', name: '碧霄', sub: '青碧全息', cost: 45, owned: false, buyable: true }],
  ladderLines: ['<h2>⚔️ 战役进度</h2><div class="bigrank">第 3 / 5 战</div><div class="meta">命 ❤❤❤</div>', '<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--heart)">方块J·诡牌</div>'],
});

describe('Game G · lobby-screen 视觉回归（忠实港大厅 · 真渲染器 → HTML golden · 接真存档数据）', () => {
  it('大厅 HOME 帧匹配 golden（绿呢牌桌 + 漂浮对决卡掷emblem + sheen出征 + 货币接真 + 玄铁皮）', async () => {
    const html = renderLobbyDoc(view(), 'home');
    expect(html).toContain('第 3 关 · 赤壁'); // 当前关战役（doc23 §八 新数据）
    expect(html).toContain('曹操'); // 本关 Boss
    expect(html).toContain('连环船'); // Boss 地煞明牌
    expect(html).toContain('解锁天罡 <b style="color:var(--gold)">不屈'); // 通关解锁
    expect(html).toContain('出征 ·'); // sheen 大 CTA（SVG 图标 + 出征文本）
    expect(html).toContain('class="vs">掷'); // 漂浮对决卡 掷 emblem（招牌）
    expect(html).toContain('1.2k'); // 货币接真存档
    expect(html).toContain('将领流'); // 真流派↔Boss
    expect(html).toContain('--felt:radial-gradient(120% 110% at 50% 26%,#1d6f4e'); // 玄铁绿呢牌桌
    expect(html).toContain('📜 游戏介绍'); expect(html).toContain('📖 新手指导');
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-home.html');
  });

  it('战役进度帧（关卡路线 + 战役背景 + Boss对白 + 地煞 · doc27）匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'campaign');
    expect(html).toContain('命运之战'); // 战役进度屏标题
    expect(html).toContain('建安十三年'); // 当前关战役背景旁白
    expect(html).toContain('孤提百万雄师'); // Boss 开场白
    expect(html).toContain('▶ 当前'); // 当前关标记
    expect(html).toContain('🔒 未解锁'); // 关5 未解锁（campaignMax=4）
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-campaign.html');
  });

  it('抽卡商城帧（天罡/地支卡池 + 碎片定向兑换 · doc25 §四）匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'home', 'cards', 'base', true, null, false, 'gacha');
    expect(html).toContain('🛒 商城');
    expect(html).toContain('天罡卡池');
    expect(html).toContain('地支卡池');
    expect(html).toContain('定向兑换'); // 碎片保底
    expect(html).toContain('🔶'); // 天罡碎片余额
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-shop-gacha.html');
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

  it('改造坊帧（地支附魔台 + 天罡货架 + 星球牌·接真材料/拥有）匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'craft');
    expect(html).toContain('附魔台'); // 地支镶嵌附魔台
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
