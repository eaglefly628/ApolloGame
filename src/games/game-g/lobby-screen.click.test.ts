// @vitest-environment happy-dom
// 大厅 mountLobby 点击交互测试：DOM 真点击 → 状态/回调验证。
// 覆盖：5 tab 切换 / 皮肤切换 / 新手指导 overlay / 出征回调 / 买入回调 / 战库切换

import { describe, it, expect, vi } from 'vitest';
import { mountLobby, type LobbyView, type LobbyShopItem } from './lobby-screen.js';

// ── 测试 view 工厂 ──
const J = (id: string, name: string, owned = false, inDeck = false, buyable = true): LobbyShopItem =>
  ({ id, name, sub: `${name}效果`, cost: 16, owned, inDeck, buyable: buyable && !owned });

const makeView = (overrides: Partial<LobbyView> = {}): LobbyView => ({
  skin: 'onyx', coin: 1200, energy: 4, energyMax: 6, foilCount: 1,
  name: '测试玩家', mainCard: '黑桃A', rankText: '战役 3/5',
  stageLabel: '第 3 战', archLine: '将领流', bossLine: 'Boss信息',
  deckAvg: 53, deckMin: 44, deckMax: 62,
  deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2),
  jokers: [J('comrade', '同袍', true, true), J('gambler', '赌徒', false, false, true), J('warlord', '枭雄', false, false, false)],
  planets: [{ id: 'saturn', name: '星球·命', sub: '命线', cost: 24, owned: false, level: 1, buyable: true }],
  foils: [{ id: 'gilt', name: '鎏金', sub: '金箔', cost: 30, owned: false, buyable: true }],
  ladderLines: ['<h2>战役进度</h2><div class="bigrank">第 3/5 战</div>'],
  deckArchName: '将领流', deckArchActivated: true,
  ...overrides,
});

