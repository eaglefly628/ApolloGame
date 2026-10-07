// game112《星尾会客厅》—— UI 屏（全部 LayoutNode 纯数据·闭集控件·写世界只发 action 信号）。
// owner 2026-09-28 巡游版铁律：**所有按钮内嵌在画面里**——门 = 去相邻房、物件 = 活动入口、猫 = 呼唤、
// 墙上的木牌 = 馆图；没有画面外的菜单栏。子功能（晶球厅名册 / 杂货铺 / 玩具篮 / 回忆廊 / 设置）
// 以 Drawer 叠在当前房间之上（房间仍可见·点暗处即回房），章节阅读走底部 Drawer（VN 台词框）。
// 猫的位置 = 每房一个固定「猫位」（world-data ROOMS.catSpot·舞台坐标）；猫画面层 = 一块 Image（视频接管前）。
// 设计稿对齐：docs/design/game112/claude-design-spec.md · hall-framework.md v3。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildStarterHome } from '@zerocraft/engine/ui/starters/index.js';
import { catArt, mapSkin, sceneSkin, propArt, shopkeeperArt } from './cat-art.js';
import { ITEM_EXPERIENCES, experienceOf } from './item-data.js';
import { shopkeeperMotion, xuetuanMotion } from './cat-motion.js';
import {
  SHOP_ITEMS, STARDUST_GRANTS, STARDUST_MAX, RELATIONS, CATS, TABLE_PLACEHOLDER, GAME_ID, STAGE_ONLY_FLAG, shopItemOf,
  ROOMS, roomOf, SCENE_W, SCENE_H, type RoomId, type RoomSpec,
} from './world-data.js';
import type { HallView, ReadingView } from './project.js';
import { WHEREABOUTS, type CatRegistry, type RegistrationDraft } from './registration.js';
import { CAT_BREEDS, CAT_GALLERY, RAGDOLL_IMAGES, catalogPage, EMPTY_CATALOG_BROWSE, type CatalogBrowse, type CatalogSource } from './cat-gallery.js';
import { EMPTY_SHOP_BROWSE, SHOP_CATEGORIES, SHOP_SORTS, SHOP_VALUES, shopPage, type ShopBrowse } from './shop-browse.js';

/** 屏：scene = 当前房间（唯一的「主屏」）；map = 馆图；其余 = 叠在房间上的 Drawer。 */
export type Screen = 'home' | 'reception' | 'scene' | 'map' | 'orbs' | 'catalog' | 'table' | 'toys' | 'shop' | 'memory' | 'reading' | 'settings' | 'about';

/** 本游戏 UI 发出的全部 action 信号（宿主接线的单一真相·测试对账用）。 */
export const UI_ACTIONS = [
  'home.enter', 'home.about', 'home.exit',
  'hall.back', 'map.open', 'room.enter', 'orbs.open', 'table.open', 'toys.open', 'shop.open', 'memory.open', 'settings.open', 'later',
  'catalog.open', 'catalog.search', 'catalog.source', 'catalog.page',
  'cat.greet', 'cat.sit', 'offline.ack', 'ui.hide', 'ui.show',
  'shop.inspect', 'shop.buy', 'shop.claimWelcome', 'shop.category', 'shop.value', 'shop.sort', 'shop.search', 'shop.page',
  'decor.place', 'decor.remove', 'item.use', 'item.respond', 'item.cancel',
  'memory.read', 'memory.advance', 'memory.choose', 'memory.back',
  'registration.open', 'registration.name', 'registration.note', 'registration.whereabouts', 'registration.save', 'registration.skip', 'registration.remove',
] as const;
export type UiAction = (typeof UI_ACTIONS)[number];

const NOT_STAGE_ONLY = `!${STAGE_ONLY_FLAG}`;
const two = (n: number): string => String(n).padStart(2, '0');

/**
 * 页面外壳（关于页等文字页用）——**`Screen` 会丢掉 `layout`**（game111 真机实测），padding/gap/maxWidth 挂在内层 bare Panel。
 */
function page(id: string, children: LayoutNode[], gap = 14): LayoutNode {
  return {
    type: 'Screen', id, props: {},
    children: [{
      type: 'Panel', id: `${id}-inner`, props: { bare: true },
      layout: { direction: 'column', gap, padding: 22, maxWidth: 1180 },
      children,
    }],
  };
}
const heading = (id: string, text: string, size: 'xl' | 'xxl' = 'xl'): LayoutNode =>
  ({ type: 'Label', id, props: { text, size, bold: true, font: 'cnround', color: 'gold' } });
const subLabel = (id: string, text: string): LayoutNode => ({ type: 'Label', id, props: { text, size: 'sm', color: 'sub' } });
const backBtn = (id: string, label = '回到猫身边', action = 'hall.back'): LayoutNode =>
  ({ type: 'Button', id, props: { label, kind: 'ghost', action } });

/** 画里的「木牌」：一块可点的旧纸卡（复合贴图按钮的素坯形态·S5 换皮成木牌/布标）。 */
function sign(id: string, text: string, action: string, o: { x: number; y: number; arg?: string; tag?: string; visibleWhen?: string } ): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: 'raised', edge: 'gold', action, ...(o.arg !== undefined ? { actionArg: o.arg } : {}) },
    layout: { x: o.x, y: o.y, direction: 'row', gap: 8, padding: 8, align: 'center', press3d: true },
    ...(o.visibleWhen !== undefined ? { visibleWhen: o.visibleWhen } : {}),
    children: [
      { type: 'Label', id: `${id}-label`, props: { text, size: 'sm', bold: true, color: 'text' } },
      ...(o.tag !== undefined ? [{ type: 'Label', id: `${id}-tag`, props: { text: o.tag, size: 'xs', bold: true, color: 'text' } } as LayoutNode] : []),
    ],
  };
}

// ── ① 标题页（起手包）────────────────────────────────────────────────────
export function buildHome(o: { canExit?: boolean } = {}): LayoutNode {
  return buildStarterHome({
    title: '星尾会客厅',
    subtitle: '十房巡游版 · 沿画里的门，在星尾馆里陪它慢慢走',
    actions: [
      { label: '走进星尾馆', action: 'home.enter', kind: 'hero', sub: '十间猫房已开放 · 雪团在主厅等你' },
      { label: '关于星尾馆', action: 'home.about', kind: 'ghost' },
      ...(o.canExit === true ? [{ label: '回游戏库', action: 'home.exit', kind: 'quiet' as const }] : []),
    ],
  });
}

