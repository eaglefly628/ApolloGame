import { describe, it, expect } from 'vitest';
import { validateLayoutNode, resolveBindings } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { buildScreen, buildHome, buildMap, buildReading, buildScene, UI_ACTIONS, type Screen } from './ui.js';
import { flagOn } from './project.js';
import { ACTIVE_CAT, CHAPTERS, ROOMS, SCENE_W, SCENE_H, buyKey, offlineKey, relId, roomOf } from './world-data.js';

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

const SCREENS: Screen[] = ['scene', 'map', 'orbs', 'table', 'toys', 'shop', 'memory', 'settings', 'about'];

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
        expect(hot.layout?.press3d, `${room.id}:${hot.id} press3d`).toBe(true);
        expect(hot.layout?.fx?.some((fx) => fx.kind === 'sheen-hover'), `${room.id}:${hot.id} sheen-hover`).toBe(true);
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
      const movingCat = walk(cat).find((n) => n.id === 'hall-cat')!;
      const sprite = (movingCat.props as { sprite?: { frames?: number; directedPatrol?: { backwardSrc?: string; turnSrc?: string } } }).sprite;
      expect(sprite?.frames, `${room.id} walk strip`).toBe(4);
      expect(sprite?.directedPatrol?.backwardSrc, `${room.id} left walk strip`).toBeTruthy();
      expect(sprite?.directedPatrol?.turnSrc, `${room.id} true turn strip`).toBeTruthy();
      expect(movingCat.layout?.anim, `${room.id} patrol`).toBe('patrol');
      expect(movingCat.layout?.animDist, `${room.id} patrol dx`).toBe(room.catPatrol.dx);
      expect(movingCat.layout?.animMs, `${room.id} synchronized cycle`).toBe(12000);
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

  it('子功能叠在房间上：Drawer 里是内容，身后还是当前房间的舞台（不换屏）', () => {
    const view = richSession().hall();
    for (const [screen, drawerId] of [['shop', 'shop-drawer'], ['toys', 'toys-drawer'], ['memory', 'memory-drawer'], ['orbs', 'orbs-drawer'], ['settings', 'settings-drawer'], ['table', 'table-drawer']] as const) {
      const tree = buildScreen({ screen, view, room: 'sunroom' });
      const t = ids(tree);
      expect(tree.id, screen).toBe('scene-sunroom');
      expect(t.has('hall-stage'), screen).toBe(true);
      expect(t.has(drawerId), screen).toBe(true);
      const d = walk(tree).find((n) => n.id === drawerId)!;
      expect(d.type).toBe('Drawer');
      expect((d.props as { closeAction?: string }).closeAction).toBe('hall.back');
    }
  });

  it('阅读 = 底部台词框三态（line / choice / ended）零 issue，选项列走 choiceList，关闭回回忆廊', () => {
    const s = richSession();
    const id = CHAPTERS[0]!.id;
    const line = buildReading(s.reading(id)!);
    expect(validateLayoutNode(line)).toEqual([]);
    expect((line.props as { side?: string; closeAction?: string })).toMatchObject({ side: 'bottom', closeAction: 'memory.back' });
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

  it('杂货铺：星砂不够的物品按钮禁用（可负担才成交在 UI 上也可见）', () => {
    const poor = new HallSession(112).hall();
    const shop = buildScreen({ screen: 'shop', view: poor });
    const buyBtns = walk(shop).filter((n) => n.type === 'Button' && (n.props as { action?: string }).action === 'shop.buy');
    expect(buyBtns.length).toBeGreaterThan(0);
    for (const b of buyBtns) expect((b.props as { disabled?: boolean }).disabled).toBe(true);
  });
});
