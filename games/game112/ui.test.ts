import { describe, it, expect } from 'vitest';
import { validateLayoutNode, resolveBindings } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { buildScreen, buildHome, buildMap, buildReading, buildScene, UI_ACTIONS, type Screen } from './ui.js';
import { flagOn } from './project.js';
import { ACTIVE_CAT, CHAPTERS, ROOMS, SCENE_W, SCENE_H, SHOP_ITEMS, buyKey, offlineKey, relId, roomOf } from './world-data.js';
import { SHOP_PAGE_SIZE } from './shop-browse.js';

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
const ids = (t: LayoutNode): Set<string> => new Set(walk(t).map((n) => n.id));

const SCREENS: Screen[] = ['reception', 'scene', 'map', 'orbs', 'catalog', 'table', 'toys', 'shop', 'memory', 'settings', 'about'];

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

  it('全部屏 × 十个房间 · 空世界 / 富世界 均零 issue', () => {
    const empty = new HallSession(112).hall();
    const rich = richSession().hall();
    for (const screen of SCREENS) {
      for (const room of ROOMS) {
        expect(validateLayoutNode(buildScreen({ screen, view: empty, room: room.id })), `${screen}/${room.id}/empty`).toEqual([]);
        expect(validateLayoutNode(buildScreen({ screen, view: rich, room: room.id })), `${screen}/${room.id}/rich`).toEqual([]);
      }
    }
  });

  it('十房拓扑是单一、连通、对称的闭集；门 ⇔ adjacent 一一对应；热区与猫位都落在舞台 1000×714 内；馆图热区落在 960×540 内', () => {
    expect(ROOMS).toHaveLength(10);
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(10);
    expect(new Set(ROOMS.map((r) => r.number)).size).toBe(10);
    const inStage = (r: { x: number; y: number; w: number; h: number }): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= SCENE_W && r.y + r.h <= SCENE_H;
    for (const room of ROOMS) {
      expect(room.scene, room.id).toBe(room.id);
      expect(room.mapRect.x + room.mapRect.w, room.id).toBeLessThanOrEqual(960);
      expect(room.mapRect.y + room.mapRect.h, room.id).toBeLessThanOrEqual(540);
      for (const next of room.adjacent) expect(roomOf(next)?.adjacent, `${room.id}↔${next}`).toContain(room.id);
      // 门 ⇔ adjacent（画里每扇门通向一间相邻房·每间相邻房恰有一扇门）
      expect([...room.doors.map((d) => d.to)].sort(), `${room.id} doors`).toEqual([...room.adjacent].sort());
      for (const d of room.doors) expect(inStage(d), `${room.id} door→${d.to}`).toBe(true);
      for (const o of room.objects) expect(inStage(o), `${room.id} object ${o.id}`).toBe(true);
      expect(room.catSpot.x + room.catSpot.w, `${room.id} cat`).toBeLessThanOrEqual(SCENE_W);
      expect(room.catSpot.y + room.catSpot.h, `${room.id} cat`).toBeLessThanOrEqual(SCENE_H);
      expect(room.catSpot.x + room.catSpot.w + room.catPatrol.dx, `${room.id} cat patrol`).toBeLessThanOrEqual(SCENE_W);
      expect(room.objects.length, `${room.id} 至少一个物件入口`).toBeGreaterThan(0);
    }
    const seen = new Set<string>(['hall']);
    const queue = ['hall'];
    while (queue.length > 0) for (const next of roomOf(queue.shift()!)!.adjacent) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    expect(seen.size).toBe(ROOMS.length);
    expect(new Set(ROOMS.map((room) => `${room.catSpot.w}x${room.catSpot.h}`)).size).toBeGreaterThanOrEqual(6);
  });

  it('巡游版铁律：房间舞台上没有画面外的菜单——没有 navbar / 顶栏 / 卡片栏；门、物件、猫、木牌都在舞台里', () => {
    const view = richSession().hall();
    for (const room of ROOMS) {
      const tree = buildScene(view, room.id);
      const t = ids(tree);
      for (const banned of ['navbar', 'hall-top', 'hall-hotspots', 'hall-care', 'map-quick-jump']) expect(t.has(banned), `${room.id} 不许有 ${banned}`).toBe(false);
      const stage = walk(tree).find((n) => n.id === 'hall-stage')!;
      const inside = ids(stage);
      for (const must of ['room-sign', 'hall-hud', 'hall-stardust', 'hall-stage-hide', 'hall-cat', 'hall-cat-line', 'hall-mood', 'hall-stage-show']) expect(inside.has(must), `${room.id} 舞台里要有 ${must}`).toBe(true);
      // 门只通向 adjacent
      const doorArgs = walk(stage).filter((n) => (n.props as { action?: string }).action === 'room.enter').map((n) => (n.props as { actionArg?: string }).actionArg);
      expect([...doorArgs].sort(), room.id).toEqual([...room.adjacent].sort());
      // 画内热区必须有明确的悬停/按下反馈与实底标签，不能只靠透明矩形猜哪里可点。
      const hotzones = walk(stage).filter((n) => {
        const action = (n.props as { action?: string }).action;
        return action !== undefined && (n.id.startsWith('door-') || n.id.startsWith('hot-'));
      });
      for (const hot of hotzones) {
        expect(hot.children?.some((child) => child.layout?.press3d), `${room.id}:${hot.id} press3d only on visible chip`).toBe(true);
        expect(hot.children?.some((child) => child.layout?.fx?.some((fx) => fx.kind === 'sheen-hover')), `${room.id}:${hot.id} sheen-hover on child (preserve absolute anchor)`).toBe(true);
        expect(walk(hot).some((n) => n.id === `${hot.id}-chip` && (n.props as { edge?: string }).edge === 'gold'), `${room.id}:${hot.id} 实底标签`).toBe(true);
      }
      // 每个物件都是已接线动作
      const known = new Set<string>(UI_ACTIONS);
      for (const o of room.objects) expect(known.has(o.action), `${room.id}:${o.action}`).toBe(true);
      // 猫在猫位上（绝对坐标 = 表里的猫位）
      const cat = walk(stage).find((n) => n.id === 'hall-cat-wrap')!;
      expect(cat.layout?.x).toBe(room.catSpot.x);
      expect(cat.layout?.y).toBe(room.catSpot.y);
      expect(walk(cat).find((n) => n.id === 'hall-cat')?.layout?.width).toBe(room.catSpot.w);
      expect(walk(cat).find((n) => n.id === 'hall-cat')?.layout?.height).toBe(room.catSpot.h);
      const anchoredCat = walk(cat).find((n) => n.id === 'hall-cat')!;
      expect((anchoredCat.props as { sprite?: unknown }).sprite, `${room.id} rejected frame strip stays disabled`).toBeUndefined();
      expect(anchoredCat.layout?.anim, `${room.id} rejected patrol stays disabled`).toBeUndefined();
      expect((cat.props as { action?: string }).action).toBe('cat.greet');
    }
  });

  it('00 馆图：十个房间都在画里可点、当前房高亮、画里有回猫身边的木牌；没有文字快跳栏', () => {
    const map = buildMap('garden');
    expect(validateLayoutNode(map)).toEqual([]);
    const nodes = walk(map);
    const imageHits = nodes.filter((n) => n.id.startsWith('map-room-') && (n.props as { action?: string }).action === 'room.enter');
    expect(imageHits).toHaveLength(10);
    expect(imageHits.map((n) => (n.props as { actionArg?: string }).actionArg)).toEqual(ROOMS.map((r) => r.id));
    expect((nodes.find((n) => n.id === 'map-room-garden')?.props as { accent?: boolean }).accent).toBe(true);
    expect(nodes.some((n) => n.id === 'map-back' && (n.props as { action?: string }).action === 'hall.back')).toBe(true);
    expect(nodes.some((n) => n.id.startsWith('go-room-'))).toBe(false);
  });

  it('子功能属于房间舞台：没有 viewport Drawer / Modal，合册回当前房间', () => {
    const view = richSession().hall();
    for (const [screen, drawerId] of [['shop', 'shop-drawer'], ['toys', 'toys-drawer'], ['memory', 'memory-drawer'], ['orbs', 'orbs-drawer'], ['catalog', 'catalog-drawer'], ['settings', 'settings-drawer'], ['table', 'table-drawer']] as const) {
      const tree = buildScreen({ screen, view, room: 'sunroom' });
      const t = ids(tree);
      expect(tree.id, screen).toBe('scene-sunroom');
      expect(t.has('hall-stage'), screen).toBe(true);
      expect(t.has(drawerId), screen).toBe(true);
      const d = walk(tree).find((n) => n.id === drawerId)!;
      expect(d.type).toBe('Panel');
      expect(ids(walk(tree).find((n) => n.id === 'hall-stage')!).has(drawerId)).toBe(true);
      expect(walk(tree).some((n) => n.type === 'Drawer' || n.type === 'Modal')).toBe(false);
      expect(actionsIn(d).has('hall.back')).toBe(true);
      expect(ids(tree).has('hall-cat')).toBe(false); // 无隐藏背景按钮 / 猫抢占点按
    }
  });

  it('星砂铺有画内掌柜，商品操作和账页不被立绘遮挡', () => {
    const shop = buildScreen({ screen: 'shop', view: richSession().hall(), room: 'hall' });
    const nodes = walk(shop);
    const cat = nodes.find((n) => n.id === 'shopkeeper-cat')!;
    const ledger = nodes.find((n) => n.id === 'shop-ledger')!;
    expect(cat.type).toBe('Image');
    expect((cat.props as { src?: string }).src).toContain('shopkeeper-tortoiseshell-v1.png');
    expect((cat.layout!.x! + cat.layout!.width!)).toBeLessThan(ledger.layout!.x!);
    expect(nodes.filter((n) => SHOP_ITEMS.some((it) => n.id === `shop-${it.id}`))).toHaveLength(Math.min(SHOP_PAGE_SIZE, SHOP_ITEMS.length));
    expect(validateLayoutNode(shop)).toEqual([]);
  });

  it('精选四件可按名称检索查看；交换只从详情确认，见面星砂有明确反馈', () => {
    const empty = new HallSession(112).hall();
    for (const item of SHOP_ITEMS) {
      const tree = buildScreen({ screen: 'shop', view: empty, shopItem: item.id,
        shopBrowse: { category: 'all', value: 'all', sort: 'featured', query: item.id, page: 0 } });
      const nodes = walk(tree);
      expect((nodes.find((n) => n.id === 'shop-title')?.props as { text?: string }).text).toContain(item.name);
      expect((nodes.find((n) => n.id === 'shop-sub')?.props as { text?: string }).text).toBe(item.blurb);
      expect(nodes.filter((n) => (n.props as { action?: string }).action === 'shop.inspect')).toHaveLength(1);
      expect(nodes.filter((n) => (n.props as { action?: string }).action === 'shop.buy')).toHaveLength(0);
      expect(ids(tree).has('shop-selected-shortfall')).toBe(true);
      expect(ids(tree).has('shop-welcome-claim')).toBe(true);
      expect(validateLayoutNode(tree)).toEqual([]);
    }
    const s = new HallSession(112);
    s.act('currency.grant.welcome'); s.step();
    const claimed = buildScreen({ screen: 'shop', view: s.hall(), shopItem: 'paperbag' });
    expect(ids(claimed).has('shop-welcome-claim')).toBe(false);
    expect(ids(claimed).has('shop-welcome-claimed')).toBe(true);
    expect((walk(claimed).find((n) => n.id === 'shop-selected-buy')?.props as { action?: string }).action).toBe('shop.buy');
    const short = buildScreen({ screen: 'shop', view: s.hall(), shopItem: 'feather' });
    expect(ids(short).has('shop-welcome-claimed')).toBe(true);
    expect(ids(short).has('shop-selected-shortfall')).toBe(true);
    expect(ids(short).has('shop-selected-buy')).toBe(false);
  });

  it('阅读 = 底部台词框三态（line / choice / ended）零 issue，选项列走 choiceList，关闭回回忆廊', () => {
    const s = richSession();
    const id = CHAPTERS[0]!.id;
    const line = buildReading(s.reading(id)!);
    expect(validateLayoutNode(line)).toEqual([]);
    expect(line.type).toBe('Panel');
    expect(actionsIn(line).has('memory.back')).toBe(true);
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
    for (const screen of SCREENS) for (const room of ROOMS) for (const a of actionsIn(buildScreen({ screen, view: rich.hall(), room: room.id }))) all.add(a);
    for (const a of actionsIn(buildHome({ canExit: true }))) all.add(a);
    for (const a of actionsIn(buildScreen({ screen: 'reading', view: rich.hall(), reading: rich.reading(CHAPTERS[0]!.id)! }))) all.add(a);
    const known = new Set<string>(UI_ACTIONS);
    for (const a of all) expect(known.has(a), a).toBe(true);
  });

  it('主厅：离线小事件 → 画里的纸条 + 「看过了」；已放置物品 → 猫身边可见（购买回到共同空间）', () => {
    const s = richSession();
    const hall = buildScreen({ screen: 'scene', view: s.hall(), room: 'hall' });
    expect(walk(hall).some((n) => n.id === 'hall-offline-ack')).toBe(true);
    s.act('offline.ack'); s.step(); // Effect（Commit）发 DestroyRequest → 下一拍 destroy-apply 才移除
    expect(walk(buildScreen({ screen: 'scene', view: s.hall(), room: 'hall' })).some((n) => n.id === 'hall-offline')).toBe(false);
    s.act('decor.place.feather'); s.step();
    expect(walk(buildScreen({ screen: 'scene', view: s.hall(), room: 'hall' })).some((n) => n.id === 'hall-placed-feather')).toBe(true);
  });

  it('沉浸模式「只看它」：Flag 开 → visibleWhen 剔掉木牌/星砂/门/物件/纸条，只剩猫 + 「显示界面」；关 → 复原', () => {
    const s = richSession();
    const tree = () => resolveBindings(buildScreen({ screen: 'scene', view: s.hall(), room: 'hall' }), { flag: (id) => flagOn(s.world, id) });
    let t = ids(tree());
    expect(s.hall().stageOnly).toBe(false);
    for (const id of ['room-sign', 'hall-hud', 'hall-stage-hide', 'hall-offline', 'door-garden', 'hot-orbs']) expect(t.has(id), id).toBe(true);
    expect(t.has('hall-stage-show')).toBe(false);
    s.act('ui.hide'); s.step();
    expect(s.hall().stageOnly).toBe(true);
    t = ids(tree());
    for (const id of ['room-sign', 'hall-hud', 'hall-offline', 'door-garden', 'hot-orbs']) expect(t.has(id), id).toBe(false);
    expect(t.has('hall-cat')).toBe(true);
    expect(t.has('hall-stage-show')).toBe(true);
    s.act('ui.show'); s.step();
    t = ids(tree());
    expect(t.has('room-sign')).toBe(true);
    expect(t.has('hall-stage-show')).toBe(false);
  });

  it('杂货铺：星砂不够时只显示差额，不开放购买动作', () => {
    const poor = new HallSession(112).hall();
    const shop = buildScreen({ screen: 'shop', view: poor });
    const buyBtns = walk(shop).filter((n) => n.type === 'Button' && (n.props as { action?: string }).action === 'shop.buy');
    expect(buyBtns).toHaveLength(0);
    expect(ids(shop).has('shop-selected-shortfall')).toBe(true);
    expect(ids(shop).has('shop-welcome-claim')).toBe(true);
  });
});
