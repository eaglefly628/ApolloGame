import { describe, it, expect } from 'vitest';
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { buildScreen, buildHome, buildReading, UI_ACTIONS, type Screen } from './ui.js';
import { ACTIVE_CAT, CHAPTERS, buyKey, offlineKey, relId } from './world-data.js';

/** 收集树里所有节点（含 children 递归）。 */
function walk(n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] {
  out.push(n);
  for (const c of n.children ?? []) walk(c, out);
  return out;
}
const actionsIn = (n: LayoutNode): Set<string> => {
  const out = new Set<string>();
  for (const x of walk(n)) {
    const p = x.props as { action?: string; chooseAction?: string; closeAction?: string };
    for (const a of [p.action, p.chooseAction, p.closeAction]) if (a !== undefined) out.add(a);
  }
  return out;
};

const SCREENS: Screen[] = ['hall', 'orbs', 'table', 'toys', 'shop', 'memory', 'settings', 'about'];

function richSession(): HallSession {
  const s = new HallSession(112, { ...EMPTY_STATE, stardust: 80, relations: { [relId('heartlight', ACTIVE_CAT)]: 20 }, chapters: [CHAPTERS[0]!.id] });
  s.act(buyKey('feather')); s.act(offlineKey('short')); s.step();
  return s;
}

describe('game112 UI = LayoutNode 纯数据（闭集校验零 issue）', () => {
  it('标题页（起手包）零 issue', () => {
    expect(validateLayoutNode(buildHome())).toEqual([]);
    expect(validateLayoutNode(buildHome({ canExit: true }))).toEqual([]);
  });

  it('全部屏 · 空世界 / 富世界 均零 issue', () => {
    const empty = new HallSession(112).hall();
    const rich = richSession().hall();
    for (const screen of SCREENS) {
      expect(validateLayoutNode(buildScreen({ screen, view: empty })), `${screen}/empty`).toEqual([]);
      expect(validateLayoutNode(buildScreen({ screen, view: rich })), `${screen}/rich`).toEqual([]);
    }
  });

  it('阅读屏三态（line / choice / ended）零 issue，选项列走 choiceList', () => {
    const s = richSession();
    const id = CHAPTERS[0]!.id;
    const line = buildReading(s.reading(id)!);
    expect(validateLayoutNode(line)).toEqual([]);
    s.act('dialogue.advance'); s.act('dialogue.advance');
    const choice = buildReading(s.reading(id)!);
    expect(validateLayoutNode(choice)).toEqual([]);
    expect(walk(choice).some((n) => n.type === 'choiceList')).toBe(true);
    s.act('dialogue.choose', { x: 0 });
    const ended = buildReading(s.reading(id)!);
    expect(validateLayoutNode(ended)).toEqual([]);
    expect(walk(ended).some((n) => n.id === 'reading-next')).toBe(false);
  });

  it('屏上发出的 action ⊆ UI_ACTIONS（宿主接线单一真相·无孤儿信号）', () => {
    const rich = richSession();
    const all = new Set<string>();
    for (const screen of SCREENS) for (const a of actionsIn(buildScreen({ screen, view: rich.hall() }))) all.add(a);
    for (const a of actionsIn(buildHome({ canExit: true }))) all.add(a);
    for (const a of actionsIn(buildReading(rich.reading(CHAPTERS[0]!.id)!))) all.add(a);
    const known = new Set<string>(UI_ACTIONS);
    for (const a of all) expect(known.has(a), a).toBe(true);
  });

  it('主厅：离线小事件 → 「看过了」按钮出现；已放置物品 → 主厅可见（购买回到共同空间）', () => {
    const s = richSession();
    const hall = buildScreen({ screen: 'hall', view: s.hall() });
    expect(walk(hall).some((n) => n.id === 'hall-offline-ack')).toBe(true);
    s.act('offline.ack'); s.step(); // Effect（Commit）发 DestroyRequest → 下一拍 destroy-apply 才移除
    expect(walk(buildScreen({ screen: 'hall', view: s.hall() })).some((n) => n.id === 'hall-offline')).toBe(false);
    s.act('decor.place.feather'); s.step();
    expect(walk(buildScreen({ screen: 'hall', view: s.hall() })).some((n) => n.id === 'hall-placed-feather')).toBe(true);
  });

  it('杂货铺：星砂不够的物品按钮禁用（可负担才成交在 UI 上也可见）', () => {
    const poor = new HallSession(112).hall();
    const shop = buildScreen({ screen: 'shop', view: poor });
    const buyBtns = walk(shop).filter((n) => n.type === 'Button' && (n.props as { action?: string }).action === 'shop.buy');
    expect(buyBtns.length).toBeGreaterThan(0);
    for (const b of buyBtns) expect((b.props as { disabled?: boolean }).disabled).toBe(true);
  });
});
