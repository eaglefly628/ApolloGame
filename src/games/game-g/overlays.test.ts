// @vitest-environment happy-dom
// 浮层数据驱动 pilot 验收（Step C·接力 Step B 五屏）：
// ① buildOverlayLauncher 产出启动器 Screen（开各浮层按钮·纯数据）；
// ② buildOverlay 按 state.open 返回对应 Modal/Drawer（none→null）；
// ③ mountOverlays 双宿主：点「设置」→ Modal 现于 overlayHost·点关闭→消失；点「商城」→ Drawer（数据→渲染→信号链路通）。
import { describe, it, expect } from 'vitest';
import { mountOverlays, buildOverlayLauncher, buildOverlay, INITIAL_OVERLAY } from './overlays.js';
import type { LobbyView } from './lobby-screen.js';

const VIEW = (): LobbyView => ({
  skin: 'onyx', coin: 8000, diamond: 12, dizhiShards: 5, energy: 3, energyMax: 6, foilCount: 1,
  name: '玩家', mainCard: 'A♠', rankText: '青铜 III',
  stageLabel: '序章', archLine: '', bossLine: '',
  deckAvg: 50, deckMin: 50, deckMax: 50, deck: [], tiangangs: [], planets: [],
  foils: [{ id: 'gold', name: '鎏金', sub: '牌面皮肤', cost: 50, owned: false, buyable: true }],
  ladderLines: [], guideOn: true,
} as unknown as LobbyView);

describe('overlays pilot · 数据驱动浮层', () => {
  it('buildOverlayLauncher 产出启动器 Screen（开各浮层按钮·纯数据）', () => {
    const tree = buildOverlayLauncher();
    expect(tree.type).toBe('Screen');
    const json = JSON.stringify(tree);
    for (const a of ['openHelp', 'openSettings', 'openShop', 'openLucky', 'openStory']) expect(json).toContain(`"action":"${a}"`);
  });

  it('buildOverlay 按 open 返回对应浮层（none→null·settings→Modal·shop→Drawer）', () => {
    expect(buildOverlay(VIEW(), INITIAL_OVERLAY)).toBeNull(); // open:'none'
    const settings = buildOverlay(VIEW(), { ...INITIAL_OVERLAY, open: 'settings' });
    expect(settings?.type).toBe('Modal');
    expect(JSON.stringify(settings)).toContain('"action":"setSkin"');
    const shop = buildOverlay(VIEW(), { ...INITIAL_OVERLAY, open: 'shop' });
    expect(shop?.type).toBe('Drawer');
    expect(JSON.stringify(shop)).toContain('"action":"gacha"');
    const story = buildOverlay(VIEW(), { ...INITIAL_OVERLAY, open: 'story' });
    expect(JSON.stringify(story)).toContain('"typewriter"'); // 旁白逐字
  });

  it('mountOverlays 双宿主：点「设置」→ Modal 现·点完成→消失；点「商城」→ Drawer', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const h = mountOverlays(host, VIEW);
    expect(host.textContent).toContain('大厅浮层');          // 启动器常驻
    expect(host.textContent).not.toContain('大厅皮肤');       // 设置浮层未开

    (host.querySelector('[data-action="openSettings"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.textContent).toContain('大厅皮肤');           // 设置 Modal 出现

    (host.querySelector('[data-action="closeOverlay"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.textContent).not.toContain('大厅皮肤');       // 关闭后消失

    (host.querySelector('[data-action="openShop"]') as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.textContent).toContain('天罡卡池');           // 商城 Drawer 出现
    h.destroy(); host.remove();
  });
});