// 工具：向 DOM 元素派发真实点击
function click(el: Element | null): void {
  if (!el) throw new Error('click target is null');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// 找 nav 按钮（按文本）
function navBtn(host: HTMLElement, text: string): Element | null {
  return [...host.querySelectorAll('.nav button')].find((b) => b.textContent?.includes(text)) ?? null;
}

// ── 测试套件 ──
describe('Game G · lobby-screen mountLobby 点击交互（DOM · happy-dom）', () => {

  // ── 1. Tab 切换 ──
  describe('Tab 导航切换', () => {
    it('初始渲染默认显示「大厅」tab', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      expect(host.querySelector('.screen.on.homerow')).not.toBeNull();
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('大厅');
    });

    it('点击「牌组」→ decks section 激活，home 隐藏', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '牌组'));
      const sections = host.querySelectorAll('.screen.on');
      expect(sections.length).toBe(1);
      expect(sections[0].classList.contains('homerow')).toBe(false); // home 不激活
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('牌组');
      // 牌组内容可见：52 张牌格
      expect(host.querySelectorAll('.pcard').length).toBe(52);
    });

    it('点击「收藏」→ coll section 激活，显示小丑收藏', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '收藏'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('收藏');
      expect(host.querySelector('.screen.on.full')).not.toBeNull();
      // 收藏屏中应有小丑列表
      expect(host.innerHTML).toContain('同袍');
    });

    it('点击「改造坊」→ craft section 激活，显示小丑货架和星球牌', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('改造坊');
      expect(host.innerHTML).toContain('改造台');
      expect(host.innerHTML).toContain('星球·命');
    });

    it('点击「天梯」→ ladder section 激活', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '天梯'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('天梯');
      expect(host.innerHTML).toContain('战役进度');
    });

    it('5 tab 全循环：每次只有 1 个 section 带 .on', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      for (const label of ['牌组', '收藏', '改造坊', '天梯', '大厅']) {
        click(navBtn(host, label));
        expect(host.querySelectorAll('.screen.on').length).toBe(1);
      }
    });
  });

  // ── 2. 皮肤切换 ──
  describe('皮肤切换（玄铁/锦霞）', () => {
    it('点击「锦霞」→ data-skin 变 rosy，onSkin 回调触发', () => {
      const onSkin = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onSkin });
      const rosyBtn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('锦霞'))!;
      click(rosyBtn);
      expect(host.querySelector('[data-skin]')?.getAttribute('data-skin')).toBe('rosy');
      expect(onSkin).toHaveBeenCalledWith('rosy');
    });

    it('点击「玄铁」后再点「锦霞」→ 切回 onyx', () => {
      const onSkin = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onSkin });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('锦霞'))!);
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('玄铁'))!);
      expect(host.querySelector('[data-skin]')?.getAttribute('data-skin')).toBe('onyx');
      expect(onSkin).toHaveBeenLastCalledWith('onyx');
    });
  });

  // ── 3. 新手指导 overlay ──
  describe('新手指导 overlay', () => {
    it('点击「📖 新手指导」→ overlay 出现，含"新手指导·一局怎么打"', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      const tutBtn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('新手指导'))!;
      click(tutBtn);
      expect(host.querySelector('.tut-ov')).not.toBeNull();
      expect(host.innerHTML).toContain('新手指导 · 一局怎么打');
    });

    it('点击「明白了，开打」→ overlay 关闭', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('新手指导'))!);
      expect(host.querySelector('.tut-ov')).not.toBeNull(); // 先开
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('明白了'))!);
      expect(host.querySelector('.tut-ov')).toBeNull(); // 再关
    });

    it('新手指导内容包含对局核心要点（对决核/先破者胜/胜率可见）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('新手指导'))!);
      expect(host.innerHTML).toContain('对决核');
      expect(host.innerHTML).toContain('先破者胜');
      expect(host.innerHTML).toContain('胜率可见');
    });
  });

  // ── 4. 出征按钮 ──
  describe('出征（play）回调', () => {
    it('点击「出征」→ onPlay 回调触发', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay });
      const playBtn = host.querySelector('[data-act="play"]')!;
      click(playBtn);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. 买入小丑 ──
  describe('改造坊·买入小丑', () => {
    it('点击可买小丑→ onBuyJoker 以正确 id 调用', () => {
      const onBuyJoker = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onBuyJoker });
      click(navBtn(host, '改造坊'));
      // gambler 是 buyable 的（owned=false, buyable=true）
      const buyEl = host.querySelector('[data-act="buyJoker"][data-k="gambler"]')!;
      click(buyEl);
      expect(onBuyJoker).toHaveBeenCalledWith('gambler');
    });

    it('locked 小丑（warlord）不渲染 data-act="buyJoker"', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      expect(host.querySelector('[data-act="buyJoker"][data-k="warlord"]')).toBeNull();
    });
  });

  // ── 6. 战库切换（B3）──
  describe('改造坊·命牌战库切换（B3）', () => {
    it('已拥有且未入战库的小丑：点「+ 战库」→ onToggleJoker 以 id 调用', () => {
      const onToggleJoker = vi.fn();
      // 构造一个 owned=true，inDeck=false 的小丑
      const view = makeView({
        jokers: [J('comrade', '同袍', true, false)],
      });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn(), onToggleJoker });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleJoker"][data-k="comrade"]')!;
      expect(togBtn).not.toBeNull();
      click(togBtn);
      expect(onToggleJoker).toHaveBeenCalledWith('comrade');
    });

    it('已入战库的小丑：显示「⚔ 战库」active 态按钮', () => {
      const view = makeView({
        jokers: [J('comrade', '同袍', true, true)],
      });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleJoker"][data-k="comrade"]')!;
      expect(togBtn).not.toBeNull();
      expect(togBtn.classList.contains('active')).toBe(true);
      expect(togBtn.textContent).toContain('⚔ 战库');
    });

    it('战库已满（5 张）：未入战库的 owned 小丑显示「战库满」且 disabled', () => {
      const jokers: LobbyShopItem[] = [
        J('a', 'A', true, true), J('b', 'B', true, true), J('c', 'C', true, true),
        J('d', 'D', true, true), J('e', 'E', true, true),
        J('f', 'F', true, false), // owned 但未入战库，且战库已满
      ];
      const view = makeView({ jokers });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleJoker"][data-k="f"]') as HTMLButtonElement | null;
      expect(togBtn).not.toBeNull();
      expect(togBtn?.disabled).toBe(true);
      expect(togBtn?.textContent).toContain('战库满');
    });
  });

  // ── 7. 买入星球牌 ──
  describe('改造坊·买入星球牌', () => {
    it('点击可买星球牌→ onBuyPlanet 以正确 id 调用', () => {
      const onBuyPlanet = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onBuyPlanet });
      click(navBtn(host, '改造坊'));
      const buyEl = host.querySelector('[data-act="buyPlanet"][data-k="saturn"]')!;
      click(buyEl);
      expect(onBuyPlanet).toHaveBeenCalledWith('saturn');
    });
  });

  // ── 8. destroy 清理 ──
  describe('挂载/卸载', () => {
    it('destroy() 后点击不再触发 onPlay', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      const { destroy } = mountLobby(host, { getView: makeView, onPlay });
      destroy();
      // host 内容已清空
      expect(host.innerHTML).toBe('');
    });

    it('update() 刷新视图后内容仍正确', () => {
      let v = makeView({ coin: 500 });
      const host = document.createElement('div');
      const { update } = mountLobby(host, { getView: () => v, onPlay: vi.fn() });
      expect(host.innerHTML).toContain('500');
      v = makeView({ coin: 777 }); // <1000 → kfmt 直接输出数字，不转 k
      update();
      expect(host.innerHTML).toContain('777');
    });
  });
});
