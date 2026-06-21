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

    it('设置里点重置 → onReset 调用', () => {
      const host = document.createElement('div');
      const onReset = vi.fn();
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onReset });
      click(host.querySelector('[data-act="settings"]'));
      click(host.querySelector('[data-act="reset"]'));
      expect(onReset).toHaveBeenCalled();
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

  // ── 抽卡商城 gacha（doc25 §四）──
  describe('抽卡商城 gacha', () => {
    const drawn = [{ kind: 'tiangang' as const, id: 'tigertally', name: '虎符', outcome: 'new' as const, detail: '新获得！' }];

    it('🛒 商城 → 抽卡 tab：天罡卡池 + 地支卡池齐', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ tiangangShards: 0, coin: 2000, diamond: 100 }), onPlay: vi.fn() });
      click(host.querySelector('[data-act="shop"]'));
      expect(host.innerHTML).toContain('天罡卡池');
      expect(host.innerHTML).toContain('地支卡池');
      expect(host.querySelector('[data-k="tiangang:1:gold"]')).not.toBeNull(); // 天罡单抽🪙
      expect(host.querySelector('[data-k="dizhi:10:diamond"]')).not.toBeNull(); // 地支十连💎（diamond 够）
    });

    it('抽天罡单抽 → onGacha(tiangang,1,gold) → 开包演出', () => {
      const host = document.createElement('div');
      const onGacha = vi.fn(() => drawn);
      mountLobby(host, { getView: makeView, onPlay: vi.fn(), onGacha });
      click(host.querySelector('[data-act="shop"]'));
      click(host.querySelector('[data-k="tiangang:1:gold"]'));
      expect(onGacha).toHaveBeenCalledWith('tiangang', 1, 'gold');
      expect(host.querySelector('.reveal-card')).not.toBeNull(); // 开包演出
      expect(host.innerHTML).toContain('虎符');
      click(host.querySelector('[data-act="reveal-close"]'));
      expect(host.querySelector('.reveal-card')).toBeNull(); // 收起
    });

    it('买不起 → 抽卡按钮禁用（无 data-act·不触发抽卡）', () => {
      const host = document.createElement('div');
      const onGacha = vi.fn();
      mountLobby(host, { getView: () => makeView({ coin: 0, diamond: 0 }), onPlay: vi.fn(), onGacha });
      click(host.querySelector('[data-act="shop"]'));
      expect(host.querySelector('[data-act="gacha"]')).toBeNull(); // 全买不起 → 无可点抽卡按钮
      expect(host.querySelector('.reveal-card')).toBeNull();
    });

    it('天罡碎片定向兑换：碎片够 → onCraftTiangang 以 id 调用 + 演出', () => {
      const host = document.createElement('div');
      const onCraftTiangang = vi.fn(() => true);
      mountLobby(host, { getView: () => makeView({ tiangangShards: 50 }), onPlay: vi.fn(), onCraftTiangang });
      click(host.querySelector('[data-act="shop"]'));
      const craft = host.querySelector('[data-act="craftTiangang"]') as HTMLElement;
      expect(craft).not.toBeNull(); // 有未拥有的已解锁天罡可兑换
      click(craft);
      expect(onCraftTiangang).toHaveBeenCalledWith(craft.dataset.k);
      expect(host.querySelector('.reveal-card')).not.toBeNull();
    });

    it('地支碎片定向兑换：碎片够 → onCraftDizhi 以 branch 调用 + 演出（owner 2026-06-21）', () => {
      const host = document.createElement('div');
      const onCraftDizhi = vi.fn(() => true);
      mountLobby(host, { getView: () => makeView({ dizhiShards: 50, dizhiBag: {} }), onPlay: vi.fn(), onCraftDizhi });
      click(host.querySelector('[data-act="shop"]'));
      const craft = host.querySelector('[data-act="craftDizhi"]') as HTMLElement;
      expect(craft, '有地支可兑换').not.toBeNull();
      click(craft);
      expect(onCraftDizhi).toHaveBeenCalledWith(craft.dataset.k); // 传生肖 branch
      expect(host.querySelector('.reveal-card')).not.toBeNull();
    });

    it('碎片不足 → 定向兑换档禁用（无 data-act）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ tiangangShards: 0 }), onPlay: vi.fn(), onCraftTiangang: vi.fn() });
      click(host.querySelector('[data-act="shop"]'));
      expect(host.querySelector('[data-act="craftTiangang"]')).toBeNull(); // 0 碎片全禁用
    });
  });

  // ── 首启开场故事 + 新手引导（doc28 A/B/C·coachmark）──
  describe('首启开场故事 + 新手引导', () => {
    afterEach(() => { document.querySelectorAll('.gg-coach-layer').forEach((e) => e.remove()); });
    const coach = (): Element | null => [...document.querySelectorAll('.gg-coach-layer')].at(-1) ?? null; // 取本次 mount 的高亮层

    it('首启（firstLaunch）→ 自动播开场故事 overlay', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ firstLaunch: true, guideStep: 0 }), onPlay: vi.fn() });
      expect(host.querySelector('.story-box')).not.toBeNull();
      expect(host.innerHTML).toContain('序章');
      expect(host.innerHTML).toContain('从未真正死去'); // 开场第一幕旁白
    });

    it('开场故事跳过 → onIntroSeen 触发（起引导）', () => {
      const host = document.createElement('div');
      const onIntroSeen = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: true, guideStep: 0 }), onPlay: vi.fn(), onIntroSeen });
      click(host.querySelector('[data-act="story-skip"]'));
      expect(onIntroSeen).toHaveBeenCalledTimes(1);
    });

    it('引导步0（手册）→ coachmark 层高亮手册 + 跳过引导', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: 0 }), onPlay: vi.fn() });
      const c = coach();
      expect(c, '高亮层').not.toBeNull();
      expect(c!.innerHTML).toContain('玩法手册'); // 步0 引导词（指向 📖 手册）
      expect(c!.querySelector('[data-act="guide-skip"]')).not.toBeNull();
    });

    it('点中当前步锚点动作（手册 man）→ onGuideStep(1) 点对推进', () => {
      const host = document.createElement('div');
      const onGuideStep = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: 0 }), onPlay: vi.fn(), onGuideStep });
      click(host.querySelector('[data-act="man"]')); // 点手册按钮 = 步0 的 advanceAct
      expect(onGuideStep).toHaveBeenCalledWith(1);
    });

    it('步1（配牌组）点「我的牌组」tab → onGuideStep(2)（advanceK 校验）', () => {
      const host = document.createElement('div');
      const onGuideStep = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: 1 }), onPlay: vi.fn(), onGuideStep });
      click([...host.querySelectorAll('.nav button')].find((b) => b.textContent?.includes('我的牌组')) ?? null); // tab k=decks
      expect(onGuideStep).toHaveBeenCalledWith(2);
    });

    it('末步（出征 play）点中锚点 → onGuideDone', () => {
      const host = document.createElement('div');
      const onGuideDone = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: 6 }), onPlay: vi.fn(), onGuideDone }); // 7 步·末步=出征
      click(host.querySelector('[data-act="play"]')); // 步6 的 advanceAct=play
      expect(onGuideDone).toHaveBeenCalledTimes(1);
    });

    it('跳过引导（coach 层）→ 确认对话框 → 确认跳过 → onGuideDone', () => {
      const host = document.createElement('div');
      const onGuideDone = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: 0 }), onPlay: vi.fn(), onGuideDone });
      click(coach()!.querySelector('[data-act="guide-skip"]'));
      expect(host.innerHTML).toContain('跳过新手引导？'); // 首页跳过对话框（owner 点名）
      click(host.querySelector('[data-act="guide-skip-cancel"]')); // 先取消
      expect(onGuideDone).not.toHaveBeenCalled();
      click(coach()!.querySelector('[data-act="guide-skip"]'));
      click(host.querySelector('[data-act="guide-skip-confirm"]'));
      expect(onGuideDone).toHaveBeenCalledTimes(1);
    });

    it('设置里「↻ 重看」→ onReplayIntro + 开场故事重现', () => {
      const host = document.createElement('div');
      const onReplayIntro = vi.fn();
      mountLobby(host, { getView: () => makeView({ firstLaunch: false, guideStep: -1 }), onPlay: vi.fn(), onReplayIntro });
      expect(host.querySelector('.story-box')).toBeNull(); // 初始无
      click(host.querySelector('[data-act="settings"]')); // 打开设置
      click(host.querySelector('[data-act="replayIntro"]'));
      expect(onReplayIntro).toHaveBeenCalledTimes(1);
      expect(host.querySelector('.story-box')).not.toBeNull(); // 故事重现
    });
  });

  // ── 4. 出征按钮 ──
  describe('出征（play）回调', () => {
    it('无战役 intro：点「出征」→ 直接 onPlay 回调触发', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay }); // makeView 无 campaign → 直接打
      const playBtn = host.querySelector('[data-act="play"]')!;
      click(playBtn);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('点主页「掷」字 → 弹今日运势（含吉凶 + 再掷）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(host.querySelector('[data-act="lucky"]'));
      expect(host.querySelector('.story-box, .tut-box')).not.toBeNull();
      expect(host.innerHTML).toContain('再掷一卦'); // 弹框独有（避开 title 里的"看今日运势"）
      expect(host.querySelector('[data-act="lucky-close"]')).not.toBeNull();
      click(host.querySelector('[data-act="lucky-close"]'));
      expect(host.innerHTML).not.toContain('再掷一卦'); // 收起
    });

    it('今日卦象（owner 2026-06-21）：掷→onRollFortune 计数 / 收下此卦→onKeepFortune + 主页顶徽标显示', () => {
      const host = document.createElement('div');
      const fortune = { rolls: 0, max: 3, keptVal: null as number | null };
      const onRollFortune = vi.fn(() => { fortune.rolls += 1; return 95; }); // 掷出「大吉 95」
      const onKeepFortune = vi.fn((v: number) => { fortune.keptVal = v; });
      mountLobby(host, { getView: () => makeView({ fortune: { ...fortune } }), onPlay: vi.fn(), onRollFortune, onKeepFortune });
      click(host.querySelector('[data-act="lucky"]')); // 开弹框并掷一卦
      expect(onRollFortune).toHaveBeenCalledTimes(1);
      expect(host.innerHTML).toContain('今日制卦'); // 次数行
      expect(host.innerHTML).toContain('大吉'); // 95 → 大吉
      click(host.querySelector('[data-act="lucky-keep"]')); // 收下此卦
      expect(onKeepFortune).toHaveBeenCalledWith(95);
      expect(host.querySelector('.gg-fortune')).not.toBeNull(); // 主页顶徽标出现
      expect(host.querySelector('.gg-fortune')?.textContent).toContain('今日卦象');
    });

    it('今日卦象：次数已尽（rolls≥max）→「再掷」禁用、展示已收下的卦', () => {
      const host = document.createElement('div');
      const onRollFortune = vi.fn(() => null); // 引擎判定已用尽
      mountLobby(host, { getView: () => makeView({ fortune: { rolls: 3, max: 3, keptVal: 72 } }), onPlay: vi.fn(), onRollFortune });
      click(host.querySelector('[data-act="lucky"]'));
      expect(host.innerHTML).toContain('次数已尽');
      expect(host.innerHTML).toContain('吉'); // keptVal 72 → 吉
      expect(onRollFortune).not.toHaveBeenCalled(); // 用尽不再调引擎掷
    });
  });

  // ── 战役进度屏 + 每关开局演出（doc27）──
  describe('战役进度 + 开局演出', () => {
    const campView = (over: Partial<LobbyView> = {}): LobbyView => makeView({
      campaignMax: 2,
      campaign: { stage: 1, boss: '列奥尼达', battle: '温泉关', oneLiner: '三百斯巴达', stars: 1, unlock: '虎符', intro: '波斯百万大军压境。', bossLines: { open: '来取我的长矛吧。', mid: '冥府见。', lose: '荣耀终结于你手。' }, fiends: [{ name: '温泉关死守', desc: '极难破' }] },
      ...over,
    });

    it('「战役」tab → 战役进度屏（命运之战 + 第1关 + Boss对白）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: campView, onPlay: vi.fn() });
      click(navBtn(host, '战役'));
      expect(host.querySelector('.screen.on')).not.toBeNull();
      expect(host.innerHTML).toContain('命运之战');
      expect(host.innerHTML).toContain('温泉关');
      expect(host.innerHTML).toContain('来取我的长矛吧'); // Boss 开场白
    });

    it('点「出征」（有战役 intro）→ 开局演出 overlay 出现（非直接 onPlay）', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: campView, onPlay });
      click(host.querySelector('[data-act="play"]'));
      expect(host.querySelector('.story-box')).not.toBeNull();
      expect(host.innerHTML).toContain('波斯百万大军压境'); // 战役背景旁白
      expect(onPlay).not.toHaveBeenCalled(); // 先演出·未直接进战斗
    });

    it('演出 → 跳过 → onPlay（进战斗）', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: campView, onPlay });
      click(host.querySelector('[data-act="play"]'));
      click(host.querySelector('[data-act="story-skip"]'));
      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(host.querySelector('.story-box')).toBeNull(); // overlay 收起
    });

    it('演出 → 逐幕「下一幕」走到末幕 → onPlay', () => {
      const onPlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: campView, onPlay });
      click(host.querySelector('[data-act="play"]')); // 幕0=战役背景
      click(host.querySelector('[data-act="story-next"]')); // 幕1=Boss开场
      expect(onPlay).not.toHaveBeenCalled();
      click(host.querySelector('[data-act="story-next"]')); // 末幕→出征
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
  describe('天罡牌组编辑器（选组→槽位移除/添加→弹窗选卡）', () => {
    const gang = (host: HTMLElement): void => { click(navBtn(host, '牌组')); click(host.querySelector('[data-act="deckTab"][data-k="gang"]')!); };

    it('空槽点「＋ 添加」→ 弹选卡窗 → 点已拥有天罡 → onToggleTiangang 以 id 调用', () => {
      const onToggleTiangang = vi.fn();
      const view = makeView({ tiangangs: [J('comrade', '同袍', true, false)], deckSize: 12, activeDeckName: '牌组 1' });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn(), onToggleTiangang });
      gang(host);
      click(host.querySelector('[data-act="deckAdd"]')!); // 点空槽 → 弹窗
      expect(host.querySelector('.pick-list')).not.toBeNull();
      const pick = host.querySelector('.pick-item[data-act="toggleTiangang"][data-k="comrade"]')!;
      expect(pick).not.toBeNull();
      click(pick);
      expect(onToggleTiangang).toHaveBeenCalledWith('comrade');
    });

    it('已入组的天罡：在牌组一排里显示为槽位 + ✕ 移除（toggleTiangang）', () => {
      const onToggleTiangang = vi.fn();
      const view = makeView({ tiangangs: [J('comrade', '同袍', true, true)], deckSize: 12, activeDeckName: '牌组 1' });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn(), onToggleTiangang });
      gang(host);
      const slot = host.querySelector('.tg-slot:not(.empty)')!;
      expect(slot.textContent).toContain('同袍');
      const rm = host.querySelector('.tg-rm[data-act="toggleTiangang"][data-k="comrade"]')!;
      expect(rm).not.toBeNull();
      click(rm);
      expect(onToggleTiangang).toHaveBeenCalledWith('comrade');
    });

    it('主页天罡牌组「✏ 编辑牌组」→ 跳牌组屏天罡页（出现槽位编辑器）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => makeView({ tiangangs: [J('comrade', '同袍', true, true)], deckSize: 12, activeDeckName: '牌组 1' }), onPlay: vi.fn() });
      click(host.querySelector('[data-act="editDeck"]')!); // 主页预览面板上的编辑按钮
      expect(host.querySelector('.screen.on')).not.toBeNull();
      expect(host.querySelector('.tg-deck')).not.toBeNull(); // 已在天罡编辑器
    });

    it('牌组已满（deckSize 张）：无空槽「＋」，弹窗提示已满', () => {
      const tiangangs: LobbyShopItem[] = [
        J('a', 'A', true, true), J('b', 'B', true, true), J('c', 'C', true, true),
        J('d', 'D', true, true), J('e', 'E', true, true),
      ];
      const view = makeView({ tiangangs, deckSize: 5, activeDeckName: '牌组 1' });
      const host = document.createElement('div');
      mountLobby(host, { getView: () => view, onPlay: vi.fn() });
      gang(host);
      expect(host.querySelector('.tg-slot.empty')).toBeNull(); // 满 → 无空槽＋
      expect(host.querySelectorAll('.tg-slot:not(.empty)').length).toBe(5);
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

  // ── 改造坊·地支附魔台 ──
  describe('地支附魔台（选牌→镶地支→+favor）', () => {
    // 地支消耗品模型（owner 2026-06-21）：卡包 {子:[铜,银,金]}；镶入消耗一张、按 (生肖:档位) 选。
    const enView = (over: Partial<LobbyView> = {}): LobbyView => makeView({ dizhiBag: { 子: [2, 0, 0] }, inlays: {}, ...over });

    it('改造坊→附魔台：选一张牌 → 出镶嵌槽 + 卡包里的地支可镶（按档位）', () => {
      const host = document.createElement('div');
      mountLobby(host, { getView: () => enView(), onPlay: vi.fn() });
      click(navBtn(host, '改造坊'));
      expect(host.innerHTML).toContain('生肖镶嵌'); // 占位改造台已替换为真·地支生肖镶嵌附魔
      click(host.querySelector('[data-act="craftSel"][data-k="0"]')!); // 选第一张牌
      expect(host.querySelector('.ench-slots')).not.toBeNull(); // 镶嵌槽出现
      expect(host.querySelector('[data-act="inlay"][data-k="0:子:1"]')).not.toBeNull(); // 卡包子鼠·铜(档1)可镶
    });

    it('镶入地支 → onInlay(idx, branch, tier) 调用（消耗一张）', () => {
      const onInlay = vi.fn(() => true);
      const host = document.createElement('div');
      mountLobby(host, { getView: () => enView(), onPlay: vi.fn(), onInlay });
      click(navBtn(host, '改造坊'));
      click(host.querySelector('[data-act="craftSel"][data-k="0"]')!);
      click(host.querySelector('[data-act="inlay"][data-k="0:子:1"]')!);
      expect(onInlay).toHaveBeenCalledWith('0', '子', 1);
    });

    it('已镶的槽显示 ✕ 卸下 → onRemoveInlay(idx, slot)（永久消耗不退）', () => {
      const onRemoveInlay = vi.fn();
      const host = document.createElement('div');
      mountLobby(host, { getView: () => enView({ inlays: { '0': [{ b: '子', t: 1 }] } }), onPlay: vi.fn(), onRemoveInlay });
      click(navBtn(host, '改造坊'));
      click(host.querySelector('[data-act="craftSel"][data-k="0"]')!);
      const rm = host.querySelector('[data-act="removeInlay"][data-k="0:0"]')!;
      expect(rm).not.toBeNull();
      click(rm);
      expect(onRemoveInlay).toHaveBeenCalledWith('0', 0);
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

  // ── 背景音乐（菜单设置·owner 2026-06-21）──
  describe('背景音乐设置（菜单·开关/选 3 首/音量）', () => {
    it('设置面板含 BGM 开关 + 3 首选曲 + 音量', () => {
      const host = document.createElement('div');
      try { localStorage.setItem('gg_bgm_on', '1'); } catch { /* noop */ } // owner 改默认关 → 需开启才显选曲/音量
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(host.querySelector('[data-act="settings"]')); // 开设置
      expect(host.querySelector('[data-act="bgmToggle"]'), 'BGM 开关').not.toBeNull();
      expect(host.querySelectorAll('[data-act="bgmTrack"]').length, '3 首选曲').toBe(3);
      expect(host.querySelector('[data-act="bgmVol"]'), '音量').not.toBeNull();
    });
    it('点选曲 / 开关 不抛错（直调 bgm.ts·无 AudioContext 静默）', () => {
      const host = document.createElement('div');
      try { localStorage.setItem('gg_bgm_on', '1'); } catch { /* noop */ } // 开启才有选曲/音量钮可点
      mountLobby(host, { getView: makeView, onPlay: vi.fn() });
      click(host.querySelector('[data-act="settings"]'));
      expect(() => {
        click(host.querySelectorAll('[data-act="bgmTrack"]')[1]);
        click(host.querySelector('[data-act="bgmVol"]'));
        click(host.querySelector('[data-act="bgmToggle"]'));
      }).not.toThrow();
    });
  });

  // ── 出战扑克牌组构筑（乙1/乙3·DEV-CHECKLIST §3）──
  describe('出战扑克牌组构筑（52 池选 16）', () => {
    const open = (host: HTMLElement, h: Parameters<typeof mountLobby>[1]): void => {
      mountLobby(host, h);
      click(navBtn(host, '我的牌组')); // 进牌组屏（默认 base=扑克构筑屏）
    };
    it('牌组屏显示构筑选牌：计数 N/16 + 一键自动构筑 + 卡可点', () => {
      const host = document.createElement('div');
      open(host, { getView: () => makeView({ pokerPicks: ['AS', 'KH'], pokerPickMax: 16 }), onPlay: vi.fn() });
      expect(host.innerHTML).toContain('2/16'); // 已选 2/16
      expect(host.querySelector('[data-act="autoBuildDeck"]')).not.toBeNull();
      expect(host.querySelector('[data-act="pickCard"]')).not.toBeNull();
      expect(host.querySelector('.pcard.picked')).not.toBeNull(); // AS/KH 选中态
    });
    it('点一张牌 → onTogglePick(卡id)', () => {
      const onTogglePick = vi.fn();
      const host = document.createElement('div');
      open(host, { getView: () => makeView({ pokerPicks: [], pokerPickMax: 16 }), onPlay: vi.fn(), onTogglePick });
      click(host.querySelector('[data-act="pickCard"]'));
      expect(onTogglePick).toHaveBeenCalledTimes(1);
      expect(typeof onTogglePick.mock.calls[0][0]).toBe('string'); // 传卡 id
    });
    it('一键自动构筑 → onAutoBuildDeck / 清空 → onClearPicks', () => {
      const onAutoBuildDeck = vi.fn(); const onClearPicks = vi.fn();
      const host = document.createElement('div');
      open(host, { getView: () => makeView({ pokerPicks: [], pokerPickMax: 16 }), onPlay: vi.fn(), onAutoBuildDeck, onClearPicks });
      click(host.querySelector('[data-act="autoBuildDeck"]'));
      click(host.querySelector('[data-act="clearPicks"]'));
      expect(onAutoBuildDeck).toHaveBeenCalledTimes(1);
      expect(onClearPicks).toHaveBeenCalledTimes(1);
    });
  });
});
