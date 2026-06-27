// @vitest-environment happy-dom
// 收藏屏数据驱动 pilot 验收（Step B·接力 home/campaign）：
// ① buildCollectionScreen 产出纯 LayoutNode（Screen 根 + Tabs 四子页：牌谱/天梯/地煞/天罡&闪艺）；
// ② 花色过滤态（CollectionState.suit）只留对应花色英雄；
// ③ mountCollection 挂载渲染 + 点花色过滤标签触发 filterSuit → 局部重渲（数据→渲染→信号→reducer 链路通）。
import { describe, it, expect } from 'vitest';
import { mountCollection, buildCollectionScreen } from './collection-screen.js';
import type { LobbyView } from './lobby-screen.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 100, energy: 3, energyMax: 6, foilCount: 1,
  name: '玩家', mainCard: 'A♠', rankText: '青铜 III',
  stageLabel: '序章', archLine: '', bossLine: '',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: [],
  tiangangs: [{ id: 'hu', name: '虎符', sub: '调兵', cost: 100, owned: true, buyable: false, icon: '⚡' }],
  planets: [],
  foils: [{ id: 'gold', name: '鎏金', sub: '牌面皮肤', cost: 50, owned: false, buyable: true }],
  ladderLines: [], campaign: { stage: 3, boss: '曹操', battle: '赤壁', oneLiner: '', stars: 2, unlock: '不屈', fiends: [] },
  campaignMax: 3,
} as unknown as LobbyView);

describe('collection-screen pilot · 数据驱动收藏', () => {
  it('buildCollectionScreen 产出 LayoutNode 树（Screen 根 + Tabs 三子页·纯数据·天梯榜已移到顶部导航）', () => {
    const tree = buildCollectionScreen(VIEW());
    expect(tree.type).toBe('Screen');
    const tabs = tree.children?.[0];
    expect(tabs?.type).toBe('Tabs');
    expect((tabs?.props as { tabs: unknown[] }).tabs).toHaveLength(3); // 牌谱/地煞/天罡&闪艺（天梯榜移到顶部 nav·去重）
    const json = JSON.stringify(tree);
    expect(json).toContain('英雄列传');     // 牌谱页
    expect(json).toContain('地煞图鉴');     // 地煞页
    expect(json).toContain('虎符');         // 天罡&闪艺页（view.tiangangs）
    expect(json).toContain('"action":"filterSuit"'); // 花色过滤信号
  });

  it('花色过滤态：suit=♠ 只留黑桃英雄（孙武在·成吉思汗❤不在牌谱页）', () => {
    const all = JSON.stringify(buildCollectionScreen(VIEW(), { suit: 'all', rar: 'all', ownedOnly: false, heroId: '' }).children![0]!.children![0]!);
    const spade = JSON.stringify(buildCollectionScreen(VIEW(), { suit: '♠', rar: 'all', ownedOnly: false, heroId: '' }).children![0]!.children![0]!);
    expect(all).toContain('成吉思汗');       // ♥ 在全部里
    expect(spade).toContain('孙武');         // ♠ 仍在
    expect(spade).not.toContain('成吉思汗');  // ♥ 被花色过滤掉
  });

  it('mountCollection 挂载渲染 + 点花色「♠」标签 → filterSuit 过滤生效（牌谱格内成吉思汗❤消失）', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const h = mountCollection(host, VIEW);
    const grid = () => host.querySelector('#coll-grid')?.textContent ?? '';
    expect(host.textContent).toContain('英雄列传');
    expect(grid()).toContain('成吉思汗');   // 未过滤时 ♥ 在牌谱格
    const spadeTag = host.querySelector('[data-action="filterSuit"][data-arg="♠"]') as HTMLElement | null;
    expect(spadeTag, '花色♠过滤标签应渲染').toBeTruthy();
    spadeTag?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(grid()).toContain('孙武');         // ♠ 英雄仍在牌谱格
    expect(grid()).not.toContain('成吉思汗');  // ♥ 英雄被花色过滤出牌谱格
    h.destroy(); host.remove();
  });
});
