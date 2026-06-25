// @vitest-environment happy-dom
// 全数据驱动大厅集成验收（Step A）：
// ① buildLobby 产出纯 LayoutNode（Screen 根 + 顶栏 + 导航 + 当前页内容）；
// ② mountLobby 挂载渲染（顶栏/导航/主页）+ 切 tab + 点出征→onPlay + 开商城浮层 + 选牌→onTogglePick（信号→真 handler 链路通）。
import { describe, it, expect, vi } from 'vitest';
import { mountLobby, buildLobby, INITIAL_LOBBY_DD } from './lobby-dd.js';
import type { LobbyView, LobbyHandlers } from './lobby-screen.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 8000, diamond: 12, dizhiShards: 5, energy: 3, energyMax: 6, foilCount: 1,
  name: '玩家', mainCard: 'A♠', rankText: '青铜 III',
  stageLabel: '第 3 关', archLine: '', bossLine: '列奥尼达',
  deckAvg: 50, deckMin: 40, deckMax: 60, deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 18)),
  tiangangs: [{ id: 'hu', name: '虎符', sub: '调兵', cost: 100, owned: true, buyable: false, inDeck: true, icon: '⚡', power: 4 }],
  planets: [], foils: [{ id: 'gold', name: '鎏金', sub: '皮肤', cost: 50, owned: false, buyable: true }], ladderLines: [],
  campaign: { stage: 3, boss: '曹操', battle: '赤壁', oneLiner: '火攻可破', stars: 2, unlock: '不屈', fiends: [{ name: '连环船', desc: '串联共享战力' }] },
  campaignMax: 3,
  decks: [{ id: 'd1', name: '主战组', size: 1, pokerSize: 0, active: true }],
  deckSize: 12, activeDeckName: '主战组', canAddDeck: true, pokerPicks: [], pokerPickMax: 16,
  fortune: { rolls: 0, max: 3, keptVal: 66 },
} as unknown as LobbyView);

const handlers = (over: Partial<LobbyHandlers> = {}): LobbyHandlers => ({ getView: VIEW, onPlay: vi.fn(), ...over } as unknown as LobbyHandlers);

describe('lobby-dd · 全数据驱动大厅集成', () => {
  it('buildLobby 产出 LayoutNode 树（Screen 根 + 顶栏 + 导航 + 内容·纯数据）', () => {
    const tree = buildLobby(VIEW(), INITIAL_LOBBY_DD);
    expect(tree.type).toBe('Screen');
    expect(tree.children?.[0]?.id).toBe('lobby-topbar');
    expect(tree.children?.[1]?.id).toBe('lobby-nav');
    const json = JSON.stringify(tree);
    expect(json).toContain('大厅'); expect(json).toContain('改造坊'); // 导航
    expect(json).toContain('"action":"tab"'); expect(json).toContain('"action":"openShop"');
    expect(json).toContain('出征');         // 主页 CTA（home 内容）
  });

  it('mountLobby 挂载渲染顶栏/导航/主页', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const lobby = mountLobby(host, handlers());
    expect(host.textContent).toContain('玩家');     // 顶栏玩家名
    expect(host.textContent).toContain('我的牌组'); // 导航
    expect(host.textContent).toContain('出征');     // 主页
    lobby.destroy(); host.remove();
  });

  it('点「出征」→ onPlay；切「战役」tab → 战役进度内容出现', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onPlay = vi.fn();
    const lobby = mountLobby(host, handlers({ onPlay }));
    const playBtn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('出征'));
    playBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPlay).toHaveBeenCalled();
    (host.querySelector('[data-action="tab"][data-arg="campaign"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.textContent).toContain('战役进度');
    lobby.destroy(); host.remove();
  });

  it('开商城浮层（点🛒）→ Drawer 现；选牌（牌组 tab pickCard）→ onTogglePick', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onTogglePick = vi.fn();
    const lobby = mountLobby(host, handlers({ onTogglePick }));
    (host.querySelector('[data-action="openShop"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.textContent).toContain('天罡卡池');   // 商城 Drawer 内容
    (host.querySelector('[data-action="closeOverlay"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    (host.querySelector('[data-action="tab"][data-arg="decks"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const card = host.querySelector('[data-action="pickCard"]') as HTMLElement | null;
    expect(card, '牌组页应有可点扑克牌').toBeTruthy();
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onTogglePick).toHaveBeenCalled();
    lobby.destroy(); host.remove();
  });
});
