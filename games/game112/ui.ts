// game112《星尾会客厅》—— UI 屏（全部 LayoutNode 纯数据·闭集控件·写世界只发 action 信号）。
// owner 2026-09-28 巡游版铁律：**所有按钮内嵌在画面里**——门 = 去相邻房、物件 = 活动入口、猫 = 呼唤、
// 墙上的木牌 = 馆图；没有画面外的菜单栏。子功能（晶球厅名册 / 杂货铺 / 玩具篮 / 回忆廊 / 设置）
// 以 Drawer 叠在当前房间之上（房间仍可见·点暗处即回房），章节阅读走底部 Drawer（VN 台词框）。
// 猫的位置 = 每房一个固定「猫位」（world-data ROOMS.catSpot·舞台坐标）；猫画面层 = 一块 Image（视频接管前）。
// 设计稿对齐：docs/design/game112/claude-design-spec.md · hall-framework.md v3。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildStarterHome } from '@zerocraft/engine/ui/starters/index.js';
import { catArt, mapSkin, sceneSkin } from './cat-art.js';
import { xuetuanMotion } from './cat-motion.js';
import {
  SHOP_ITEMS, RELATIONS, CATS, TABLE_PLACEHOLDER, GAME_ID, STAGE_ONLY_FLAG,
  ROOMS, roomOf, SCENE_W, SCENE_H, type RoomId, type RoomSpec,
} from './world-data.js';
import type { HallView, ReadingView } from './project.js';
import { WHEREABOUTS, type CatRegistry, type RegistrationDraft } from './registration.js';

/** 屏：scene = 当前房间（唯一的「主屏」）；map = 馆图；其余 = 叠在房间上的 Drawer。 */
export type Screen = 'home' | 'reception' | 'scene' | 'map' | 'orbs' | 'table' | 'toys' | 'shop' | 'memory' | 'reading' | 'settings' | 'about';