/** 前台是主厅月庭门内的同一角落，不占馆图新房间。名册是本机私有草稿，不等于猫已到达喵星。 */
export function buildReception(registry: CatRegistry, draft: RegistrationDraft): LayoutNode {
  const scene = sceneSkin('reception');
  const caption = draft.whereabouts === 'missing'
    ? '寻猫灯会一直留着；这里不会说它已经离开。'
    : '只记下你亲手写的内容，不替它编造经历。';
  return {
    type: 'Screen', id: 'reception-screen', props: { bg: 'ink' },
    children: [{
      type: 'Panel', id: 'reception-frame', props: { bare: true },
      layout: { direction: 'column', align: 'center', padding: 10 },
      children: [{
        type: 'Panel', id: 'reception-stage', props: { bg: 'sunken', vignette: true, ...(scene !== undefined ? { skin: scene } : {}) },
        layout: { width: SCENE_W, height: SCENE_H, radius: 18, padding: 0 },
        children: [
          sign('reception-title', '星尾馆 · 前台登记', 'registration.skip', { x: 18, y: 16, tag: '主厅入口' }),
          {
            type: 'Panel', id: 'reception-cat', props: { bg: 'transparent' },
            layout: { x: 140, y: 490, width: 126, direction: 'column', align: 'center', padding: 0 },
            children: [
              { type: 'Image', id: 'reception-xuetuan', props: { src: catArt('xuetuan', 'rest'), fit: 'contain', alt: '雪团在前台旁边安静等你' }, layout: { width: 126, height: 116 } },
              readableChip('reception-cat-chip', '雪团 · 星尾馆的迎客猫'),
            ],
          },
          {
            type: 'Panel', id: 'reception-ledger', props: { bg: 'raised', edge: 'gold' },
            layout: { x: 580, y: 116, width: 392, direction: 'column', gap: 8, padding: 16, radius: 16 },
            children: [
              heading('reception-heading', '先为它留一页'),
              subLabel('reception-intro', '离开的、仍在寻找的、还在身边的猫，都可以登记。也可以先逛逛。'),
              { type: 'Input', id: 'reception-name', props: { placeholder: '猫咪的名字（最多 24 字）', value: draft.name, action: 'registration.name' } },
              { type: 'Panel', id: 'reception-statuses', props: { bare: true }, layout: { direction: 'row', gap: 5 },
                children: WHEREABOUTS.map((s): LayoutNode => ({ type: 'Button', id: `reception-status-${s.id}`, props: { label: s.label, kind: draft.whereabouts === s.id ? 'primary' : 'ghost', action: 'registration.whereabouts', actionArg: s.id } })) },
              subLabel('reception-status-explanation', WHEREABOUTS.find((s) => s.id === draft.whereabouts)?.explanation ?? ''),
              { type: 'Input', id: 'reception-note', props: { placeholder: '想记住的一句话（可不填，最多 120 字）', value: draft.note, action: 'registration.note' } },
              subLabel('reception-caption', caption),
              { type: 'Panel', id: 'reception-actions', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' },
                children: [
                  { type: 'Button', id: 'reception-save', props: { label: '记在这台设备上', kind: 'primary', action: 'registration.save', disabled: draft.name.trim().length === 0 || registry.entries.length >= 32 } },
                  { type: 'Button', id: 'reception-skip', props: { label: '先去看看', kind: 'ghost', action: 'registration.skip' } },
                ] },
              subLabel('reception-private', '目前不上传照片，也不会生成这只猫的形象；登记信息只保存在本机。'),
            ],
          },
        ],
      }],
    }],
  };
}

// ── ② 房间舞台（巡游版主屏·全部按钮在画里）────────────────────────────────
/** 初版闭环的下一步提示：不加奖励惩罚，只把已存在的动作与回忆线串起来。 */
export function loopPrompt(v: HallView): { label: string; detail: string; action: string } {
  const first = v.chapters[0];
  if (first !== undefined && !first.unlocked) return { label: '陪它坐坐', detail: `心光 ${v.relations.heartlight}/${first.need} · 慢慢听见它的故事`, action: 'cat.sit' };
  if (first !== undefined && !first.read) return { label: '看看回忆', detail: '忆光已亮 · 可以随时退出', action: 'memory.open' };
  if (v.owned.length === 0) return { label: '逛星砂铺', detail: `星砂 ${v.stardust} · 换一件留在馆里的小东西`, action: 'shop.open' };
  if (v.owned.some((o) => !o.placed)) return { label: '布置新物件', detail: '把刚带回来的东西放进主厅', action: 'toys.open' };
  return { label: '继续陪它', detail: '巡游十间猫房，想回来时再回来', action: 'cat.sit' };
}

/** 热区标签：实底小木牌兜住复杂场景，避免文字直接压在亮灯、木纹或花丛上。 */
function readableChip(id: string, label: string, emphasized = false): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: 'raised', edge: 'gold', accent: emphasized },
    layout: { padding: 5, radius: 10, ...(emphasized ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }] } : {}) },
    children: [{
      type: 'Label', id: `${id}-label`,
      props: { text: label, size: 'sm', bold: true, color: 'text' },
    }],
  };
}

/** 画里的热区（门 / 物件）：透明命中面 + 实底小木牌；悬停流光、按下反馈。 */
function hotzone(id: string, label: string, action: string, r: { x: number; y: number; w: number; h: number }, o: { arg?: string; sub?: string; tone?: 'accent' | 'normal' | 'dim' } = {}): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true, action, ...(o.arg !== undefined ? { actionArg: o.arg } : {}) },
    layout: {
      x: r.x, y: r.y, width: r.w, height: r.h,
      direction: 'column', gap: 4, align: 'center', justify: 'end', padding: 0,
      radius: 14,
    },
    visibleWhen: NOT_STAGE_ONLY,
    children: [
      ...(o.sub !== undefined ? [readableChip(`${id}-sub`, o.sub)] : []),
      { ...readableChip(`${id}-chip`, label, (o.tone ?? 'accent') === 'accent'), layout: { padding: 5, radius: 10, press3d: true, fx: [{ kind: 'sheen-hover' }] } },
    ],
  };
}

/** 猫：固定猫位上的一块画面层 + 台词纸条；点猫 = 轻声呼唤。 */
function catLayer(v: HallView, room: RoomSpec): LayoutNode {
  const { w, h } = room.catSpot;
  // 另一张「注意」图是完全不同的全身姿态；没有过渡帧时不能拿它做摸猫反馈。
  // 陪伴动作只更新文字/数值，坐姿图保持稳定，局部动效只动胸毛与尾尖。
  const catSrc = catArt(v.catId, 'rest');
  return {
    type: 'Panel', id: 'hall-cat-wrap', props: { bare: true, action: 'cat.greet' },
    layout: { x: room.catSpot.x, y: room.catSpot.y, width: w, height: h, direction: 'column', align: 'center', padding: 0 },
    children: [
      { type: 'Image', id: 'hall-cat', props: { src: catSrc, fit: 'contain', alt: `${v.catName}安静地陪在房间里`, meshMotion: xuetuanMotion(catSrc, room.id === 'hall' && v.itemActivity !== 'none') }, layout: { width: w, height: h } },
    ],
  };
}

