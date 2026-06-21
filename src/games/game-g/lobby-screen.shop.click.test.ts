// Game G · 大厅点击交互测试·商城/抽卡/开场流程（拆分自 lobby-screen.click.test.ts）。
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
});