/** 本游戏 UI 发出的全部 action 信号（宿主接线的单一真相·测试对账用）。 */
export const UI_ACTIONS = [
  'home.enter', 'home.about', 'home.exit',
  'hall.back', 'map.open', 'room.enter', 'orbs.open', 'table.open', 'toys.open', 'shop.open', 'memory.open', 'settings.open', 'later',
  'cat.greet', 'cat.sit', 'offline.ack', 'ui.hide', 'ui.show',
  'shop.buy', 'decor.place',
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
    layout: { x: o.x, y: o.y, direction: 'row', gap: 8, padding: 8, align: 'center', press3d: true, allowOverlap: true, fx: [{ kind: 'sheen-hover' }] },
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
        layout: { width: SCENE_W, height: SCENE_H, radius: 18 },
        children: [
          sign('reception-title', '星尾馆 · 前台登记', 'registration.skip', { x: 18, y: 16, tag: '主厅入口' }),
          {
            type: 'Panel', id: 'reception-cat', props: { bg: 'transparent' },
            layout: { x: 140, y: 490, width: 126, direction: 'column', align: 'center', allowOverlap: true },
            children: [
              { type: 'Image', id: 'reception-xuetuan', props: { src: catArt('xuetuan', 'rest'), fit: 'contain', alt: '雪团在前台旁边安静等你' }, layout: { width: 126, height: 116 } },
              readableChip('reception-cat-chip', '雪团 · 星尾馆的迎客猫'),
            ],
          },
          {
            type: 'Panel', id: 'reception-ledger', props: { bg: 'raised', edge: 'gold' },
            layout: { x: 580, y: 116, width: 392, direction: 'column', gap: 8, padding: 16, radius: 16, allowOverlap: true },
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
/** 晶球物件副标 = 心光进度（陪坐的可见回报 + 「心光是什么」的现场解释·八问第 2/6 问）。纯查 view。 */
function orbSub(v: HallView): string {
  const locked = v.chapters.filter((c) => !c.unlocked).map((c) => c.need).sort((a, b) => a - b)[0];
  if (locked === undefined) return `心光 ${v.relations.heartlight} · 看它的过去`;
  return `心光 ${v.relations.heartlight} · 还差 ${Math.max(0, locked - v.relations.heartlight)} 就发光`;
}

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
    type: 'Panel', id, props: { bg: 'transparent', action, ...(o.arg !== undefined ? { actionArg: o.arg } : {}) },
    layout: {
      x: r.x, y: r.y, width: r.w, height: r.h,
      direction: 'column', gap: 4, align: 'center', justify: 'end', padding: 4,
      allowOverlap: true, radius: 14, press3d: true,
      fx: [{ kind: 'sheen-hover' }],
    },
    visibleWhen: NOT_STAGE_ONLY,
    children: [
      ...(o.sub !== undefined ? [readableChip(`${id}-sub`, o.sub)] : []),
      readableChip(`${id}-chip`, label, (o.tone ?? 'accent') === 'accent'),
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
    type: 'Panel', id: 'hall-cat-wrap', props: { bg: 'transparent', action: 'cat.greet' },
    layout: { x: room.catSpot.x, y: room.catSpot.y, width: w, direction: 'column', gap: 4, align: 'center', allowOverlap: true },
    children: [
      { type: 'Image', id: 'hall-cat', props: { src: catSrc, fit: 'contain', alt: `${v.catName}安静地陪在房间里`, meshMotion: xuetuanMotion(catSrc) }, layout: { width: w, height: h } },
      {
        type: 'Panel', id: 'hall-cat-caption', props: { bg: 'raised', edge: 'gold' },
        layout: { direction: 'column', gap: 3, padding: 6, align: 'center' },
        children: [
          { type: 'Label', id: 'hall-cat-line', props: { text: v.catLine, size: 'xs', color: 'text' } },
          { type: 'Label', id: 'hall-mood', props: { text: `${v.catName} · ${v.moodPhrase}`, size: 'xs', bold: true, color: 'text' } },
        ],
      },
      ...(room.id === 'hall' && v.owned.some((it) => it.placed) ? [{
        type: 'Panel', id: 'hall-placed', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'center', justify: 'center' },
        children: v.owned.filter((it) => it.placed).map((it): LayoutNode => ({ type: 'Tag', id: `hall-placed-${it.id}`, props: { label: it.name, tone: 'normal', size: 'sm' } })),
      } as LayoutNode] : []),
    ],
  };
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
      layout: { x: 560, y: 14, width: 424, direction: 'row', gap: 8, padding: 6, align: 'center', justify: 'end', allowOverlap: true },
      visibleWhen: NOT_STAGE_ONLY,
      children: [
        { type: 'Label', id: 'hall-stardust', props: { text: `星砂 ${v.stardust}`, size: 'md', bold: true, color: 'text' } },
        { type: 'Label', id: 'hall-gen', props: { text: '离线陪伴', size: 'xs', color: 'text' } },
        {
          type: 'Panel', id: 'hall-stage-hide', props: { bg: 'raised', edge: 'gold', action: 'ui.hide' },
          layout: { padding: 6, press3d: true, allowOverlap: true },
          children: [{ type: 'Label', id: 'hall-stage-hide-label', props: { text: '只看它', size: 'sm', bold: true, color: 'text' } }],
        },
        {
          type: 'Panel', id: 'hall-settings', props: { bg: 'raised', edge: 'gold', action: 'settings.open' },
          layout: { padding: 6, press3d: true, allowOverlap: true },
          children: [{ type: 'Label', id: 'hall-settings-label', props: { text: '设置', size: 'sm', bold: true, color: 'text' } }],
        },
      ],
    },
    // 回馆纸条（有离线小事件才在树里·一句可展开说明·看过即收）
    ...(v.offlineEvents.length > 0 ? [{
      type: 'Panel', id: 'hall-offline', props: { bg: 'raised', edge: 'gold' },
      layout: { x: 300, y: 64, width: 400, direction: 'column', gap: 6, padding: 12, allowOverlap: true },
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
      ...(o.action === 'orbs.open' ? { sub: orbSub(v) } : {}),
      tone: 'normal',
    })),
    ...(room.id === 'hall' ? [hotzone('hall-loop-next', next.label, next.action, { x: 346, y: 616, w: 306, h: 78 }, { sub: next.detail, tone: 'normal' })] : []),
    // 猫（固定猫位·点猫 = 呼唤）
    catLayer(v, room),
    // 沉浸模式里唯一的键（只在 Flag 开时在树里·由 resolveBindings 剔/留）
    sign('hall-stage-show', '显示界面', 'ui.show', { x: 440, y: SCENE_H - 54, visibleWhen: STAGE_ONLY_FLAG }),
  ];
}

