import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { SHOP_ITEMS, buyKey, placeKey } from './world-data.js';
import { ITEM_EXPERIENCES, useKey, respondKey, removeKey, ITEM_CANCEL } from './item-data.js';
import { buildScreen } from './ui.js';

const act = (s: HallSession, key: string): void => { s.act(key); s.step(); };
const stocked = (): HallSession => new HallSession(112, { ...EMPTY_STATE, stardust: 200,
  items: Object.fromEntries(SHOP_ITEMS.map((it) => [it.id, 1])), placed: SHOP_ITEMS.map((it) => it.id) });
const walk = (n: LayoutNode): LayoutNode[] => [n, ...(n.children ?? []).flatMap(walk)];

describe('物件购买、摆放、互动与持久化', () => {
  it('未拥有不能放；拥有未摆不能用；已购不能重复扣款', () => {
    const s = new HallSession(112, { ...EMPTY_STATE, stardust: 200 });
    act(s, placeKey('feather')); act(s, useKey('feather'));
    expect(s.persisted().placed).toEqual([]);
    expect(s.hall().itemActivity).toBe('none');
    act(s, buyKey('feather'));
    const balance = s.hall().stardust;
    act(s, buyKey('feather'));
    expect(s.hall().stardust).toBe(balance);
    expect(s.hall().owned[0]?.count).toBe(1);
    act(s, useKey('feather'));
    expect(s.hall().itemActivity).toBe('none');
    act(s, placeKey('feather')); act(s, useKey('feather'));
    expect(s.hall().itemActivity).toBe('feather:invite');
  });

  it.each(ITEM_EXPERIENCES)('$id: 邀请与回应分开，只有对应回应结算一次；收尾不排队', (it) => {
    const s = stocked();
    const before = s.hall().relations[it.benefit];
    act(s, respondKey(it.id));
    expect(s.hall().itemUses[it.id]).toBe(0);
    act(s, useKey(it.id));
    expect(s.hall().itemActivity).toBe(`${it.id}:invite`);
    expect(s.hall().relations[it.benefit]).toBe(before);
    const other = ITEM_EXPERIENCES.find((x) => x.id !== it.id)!;
    act(s, respondKey(other.id));
    expect(s.hall().itemActivity).toBe(`${it.id}:invite`);
    act(s, respondKey(it.id));
    expect(s.hall().itemActivity).toBe(`${it.id}:done`);
    expect(s.hall().relations[it.benefit]).toBe(before + 2);
    for (let n = 0; n < 4; n++) act(s, respondKey(it.id));
    act(s, useKey(it.id)); s.step(30);
    expect(s.hall().itemActivity).toBe('none');
    expect(s.hall().itemUses[it.id]).toBe(1);
    expect(s.hall().stardust).toBe(200);
    const resumed = new HallSession(112, s.persisted());
    expect(resumed.hall().itemUses[it.id]).toBe(1);
    expect(resumed.hall().owned.find((x) => x.id === it.id)?.placed).toBe(true);
    expect(resumed.hall().itemActivity).toBe('none');
  });

  it('取消、离房、收回、超时不会发奖；收回后可再次摆放', () => {
    const s = stocked();
    for (const stop of [ITEM_CANCEL, 'room.visit.garden', removeKey('feather')]) {
      act(s, 'room.visit.hall'); act(s, placeKey('feather')); act(s, useKey('feather'));
      act(s, stop); act(s, respondKey('feather'));
      expect(s.hall().itemActivity).toBe('none');
      expect(s.hall().itemUses.feather).toBe(0);
    }
    expect(s.hall().owned.find((it) => it.id === 'feather')).toMatchObject({ count: 1, placed: false });
    act(s, placeKey('feather')); act(s, useKey('feather')); s.step(151);
    expect(s.hall().itemActivity).toBe('none');
    act(s, respondKey('feather'));
    expect(s.hall().itemUses.feather).toBe(0);
    act(s, 'room.visit.garden'); act(s, useKey('feather'));
    expect(s.hall().itemActivity).toBe('none');
  });

  it('快速连续输入不丢回应、不重复结算，整快照可重放', () => {
    const a = stocked(), b = stocked();
    for (const s of [a, b]) {
      s.act(useKey('paperbag')); s.act(respondKey('paperbag')); s.act(respondKey('paperbag')); s.step(2);
      expect(s.hall().itemUses.paperbag).toBe(1);
    }
    expect(a.hash()).toBe(b.hash());
  });

  it('四物件的场景图、商店、收纳篮和互动三态均合法；移除立即消失', () => {
    const s = stocked();
    for (const it of ITEM_EXPERIENCES) {
      for (const key of [useKey(it.id), respondKey(it.id), ITEM_CANCEL]) {
        act(s, key);
        for (const screen of ['scene', 'shop', 'toys', 'table'] as const) {
          expect(validateLayoutNode(buildScreen({ screen, room: 'hall', view: s.hall() })), `${it.id}/${key}/${screen}`).toEqual([]);
        }
      }
    }
    const nodes = () => walk(buildScreen({ screen: 'scene', room: 'hall', view: s.hall() }));
    expect(nodes().filter((n) => n.id.startsWith('hall-placed-'))).toHaveLength(4);
    act(s, removeKey('paperbag'));
    expect(nodes().some((n) => n.id === 'hall-placed-paperbag')).toBe(false);
    const shop = walk(buildScreen({ screen: 'shop', view: s.hall() }));
    expect(shop.some((n) => (n.props as { action?: string }).action === 'shop.buy')).toBe(false);
  });
});
