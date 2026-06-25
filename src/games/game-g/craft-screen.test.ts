// @vitest-environment happy-dom
// 改造坊屏数据驱动 pilot 验收（Step B 收官·接力 home/campaign/collection/deck）：
// ① buildCraftScreen 产出纯 LayoutNode（Screen 根 + 附魔台 + 天罡货架）；
// ② 选牌态 craftSel 控制附魔详情（未选=提示·选中=出该牌槽位 + 卡包可镶项）；
// ③ mountCraft 挂载 + 点一张 ench 牌 → craftSel 选中→详情出现（数据→渲染→信号→reducer 链路通）。
import { describe, it, expect } from 'vitest';
import { mountCraft, buildCraftScreen } from './craft-screen.js';
import type { LobbyView } from './lobby-screen.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 100, energy: 3, energyMax: 6, foilCount: 0,
  name: '玩家', mainCard: 'A♠', rankText: '青铜 III',
  stageLabel: '序章', archLine: '', bossLine: '',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 18)),
  tiangangs: [
    { id: 'hu', name: '虎符', sub: '调兵', cost: 100, owned: true, buyable: false, inDeck: true, icon: '⚡', power: 4, unlockStage: 1 },
    { id: 'qi', name: '旗手', sub: '士气', cost: 120, owned: false, buyable: true, icon: '🚩', power: 3, unlockStage: 1 },
    { id: 'bq', name: '不屈', sub: '濒死不溃', cost: 0, owned: false, buyable: false, locked: true, icon: '🛡', unlockStage: 3 },
  ],
  planets: [], foils: [], ladderLines: [],
  dizhiBag: { '子': [3, 1, 0], '午': [1, 0, 0] }, inlays: {},
} as unknown as LobbyView);

describe('craft-screen pilot · 数据驱动改造坊', () => {
  it('buildCraftScreen 产出 LayoutNode 树（Screen 根 + 附魔台 + 天罡货架·纯数据）', () => {
    const tree = buildCraftScreen(VIEW());
    expect(tree.type).toBe('Screen');
    const json = JSON.stringify(tree);
    expect(json).toContain('生肖镶嵌');                  // 附魔台
    expect(json).toContain('天罡牌 · 购买');              // 货架
    expect(json).toContain('"action":"craftSel"');       // 选牌信号
    expect(json).toContain('"action":"buyTiangang"');    // 可购天罡（旗手）
    expect(json).toContain('"action":"diamondUnlock"');  // 锁定天罡（不屈·💎速解）
  });

  it('选牌态：未选=提示·选中 idx=0 → 出附魔详情（镶嵌槽 + 卡包可镶项）', () => {
    const none = JSON.stringify(buildCraftScreen(VIEW(), ''));
    expect(none).toContain('选一张牌');                   // 未选提示
    const sel0 = JSON.stringify(buildCraftScreen(VIEW(), '0'));
    expect(sel0).toContain('镶嵌槽');                     // 选中出槽位
    expect(sel0).toContain('"action":"inlay"');          // 卡包可镶项（子/午）
  });

  it('mountCraft 挂载 + 点 ench 牌(idx 0) → craftSel 选中→附魔详情出现', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const h = mountCraft(host, VIEW);
    expect(host.querySelector('#ench-detail')?.textContent).toContain('选一张牌'); // 初始提示
    const card0 = host.querySelector('[data-action="craftSel"][data-arg="0"]') as HTMLElement | null;
    expect(card0, 'ench 牌 0 应渲染可点').toBeTruthy();
    card0?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.querySelector('#ench-detail')?.textContent).toContain('镶嵌槽'); // 选中后出详情
    h.destroy(); host.remove();
  });
});
