import { describe, it, expect } from 'vitest';
import { renderLobby, type LobbyView, type LobbyShopItem } from './lobby-screen.js';

const J = (id: string, name: string): LobbyShopItem => ({ id, name, sub: name, cost: 16, owned: false, buyable: true });
const view = (): LobbyView => ({
  skin: 'onyx', coin: 1200, energy: 4, energyMax: 6, foilCount: 1, name: 'X', mainCard: '黑桃A', rankText: '战役 3/5',
  stageLabel: '第 3 战', archLine: '将领流', bossLine: 'boss', deckAvg: 53, deckMin: 44, deckMax: 62, deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2),
  jokers: [J('comrade', '同袍')], planets: [{ id: 'mars', name: '星球·军', sub: 's', cost: 14, owned: false, level: 0, buyable: true }], foils: [J('gilt', '鎏金')], ladderLines: ['<h2>战役</h2>'],
});

describe('Game G · lobby tab 渲染逻辑（on(tab) 切激活屏 + 回调挂钩齐全）', () => {
  it('每个 tab 对应 section 加 .on、nav 高亮；点击钩子 data-act 齐全', () => {
    // home：homerow 屏激活
    expect(renderLobby(view(), 'home', false)).toContain('class="screen on homerow"');
    // 其余 tab：对应 full 屏激活、且该 nav 按钮高亮、home 不激活
    for (const t of ['decks', 'coll', 'craft', 'ladder']) {
      const html = renderLobby(view(), t, false);
      expect(html).toContain('class="screen on full"'); // 激活的 full 屏
      expect(html).toContain('class="screen homerow"'); // home 未激活（无 on）
      expect(html).toMatch(new RegExp(`data-act="tab" data-k="${t}"`)); // nav 钩子在
    }
    // 交互钩子齐全（mountLobby 据此分发）
    const h = renderLobby(view(), 'craft', false);
    for (const a of ['data-act="tab"', 'data-act="skin"', 'data-act="play"', 'data-act="buyJoker"', 'data-act="buyPlanet"', 'data-act="reset"', 'data-act="tut"']) expect(h).toContain(a);
  });
});
