// game112《星尾会客厅》—— UI = LayoutNode 纯数据（闭集控件·写世界靠 action 信号·零手写 DOM/React/CSS）。
//
// 华丽起手三步（ui-playbook §0）：
//   ① house 主题 = `apolloBrocade`「锦霞」（暖白锦缎 + 金/胭脂·最接近 GDD「燕麦旧木暖光」）——**不自写 UITheme**。
//   ② 标题页 = `buildStarterHome`（起手包·不从空白搭）。
//   ③ 成熟件（全部对 catalog 实查）：`Avatar.ring` 晶球猫卡 · `ProgressBar` 关系条 · `Tag.size:lg` 星砂药丸 ·
//      `Badge` 状态 · `Panel.action + press3d` 场景热点 · `Panel.glass` 浮层 · `dialog + choiceList` 回忆章节 ·
//      `Button.kind:'hero' + sheen-hover` 主 CTA · `Label.font:'cnround'` 标题。
//
// 红线：handler 不塞自由逻辑——按钮只发 `action` 信号，宿主查表转成输入动作进 sim（信号铁律）。
// 壳层保留区：右上角 ⚙ 菜单钉死在那儿（game111 真机实测会吃掉命中），本游戏动作一律放底部/左侧。
// 设计稿对齐：docs/design/game112/claude-design-brief.md（出稿后 1:1 复刻·本文件是素坯结构）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildStarterHome } from '@zerocraft/engine/ui/starters/index.js';
import { catArt, hotspotArt } from './cat-art.js';
import { CARE_ACTIONS, SHOP_ITEMS, RELATIONS, CATS, TABLE_PLACEHOLDER, GAME_ID } from './world-data.js';
import type { HallView, ReadingView } from './project.js';

export type Screen = 'home' | 'hall' | 'orbs' | 'table' | 'toys' | 'shop' | 'memory' | 'reading' | 'settings' | 'about';

/** 本游戏 UI 发出的全部 action 信号（宿主接线的单一真相·测试对账用·词表见 menu-flow §13）。 */
export const UI_ACTIONS = [
  'home.enter', 'home.about', 'home.exit',
  'hall.back', 'orbs.open', 'table.open', 'toys.open', 'shop.open', 'memory.open', 'settings.open', 'later',
  'cat.greet', 'cat.sit', 'offline.ack',
  'shop.buy', 'decor.place',
  'memory.read', 'memory.advance', 'memory.choose', 'memory.back',
] as const;
export type UiAction = (typeof UI_ACTIONS)[number];

/**
 * 页面外壳——**`Screen` 会丢掉 `layout`**（game111 真机实测），padding/gap/maxWidth 挂在内层 bare Panel。
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

/** 主导航（menu-flow §1.2 五入口·牌桌与逗猫不进常驻栏·右上角留给壳层）。 */
function navBar(active: Screen): LayoutNode {
  const item = (id: string, label: string, action: string, screen: Screen): LayoutNode =>
    ({ type: 'Button', id: `nav-${id}`, props: { label, kind: active === screen ? 'primary' : 'quiet', action } });
  return {
    type: 'Panel', id: 'navbar', props: { bare: true },
    layout: { direction: 'row', gap: 10, justify: 'center', align: 'center' },
    children: [
      item('orbs', '猫咪', 'orbs.open', 'orbs'),
      { type: 'Button', id: 'nav-hall', props: { label: '回到猫身边', kind: active === 'hall' ? 'hero' : 'primary', action: 'hall.back' }, layout: { fx: [{ kind: 'sheen-hover' as const }] } },
      item('memory', '回忆', 'memory.open', 'memory'),
      item('shop', '星砂铺', 'shop.open', 'shop'),
      item('settings', '设置', 'settings.open', 'settings'),
    ],
  };
}

// ── ① 标题页（起手包）────────────────────────────────────────────────────
export function buildHome(o: { canExit?: boolean } = {}): LayoutNode {
  return buildStarterHome({
    title: '星尾会客厅',
    subtitle: '在记忆发亮的地方，再陪它坐一会儿',
    actions: [
      { label: '回到星尾馆', action: 'home.enter', kind: 'hero', sub: '雪团在旧木桌边等你' },
      { label: '关于星尾馆', action: 'home.about', kind: 'ghost' },
      ...(o.canExit === true ? [{ label: '回游戏库', action: 'home.exit', kind: 'quiet' as const }] : []),
    ],
  });
}