/** 房间舞台 = 一张房间画（Panel.skin cover）+ 画里的一切；无图回退主题 sunken 面（兜底不丢）。 */
function stageNode(v: HallView, room: RoomSpec): LayoutNode {
  const skin = sceneSkin(room.scene);
  return {
    type: 'Panel', id: 'hall-stage', props: { bg: 'sunken', vignette: true, ...(skin !== undefined ? { skin } : {}) },
    layout: { width: SCENE_W, height: SCENE_H, radius: 18 },
    children: stageChildren(v, room),
  };
}

/** 房间屏（唯一主屏）；overlay = 叠在房间上的 Drawer（子功能）。 */
export function buildScene(v: HallView, roomId: RoomId, overlay?: LayoutNode): LayoutNode {
  const room = roomOf(roomId) ?? roomOf('hall')!;
  return {
    type: 'Screen', id: `scene-${room.id}`, props: { bg: 'ink' },
    children: [
      {
        type: 'Panel', id: 'stage-frame', props: { bare: true },
        layout: { direction: 'column', align: 'center', padding: 10 },
        children: [stageNode(v, room)],
      },
      ...(overlay !== undefined ? [overlay] : []),
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
        layout: { width: 960, height: 540, radius: 16 },
        children: [
          ...ROOMS.map((room): LayoutNode => ({
            type: 'Panel', id: `map-room-${room.id}`,
            props: { bg: 'transparent', action: 'room.enter', actionArg: room.id, accent: room.id === activeRoom },
            layout: { x: room.mapRect.x, y: room.mapRect.y, width: room.mapRect.w, height: room.mapRect.h, direction: 'column', align: 'center', justify: 'end', padding: 8, press3d: true, allowOverlap: true, ...(room.id === activeRoom ? { fx: [{ kind: 'glow', color: 'gold' as const }] } : {}) },
            children: [readableChip(
              `map-room-${room.id}-tag`,
              `${two(room.number)} ${room.name}${room.id === activeRoom ? ' · 雪团在这里' : ''}`,
              room.id === activeRoom,
            )],
          })),
          sign('map-back', '回到雪团身边', 'hall.back', { x: 16, y: 14 }),
          {
            ...readableChip('map-hint', '直接点图里的房间', true),
            layout: { x: 780, y: 18, padding: 5, radius: 10, allowOverlap: true, fx: [{ kind: 'glow', color: 'gold' }] },
          },
        ],
      }],
    }],
  };
}

// ── ④ 叠在房间上的子功能（Drawer·房间仍可见·点暗处 = 回房）──────────────────
function drawer(id: string, title: string, children: LayoutNode[], side: 'right' | 'bottom' = 'right', closeAction = 'hall.back'): LayoutNode {
  return { type: 'Drawer', id, props: { side, title, closeAction }, children };
}

