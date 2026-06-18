import { describe, it, expect } from 'vitest';
import { renderLobby, renderLobbyDoc, type LobbyView } from './lobby-screen.js';

// 大厅忠实港 · 视觉回归（无头）：真渲染器 → 自包含 HTML golden（浏览器开 = 真大厅，同 battle-screen 套路）。
const view = (skin: 'onyx' | 'rosy' = 'onyx'): LobbyView => ({ skin, coin: 1200, energy: 30, gem: 88, name: '不翻就赢_07', mainCard: '黑桃A「掷命尖兵」', rankText: '黄金 III · 1240 LP' });

describe('Game G · lobby-screen 视觉回归（忠实港大厅 · 真渲染器 → HTML golden）', () => {
  it('大厅 HOME 帧匹配 golden（命运牌桌 + 天梯掷命 + 货币接真 + 玄铁皮）', async () => {
    const html = renderLobbyDoc(view(), 'home');
    expect(html).toContain('命运牌桌');
    expect(html).toContain('天梯掷命');
    expect(html).toContain('🪙 <b>1.2k</b>'); // 货币接真存档
    expect(html).toContain('--accent:#d8504e'); // 玄铁皮
    expect(html).toContain('📖 新手指导'); // 新手指导按钮
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-home.html');
  });

  it('收藏帧 = 52 卡网格匹配 golden', async () => {
    const html = renderLobbyDoc(view(), 'coll');
    expect((html.match(/class="pcard/g) || []).length).toBe(52);
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-coll.html');
  });

  it('改造坊帧匹配 golden', async () => {
    await expect(renderLobbyDoc(view(), 'craft')).toMatchFileSnapshot('./__frames__/lobby-craft.html');
  });

  it('锦霞皮帧匹配 golden', async () => {
    const html = renderLobbyDoc(view('rosy'), 'home');
    expect(html).toContain('--accent:#c14b66'); // 锦霞皮
    await expect(html).toMatchFileSnapshot('./__frames__/lobby-rosy.html');
  });

  it('新手指导 overlay：渲染含对局流程图要点', () => {
    const html = renderLobby(view(), 'home', true);
    expect(html).toContain('新手指导 · 一局怎么打');
    expect(html).toContain('对决核');
    expect(html).toContain('先破者胜');
  });
});
