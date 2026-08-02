// @vitest-environment happy-dom
// 主页数据驱动 pilot 验收：① buildHomeScreen 产出纯 LayoutNode（含出征 CTA / Boss 情报 / 地煞）；
// ② mountUI 挂载渲染出内容 + 点「出征」触发 play 信号（证明数据→渲染→事件链路通）。
import { describe, it, expect, vi } from 'vitest';
import { mountHome, buildHomeScreen } from './home-screen.js';
import type { LobbyView } from './lobby-types.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 100, energy: 3, energyMax: 6, foilCount: 0,
  name: '玩家', mainCard: 'A♠', rankText: '新手',
  stageLabel: '序章 · 温泉关', archLine: '', bossLine: '列奥尼达',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: [], tiangangs: [], planets: [], foils: [], ladderLines: [],
  campaign: { stage: 1, boss: '列奥尼达', battle: '温泉关', oneLiner: '三百死守隘口', stars: 1, unlock: '虎符',
    fiends: [{ name: '温泉关死守', desc: '大本营更厚' }, { name: '斯巴达方阵', desc: '扎堆增益' }] },
  fortune: { rolls: 1, max: 3, keptVal: 66 },
} as unknown as LobbyView);

describe('home-screen pilot · 数据驱动主页', () => {
  it('buildHomeScreen 产出 LayoutNode 树（Screen 根 + 出征 CTA + Boss + 地煞·纯数据）', () => {
    const tree = buildHomeScreen(VIEW());
    expect(tree.type).toBe('Screen');
    const json = JSON.stringify(tree);
    expect(json).toContain('出征');         // 出征 CTA
    expect(json).toContain('列奥尼达');      // Boss
    expect(json).toContain('温泉关死守');    // 地煞
    expect(json).toContain('"action":"play"'); // 出征 → play 信号
    expect(json).toContain('"action":"lucky"'); // 卦象 → lucky 信号
  });

  it('mountHome 挂载后渲染出内容 + 点「出征」触发 play 信号', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const play = vi.fn(); const man = vi.fn(); const lucky = vi.fn();
    const h = mountHome(host, VIEW, { play, man, lucky });
    expect(host.textContent).toContain('出征');
    expect(host.textContent).toContain('列奥尼达');
    const btn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('出征'));
    expect(btn, '出征按钮应渲染').toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(play, '点出征应触发 play 信号').toHaveBeenCalled();
    h.destroy(); host.remove();
  });
});