export function buildOrbs(v: HallView, registry: CatRegistry): LayoutNode {
  const cat = CATS.find((c) => c.id === v.catId);
  return drawer('orbs-drawer', '晶球厅 · 猫咪名册', [
    subLabel('orbs-sub', '每一颗晶球都是一个记忆入口，不是囚禁灵魂。'),
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

// 星牌桌：🟡 牌规待 owner 对定·只留接口位
export function buildTable(v: HallView): LayoutNode {
  return drawer('table-drawer', '星牌桌', [
    {
      type: 'Panel', id: 'table-stage', props: { bg: 'raised', edge: 'gold' },
      layout: { direction: 'column', gap: 8, padding: 16, align: 'center' },
      children: [
        { type: 'Label', id: 'table-note', props: { text: TABLE_PLACEHOLDER, size: 'md', color: 'text' } },
        subLabel('table-sub', `规则定稿后这里是：${v.catName} → 三个星盘 → 你的手牌 → 双方星光。`),
      ],
    },
    backBtn('table-back'),
  ], 'bottom');
}

export function buildToys(v: HallView): LayoutNode {
  return drawer('toys-drawer', '玩具篮', [
    ...(v.owned.length === 0
      ? [
          subLabel('toys-empty', '还没有玩具。星砂铺里有羽毛杆和纸袋。'),
          { type: 'Button', id: 'toys-shop', props: { label: '去星砂铺', kind: 'primary', action: 'shop.open' } } as LayoutNode,
        ]
      : v.owned.map((it): LayoutNode => ({
          type: 'Panel', id: `toy-${it.id}`, props: { bg: 'raised' },
          layout: { direction: 'row', gap: 12, padding: 12, align: 'center', justify: 'between' },
          children: [
            {
              type: 'Panel', id: `toy-${it.id}-l`, props: { bare: true },
              layout: { direction: 'row', gap: 8, align: 'center' },
              children: [
                { type: 'Label', id: `toy-${it.id}-name`, props: { text: it.name, size: 'lg', bold: true, color: 'text' } },
                { type: 'Tag', id: `toy-${it.id}-kind`, props: { label: it.kind === 'toy' ? '新互动' : it.kind === 'decor' ? '装饰' : '牌具外观', tone: 'dim' } },
                { type: 'Badge', id: `toy-${it.id}-n`, props: { text: `×${it.count}`, tone: 'accent' } },
              ],
            },
            it.placed
              ? { type: 'Badge', id: `toy-${it.id}-placed`, props: { text: '已在馆里', tone: 'ok' } }
              : { type: 'Button', id: `toy-${it.id}-place`, props: { label: '放到馆里', kind: 'primary', action: 'decor.place', actionArg: it.id } },
          ],
        }))),
    backBtn('toys-back'),
  ]);
}

export function buildShop(v: HallView): LayoutNode {
  const countOf = (id: string): number => v.owned.find((o) => o.id === id)?.count ?? 0;
  return drawer('shop-drawer', '星砂杂货铺', [
    {
      type: 'Panel', id: 'shop-top', props: { bare: true },
      layout: { direction: 'row', gap: 12, align: 'center', justify: 'between' },
      children: [
        subLabel('shop-sub', '不卖关系，不卖回忆。换来的东西会留在馆里。'),
        { type: 'Tag', id: 'shop-stardust', props: { label: `星砂 ${v.stardust}`, tone: 'accent', size: 'lg' } },
      ],
    },
    {
      type: 'Panel', id: 'shop-grid', props: { bare: true },
      layout: { direction: 'column', gap: 12 },
      children: SHOP_ITEMS.map((it): LayoutNode => {
        const n = countOf(it.id);
        const afford = v.stardust >= it.price;
        return {
          type: 'Panel', id: `shop-${it.id}`, props: { bg: 'raised' },
          layout: { direction: 'column', gap: 8, padding: 12, press3d: true },
          children: [
            { type: 'Label', id: `shop-${it.id}-name`, props: { text: it.name, size: 'lg', bold: true, font: 'cnround', color: 'text' } },
            { type: 'Label', id: `shop-${it.id}-blurb`, props: { text: it.blurb, size: 'sm', color: 'sub' } },
            {
              type: 'Panel', id: `shop-${it.id}-row`, props: { bare: true },
              layout: { direction: 'row', gap: 8, align: 'center', justify: 'between' },
              children: [
                { type: 'Tag', id: `shop-${it.id}-price`, props: { label: `星砂 ${it.price}`, tone: 'accent' } },
                ...(n > 0 ? [{ type: 'Badge', id: `shop-${it.id}-own`, props: { text: `已拥有 ×${n}`, tone: 'ok' } } as LayoutNode] : []),
              ],
            },
            { type: 'Button', id: `shop-${it.id}-buy`, props: { label: afford ? '用星砂交换' : '星砂不够', kind: afford ? 'primary' : 'ghost', action: 'shop.buy', actionArg: it.id, disabled: !afford } },
          ],
        };
      }),
    },
    backBtn('shop-back'),
  ]);
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
export function buildScreen(o: { screen: Screen; view?: HallView; reading?: ReadingView; room?: RoomId; canExit?: boolean; registry?: CatRegistry; draft?: RegistrationDraft }): LayoutNode {
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
    case 'table': return buildScene(v, room, buildTable(v));
    case 'toys': return buildScene(v, room, buildToys(v));
    case 'shop': return buildScene(v, room, buildShop(v));
    case 'memory': return buildScene(v, room, buildMemory(v));
    case 'reading': return buildScene(v, room, o.reading !== undefined ? buildReading(o.reading) : buildMemory(v));
    case 'settings': return buildScene(v, room, buildSettings());
    default: return buildScene(v, room);
  }
}
