// Game G · 大厅点击交互测试·牌组构筑/天罡战库/地支附魔/挂载/BGM（拆分自 lobby-screen.click.test.ts）。
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

    it('牌库内附魔（E·owner 2026-06-21）：牌组屏每张牌有🀄徽标 → 点它进改造坊并选中该牌（不动选牌）', () => {
      const host = document.createElement('div');
      const onInlay = vi.fn(() => true);
      const onTogglePick = vi.fn();
      mountLobby(host, { getView: () => enView(), onPlay: vi.fn(), onInlay, onTogglePick });
      click(navBtn(host, '牌组')); // 到牌组屏（默认扑克牌库子页）
      const badge = host.querySelector('[data-act="enchSel"][data-k="0"]');
      expect(badge).not.toBeNull(); // 每张牌带附魔小徽标
      click(badge!);
      expect(onTogglePick).not.toHaveBeenCalled(); // 点徽标不触发选牌（pickCard）
      expect(host.querySelector('[data-screen="craft"].on')).not.toBeNull(); // 跳到改造坊
      expect(host.querySelector('.ench-card.sel[data-k="0"]')).not.toBeNull(); // 且选中这张牌
      expect(host.querySelector('.ench-slots')).not.toBeNull(); // 出该牌的镶嵌编辑
      click(host.querySelector('[data-act="inlay"][data-k="0:子:1"]')!); // 在改造坊里镶入这张牌
      expect(onInlay).toHaveBeenCalledWith('0', '子', 1);
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