/** 道具是场景实体图层；唯一的意图叠层是猫压在软垫上。命中标签独立，不借豁免掩盖冲突。 */
function placedProps(v: HallView, room: RoomSpec): LayoutNode[] {
  if (room.id !== 'hall') return [];
  return ITEM_EXPERIENCES.filter((it) => v.owned.some((o) => o.id === it.id && o.placed)).flatMap((it): LayoutNode[] => {
    const active = v.itemActivity.startsWith(`${it.id}:`);
    const done = v.itemActivity === `${it.id}:done`;
    const revealed = it.id === 'cardback-moon' && (done || (!active && (v.itemUses[it.id] ?? 0) > 0));
    const r = it.spot;
    return [
      { type: 'Panel', id: `hall-placed-${it.id}`, props: { bare: true, action: 'item.use', actionArg: it.id },
        layout: { x: r.x, y: r.y, width: r.w, height: r.h, padding: 0, ...(it.id === 'cushion' ? { allowOverlap: true } : {}) },
        children: revealed ? [{ type: 'PlayingCard', id: 'prop-moon-revealed', props: { rank: '', suit: '☾', face: 'light', size: 'sm', faceUp: true }, layout: { width: 50, height: 44, rotate: -9, rotateX: 42 } }] : [{ type: 'Image', id: `prop-art-${it.id}`, props: { src: propArt(it.id), fit: 'contain', alt: it.place },
          layout: { width: r.w, height: r.h,
            ...(active && !done && it.id === 'feather' ? { fx: [{ kind: 'wobble' as const, intensity: 0.22, ms: 2100 }] } : {}),
            ...(done && it.id === 'feather' ? { rotate: 16 } : {}),
            ...(active && it.id === 'paperbag' ? { fx: [{ kind: 'wobble' as const, intensity: done ? 0.1 : 0.04, ms: 1600 }] } : {}),
          } }],
      },
      hotzone(`prop-label-${it.id}`, active ? '正在陪伴' : it.invite, 'item.use', it.labelSpot, { arg: it.id, tone: 'normal' }),
    ];
  });
}

function catCaption(v: HallView, room: RoomSpec): LayoutNode {
  const active = room.id === 'hall' ? ITEM_EXPERIENCES.find((it) => v.itemActivity.startsWith(`${it.id}:`)) : undefined;
  const done = active !== undefined && v.itemActivity === `${active.id}:done`;
  return { type: 'Panel', id: 'hall-cat-caption', props: { bg: 'raised', edge: 'gold' },
    layout: { x: 276, y: 612, width: 448, direction: 'column', gap: 3, padding: 8, align: 'center' }, visibleWhen: NOT_STAGE_ONLY,
    children: [
      { type: 'Label', id: 'hall-mood', props: { text: `${v.catName} · ${active ? (done ? '一起留下了小回忆' : active.invite) : v.moodPhrase}`, size: 'sm', bold: true, color: 'text' } },
      { type: 'Label', id: 'hall-cat-line', props: { text: active ? (done ? active.finished : active.waiting) : v.catLine, size: 'xs', color: 'text' } },
      ...(active ? [{ type: 'Panel', id: 'item-response-row', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' }, children: [
        ...(!done ? [{ type: 'Button', id: 'item-respond', props: { label: active.response, kind: 'primary', action: 'item.respond', actionArg: active.id } } as LayoutNode] : []),
        { type: 'Button', id: 'item-cancel', props: { label: done ? '记住这一刻' : '让它歇一会儿', kind: 'ghost', action: 'item.cancel' } } as LayoutNode,
      ] } as LayoutNode] : []),
    ] };
}

/** 舞台上的全部东西（房间画 + 木牌 + 星砂罐 + 门 + 物件 + 猫 + 回馆纸条 + 沉浸出口）。 */
function stageChildren(v: HallView, room: RoomSpec): LayoutNode[] {
  const next = loopPrompt(v);
  return [
    // 左上：房名木牌 = 馆图入口（画里的东西·不是菜单）
    sign('room-sign', `${two(room.number)} · ${room.name}`, 'map.open', { x: 16, y: 14, tag: '馆图', visibleWhen: NOT_STAGE_ONLY }),
    // 右上：星砂罐 + 生成状态 + 只看它（都在画里·右上角壳层 ⚙ 在舞台之外）
    {
      type: 'Panel', id: 'hall-hud', props: { bg: 'raised', edge: 'gold' },
      layout: { x: 490, y: 14, width: 494, direction: 'row', gap: 8, padding: 6, align: 'center', justify: 'end' },
      visibleWhen: NOT_STAGE_ONLY,
      children: [
        { type: 'Label', id: 'hall-stardust', props: { text: `星砂 ${v.stardust}`, size: 'md', bold: true, color: 'text' } },
        { type: 'Label', id: 'hall-heartlight', props: { text: `心光 ${v.relations.heartlight}`, size: 'sm', color: 'text' } },
        {
          type: 'Panel', id: 'hall-catalog', props: { bg: 'raised', edge: 'gold', action: 'catalog.open' },
          layout: { padding: 6, press3d: true },
          children: [{ type: 'Label', id: 'hall-catalog-label', props: { text: 'Gallery 图鉴', size: 'sm', bold: true, color: 'text' } }],
        },
        {
          type: 'Panel', id: 'hall-stage-hide', props: { bg: 'raised', edge: 'gold', action: 'ui.hide' },
          layout: { padding: 6, press3d: true },
          children: [{ type: 'Label', id: 'hall-stage-hide-label', props: { text: '只看它', size: 'sm', bold: true, color: 'text' } }],
        },
        {
          type: 'Panel', id: 'hall-settings', props: { bg: 'raised', edge: 'gold', action: 'settings.open' },
          layout: { padding: 6, press3d: true },
          children: [{ type: 'Label', id: 'hall-settings-label', props: { text: '设置', size: 'sm', bold: true, color: 'text' } }],
        },
      ],
    },
    // 回馆纸条（有离线小事件才在树里·一句可展开说明·看过即收）
    ...(v.offlineEvents.length > 0 ? [{
      type: 'Panel', id: 'hall-offline', props: { bg: 'raised', edge: 'gold' },
      layout: { x: 300, y: 74, width: 400, direction: 'column', gap: 6, padding: 12 },
      visibleWhen: NOT_STAGE_ONLY,
      children: [
        { type: 'Label', id: 'hall-offline-cap', props: { text: '你不在的时候', size: 'sm', bold: true, color: 'gold' } },
        ...v.offlineEvents.map((t, i): LayoutNode => ({ type: 'Label', id: `hall-offline-${i}`, props: { text: t, size: 'md', color: 'text' } })),
        {
          type: 'Panel', id: 'hall-offline-ack', props: { bg: 'raised', edge: 'gold', action: 'offline.ack' },
          layout: { padding: 6, align: 'center', press3d: true },
          children: [{ type: 'Label', id: 'hall-offline-ack-label', props: { text: '看过了', size: 'sm', bold: true, color: 'text' } }],
        },
      ],
    } as LayoutNode] : []),
    // 门：去相邻房（与 ROOMS.adjacent 一一对应）
    ...room.doors.map((d) => hotzone(`door-${d.to}`, `→ ${d.label}`, 'room.enter', d, { arg: d.to })),
    // 物件：活动入口
    ...room.objects.map((o) => hotzone(`hot-${o.id}`, o.label, o.action, o, {
      ...(o.arg !== undefined ? { arg: o.arg } : {}),
      tone: 'normal',
    })),
    ...(room.id === 'hall' ? [hotzone('hall-loop-next', next.label, next.action, { x: 762, y: 641, w: 204, h: 46 }, { tone: 'normal' })] : []),
    ...placedProps(v, room),
    // 猫（固定猫位·点猫 = 呼唤）
    catLayer(v, room),
    catCaption(v, room),
    // 沉浸模式里唯一的键（只在 Flag 开时在树里·由 resolveBindings 剔/留）
    sign('hall-stage-show', '显示界面', 'ui.show', { x: 440, y: SCENE_H - 54, visibleWhen: STAGE_ONLY_FLAG }),
  ];
}