// ── ② 主厅 S10：猫先于菜单·三个场景热点·轻 HUD ─────────────────────────────
function hotspot(id: string, kind: 'orb' | 'table' | 'basket', label: string, sub: string, action: string): LayoutNode {
  return {
    type: 'Panel', id: `hot-${id}`, props: { bg: 'raised', action },
    layout: { direction: 'column', gap: 6, padding: 10, width: 150, align: 'center', press3d: true },
    children: [
      { type: 'Image', id: `hot-${id}-img`, props: { src: hotspotArt(kind), fit: 'contain' }, layout: { width: 64, height: 64 } },
      { type: 'Label', id: `hot-${id}-lbl`, props: { text: label, size: 'md', bold: true, color: 'text' } },
      { type: 'Label', id: `hot-${id}-sub`, props: { text: sub, size: 'xs', color: 'sub' } },
    ],
  };
}

export function buildHall(v: HallView): LayoutNode {
  return page('hall', [
    // 顶栏：猫名 + 情绪短语（GDD：主厅只显示名字与一个情绪短语）· 星砂 · 生成状态（低调）
    {
      type: 'Panel', id: 'hall-top', props: { bare: true },
      layout: { direction: 'row', gap: 12, align: 'center', justify: 'between' },
      children: [
        {
          type: 'Panel', id: 'hall-top-left', props: { bare: true },
          layout: { direction: 'row', gap: 10, align: 'center' },
          children: [
            heading('hall-cat-name', v.catName, 'xxl'),
            { type: 'Tag', id: 'hall-mood', props: { label: v.moodPhrase, tone: 'accent' } },
          ],
        },
        {
          type: 'Panel', id: 'hall-top-right', props: { bare: true },
          layout: { direction: 'row', gap: 10, align: 'center' },
          children: [
            { type: 'Tag', id: 'hall-stardust', props: { label: `星砂 ${v.stardust}`, tone: 'accent', size: 'lg' } },
            { type: 'Badge', id: 'hall-gen', props: { text: '离线陪伴', tone: 'dim' } },
          ],
        },
      ],
    },
    // 刚回馆：猫留下的小变化（一句可展开说明·忽略后不再追弹）
    ...(v.offlineEvents.length > 0 ? [{
      type: 'Panel', id: 'hall-offline', props: { glass: true },
      layout: { direction: 'column', gap: 6, padding: 12 },
      children: [
        subLabel('hall-offline-cap', '你不在的时候'),
        ...v.offlineEvents.map((t, i): LayoutNode => ({ type: 'Label', id: `hall-offline-${i}`, props: { text: t, size: 'md', color: 'text' } })),
        { type: 'Button', id: 'hall-offline-ack', props: { label: '看过了', kind: 'ghost', action: 'offline.ack' } },
      ],
    } as LayoutNode] : []),
    // 猫画面层（Image 占位 → REQ-112-ENG-11 交付后由「内嵌 AI 视频播放」接管·矩形区域·按钮不插进猫里）
    {
      type: 'Panel', id: 'hall-stage', props: { bg: 'sunken', vignette: true },
      layout: { direction: 'column', gap: 8, padding: 16, align: 'center' },
      children: [
        { type: 'Image', id: 'hall-cat', props: { src: catArt(v.catId, v.relations.mood >= 70 ? 'notice' : 'rest'), fit: 'contain', alt: v.catName }, layout: { width: 420, height: 300 } },
        subLabel('hall-cat-line', v.catLine),
        ...(v.owned.some((it) => it.placed) ? [{
          type: 'Panel', id: 'hall-placed', props: { bare: true },
          layout: { direction: 'row', gap: 6, align: 'center', justify: 'center' },
          children: v.owned.filter((it) => it.placed).map((it): LayoutNode => ({ type: 'Tag', id: `hall-placed-${it.id}`, props: { label: it.name, tone: 'normal' } })),
        } as LayoutNode] : []),
      ],
    },
    // 三个场景热点 = 活动入口（不做九宫格大厅）
    {
      type: 'Panel', id: 'hall-hotspots', props: { bare: true },
      layout: { direction: 'row', gap: 14, justify: 'center', align: 'stretch' },
      children: [
        hotspot('orbs', 'orb', '忆光晶球', '遇见猫·看它的过去', 'orbs.open'),
        hotspot('table', 'table', '星牌桌', '和它打牌', 'table.open'),
        hotspot('toys', 'basket', '玩具篮', v.owned.length > 0 ? `${v.owned.length} 件` : '还是空的', 'toys.open'),
      ],
    },
    // 陪伴动作（首版按动作判·触摸分区随逗猫重设计）
    {
      type: 'Panel', id: 'hall-care', props: { bare: true },
      layout: { direction: 'row', gap: 12, justify: 'center', align: 'center' },
      children: CARE_ACTIONS.map((a): LayoutNode => ({ type: 'Button', id: `care-${a.id}`, props: { label: a.label, kind: 'primary', action: a.key, sub: a.sub } })),
    },
    navBar('hall'),
  ]);
}

