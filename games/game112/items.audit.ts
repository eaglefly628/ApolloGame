// 独立 file:// 验收夹具；不连接本地游戏服务，不读取玩家存档。
import { mountUI, resolveBindings, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { STAR_TAIL_THEME } from './ui-theme.js';
import { HallSession } from './session.js';
import { EMPTY_STATE } from './blueprint.js';
import { buildScene, buildMap, buildScreen, type Screen } from './ui.js';
import { ROOMS, SHOP_ITEMS, type RoomId } from './world-data.js';
import { ITEM_EXPERIENCES } from './item-data.js';
import { routeAction } from './game112.js';
import { setSkinOverrides } from './cat-art.js';
import assets from '../../public/games/game112/art/index.json';

const globals = globalThis as typeof globalThis & { __GAME112_ASSET_ROOT__?: string };
const name = new URL(location.href).searchParams.get('case');
setSkinOverrides(Object.fromEntries(assets.assets.filter((a) => a.status === 'filled' && a.path).map((a) => [a.id, `${globals.__GAME112_ASSET_ROOT__ ?? ''}${a.path}`])));
const s = name === 'shop-empty' ? new HallSession(112) : new HallSession(112, { ...EMPTY_STATE, stardust: 200,
  items: Object.fromEntries(SHOP_ITEMS.map((it) => [it.id, 1])), placed: SHOP_ITEMS.map((it) => it.id) });
const root = document.getElementById('root')!;
const prefix = (node: LayoutNode, p: string): LayoutNode => ({ ...node, id: `${p}-${node.id}`, ...(node.children ? { children: node.children.map((c) => prefix(c, p)) } : {}) });
// Gallery 的数据图源不经过 skin 槽；仅在 file 夹具里映射成本地 public 路径。
const fileArt = (node: LayoutNode): LayoutNode => {
  const p = node.props as { src?: string };
  return { ...node,
    ...(p.src?.startsWith('/games/') && globals.__GAME112_ASSET_ROOT__ ? { props: { ...node.props, src: `${globals.__GAME112_ASSET_ROOT__}${p.src}` } } : {}),
    ...(node.children ? { children: node.children.map(fileArt) } : {}),
  };
};
const resolve = (node: LayoutNode): LayoutNode => fileArt(resolveBindings(node, { flag: () => false }));

if (!name) {
  const v = s.hall();
  mountUI(root, { type: 'Panel', id: 'audit-scenes', props: { bare: true }, layout: { direction: 'column', gap: 20, padding: 0 }, children: [
    ...ROOMS.map((room) => prefix(resolve(buildScene(v, room.id)), room.id)),
    prefix(buildMap('hall'), 'map'),
    ...(['shop', 'toys', 'orbs', 'catalog', 'table', 'memory', 'settings'] as const).map((screen) => prefix(buildScreen({ screen, view: v }), `menu-${screen}`)),
    prefix(buildScreen({ screen: 'shop', view: new HallSession(112).hall(), shopItem: 'paperbag' }), 'menu-shop-empty'),
    ...ITEM_EXPERIENCES.flatMap((it) => ['invite', 'done'].map((state) => prefix(resolve(buildScene({ ...v, itemActivity: `${it.id}:${state}` }, 'hall')), `${it.id}-${state}`))),
    prefix(resolve(buildScene({ ...v, offlineEvents: ['雪团把旧玩具推到了窗边，等你回来。'] }, 'hall')), 'offline'),
  ] }, {}, STAR_TAIL_THEME);
} else {
  let room: RoomId = ROOMS.find((r) => r.id === name)?.id ?? 'hall';
  let screen: Screen = (['shop', 'shop-empty', 'map', 'toys', 'catalog', 'table', 'memory', 'settings', 'orbs-menu'].includes(name) ? (name === 'orbs-menu' ? 'orbs' : name === 'shop-empty' ? 'shop' : name) : 'scene') as Screen;
  let shopItem = 'paperbag';
  let unmount: (() => void) | undefined;
  const render = (): void => {
    unmount?.();
    unmount = mountUI(root, resolve(buildScreen({ screen, room, view: s.hall(), shopItem })), {}, STAR_TAIL_THEME, { enqueueAction: (action, value) => {
      if (action === 'shop.inspect' && SHOP_ITEMS.some((it) => it.id === value?.arg)) { shopItem = value!.arg!; render(); return; }
      const route = routeAction(action, value?.arg);
      if (!route) return;
      if (route.room) { room = route.room; s.act(`room.visit.${room}`); }
      if (route.key) s.act(route.key);
      s.step();
      if (route.screen) screen = route.screen;
      render();
    } });
  };
  render();
}