/** 房间舞台 = 一张房间画（Panel.skin cover）+ 画里的一切；无图回退主题 sunken 面（兜底不丢）。 */
function stageNode(v: HallView, room: RoomSpec, overlay?: LayoutNode): LayoutNode {
  const skin = sceneSkin(room.scene);
  return {
    type: 'Panel', id: 'hall-stage', props: { bg: 'sunken', vignette: true, ...(skin !== undefined ? { skin } : {}) },
    layout: { width: SCENE_W, height: SCENE_H, radius: 18, padding: 0 },
    children: overlay ? [overlay] : stageChildren(v, room),
  };
}

/** 子功能也属于舞台：书页 / 货架使用同一坐标系，不挂窗口外 Drawer。 */
export function buildScene(v: HallView, roomId: RoomId, overlay?: LayoutNode): LayoutNode {
  const room = roomOf(roomId) ?? roomOf('hall')!;
  return {
    type: 'Screen', id: `scene-${room.id}`, props: { bg: 'ink' },
    children: [
      {
        type: 'Panel', id: 'stage-frame', props: { bare: true },
        layout: { direction: 'column', align: 'center', padding: 10 },
        children: [stageNode(v, room, overlay)],
      },
    ],
  };
}

// ── ③ 馆图（00 全馆剖面·画里直接点房间·画里的木牌回猫身边）──────────────────
export function buildMap(activeRoom: RoomId): LayoutNode {
  const skin = mapSkin();
  return {
    type: 'Screen', id: 'scene-map', props: { bg: 'ink' },
    children: [{
      type: 'Panel', id: 'stage-frame', props: { bare: true },
      layout: { direction: 'column', align: 'center', padding: 10 },
      children: [{
        type: 'Panel', id: 'map-cutaway', props: { bg: 'sunken', vignette: true, ...(skin !== undefined ? { skin } : {}) },
        layout: { width: 960, height: 540, radius: 16, padding: 0 },
        children: [
          ...ROOMS.map((room): LayoutNode => ({
            type: 'Panel', id: `map-room-${room.id}`,
            props: { bg: 'transparent', action: 'room.enter', actionArg: room.id, accent: room.id === activeRoom },
            layout: { x: room.mapRect.x + 3, y: room.mapRect.y + 3, width: room.mapRect.w - 8, height: room.mapRect.h - 8, direction: 'column', align: 'center', justify: 'end', padding: 0, press3d: true },
            children: [readableChip(
              `map-room-${room.id}-tag`,
              `${two(room.number)} ${room.name}${room.id === activeRoom ? ' · 雪团在这里' : ''}`,
              room.id === activeRoom,
            )],
          })),
          sign('map-back', '回到雪团身边', 'hall.back', { x: 16, y: 14 }),
          {
            ...readableChip('map-hint', '直接点图里的房间', true),
            layout: { x: 780, y: 18, padding: 5, radius: 10 },
          },
        ],
      }],
    }],
  };
}

// ── ④ 馆里的册页：画内实物近景；内容独立滚动，合册始终可见 ──────────────────
function drawer(id: string, title: string, children: LayoutNode[], _side: 'right' | 'bottom' = 'right', closeAction = 'hall.back'): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: 'raised', edge: 'gold' },
    layout: { x: 90, y: 48, width: 820, height: 618, padding: 0, radius: 8 },
    children: [{ type: 'Panel', id: `${id}-cover`, props: { skin: sceneSkin('folio'), bg: 'raised' },
      layout: { x: 0, y: 0, width: 820, height: 618, padding: 0, radius: 8 }, children: [
      { type: 'Panel', id: `${id}-header`, props: { bare: true },
        layout: { x: 54, y: 36, width: 714, height: 46, direction: 'row', align: 'center', justify: 'between', padding: 0 },
        children: [heading(`${id}-title`, title), backBtn(`${id}-close`, closeAction === 'memory.back' ? '合上这一页' : '合上册子', closeAction)] },
      { type: 'Panel', id: `${id}-pages`, props: { bare: true, scroll: true },
        layout: { x: 54, y: 106, width: 714, height: 456, direction: 'column', gap: 14, padding: 4 }, children },
    ] }],
  };
}

export function buildOrbs(v: HallView, registry: CatRegistry): LayoutNode {
  const cat = CATS.find((c) => c.id === v.catId);
  return drawer('orbs-drawer', '晶球厅 · 猫咪名册', [
    subLabel('orbs-sub', '每一颗晶球都是一个记忆入口，不是囚禁灵魂。'),
    { type: 'Button', id: 'orbs-catalog', props: { label: '打开 Gallery · 猫咪图鉴', kind: 'ghost', action: 'catalog.open' } },
    {
      type: 'Panel', id: 'orbs-row', props: { bare: true },
      layout: { direction: 'column', gap: 14 },
      children: [
        {
          type: 'Panel', id: `orb-${v.catId}`, props: { bg: 'raised' },
          layout: { direction: 'column', gap: 8, padding: 14, press3d: true },
          children: [
            {
              type: 'Panel', id: `orb-${v.catId}-head`, props: { bare: true },
              layout: { direction: 'row', gap: 10, align: 'center' },
              children: [
                { type: 'Avatar', id: `orb-${v.catId}-av`, props: { name: v.catName, src: catArt(v.catId), size: 56, shape: 'circle', ring: { value: v.relations.closeness, max: 100, tone: 'gold' } } },
                {
                  type: 'Panel', id: `orb-${v.catId}-id`, props: { bare: true },
                  layout: { direction: 'column', gap: 3 },
                  children: [
                    { type: 'Label', id: `orb-${v.catId}-name`, props: { text: v.catName, size: 'lg', bold: true, font: 'cnround', color: 'text' } },
                    { type: 'Tag', id: `orb-${v.catId}-breed`, props: { label: `${cat?.breed ?? ''} · 官方猫`, tone: 'accent' } },
                  ],
                },
              ],
            },
            ...RELATIONS.filter((r) => r.key !== 'mood' && r.key !== 'heartlight').map((r): LayoutNode => ({
              type: 'ProgressBar', id: `orb-${v.catId}-${r.key}`,
              props: { value: v.relations[r.key], max: r.max, tone: r.key === 'closeness' ? 'gold' : 'ok', label: r.name, showValue: true },
            })),
            { type: 'Label', id: `orb-${v.catId}-heart`, props: { text: `心光 ${v.relations.heartlight}`, size: 'sm', color: 'gold' } },
            { type: 'Button', id: `orb-${v.catId}-go`, props: { label: '去陪它', kind: 'primary', action: 'hall.back' } },
          ],
        },
        {
          type: 'Panel', id: 'orb-empty', props: { bg: 'sunken', dashed: true },
          layout: { direction: 'column', gap: 8, padding: 14, align: 'center', justify: 'center' },
          children: [
            { type: 'Label', id: 'orb-empty-title', props: { text: '我的猫咪登记簿', size: 'lg', bold: true, color: 'text' } },
            subLabel('orb-empty-sub', '这只是本机保存的名字与回忆；上传照片和数字形象尚未开放。'),
            ...registry.entries.map((e): LayoutNode => ({
              type: 'Panel', id: `registered-${e.id}`, props: { bg: 'raised' },
              layout: { direction: 'column', gap: 5, padding: 10 },
              children: [
                { type: 'Label', id: `registered-${e.id}-name`, props: { text: e.name, size: 'md', bold: true, color: 'text' } },
                subLabel(`registered-${e.id}-state`, WHEREABOUTS.find((s) => s.id === e.whereabouts)?.label ?? ''),
                ...(e.note ? [subLabel(`registered-${e.id}-note`, e.note)] : []),
                { type: 'Button', id: `registered-${e.id}-remove`, props: { label: '删除这页', kind: 'ghost', action: 'registration.remove', actionArg: e.id } },
              ],
            })),
            { type: 'Button', id: 'orb-registration-open', props: { label: '去前台登记', kind: 'primary', action: 'registration.open' } },
          ],
        },
      ],
    },
  ]);
}

