import { describe, it, expect } from 'vitest';
import { validateLayoutNode, resolveBindings } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { buildScreen, buildHome, buildMap, buildReading, buildRoom, UI_ACTIONS, type Screen } from './ui.js';
import { flagOn } from './project.js';
import { ACTIVE_CAT, CHAPTERS, ROOMS, buyKey, offlineKey, relId, roomOf } from './world-data.js';

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

const SCREENS: Screen[] = ['hall', 'map', 'room', 'orbs', 'table', 'toys', 'shop', 'memory', 'settings', 'about'];

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

  it('十房拓扑是单一、连通、对称的闭集；00 馆图热区全部落在 960×540 内', () => {
    expect(ROOMS).toHaveLength(10);
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(10);
    expect(new Set(ROOMS.map((r) => r.number)).size).toBe(10);
    for (const room of ROOMS) {
      expect(room.scene, room.id).toBe(room.id);
      expect(room.mapRect.x, room.id).toBeGreaterThanOrEqual(0);
      expect(room.mapRect.y, room.id).toBeGreaterThanOrEqual(0);
      expect(room.mapRect.x + room.mapRect.w, room.id).toBeLessThanOrEqual(960);
      expect(room.mapRect.y + room.mapRect.h, room.id).toBeLessThanOrEqual(540);
      for (const next of room.adjacent) expect(roomOf(next)?.adjacent, `${room.id}↔${next}`).toContain(room.id);
    }
    const seen = new Set<string>(['hall']);
    const queue = ['hall'];
    while (queue.length > 0) for (const next of roomOf(queue.shift()!)!.adjacent) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    expect(seen.size).toBe(ROOMS.length);
  });

  it('00 快速预览图本身十个房间都可点，文字快跳也同表生成；当前房高亮', () => {
    const map = buildMap('garden');
    expect(validateLayoutNode(map)).toEqual([]);
    const nodes = walk(map);
    const imageHits = nodes.filter((n) => n.id.startsWith('map-room-') && !n.id.endsWith('-tag'));
    expect(imageHits).toHaveLength(10);
    expect(imageHits.map((n) => (n.props as { actionArg?: string }).actionArg)).toEqual(ROOMS.map((r) => r.id));
    expect(nodes.filter((n) => n.id.startsWith('go-room-'))).toHaveLength(10);
    expect((nodes.find((n) => n.id === 'map-room-garden')?.props as { accent?: boolean }).accent).toBe(true);
  });

  it('通用房间只生成 ROOMS.adjacent 指定的门，不会越拓扑边', () => {
    const view = richSession().hall();
    for (const room of ROOMS.filter((r) => r.id !== 'hall')) {
      const tree = buildRoom(view, room.id);
      expect(validateLayoutNode(tree), room.id).toEqual([]);
      const args = walk(tree)
        .filter((n) => (n.props as { action?: string }).action === 'room.enter')
        .map((n) => (n.props as { actionArg?: string }).actionArg);
      expect(args, room.id).toEqual(room.adjacent);
    }
  });

  it('每个房间活动都复用已接线 UI_ACTIONS，不制造空入口', () => {
    const known = new Set<string>(UI_ACTIONS);
    for (const room of ROOMS) if (room.activity !== undefined) expect(known.has(room.activity.action), `${room.id}:${room.activity.action}`).toBe(true);
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
    expect((walk(ended).find((n) => n.id === 'reading-dialog')?.props as { kind?: string }).kind).toBe('choice');
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

  it('沉浸模式「只看它」：Flag 开 → visibleWhen 剔掉顶栏/热点/动作/导航，只剩猫画面 + 「显示界面」；关 → 复原（重组·非缺口）', () => {
    const s = richSession();
    const tree = () => resolveBindings(buildScreen({ screen: 'hall', view: s.hall() }), { flag: (id) => flagOn(s.world, id) });
    const ids = (t: LayoutNode) => new Set(walk(t).map((n) => n.id));
    let t = ids(tree());
    expect(s.hall().stageOnly).toBe(false);
    for (const id of ['hall-top', 'hall-hotspots', 'hall-care', 'navbar', 'hall-stage-hide', 'hall-offline']) expect(t.has(id), id).toBe(true);
    expect(t.has('hall-stage-show')).toBe(false);
    s.act('ui.hide'); s.step();
    expect(s.hall().stageOnly).toBe(true);
    t = ids(tree());
    for (const id of ['hall-top', 'hall-hotspots', 'hall-care', 'navbar', 'hall-offline']) expect(t.has(id), id).toBe(false);
    expect(t.has('hall-cat')).toBe(true);
    expect(t.has('hall-stage-show')).toBe(true);
    s.act('ui.show'); s.step();
    t = ids(tree());
    expect(t.has('navbar')).toBe(true);
    expect(t.has('hall-stage-show')).toBe(false);
  });

  it('杂货铺：星砂不够的物品按钮禁用（可负担才成交在 UI 上也可见）', () => {
    const poor = new HallSession(112).hall();
    const shop = buildScreen({ screen: 'shop', view: poor });
    const buyBtns = walk(shop).filter((n) => n.type === 'Button' && (n.props as { action?: string }).action === 'shop.buy');
    expect(buyBtns.length).toBeGreaterThan(0);
    for (const b of buyBtns) expect((b.props as { disabled?: boolean }).disabled).toBe(true);
  });
});
