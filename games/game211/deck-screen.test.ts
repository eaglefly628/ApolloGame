// @vitest-environment happy-dom
// 牌组屏数据驱动 pilot 验收（Step B·接力 home/campaign/collection）：
// ① buildDeckScreen 产出纯 LayoutNode（Screen 根 + 出战牌组选择条 + Tabs 三子页：扑克/天罡/地支）；
// ② 扑克构筑：picks 集驱动卡选中态 + 计数；
// ③ mountDeck 挂载 + 点一张扑克牌 → pickCard 入战库（计数 +1·≤16 上限）+ 再点出库（数据→渲染→信号→reducer 链路通）。
import { describe, it, expect } from 'vitest';
import { mountDeck, buildDeckScreen } from './deck-screen.js';
import type { LobbyView } from './lobby-types.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 100, energy: 3, energyMax: 6, foilCount: 0,
  name: '玩家', mainCard: 'A♠', rankText: '青铜 III',
  stageLabel: '序章', archLine: '', bossLine: '',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: Array.from({ length: 52 }, (_, i) => 40 + (i % 40)),
  tiangangs: [{ id: 'hu', name: '虎符', sub: '调兵', cost: 100, owned: true, buyable: false, inDeck: true, icon: '⚡', power: 4 }],
  planets: [], foils: [], ladderLines: [],
  decks: [{ id: 'd1', name: '主战组', size: 1, pokerSize: 0, active: true }, { id: 'd2', name: '备用组', size: 0, pokerSize: 0, active: false }],
  deckSize: 12, activeDeckName: '主战组', canAddDeck: true,
  pokerPicks: [], pokerPickMax: 16,
} as unknown as LobbyView);

describe('deck-screen pilot · 数据驱动牌组', () => {
  it('buildDeckScreen 产出 LayoutNode 树（Screen 根 + 选择条 + Tabs 三子页·纯数据）', () => {
    const tree = buildDeckScreen(VIEW());
    expect(tree.type).toBe('Screen');
    const selector = tree.children?.[0];
    expect(selector?.id).toBe('deck-selector');
    const tabs = tree.children?.[1];
    expect(tabs?.type).toBe('Tabs');
    expect((tabs?.props as { tabs: unknown[] }).tabs).toHaveLength(3);
    const json = JSON.stringify(tree);
    expect(json).toContain('扑克牌库');
    expect(json).toContain('天罡战法');
    expect(json).toContain('地支牌');
    expect(json).toContain('"action":"pickCard"');   // 选牌信号
    expect(json).toContain('"action":"selectDeck"');  // 选套信号
    expect(json).toContain('主战组');
  });

  it('扑克构筑：picks 集 → 卡选中态（accent）+ 计数反映', () => {
    const none = JSON.stringify(buildDeckScreen(VIEW(), new Set()));
    expect(none).toContain('从 52 选 0/16');
    const picked = JSON.stringify(buildDeckScreen(VIEW(), new Set(['AS', 'KH'])));
    expect(picked).toContain('从 52 选 2/16');
  });

  it('mountDeck 挂载 + 点扑克牌 AS → pickCard 入库（计数 0→1），再点 → 出库（1→0）', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const h = mountDeck(host, VIEW);
    const count = () => host.querySelector('#poker-count')?.textContent ?? '';
    expect(count()).toContain('0/16');
    const cardAS = host.querySelector('[data-action="pickCard"][data-arg="AS"]') as HTMLElement | null;
    expect(cardAS, '扑克牌 AS 应渲染可点').toBeTruthy();
    cardAS?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(count()).toContain('1/16');   // 入库
    host.querySelector('[data-action="pickCard"][data-arg="AS"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(count()).toContain('0/16');   // 再点出库
    h.destroy(); host.remove();
  });
});