/** 第八个功能入口：文字目录 + 布偶猫待审样本；其余品种不伪造图。 */
export function buildCatalog(browse: CatalogBrowse = EMPTY_CATALOG_BROWSE): LayoutNode {
  const result = catalogPage(browse);
  const sources: readonly { id: CatalogSource; label: string }[] = [
    { id: 'all', label: '全部' }, { id: 'TICA', label: 'TICA' }, { id: 'CFA', label: 'CFA 补充' }, { id: 'FIFe', label: 'FIFe 补充' },
  ];
  return drawer('catalog-drawer', 'Gallery · 猫咪图鉴', [
    { type: 'Panel', id: 'catalog-intro', props: { bare: true }, layout: { direction: 'column', gap: 5 },
      children: [
        heading('catalog-heading', '猫咪文字库与试作'),
        subLabel('catalog-scope', `${CAT_BREEDS.length} 个目录条目 · 布偶猫待审试作 ${CAT_GALLERY.imageRecords.length} 张`),
        subLabel('catalog-note', '品相指毛色、花纹、耳尾等中性外观，不评“好坏”或“纯不纯”。家猫也有自己的位置。'),
      ] },
    {
      type: 'Panel', id: 'catalog-ragdoll-study', props: { bg: 'raised', edge: 'gold' },
      layout: { direction: 'column', gap: 6, padding: 10 },
      children: [
        { type: 'Label', id: 'catalog-ragdoll-title', props: { text: '布偶猫 · 2 只角色 / 6 个年龄格', size: 'md', bold: true, color: 'text' } },
        { type: 'Image', id: 'catalog-ragdoll-board', props: { src: CAT_GALLERY.ragdollConceptBoard.path, fit: 'contain', alt: '公猫和母猫各有幼猫、成年猫、年长猫三个阶段的绘本风格对照板' }, layout: { width: 300, height: 200 } },
        subLabel('catalog-ragdoll-board-note', '上图是绘本风格方向板；下方是逐只透明技术试作。'),
        subLabel('catalog-ragdoll-status', '六格均有方向稿，但全部需修订，尚未通过美术审核。'),
        { type: 'Panel', id: 'catalog-ragdoll-images', props: { bare: true }, layout: { direction: 'grid', minCol: 96, gap: 4 },
          children: RAGDOLL_IMAGES.map((image): LayoutNode => ({
            type: 'Panel', id: `catalog-image-card-${image.imageId}`, props: { bare: true },
            layout: { direction: 'column', gap: 2, width: 96, align: 'center' },
            children: [
              { type: 'Image', id: `catalog-image-${image.imageId}`, props: { src: image.path, fit: 'contain', alt: `布偶猫${image.sex}猫${image.ageStage}待审图` }, layout: { width: 88, height: 98 } },
              { type: 'Label', id: `catalog-image-label-${image.imageId}`, props: { text: `${image.sex} · ${image.ageStage}`, size: 'xs', color: 'text' } },
            ],
          })) },
        subLabel('catalog-ragdoll-personality', '性格独立于性别和品种：好奇 / 谨慎 / 黏人 / 独立 / 好胜 / 贪玩 / 耐心。'),
        ...CAT_GALLERY.ragdollCharacters.map((cat, index): LayoutNode =>
          subLabel(`catalog-ragdoll-character-${index}`, `${index === 0 ? 'A' : 'B'} · ${cat.playCue}`)),
      ],
    },
    {
      type: 'Panel', id: 'catalog-axes', props: { bg: 'raised', edge: 'gold' },
      layout: { direction: 'column', gap: 5, padding: 10 },
      children: [
        { type: 'Label', id: 'catalog-axes-title', props: { text: '未来图片矩阵的分类轴', size: 'md', bold: true, color: 'text' } },
        subLabel('catalog-age', `年龄：${CAT_GALLERY.dimensions.ageStage.join(' / ')}`),
        subLabel('catalog-size', `体型：${CAT_GALLERY.dimensions.bodySize.join(' / ')}`),
        subLabel('catalog-sex', `性别：${CAT_GALLERY.dimensions.sex.join(' / ')}`),
        subLabel('catalog-temperament', `性格：${CAT_GALLERY.dimensions.temperament.join(' / ')}`),
        subLabel('catalog-appearance', '外观：毛长 / 底色 / 花纹 / 白斑 / 耳形 / 尾形 / 眼色'),
      ],
    },
    { type: 'Input', id: 'catalog-query', props: { placeholder: '搜索中文名或英文名', value: browse.query, action: 'catalog.search' } },
    { type: 'Panel', id: 'catalog-sources', props: { bare: true }, layout: { direction: 'row', gap: 5 },
      children: sources.map((s): LayoutNode => ({ type: 'Button', id: `catalog-source-${s.id}`, props: { label: s.label, kind: browse.source === s.id ? 'primary' : 'ghost', action: 'catalog.source', actionArg: s.id } })) },
    subLabel('catalog-count', `找到 ${result.total} 项 · 第 ${result.page + 1}/${result.pages} 页`),
    ...(result.entries.length === 0 ? [subLabel('catalog-empty', '没有匹配条目，可以清空搜索词。')] : result.entries.map((b): LayoutNode => ({
      type: 'Panel', id: `catalog-breed-${b.id}`, props: { bg: 'raised', edge: b.nonPedigree ? 'jade' : 'gold' },
      layout: { direction: 'column', gap: 3, padding: 8 },
      children: [
        { type: 'Label', id: `catalog-breed-${b.id}-zh`, props: { text: b.zh, size: 'md', bold: true, color: 'text' } },
        subLabel(`catalog-breed-${b.id}-en`, `${b.en} · ${b.source}${b.variantOf ? ' · 变体' : ''}${b.nonPedigree ? ' · 非纯种分类' : ''}`),
      ],
    }))),
    { type: 'Panel', id: 'catalog-pages', props: { bare: true }, layout: { direction: 'row', gap: 8 },
      children: [
        { type: 'Button', id: 'catalog-prev', props: { label: '上一页', kind: 'ghost', action: 'catalog.page', actionArg: String(result.page - 1), disabled: result.page === 0 } },
        { type: 'Button', id: 'catalog-next', props: { label: '下一页', kind: 'ghost', action: 'catalog.page', actionArg: String(result.page + 1), disabled: result.page >= result.pages - 1 } },
      ] },
    { type: 'Panel', id: 'catalog-outro', props: { bare: true }, layout: { direction: 'column', gap: 8 },
      children: [
        subLabel('catalog-image-notice', '当前仅有布偶猫待审试作，其余品种无图；试作不会替换房间里的雪团。'),
        backBtn('catalog-back'),
      ] },
  ]);
}

