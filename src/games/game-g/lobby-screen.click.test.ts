// @vitest-environment happy-dom
// 大厅 mountLobby 点击交互测试：DOM 真点击 → 状态/回调验证。
// 覆盖：5 tab 切换 / 皮肤切换 / 新手指导 overlay / 出征回调 / 买入回调 / 战库切换

import { describe, it, expect, vi, afterEach } from 'vitest';
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
  planets: [{ id: 'saturn', name: '地支·命', sub: '命线', cost: 24, owned: false, level: 1, buyable: true }],
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
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('我的牌组');
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

    it('点击「改造坊」→ craft section 激活，显示地支生肖镶嵌 + 天罡货架', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('改造坊');
      expect(host.innerHTML).toContain('生肖镶嵌'); // 地支·生肖镶嵌附魔台
      expect(host.innerHTML).toContain('天罡牌 · 购买'); // 天罡货架
    });

    it('点击「天梯」→ ladder section 激活', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(navBtn(host, '天梯'));
      expect(host.querySelector('.nav button.on')?.textContent?.trim()).toBe('天梯');
      expect(host.innerHTML).toContain('全服榜');
    });

    it('6 tab 全循环：每次只有 1 个 section 带 .on', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      for (const label of ['战役', '牌组', '收藏', '改造坊', '天梯', '大厅']) {
        click(navBtn(host, label));
        expect(host.querySelectorAll('.screen.on').length).toBe(1);
      }
    });
  });

  // ── 2. 皮肤切换（设置里）──
  describe('皮肤切换（设置·玄铁/锦霞）', () => {
    const openSettings = (host: HTMLElement): void => { click(host.querySelector('[data-act="settings"]')); };
    it('设置里点「锦霞」→ data-skin 变 rosy，onSkin 回调触发', () => {
      const onSkin = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onSkin });
      openSettings(host);
      click(host.querySelector('[data-act="skin"][data-k="rosy"]'));
      expect(host.querySelector('[data-skin]')?.getAttribute('data-skin')).toBe('rosy');
      expect(onSkin).toHaveBeenCalledWith('rosy');
    });

    it('点「锦霞」后再点「玄铁」→ 切回 onyx', () => {
      const onSkin = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onSkin });
      openSettings(host);
      click(host.querySelector('[data-act="skin"][data-k="rosy"]'));
      click(host.querySelector('[data-act="skin"][data-k="onyx"]'));
      expect(host.querySelector('[data-skin]')?.getAttribute('data-skin')).toBe('onyx');
      expect(onSkin).toHaveBeenLastCalledWith('onyx');
    });
  });

  // ── 3. 帮助中心（介绍/指导/手册 三合一）──
  describe('帮助中心 overlay', () => {
    it('点击顶栏「📚 玩法手册」→ 帮助 overlay 出现，含三 tab', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('玩法手册'))!);
      expect(host.querySelector('.tut-ov')).not.toBeNull();
      expect(host.querySelector('[data-act="helpTab"][data-k="intro"]')).not.toBeNull();
      expect(host.querySelector('[data-act="helpTab"][data-k="tut"]')).not.toBeNull();
      expect(host.querySelector('[data-act="helpTab"][data-k="manual"]')).not.toBeNull();
    });

    it('切到「新手指导」tab → 含对局核心要点（掷命对决/先破者胜）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('玩法手册'))!);
      click(host.querySelector('[data-act="helpTab"][data-k="tut"]')!);
      expect(host.innerHTML).toContain('对决核');
      expect(host.innerHTML).toContain('先破者胜');
    });

    it('点击「明白了」→ overlay 关闭', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('玩法手册'))!);
      expect(host.querySelector('.tut-ov')).not.toBeNull();
      click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('明白了'))!);
      expect(host.querySelector('.tut-ov')).toBeNull();
    });
  });

  describe('设置 overlay', () => {
    it('点击顶栏 ⚙ → 设置出现（皮肤/重看引导/重置）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(host.querySelector('[data-act="settings"]'));
      expect(host.innerHTML).toContain('⚙ 设置');
      expect(host.querySelector('[data-act="skin"][data-k="rosy"]')).not.toBeNull();
      expect(host.querySelector('[data-act="replayIntro"]')).not.toBeNull();
      expect(host.querySelector('[data-act="reset"]')).not.toBeNull();
    });

    it('设置里点重置 → onReset 调用 + 重播开场故事/新手引导（owner 2026-06-21·重置=回首启态）', () => {
      const host = document.createElement('div');
      const onReset = vi.fn();
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onReset });
      click(host.querySelector('[data-act="settings"]'));
      click(host.querySelector('[data-act="reset"]'));
      expect(onReset).toHaveBeenCalled();
      expect(host.querySelector('[data-act="settings-close"]')).toBeNull(); // 设置已关
      expect(host.querySelector('.story-box')).not.toBeNull(); // 开场故事重播=新手引导一并重置
      expect(host.innerHTML).toContain('序章');
    });

    it('退出收进设置（owner 2026-06-21·替代右上角浮钮）：点「退出到游戏库」→ onExitGame 调用', () => {
      const host = document.createElement('div');
      const onExitGame = vi.fn();
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onExitGame });
      click(host.querySelector('[data-act="settings"]'));
      expect(host.querySelector('[data-act="exitGame"]')).not.toBeNull(); // 退出项在设置里
      click(host.querySelector('[data-act="exitGame"]'));
      expect(onExitGame).toHaveBeenCalled();
    });
  });

  describe('钻石商城（充值 / 兑换）', () => {
    it('点击顶栏💎→ 钻石商城 overlay 出现（含充值 + 兑换档位）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ diamond: 12 }), onPlay: vi.fn() });
      click(host.querySelector('[data-act="recharge"]'));
      expect(host.querySelector('.tut-ov')).not.toBeNull();
      expect(host.innerHTML).toContain('🛒 商城');
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

    it('复充需密码（测试版点选花色）：选错花色（onRecharge 返回 false）→ 显示「密码不对」', () => {
      const host = document.createElement('div');
      const onRecharge = vi.fn(() => false); // 引擎判定密码错
      mountLobby(host, { getView: () => makeView({ diamond: 6, rechargeNeedsPassword: true }), onPlay: vi.fn(), onRecharge });
      click(host.querySelector('[data-act="recharge"]'));
      expect(host.querySelector('.rc-pw')).toBeNull(); // 文本框已废弃
      expect(host.querySelector('[data-act="rcSuit"][data-k="♥"]')).not.toBeNull(); // 改点选花色
      click(host.querySelector('[data-act="rcSuit"][data-k="♦"]')); // 选错：♦+♣
      click(host.querySelector('[data-act="rcSuit"][data-k="♣"]'));
      click(host.querySelector('[data-act="rechargeBuy"]'));
      expect(onRecharge).toHaveBeenCalledWith('r6', '♦♣'); // 规范化密码串（固定花色序）
      expect(host.innerHTML).toContain('密码不对');
    });

    it('复充需密码（测试版点选花色）：选对 ♥红心+♠黑桃（顺序无关·规范化为♠♥）→ 弹「谢谢老板」致谢', () => {
      const host = document.createElement('div');
      const onRecharge = vi.fn(() => true);
      mountLobby(host, { getView: () => makeView({ diamond: 6, rechargeNeedsPassword: true }), onPlay: vi.fn(), onRecharge });
      click(host.querySelector('[data-act="recharge"]'));
      click(host.querySelector('[data-act="rcSuit"][data-k="♥"]')); // 先红心
      click(host.querySelector('[data-act="rcSuit"][data-k="♠"]')); // 再黑桃
      click(host.querySelector('[data-act="rechargeBuy"]'));
      expect(onRecharge).toHaveBeenCalledWith('r6', '♠♥'); // 顺序无关·规范化
      expect(host.innerHTML).not.toContain('密码不对');
      expect(host.innerHTML).toContain('谢谢老板'); // 致谢弹框
      expect(host.innerHTML).toContain('君白'); // 打到君白工资卡
    });
  });
});
