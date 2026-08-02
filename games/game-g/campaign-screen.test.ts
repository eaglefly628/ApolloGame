// @vitest-environment happy-dom
// 战役进度屏数据驱动 pilot 验收（Step B·接力 home-screen）：
// ① buildCampaignScreen 产出纯 LayoutNode（逐关卡片 + 难度 + 解锁 + Boss 对白 + 地煞 + 当前关出征 CTA）；
// ② campaignMax 控制锁/通关态（高于已抵达的关 = 🔒 未解锁·不露战役细节）；
// ③ mountCampaign 挂载渲染出内容 + 点当前关「出征」触发 play 信号（数据→渲染→事件链路通）。
import { describe, it, expect, vi } from 'vitest';
import { mountCampaign, buildCampaignScreen } from './campaign-screen.js';
import type { LobbyView } from './lobby-types.js';

const VIEW = (stage = 1, campaignMax = 1): LobbyView => ({
  skin: 'onyx', coin: 100, energy: 3, energyMax: 6, foilCount: 0,
  name: '玩家', mainCard: 'A♠', rankText: '新手',
  stageLabel: '序章', archLine: '', bossLine: '',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: [], tiangangs: [], planets: [], foils: [], ladderLines: [],
  campaign: { stage, boss: '列奥尼达', battle: '温泉关', oneLiner: '三百死守隘口', stars: 1, unlock: '虎符',
    fiends: [{ name: '温泉关死守', desc: '大本营更厚' }] },
  campaignMax,
} as unknown as LobbyView);

describe('campaign-screen pilot · 数据驱动战役进度', () => {
  it('buildCampaignScreen 产出 LayoutNode 树（Screen 根 + 逐关卡片 + 出征 CTA·纯数据）', () => {
    const tree = buildCampaignScreen(VIEW(1, 1));
    expect(tree.type).toBe('Screen');
    const json = JSON.stringify(tree);
    expect(json).toContain('战役进度');          // 屏标题
    expect(json).toContain('列奥尼达');           // 关 1 Boss
    expect(json).toContain('温泉关');             // 关 1 战役
    expect(json).toContain('出征');               // 当前关出征 CTA
    expect(json).toContain('"action":"play"');    // 出征 → play 信号
    expect(json).toContain('地煞');               // 地煞段
  });

  it('campaignMax 控制锁态：未抵达的高关 = 🔒 未解锁（不露 Boss 对白/出征）', () => {
    const tree = buildCampaignScreen(VIEW(1, 1)); // 只到关 1 → 关 5 应锁
    const json = JSON.stringify(tree);
    expect(json).toContain('未解锁');             // 高关锁态
    expect(json).toContain('项羽');               // 关 5 Boss 名仍在卡头
    expect(json).not.toContain('破釜沉舟');        // 关 5 地煞（锁态不露细节）
  });

  it('mountCampaign 挂载后渲染出内容 + 点当前关「出征」触发 play 信号', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const play = vi.fn();
    const h = mountCampaign(host, () => VIEW(1, 1), { play });
    expect(host.textContent).toContain('战役进度');
    expect(host.textContent).toContain('列奥尼达');
    const btn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('出征'));
    expect(btn, '出征按钮应渲染').toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(play, '点出征应触发 play 信号').toHaveBeenCalled();
    h.destroy(); host.remove();
  });
});