// 星牌桌：🟡 牌规待 owner 对定·只留接口位
export function buildTable(v: HallView): LayoutNode {
  return drawer('table-drawer', '星牌桌', [
    {
      type: 'Panel', id: 'table-stage', props: { bg: 'raised', edge: 'gold' },
      layout: { direction: 'column', gap: 8, padding: 16, align: 'center' },
      children: [
        ...(v.owned.some((it) => it.id === 'cardback-moon' && it.placed) ? [
          { type: 'Image', id: 'table-moon-deck', props: { src: propArt('cardback-moon'), fit: 'contain', alt: '已换上的月相牌背' }, layout: { width: 160, height: 104 } } as LayoutNode,
          { type: 'Button', id: 'table-moon-use', props: { label: '和雪团翻一张月亮', kind: 'primary', action: 'item.use', actionArg: 'cardback-moon' } } as LayoutNode,
        ] : []),
        { type: 'Label', id: 'table-note', props: { text: TABLE_PLACEHOLDER, size: 'md', color: 'text' } },
        subLabel('table-sub', `规则定稿后这里是：${v.catName} → 三个星盘 → 你的手牌 → 双方星光。`),
      ],
    },
    backBtn('table-back'),
  ], 'bottom');
}

export function buildToys(v: HallView): LayoutNode {
  return drawer('toys-drawer', '收纳篮 · 带回来的小东西', [
    subLabel('toys-intro', '摆进主厅以后，可以直接点物件陪雪团玩。收回不会丢失。'),
    ...(v.owned.length === 0
      ? [
          subLabel('toys-empty', '还没有玩具。星砂铺里有羽毛杆和纸袋。'),
          { type: 'Button', id: 'toys-shop', props: { label: '去星砂铺', kind: 'primary', action: 'shop.open' } } as LayoutNode,
        ]
      : v.owned.map((it): LayoutNode => ({
          type: 'Panel', id: `toy-${it.id}`, props: { bare: true },
          layout: { direction: 'column', gap: 8, padding: 12 },
          children: [
            {
              type: 'Panel', id: `toy-${it.id}-l`, props: { bare: true },
              layout: { direction: 'row', gap: 8, align: 'center' },
              children: [
                { type: 'Image', id: `toy-${it.id}-art`, props: { src: propArt(it.id), fit: 'contain', alt: it.name }, layout: { width: 90, height: 78 } },
                { type: 'Label', id: `toy-${it.id}-name`, props: { text: it.name, size: 'lg', bold: true, color: 'text' } },
              ],
            },
            subLabel(`toy-${it.id}-spot`, experienceOf(it.id) !== undefined
              ? `${it.placed ? '已安放' : '可安放'}：${experienceOf(it.id)!.place}`
              : '已收进馆藏；场景摆放与猫咪互动尚待制作。'),
            ...((v.itemUses[it.id] ?? 0) > 0 ? [subLabel(`toy-${it.id}-trace`, experienceOf(it.id)?.trace ?? '')] : []),
            ...(experienceOf(it.id) === undefined ? [] : [{ type: 'Panel', id: `toy-${it.id}-actions`, props: { bare: true }, layout: { direction: 'row', gap: 8 }, children: it.placed ? [
              { type: 'Button', id: `toy-${it.id}-use`, props: { label: experienceOf(it.id)?.invite ?? '一起玩', kind: 'primary', action: 'item.use', actionArg: it.id } },
              { type: 'Button', id: `toy-${it.id}-remove`, props: { label: '收回篮里', kind: 'ghost', action: 'decor.remove', actionArg: it.id } },
            ] : [{ type: 'Button', id: `toy-${it.id}-place`, props: { label: '放到馆里', kind: 'primary', action: 'decor.place', actionArg: it.id } }] } as LayoutNode]),
          ],
        }))),
    backBtn('toys-back'),
    { type: 'Button', id: 'toys-more', props: { label: '去星砂铺看看', kind: 'ghost', action: 'shop.open' } },
  ]);
}