// ── ③ 晶球厅 S20：当前猫的晶球 + 「接回自己的猫」空晶球（上传链等引擎能力）────────
export function buildOrbs(v: HallView): LayoutNode {
  const cat = CATS.find((c) => c.id === v.catId);
  return page('orbs', [
    heading('orbs-title', '晶球厅'),
    subLabel('orbs-sub', '每一颗晶球都是一个记忆入口，不是囚禁灵魂。'),
    {
      type: 'Panel', id: 'orbs-row', props: { bare: true },
      layout: { direction: 'grid', minCol: 260, gap: 14 },
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
            { type: 'Label', id: 'orb-empty-title', props: { text: '接回自己的猫', size: 'lg', bold: true, color: 'text' } },
            subLabel('orb-empty-sub', '上传照片的功能等引擎的「AI 视频生成」能力就绪后开放。'),
            { type: 'Button', id: 'orb-empty-later', props: { label: '稍后再说', kind: 'quiet', action: 'later' } },
          ],
        },
      ],
    },
    navBar('orbs'),
  ]);
}

// ── ④ 星牌桌 S40：🟡 牌规待 owner 对定·只留接口位 ──────────────────────────
export function buildTable(v: HallView): LayoutNode {
  return page('table', [
    heading('table-title', '星牌桌'),
    {
      type: 'Panel', id: 'table-stage', props: { glass: true },
      layout: { direction: 'column', gap: 8, padding: 16, align: 'center' },
      children: [
        { type: 'Image', id: 'table-cat', props: { src: catArt(v.catId, 'notice'), fit: 'contain', alt: v.catName }, layout: { width: 320, height: 220 } },
        { type: 'Label', id: 'table-note', props: { text: TABLE_PLACEHOLDER, size: 'md', color: 'text' } },
        subLabel('table-sub', '规则定稿后这里是：猫 → 三个星盘 → 你的手牌 → 双方星光。'),
      ],
    },
    backBtn('table-back'),
  ]);
}

