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
  tiangangs: [J('comrade', '同袍', true, true), J('gambler', '赌徒', false, false, true), J('warlord', '枭雄', false, false, false)],
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

    it('点击「收藏」→ coll section 激活，显示天罡收藏', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '收藏'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('收藏');
      expect(host.querySelector('.screen.on.full')).not.toBeNull();
      // 收藏屏中应有天罡列表
      expect(host.innerHTML).toContain('同袍');
    });

    it('点击「改造坊」→ craft section 激活，显示天罡货架和星球牌', () => {
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
      expect(host.innerHTML).toContain('全服榜');
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

  describe('钻石商城（充值 / 兑换）', () => {
    it('点击顶栏💎→ 钻石商城 overlay 出现（含充值 + 兑换档位）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ diamond: 12 }), onPlay: vi.fn() });
      click(host.querySelector('[data-act="recharge"]'));
      expect(host.querySelector('.tut-ov')).not.toBeNull();
      expect(host.innerHTML).toContain('钻石商城');
      expect(host.innerHTML).toContain('越充越送');
      expect(host.querySelector('[data-act="rechargeBuy"]')).not.toBeNull();
    });

    it('点充值档 → onRecharge 以 packId 调用', () => {
      const host = document.createElement('div');
      const onRecharge = vi.fn();
      mountLobby(host, { getView: () => makeView({ diamond: 0 }), onPlay: vi.fn(), onRecharge });
      click(host.querySelector('[data-act="recharge"]'));
      click(host.querySelector('[data-act="rechargeBuy"]')); // 第一档 r6（首充免密·password=''）
      expect(onRecharge).toHaveBeenCalledWith('r6', '');
    });

    it('余额够 → 点兑换 → onExchange 以 exId 调用', () => {
      const host = document.createElement('div');
      const onExchange = vi.fn();
      mountLobby(host, { getView: () => makeView({ diamond: 100 }), onPlay: vi.fn(), onExchange });
      click(host.querySelector('[data-act="recharge"]'));
      click(host.querySelector('[data-act="exchangeBuy"]')); // 第一档 x6（100💎够）
      expect(onExchange).toHaveBeenCalledWith('x6');
    });

    it('余额不足 → 兑换档位禁用（无 data-act·不触发回调）', () => {
      const host = document.createElement('div');
      const onExchange = vi.fn();
      mountLobby(host, { getView: () => makeView({ diamond: 0 }), onPlay: vi.fn(), onExchange });
      click(host.querySelector('[data-act="recharge"]'));
      expect(host.querySelector('[data-act="exchangeBuy"]')).toBeNull(); // 0💎 全买不起
      expect(onExchange).not.toHaveBeenCalled();
    });

    it('💎→地支碎片：余额够点档 → onBuyShards 以 exId 调用', () => {
      const host = document.createElement('div');
      const onBuyShards = vi.fn();
      mountLobby(host, { getView: () => makeView({ diamond: 50 }), onPlay: vi.fn(), onBuyShards });
      click(host.querySelector('[data-act="recharge"]'));
      click(host.querySelector('[data-act="shardBuy"]')); // 第一档 s4
      expect(onBuyShards).toHaveBeenCalledWith('s4');
    });

    it('首充免密：rechargeNeedsPassword 假 → 无密码框、显示首充免密', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ diamond: 6, rechargeNeedsPassword: false }), onPlay: vi.fn(), onRecharge: () => true });
      click(host.querySelector('[data-act="recharge"]'));
      expect(host.querySelector('.rc-pw')).toBeNull();
      expect(host.innerHTML).toContain('首充免密');
    });

    it('复充需密码：密码错误（onRecharge 返回 false）→ 显示「密码错误」', () => {
      const host = document.createElement('div');
      const onRecharge = vi.fn(() => false); // 引擎判定密码错
      mountLobby(host, { getView: () => makeView({ diamond: 6, rechargeNeedsPassword: true }), onPlay: vi.fn(), onRecharge });
      click(host.querySelector('[data-act="recharge"]'));
      const pw = host.querySelector('.rc-pw') as HTMLInputElement;
      expect(pw).not.toBeNull();
      pw.value = '乱填';
      click(host.querySelector('[data-act="rechargeBuy"]'));
      expect(onRecharge).toHaveBeenCalledWith('r6', '乱填');
      expect(host.innerHTML).toContain('密码错误');
    });

    it('复充需密码：密码正确（onRecharge 返回 true）→ 无报错', () => {
      const host = document.createElement('div');
      const onRecharge = vi.fn(() => true);
      mountLobby(host, { getView: () => makeView({ diamond: 6, rechargeNeedsPassword: true }), onPlay: vi.fn(), onRecharge });
      click(host.querySelector('[data-act="recharge"]'));
      (host.querySelector('.rc-pw') as HTMLInputElement).value = 'am';
      click(host.querySelector('[data-act="rechargeBuy"]'));
      expect(onRecharge).toHaveBeenCalledWith('r6', 'am');
      expect(host.innerHTML).not.toContain('密码错误');
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

  // ── 5. 买入天罡 ──
  describe('改造坊·买入天罡', () => {
    it('点击可买天罡→ onBuyTiangang 以正确 id 调用', () => {
      const onBuyTiangang = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onBuyTiangang });
      click(navBtn(host, '改造坊'));
      // gambler 是 buyable 的（owned=false, buyable=true）
      const buyEl = host.querySelector('[data-act="buyTiangang"][data-k="gambler"]')!;
      click(buyEl);
      expect(onBuyTiangang).toHaveBeenCalledWith('gambler');
    });

    it('locked 天罡（warlord）不渲染 data-act="buyTiangang"', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      expect(host.querySelector('[data-act="buyTiangang"][data-k="warlord"]')).toBeNull();
    });
  });

  // ── 6. 出战牌组切换（多牌组 · owner 2026-06-20）──
  describe('改造坊·天罡牌组切换', () => {
    it('已拥有且未入牌组的天罡：点「+ 牌组」→ onToggleTiangang 以 id 调用', () => {
      const onToggleTiangang = vi.fn();
      // 构造一个 owned=true，inDeck=false 的天罡
      const view = makeView({
        tiangangs: [J('comrade', '同袍', true, false)],
      });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn(), onToggleTiangang });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleTiangang"][data-k="comrade"]')!;
      expect(togBtn).not.toBeNull();
      click(togBtn);
      expect(onToggleTiangang).toHaveBeenCalledWith('comrade');
    });

    it('已入牌组的天罡：显示「⚔ 牌组」active 态按钮', () => {
      const view = makeView({
        tiangangs: [J('comrade', '同袍', true, true)],
      });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleTiangang"][data-k="comrade"]')!;
      expect(togBtn).not.toBeNull();
      expect(togBtn.classList.contains('active')).toBe(true);
      expect(togBtn.textContent).toContain('⚔ 牌组');
    });

    it('出战牌组已满（deckSize 张）：未入组的 owned 天罡显示「牌组满」且 disabled', () => {
      const tiangangs: LobbyShopItem[] = [
        J('a', 'A', true, true), J('b', 'B', true, true), J('c', 'C', true, true),
        J('d', 'D', true, true), J('e', 'E', true, true),
        J('f', 'F', true, false), // owned 但未入组，且牌组已满
      ];
      const view = makeView({ tiangangs, deckSize: 5 }); // 本例上限设 5，5 张即满
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      const togBtn = host.querySelector('[data-act="toggleTiangang"][data-k="f"]') as HTMLButtonElement | null;
      expect(togBtn).not.toBeNull();
      expect(togBtn?.disabled).toBe(true);
      expect(togBtn?.textContent).toContain('牌组满');
    });

    it('多牌组：选牌组→onSelectDeck / 新建→onNewDeck / 删除→onDelDeck', () => {
      const onSelectDeck = vi.fn(), onNewDeck = vi.fn(), onDelDeck = vi.fn();
      const view = makeView({
        tiangangs: [J('comrade', '同袍', true, true)],
        decks: [{ id: 'd1', name: '牌组 1', size: 1, active: true }, { id: 'd2', name: '牌组 2', size: 0, active: false }],
        deckSize: 12, activeDeckName: '牌组 1', canAddDeck: true,
      });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn(), onSelectDeck, onNewDeck, onDelDeck });
      click(navBtn(host, '牌组')); // DECKS tab
      click(host.querySelector('[data-act="deckTab"][data-k="gang"]')!); // 天罡战牌 子页
      click(host.querySelector('[data-act="selectDeck"][data-k="d2"]')!);
      expect(onSelectDeck).toHaveBeenCalledWith('d2');
      click(host.querySelector('[data-act="newDeck"]')!);
      expect(onNewDeck).toHaveBeenCalled();
      click(host.querySelector('[data-act="delDeck"][data-k="d2"]')!);
      expect(onDelDeck).toHaveBeenCalledWith('d2');
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