export function buildShop(v: HallView, selectedItemId = 'paperbag', browse: ShopBrowse = EMPTY_SHOP_BROWSE): LayoutNode {
  const merchantSrc = shopkeeperArt();
  const result = shopPage(browse);
  const selected = result.entries.find((it) => it.id === selectedItemId) ?? result.entries[0];
  const selectedOwned = selected !== undefined ? v.owned.find((o) => o.id === selected.id) : undefined;
  const affordable = selected !== undefined && v.stardust >= selected.price;
  const welcome = STARDUST_GRANTS[0];
  const welcomeClaimed = v.claimedGrants.includes(welcome.id);
  const welcomeAmount = Math.min(welcome.amount, STARDUST_MAX - v.stardust);
  const categoryName = (id: string): string => SHOP_CATEGORIES.find((c) => c.id === id)?.name ?? '猫用物件';
  return {
    type: 'Panel', id: 'shop-drawer', props: { bg: 'raised' },
    layout: { x: 0, y: 0, width: SCENE_W, height: SCENE_H, padding: 0, radius: 18 },
    children: [{ type: 'Panel', id: 'shop-counter-art', props: { skin: sceneSkin('shop-counter'), bg: 'raised' },
      layout: { x: 0, y: 0, width: SCENE_W, height: SCENE_H, padding: 0, radius: 18 }, children: [
      sign('shop-back', '收起货单 · 回馆里', 'hall.back', { x: 26, y: 25 }),
      { ...readableChip('shop-stardust', `钱袋里 · 星砂 ${v.stardust}`), layout: { x: 768, y: 25, padding: 8, radius: 4 } },
      { type: 'Panel', id: 'shop-category-shelf', props: { bg: 'raised', edge: 'gold' },
        layout: { x: 20, y: 91, width: 171, direction: 'column', gap: 3, padding: 7, radius: 10 },
        children: [
          { type: 'Label', id: 'shop-category-heading', props: { text: '货架分类', size: 'sm', bold: true, color: 'gold' } },
          ...SHOP_CATEGORIES.map((c): LayoutNode => ({ type: 'Panel', id: `shop-category-${c.id}`,
            props: { bg: browse.category === c.id ? 'sunken' : 'raised', action: 'shop.category', actionArg: c.id },
            layout: { padding: 4, radius: 5, press3d: true },
            children: [{ type: 'Label', id: `shop-category-${c.id}-label`, props: { text: c.name, size: 'sm', bold: browse.category === c.id, color: 'text' } }],
          })),
        ] },
      { type: 'Image', id: 'shopkeeper-cat', props: { src: merchantSrc, fit: 'contain', alt: '坐在柜台边、眯着琥珀色眼睛的玳瑁猫掌柜', meshMotion: shopkeeperMotion(merchantSrc) },
        layout: { x: 28, y: 496, width: 152, height: 149 } },
      { ...readableChip('shopkeeper-name', '玳瑁掌柜 · 慢慢挑'), layout: { x: 23, y: 653, padding: 5, radius: 5 } },
      { type: 'Panel', id: 'shop-ledger', props: { bg: 'raised', edge: 'gold' },
        layout: { x: 210, y: 88, width: 776, height: 555, padding: 0, radius: 12 }, children: [
          { type: 'Input', id: 'shop-search', props: { placeholder: '找名字或编号 T001', value: browse.query, action: 'shop.search' },
            layout: { x: 13, y: 12, width: 272 } },
          ...SHOP_VALUES.map((o, i): LayoutNode => ({ type: 'Button', id: `shop-value-${o.id}`,
            props: { label: o.name, kind: browse.value === o.id ? 'primary' : 'ghost', action: 'shop.value', actionArg: o.id },
            layout: { x: 314 + i * 113, y: 12, width: 107 } })),
          ...SHOP_SORTS.map((o, i): LayoutNode => ({ type: 'Button', id: `shop-sort-${o.id}`,
            props: { label: o.name, kind: browse.sort === o.id ? 'primary' : 'ghost', action: 'shop.sort', actionArg: o.id },
            layout: { x: 14 + i * 114, y: 58, width: 108 } })),
          { type: 'Label', id: 'shop-count', props: { text: `${result.total} 件 · 第 ${result.page + 1}/${result.pages} 页`, size: 'sm', bold: true, color: 'text' },
            layout: { x: 561, y: 64 } },
          ...result.entries.map((it, i): LayoutNode => {
            const owned = v.owned.some((o) => o.id === it.id);
            return { type: 'Panel', id: `shop-${it.id}`,
              props: { bg: it.id === selected?.id ? 'sunken' : 'raised', edge: 'gold', action: 'shop.inspect', actionArg: it.id },
              layout: { x: 13 + (i % 2) * 222, y: 110 + Math.floor(i / 2) * 136, width: 208, height: 122,
                direction: 'row', gap: 4, padding: 5, radius: 8, press3d: true },
              children: [
                { type: 'Image', id: `shop-${it.id}-art`, props: { src: propArt(it.id), fit: 'contain', alt: it.name }, layout: { width: 90, height: 105 } },
                { type: 'Panel', id: `shop-${it.id}-words`, props: { bare: true }, layout: { width: 101, direction: 'column', gap: 5, justify: 'center' }, children: [
                  { type: 'Label', id: `shop-${it.id}-name`, props: { text: it.name, size: 'sm', bold: true, color: 'text' } },
                  { type: 'Label', id: `shop-${it.id}-price`, props: { text: owned ? '已拥有' : `${it.price} 星砂`, size: 'sm', color: 'gold' } },
                  { type: 'Label', id: `shop-${it.id}-code`, props: { text: it.id, size: 'xs', color: 'sub' } },
                ] },
              ] };
          }),
          { type: 'Panel', id: 'shop-product-detail', props: { bg: 'sunken', edge: 'gold' },
            layout: { x: 466, y: 110, width: 295, height: 394, direction: 'column', gap: 6, padding: 10, radius: 9, align: 'center' },
            children: selected === undefined ? [subLabel('shop-empty', '这组条件下没有物件，换个分类或价位看看。')] : [
              { type: 'Image', id: 'shop-selected-art', props: { src: propArt(selected.id), fit: 'contain', alt: selected.name }, layout: { width: 222, height: 154 } },
              heading('shop-title', selected.name),
              subLabel('shop-detail', `${selected.id} · ${categoryName(selected.category)} · ${selected.price} 星砂`),
              subLabel('shop-sub', selected.blurb),
              ...(selectedOwned !== undefined
                ? [selected.placement === 'scene'
                    ? { type: 'Button', id: 'shop-selected-place', props: { label: selectedOwned.placed ? '回主厅一起用' : '放进馆里看看', kind: 'primary', action: selectedOwned.placed ? 'item.use' : 'decor.place', actionArg: selected.id } } as LayoutNode
                    : { type: 'Button', id: 'shop-selected-collection', props: { label: '已带回 · 查看收纳篮', kind: 'primary', action: 'toys.open' } } as LayoutNode]
                : affordable
                  ? [{ type: 'Button', id: 'shop-selected-buy', props: { label: `用 ${selected.price} 星砂交换`, kind: 'primary', action: 'shop.buy', actionArg: selected.id } } as LayoutNode]
                  : [readableChip('shop-selected-shortfall', `还差 ${selected.price - v.stardust} 星砂`)]),
              ...(welcomeClaimed
                ? [subLabel('shop-welcome-claimed', '见面星砂已领 · 陪猫会继续得到星砂')]
                : welcomeAmount > 0
                  ? [{ type: 'Button', id: 'shop-welcome-claim', props: { label: `领见面星砂 +${welcomeAmount}`, kind: 'ghost', action: 'shop.claimWelcome' } } as LayoutNode]
                  : [subLabel('shop-welcome-full', '星砂罐满了，稍后再领')]),
              subLabel('shop-promise', selected.placement === 'collection'
                ? '掌柜：先替你收好。摆放和逗猫玩法会慢慢补上。'
                : '掌柜：不卖心光，也不卖回忆。喜欢，再交换。'),
            ] },
          { type: 'Button', id: 'shop-page-prev', props: { label: '← 上一页', kind: 'ghost', action: 'shop.page', actionArg: String(result.page - 1), disabled: result.page === 0 },
            layout: { x: 260, y: 519 } },
          { type: 'Button', id: 'shop-page-next', props: { label: '下一页 →', kind: 'ghost', action: 'shop.page', actionArg: String(result.page + 1), disabled: result.page + 1 >= result.pages },
            layout: { x: 361, y: 519 } },
        ] },
    ] }],
  };
}