// ── ⑤ 玩具篮 / 仓库 S73：放到馆里 ─────────────────────────────────────────
export function buildToys(v: HallView): LayoutNode {
  return page('toys', [
    heading('toys-title', '玩具篮'),
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

// ── ⑥ 星砂杂货铺 S70：展示「它会怎样改变互动」·可负担才成交 ─────────────────
export function buildShop(v: HallView): LayoutNode {
  const countOf = (id: string): number => v.owned.find((o) => o.id === id)?.count ?? 0;
  return page('shop', [
    {
      type: 'Panel', id: 'shop-top', props: { bare: true },
      layout: { direction: 'row', gap: 12, align: 'center', justify: 'between' },
      children: [
        heading('shop-title', '星砂杂货铺'),
        { type: 'Tag', id: 'shop-stardust', props: { label: `星砂 ${v.stardust}`, tone: 'accent', size: 'lg' } },
      ],
    },
    subLabel('shop-sub', '不卖关系，不卖回忆。换来的东西会留在馆里。'),
    {
      type: 'Panel', id: 'shop-grid', props: { bare: true },
      layout: { direction: 'grid', minCol: 220, gap: 12 },
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
    navBar('shop'),
  ]);
}

// ── ⑦ 回忆廊 S60 + 章节阅读 S61（dialog + choiceList 闭集控件）────────────────
export function buildMemory(v: HallView): LayoutNode {
  return page('memory', [
    heading('memory-title', '回忆廊'),
    subLabel('memory-sub', '心光会让晶球里的片段慢慢发亮。今天不想看的，可以先不看。'),
    {
      type: 'Panel', id: 'memory-list', props: { bare: true },
      layout: { direction: 'column', gap: 10 },
      children: v.chapters.map((c): LayoutNode => ({
        type: 'Panel', id: `chap-${c.id}`, props: { bg: c.unlocked ? 'raised' : 'sunken' },
        layout: { direction: 'row', gap: 12, padding: 12, align: 'center', justify: 'between' },
        children: [
          {
            type: 'Panel', id: `chap-${c.id}-l`, props: { bare: true },
            layout: { direction: 'column', gap: 4 },
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
            ],
          },
          { type: 'Button', id: `chap-${c.id}-read`, props: { label: '看它的回忆', kind: c.unlocked ? 'primary' : 'ghost', action: 'memory.read', actionArg: c.id, disabled: !c.unlocked } },
        ],
      })),
    },
    navBar('memory'),
  ]);
}

export function buildReading(r: ReadingView): LayoutNode {
  const isChoice = r.options !== undefined;
  return page('reading', [
    heading('reading-title', r.title),
    {
      type: 'Panel', id: 'reading-body', props: { glass: true },
      layout: { direction: 'column', gap: 10, padding: 16 },
      children: [
        {
          type: 'dialog', id: 'reading-dialog',
          props: { speaker: r.speaker, text: r.ended && r.text === '' ? '（这段回忆到这里。）' : r.text, kind: isChoice ? 'choice' : 'line', typewriter: 18, edge: 'gold' },
        },
        ...(isChoice ? [{
          type: 'Panel', id: 'reading-choices-wrap', props: { bare: true },
          layout: { direction: 'column', align: 'center', width: 520 },
          children: [{
            type: 'choiceList', id: 'reading-choices',
            props: {
              options: (r.options ?? []).map((t, i) => ({ label: t, actionArg: String(i) })),
              chooseAction: 'memory.choose', optionKind: 'primary', optionShape: 'pill', hoverSheen: true,
            },
          }],
        } as LayoutNode] : []),
        ...(r.ended ? [subLabel('reading-end', '（这段回忆到这里。它还在你身边。）')] : []),
      ],
    },
    {
      type: 'Panel', id: 'reading-foot', props: { bare: true },
      layout: { direction: 'row', gap: 12, justify: 'center', align: 'center' },
      children: [
        ...(!isChoice && !r.ended ? [{ type: 'Button', id: 'reading-next', props: { label: '继续', kind: 'hero', action: 'memory.advance' }, layout: { fx: [{ kind: 'sheen-hover' as const }] } } as LayoutNode] : []),
        backBtn('reading-back', '回到回忆廊', 'memory.back'),
      ],
    },
  ]);
}

// ── ⑧ 设置 / 关于（S90 简版·可信优先）────────────────────────────────────
export function buildSettings(): LayoutNode {
  return page('settings', [
    heading('settings-title', '设置与隐私'),
    subLabel('settings-sub', '音画 · 辅助 · 生成与存储 · 隐私中心 · 导出与删除——上传功能开放后在这里管理照片与视频。'),
    { type: 'Label', id: 'settings-note', props: { text: '目前的进度只存在这台设备上。生成暂停不影响基础陪伴。', size: 'md', color: 'text' } },
    navBar('settings'),
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

/** 屏 → 树（宿主唯一入口·纯查表）。 */
export function buildScreen(o: { screen: Screen; view?: HallView; reading?: ReadingView; canExit?: boolean }): LayoutNode {
  const v = o.view;
  switch (o.screen) {
    case 'home': return buildHome({ canExit: o.canExit });
    case 'about': return buildAbout();
    case 'settings': return buildSettings();
    case 'reading': return o.reading !== undefined ? buildReading(o.reading) : (v !== undefined ? buildMemory(v) : buildHome({ canExit: o.canExit }));
    default: break;
  }
  if (v === undefined) return buildHome({ canExit: o.canExit });
  switch (o.screen) {
    case 'orbs': return buildOrbs(v);
    case 'table': return buildTable(v);
    case 'toys': return buildToys(v);
    case 'shop': return buildShop(v);
    case 'memory': return buildMemory(v);
    default: return buildHall(v);
  }
}