export function buildMemory(v: HallView): LayoutNode {
  return drawer('memory-drawer', '回忆廊', [
    subLabel('memory-sub', '心光会让晶球里的片段慢慢发亮。今天不想看的，可以先不看。'),
    {
      type: 'Panel', id: 'memory-list', props: { bare: true },
      layout: { direction: 'column', gap: 10 },
      children: v.chapters.map((c): LayoutNode => ({
        type: 'Panel', id: `chap-${c.id}`, props: { bg: c.unlocked ? 'raised' : 'sunken' },
        layout: { direction: 'column', gap: 8, padding: 12 },
        children: [
          { type: 'Label', id: `chap-${c.id}-title`, props: { text: c.title, size: 'lg', bold: true, color: 'text' } },
          subLabel(`chap-${c.id}-hint`, c.hint),
          {
            type: 'Panel', id: `chap-${c.id}-badges`, props: { bare: true },
            layout: { direction: 'row', gap: 6, align: 'center' },
            children: [
              { type: 'Badge', id: `chap-${c.id}-state`, props: { text: c.unlocked ? '已发光' : `心光 ${c.need} 时发亮`, tone: c.unlocked ? 'gold' : 'dim' } },
              // 敏感章节先给控制权（GDD §2.3·S66）：标出来，玩家今天可以选择不看。
              ...(c.sensitive ? [{ type: 'Badge', id: `chap-${c.id}-sensitive`, props: { text: '可能触动情绪·可跳过', tone: 'warn' } } as LayoutNode] : []),
            ],
          },
          { type: 'Button', id: `chap-${c.id}-read`, props: { label: '看它的回忆', kind: c.unlocked ? 'primary' : 'ghost', action: 'memory.read', actionArg: c.id, disabled: !c.unlocked } },
        ],
      })),
    },
    backBtn('memory-back'),
  ]);
}

/** 章节阅读 = 底部台词框（VN chrome·房间仍在身后）。 */
export function buildReading(r: ReadingView): LayoutNode {
  const isChoice = r.options !== undefined;
  return drawer('reading-drawer', r.title, [
    {
      type: 'Panel', id: 'reading-body', props: { bare: true },
      layout: { direction: 'column', gap: 10 },
      children: [
        {
          type: 'dialog', id: 'reading-dialog',
          // 终点借现有 choice 态表达「不可推进」：不显示 ▶，也不发 dialogue.advance；出口只留页脚返回键。
          props: { speaker: r.speaker, text: r.ended && r.text === '' ? '（这段回忆到这里。）' : r.text, kind: isChoice || r.ended ? 'choice' : 'line', typewriter: 18, edge: 'gold' },
        },
        ...(isChoice ? [{
          type: 'Panel', id: 'reading-choices-wrap', props: { bare: true },
          layout: { direction: 'column', align: 'center' },
          children: [{
            type: 'choiceList', id: 'reading-choices',
            props: {
              options: (r.options ?? []).map((t, i) => ({ label: t, actionArg: String(i) })),
              chooseAction: 'memory.choose', optionKind: 'primary', optionShape: 'pill', hoverSheen: true,
            },
          }],
        } as LayoutNode] : []),
        ...(r.ended ? [{ type: 'Label', id: 'reading-end', props: { text: '（这段回忆到这里。它还在你身边。）', size: 'sm', color: 'text' } } as LayoutNode] : []),
      ],
    },
    {
      type: 'Panel', id: 'reading-foot', props: { bare: true },
      layout: { direction: 'row', gap: 12, justify: 'center', align: 'center' },
      children: [
        ...(!isChoice && !r.ended ? [{ type: 'Button', id: 'reading-next', props: { label: '继续', kind: 'hero', action: 'memory.advance' }, layout: { fx: [{ kind: 'sheen-hover' as const }] } } as LayoutNode] : []),
        { type: 'Button', id: 'reading-back', props: { label: '回到回忆廊', kind: r.ended ? 'primary' : 'ghost', action: 'memory.back' } },
      ],
    },
  ], 'bottom', 'memory.back');
}

export function buildSettings(): LayoutNode {
  return drawer('settings-drawer', '设置与隐私', [
    subLabel('settings-sub', '音画 · 辅助 · 生成与存储 · 隐私中心 · 导出与删除——上传功能开放后在这里管理照片与视频。'),
    { type: 'Label', id: 'settings-note', props: { text: '目前的进度只存在这台设备上。生成暂停不影响基础陪伴。', size: 'md', color: 'text' } },
    backBtn('settings-back'),
  ]);
}
export function buildAbout(): LayoutNode {
  return page('about', [
    heading('about-title', '关于星尾馆'),
    { type: 'Label', id: 'about-1', props: { text: '喵星不是天堂的宗教定义，而是一个温柔的幻想世界：所有被记住的猫，都可能在这里留下星光一样的痕迹。', size: 'md', color: 'text' } },
    { type: 'Label', id: 'about-2', props: { text: '这里不制造第二次失去：没有死亡、饥饿惩罚、断签退化或限时告别。', size: 'md', color: 'text' } },
    subLabel('about-3', `数据驱动骨架 · ${GAME_ID}`),
    backBtn('about-back', '回到标题', 'home.enter'),
  ]);
}

/** 屏 → 树（宿主唯一入口·纯查表）。子功能 = 当前房间舞台 + 叠层。 */
export function buildScreen(o: { screen: Screen; view?: HallView; reading?: ReadingView; room?: RoomId; canExit?: boolean; registry?: CatRegistry; draft?: RegistrationDraft; catalog?: CatalogBrowse; shopItem?: string; shopBrowse?: ShopBrowse }): LayoutNode {
  const v = o.view;
  const room: RoomId = o.room ?? 'hall';
  switch (o.screen) {
    case 'home': return buildHome({ canExit: o.canExit });
    case 'about': return buildAbout();
    case 'reception': return buildReception(o.registry ?? { visited: false, entries: [] }, o.draft ?? { name: '', whereabouts: 'undisclosed', note: '' });
    default: break;
  }
  if (v === undefined) return buildHome({ canExit: o.canExit });
  switch (o.screen) {
    case 'scene': return buildScene(v, room);
    case 'map': return buildMap(room);
    case 'orbs': return buildScene(v, room, buildOrbs(v, o.registry ?? { visited: false, entries: [] }));
    case 'catalog': return buildScene(v, room, buildCatalog(o.catalog));
    case 'table': return buildScene(v, room, buildTable(v));
    case 'toys': return buildScene(v, room, buildToys(v));
    case 'shop': return buildScene(v, room, buildShop(v, o.shopItem, o.shopBrowse));
    case 'memory': return buildScene(v, room, buildMemory(v));
    case 'reading': return buildScene(v, room, o.reading !== undefined ? buildReading(o.reading) : buildMemory(v));
    case 'settings': return buildScene(v, room, buildSettings());
    default: return buildScene(v, room);
  }
}
