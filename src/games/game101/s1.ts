// game101 · S1 主界面 —— buildS1(): LayoutNode（静态·validate 测/audit 用）+ buildS1Live(state)：**活板**。
//
// UI 铁律：全 LayoutNode 闭集控件·纯数据·零手写 DOM。buildS1Live 对齐 benchmark 设计稿（MergeBeach）——
//   不是美术风格而是**核心 gameplay 可用性**：点击目标够大、顾客需求看得清、可交付/冷却反馈齐全。
//   结构：HUD（等级/体力+计时/金币/宝石/商店）+ 顾客订单卡（头像+盘子放需求物·大而清晰+金币奖励+可交付✓）
//   + 蓝色合并板井（7×9·物品小巧 size74≈占格50%·生成器格金色·可交付格标✓）。全由引擎世界态每帧投影。
import type { LayoutNode } from '@ui/components/types.js';
import s1Tree from './layout/s1.layout.json';
import { GAME, CHAINS, ITEM_EMOJI } from './theme.js';

export function buildS1(): LayoutNode {
  return s1Tree as unknown as LayoutNode;
}

// ── 活板状态 ─────────────────────────────────────────────────────────────────
export interface CellView { emoji: string; skin?: string; gen?: string; deliverable?: boolean; timer?: number; cover?: number; coverReward?: string; bubble?: { itemEmoji: string; cost: number; id: string }; starLock?: { needStars: number }; cd?: number; cdMax?: number } // skin=皮肤槽美术图 URL(就绪即换装·空则回退 emoji)·bubble=泡泡锁·starLock=星锁区·cd=生成器冷却剩余秒
export interface SlotView { itemEmoji: string; filled: boolean; want: boolean } // filled=已交付·want=板上有该物且此槽未满(可交付)
export interface OrderView { char: string; slots: SlotView[]; coins: number; stars: number; deliverable: boolean; mood: number; moodFace: string; timed?: boolean; timeLeft?: number; portrait?: string; fly?: { id: string; label: string }; celebrate?: boolean }
export interface S1State {
  energy: number; coins: number; gems: number; level: number;
  cells: (CellView | null)[]; orders: OrderView[];
  progress?: { stars: number; goal: number }; // 进度推进②：星→关卡目标进度条
  levelComplete?: boolean;                     // 达标 → 关卡完成横幅
  menuOpen?: boolean;                          // 信息菜单开关（右上☰ → 玩法/链条/日志）
  menuTab?: 'play' | 'chains' | 'log';         // 菜单当前页
  log?: string[];                              // 事件日志（新→旧）

  burstCell?: number; // 合成迸发格（juice·render-only·该格叠一次性星光爆）
  dragGhost?: { emoji: string; x: number; y: number }; // 拖拽中跟手飞影（Screen 坐标·render-only）
  liftedCell?: number; // 被拿起的源格（淡化=物已拿在手上·render-only）
  dissolveCells?: number[]; // 刚被挖到的格（沙/蛛网消融·叠尘土 Particles·render-only）
}

type N = LayoutNode;
const FRAME = '#f2e3c2';   // 板外框奶油
const WELL = '#7f97dd';    // 蓝色板井
const CELL_BG = '#c3cef0'; // 格底浅蓝
const GEN_BG = '#c8871e';  // 生成器格金
const COVER_BG = '#b8895a'; // 阻碍层沙色（覆盖格·挖掘解锁）

// ── HUD 行（等级 / 体力+计时 / 金币 / 宝石 / 商店）────────────────────────────
function hud(s: S1State): N {
  // 资源胶囊：横向（宽>高）·统一 flex 等宽·大图标+大值。基准=ui-brief §S4「[Lv][⚡/100][🪙][💎][🛒]」横向一行。
  const pill = (id: string, glyph: string, val: string, color: 'gold' | 'jade' | 'text', flex = 1): N => ({
    type: 'Panel', id, props: { bg: 'panel' },
    layout: { direction: 'row', align: 'center', justify: 'center', gap: 8, padding: 10, radius: 22, flex, height: 96 },
    children: [
      { type: 'Label', id: `${id}-g`, props: { text: glyph, size: 44 } },
      { type: 'Label', id: `${id}-v`, props: { text: val, color, bold: true, size: 'xxl' } },
    ],
  });
  return {
    // HUD = 一条**扁横带**（宽>高·非又高又窄）：资源胶囊 flex 等宽撑开、按钮固定方尺寸。height 收到 108。
    type: 'Panel', id: 'hud', props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 8, padding: 8, height: 108 },
    children: [
      {
        // 关卡 + 星进度（进度②的家）：Lv + ⭐进度条 + N/目标·横向胶囊等宽。
        type: 'Panel', id: 'hud-lvl', props: { bg: 'gold' },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 2, padding: 8, radius: 22, flex: 1, height: 96 },
        children: [
          { type: 'Label', id: 'hud-lvl-l', props: { text: `Lv ${s.level}`, color: 'ink', bold: true, size: 'xl' } },
          ...(s.progress ? [
            { type: 'ProgressBar', id: 'hud-lvl-bar', props: { value: Math.min(s.progress.stars, s.progress.goal), max: s.progress.goal, tone: 'ok' } } as N,
            { type: 'Label', id: 'hud-lvl-p', props: { text: `⭐${s.progress.stars}/${s.progress.goal}`, color: 'ink', bold: true, size: 'sm' } } as N,
          ] : []),
        ],
      },
      pill('hud-energy', '⚡', `${Math.round(s.energy)}`, 'gold', 1.15),
      pill('hud-coins', '🪙', `${Math.round(s.coins)}`, 'gold', 1),
      pill('hud-gems', '💎', `${s.gems}`, 'jade', 1),
      // 菜单入口：固定方尺寸面板整框可点（Button 无固有宽会缩窄条·用 Panel.action 保方形·同 ui.md 框 Panel 法）。
      {
        type: 'Panel', id: 'hud-menu-frame', props: { bg: 'gold', action: 'open_menu' },
        layout: { width: 108, height: 96, align: 'center', justify: 'center', radius: 22 },
        children: [{ type: 'Label', id: 'hud-menu-i', props: { text: '☰', size: 48, bold: true, color: 'ink' } }],
      },
      // 右上角留给壳层齿轮 ⚙（退出菜单·非本游戏画）——空占位把 ☰ 顶到齿轮左侧不重叠。
      { type: 'Panel', id: 'hud-corner-gap', props: { bare: true }, layout: { width: 72, height: 96 } },
    ],
  };
}

// ── 信息菜单（右上☰ 开·玩法说明 + 合成链条 + 日志·纯 LayoutNode 数据覆盖层）─────────
function menuTab(id: string, label: string, active: boolean, action: string): N {
  return {
    type: 'Button', id: `menu-tab-${id}`,
    props: { label, kind: active ? 'hero' : 'ghost', action },
    layout: { flex: 1 },
  };
}
// 糖果色卡片底（暖港卡通调·柔和高饱和·区别彼此）。
const CANDY = ['#ffd7a6', '#ffc2cf', '#bff0d4', '#bfe0ff', '#fff0a0', '#e2d0ff', '#ffd0b0', '#c8ecff'];
// emoji 放进白色圆牌里更"卡通糖果"（大图标 + 圆底高光感）。dim=圆牌直径（信息最大化=把牌+图标撑大填满卡）。
function emojiChip(id: string, emoji: string, size: number, dim = 140, bg = '#ffffff'): N {
  return {
    type: 'Panel', id, props: { bg: { custom: bg } },
    layout: { width: dim, height: dim, align: 'center', justify: 'center', radius: Math.round(dim / 2), allowOverlap: false },
    children: [{ type: 'Label', id: `${id}-e`, props: { text: emoji, size } }],
  } as N;
}
function menuContent(s: S1State): N[] {
  const tab = s.menuTab ?? 'play';
  if (tab === 'chains') {
    // 合成链条：每链一张糖果卡（flex:1 填满）·名+级数 + **大** emoji 递进链（信息最大化·填满卡）。
    return CHAINS.map((c, i) => ({
      type: 'Panel', id: `menu-chain-${c.id}`, props: { bg: { custom: CANDY[i % CANDY.length] } },
      layout: { direction: 'column', align: 'start', justify: 'center', gap: 14, padding: 26, radius: 26, flex: 1 },
      children: [
        { type: 'Label', id: `menu-chain-${c.id}-n`, props: { text: `${c.name} · ${c.levels.length} 级`, size: 'xxl', bold: true, color: 'ink' } },
        { type: 'Label', id: `menu-chain-${c.id}-e`, props: { text: c.levels.map((l) => ITEM_EMOJI[l.item] ?? '❓').join(' → '), size: 58 } },
      ],
    } as N));
  }
  if (tab === 'log') {
    const log = s.log ?? [];
    if (!log.length) {
      return [{
        type: 'Panel', id: 'menu-log-empty', props: { bg: { custom: CANDY[3] } },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 24, padding: 40, radius: 28, flex: 1 },
        children: [
          { type: 'Label', id: 'menu-log-empty-i', props: { text: '📭', size: 200 } },
          { type: 'Label', id: 'menu-log-empty-t', props: { text: '还没有记录哦', size: 'xxxl', bold: true, color: 'ink' } },
          { type: 'Label', id: 'menu-log-empty-s', props: { text: '去交付订单、挖沙、解锁星仓，这里会记下你的每一步！', size: 'xl', color: 'ink' } },
        ],
      } as N];
    }
    return log.map((line, i) => ({
      type: 'Panel', id: `menu-log-${i}`, props: { bg: { custom: i === 0 ? '#fff0a0' : CANDY[(i + 2) % CANDY.length] } },
      layout: { direction: 'row', align: 'center', gap: 20, padding: 20, radius: 22, flex: 1 },
      children: [
        emojiChip(`menu-log-${i}-c`, i === 0 ? '🆕' : '📌', i === 0 ? 68 : 52, 120),
        { type: 'Label', id: `menu-log-${i}-t`, props: { text: line, size: 'xxl', bold: i === 0, color: 'ink' } },
      ],
    } as N));
  }
  // 玩法说明（默认页）：核心操作逐条·每条一张糖果卡（flex:1 填满·内容也放大填满卡·不留内部空白）。
  const rules: [string, string][] = [
    ['🖐️', '拖动两个相同物件叠一起 → 合并升级（2 合 1）'],
    ['🏭', '点生成器（金格）耗 1 体力 → 掉一个原料'],
    ['🍽️', '把成品拖给顾客 → 交付赚 🪙 金币 + ⭐ 星'],
    ['🔁', '顾客满足后自动换新单（需求逐级升级）'],
    ['⛏️', '在沙格旁边合并 → 周边沙层减一，挖开露出宝物'],
    ['🫧', '点泡泡、花 🪙 金币 → 解锁里面包着的物件'],
    ['🔒', '攒够 ⭐ 星 → 解锁星锁区（码头西仓 / 东仓）'],
    ['🎯', `攒够 ⭐ ${s.progress?.goal ?? 10} 星 → 关卡完成！`],
  ];
  return rules.map(([icon, txt], i) => ({
    type: 'Panel', id: `menu-rule-${i}`, props: { bg: { custom: CANDY[i % CANDY.length] } },
    layout: { direction: 'row', align: 'center', gap: 22, padding: 20, radius: 24, flex: 1 },
    children: [
      emojiChip(`menu-rule-${i}-c`, icon, 76, 150),
      { type: 'Label', id: `menu-rule-${i}-t`, props: { text: txt, size: 'xxl', bold: true, color: 'ink' } },
    ],
  } as N));
}
// 菜单 = 整屏替换（正常流·与主界面同款 Screen 布局·不用绝对定位/遮罩 → 缩放场景里必然正确）。
function menuScreen(s: S1State): LayoutNode {
  const tab = s.menuTab ?? 'play';
  return {
    type: 'Screen', id: 's1', props: {},
    layout: { direction: 'column', gap: 16, padding: 28, width: 1080, height: 1920 },
    children: [
      { // 标题行 + 关闭
        type: 'Panel', id: 'menu-head', props: { bg: 'gold' },
        layout: { direction: 'row', align: 'center', justify: 'between', gap: 10, padding: 20, radius: 24 },
        children: [
          { type: 'Label', id: 'menu-title', props: { text: '📖 海港绯闻 · 说明', size: 'xxl', bold: true, color: 'ink' } },
          { type: 'Button', id: 'menu-close', props: { label: '✕ 返回游戏', kind: 'hero', action: 'close_menu' } },
        ],
      },
      { // 页签行
        type: 'Panel', id: 'menu-tabs', props: { bare: true },
        layout: { direction: 'row', align: 'stretch', gap: 10 },
        children: [
          menuTab('play', '🎮 玩法说明', tab === 'play', 'menu_play'),
          menuTab('chains', '🔗 合成链条', tab === 'chains', 'menu_chains'),
          menuTab('log', '📜 日志', tab === 'log', 'menu_log'),
        ],
      },
      { // 内容区：显式高度撑满 scene 盒（renderScreen 只 min-height:100vh 不达 1920·同主界面手法·避免底部空白）。
        type: 'Panel', id: 'menu-body', props: { bg: 'sunken' },
        layout: { direction: 'column', align: 'stretch', gap: 14, padding: 24, radius: 22, height: 1620 },
        children: menuContent(s),
      },
    ],
  };
}

// ── 顾客订单卡：头像 + 盘子（大而清晰的需求物）+ 金币奖励 + 可交付✓ ──────────────
function orders(s: S1State): N {
  return {
    type: 'Panel', id: 'orders', props: { bare: true },
    // 顾客栏=醒目高条带（owner「不够长·卡太小·放大一波」）：显式撑高 → 立绘/餐盘大幅放大 + 填满上方避免底部空白。
    layout: { direction: 'row', align: 'stretch', justify: 'between', gap: 10, padding: 6, height: 530 },
    children: s.orders.map((o, i) => ({
      // 整卡=交付落点（宿主按 DOM id 几何识别）。限时特惠订单=**异形切角卡(Panel.shape:'cut')** + 金框 + ⏱ 倒计时
      // （动态限时菜单·REQ-UI-异型容器 PUI 已交·真异形非矩形）。金框(edge)非金底(bg)保徽章对比；cut=八边切角
      // 内容安全(不裁 slot/奖励·区别 hexagon/diamond 重裁)·给足 padding。
      // 可交付顾客卡=绿框 + 发光脉冲（醒目「可以交给我了」）；限时卡=金框异形；两者叠加时可交付绿框优先示意。
      type: 'Panel', id: `ord-${i}`,
      props: o.timed ? { bg: 'panel', edge: o.deliverable ? 'ok' : 'gold', shape: 'cut' } : o.deliverable ? { bg: 'panel', edge: 'ok' } : { bg: 'panel' },
      // 竖高卡（owner「不够长·太小·放大」）：大立绘在上作主视觉 + 需求盘/奖励叠在下，纵向排布=高而醒目。
      layout: { direction: 'column', align: 'stretch', justify: 'start', gap: 8, padding: o.timed ? 14 : 10, radius: 20, flex: 1, ...(o.deliverable ? { anim: 'glow' } : {}) },
      children: [
        // 顶：大人物立绘（皮肤槽·就绪即真图）。撑满卡宽 + 固定高 → 立绘 scale 满整个立绘框(cover·无留白·owner「scale 到框 size」)。
        // 无立绘 URL（静态稿/未接图）→ 回退 Avatar 首字兜底（Image 必填 src·不给会 invalid）。
        o.portrait
          ? { type: 'Image', id: `ord-${i}-av`, props: { src: o.portrait, alt: o.char, fit: 'cover', radius: 18 }, layout: { align: 'stretch', width: 999, height: 300 } }
          : { type: 'Avatar', id: `ord-${i}-av`, props: { name: o.char, size: 190, shape: 'rounded' }, layout: { align: 'center' } },
        {
          type: 'Panel', id: `ord-${i}-r`, props: { bare: true },
          layout: { direction: 'column', align: 'stretch', justify: 'start', gap: 8, flex: 1 },
          children: [
            {
              type: 'Panel', id: `ord-${i}-nmrow`, props: { bare: true },
              layout: { direction: 'row', align: 'center', justify: 'between', gap: 4 },
              children: [
                { type: 'Label', id: `ord-${i}-nm`, props: { text: o.char, size: 'lg', bold: true } },
                { type: 'Label', id: `ord-${i}-mf`, props: { text: o.moodFace, size: 'xl' } }, // 心情脸
                ...(o.timed && o.timeLeft != null ? [{ type: 'Badge', id: `ord-${i}-clk`, props: { text: `⏱${o.timeLeft}`, tone: 'warn' } } as N] : []),
              ],
            },
            {
              // 需求盘（叠在立绘旁）：最多 3 slot·已交付 ✓ 绿槽·可交付金槽·未满显需求物。
              type: 'Panel', id: `ord-${i}-plate`, props: { bg: 'sunken' },
              layout: { direction: 'row', align: 'center', justify: 'center', gap: 8, padding: 10, radius: 18 },
              children: o.slots.map((sl, j) => ({
                type: 'Panel', id: `ord-${i}-s${j}`, props: { bg: sl.filled ? 'ok' : sl.want ? 'gold' : 'raised' },
                layout: { direction: 'column', align: 'center', justify: 'center', padding: 6, radius: 14, height: 104, flex: 1 },
                children: [
                  sl.filled
                    ? { type: 'Label', id: `ord-${i}-s${j}-v`, props: { text: '✓', size: 56, bold: true, color: 'ink' } } as N
                    : { type: 'Label', id: `ord-${i}-s${j}-v`, props: { text: sl.itemEmoji, size: 72 } } as N,
                ],
              })),
            },
            {
              type: 'Panel', id: `ord-${i}-rw`, props: { bare: true },
              layout: { direction: 'row', align: 'center', justify: 'center', gap: 6 },
              children: [
                { type: 'Badge', id: `ord-${i}-rc`, props: { text: `🪙${o.coins}`, tone: 'warn' } },
                ...(o.stars > 0 ? [{ type: 'Badge', id: `ord-${i}-rs`, props: { text: `⭐${o.stars}`, tone: 'ok' } } as N] : []),
              ],
            },
          ],
        },
        // 交付发奖飞行轨迹（juice·render-only）：金币从顾客卡沿弧飞进 HUD 钱包（flyTo→hud-coins）。绝对定位不占流。
        ...(o.fly ? [{
          type: 'Label', id: o.fly.id, props: { text: o.fly.label, size: 30, bold: true, color: 'gold' },
          layout: { x: 20, y: 8, allowOverlap: true, flyTo: { to: 'hud-coins', ms: 820, arc: 70 } },
        } as N] : []),
        // 交付庆祝（juice·render-only）：满足顾客瞬间在其卡上撒一把星光/纸屑。
        ...(o.celebrate ? [{
          type: 'Particles', id: `ord-${i}-cel`, props: { kind: 'sparkle', count: 18, loop: false },
          layout: { x: 0, y: 0, width: 200, height: 200, allowOverlap: true },
        } as N] : []),
      ],
    })),
  };
}

// ── 蓝色合并板井（7×9·物品小巧·生成器金格·可交付✓）──────────────────────────
function board(s: S1State): N {
  const cells: N[] = s.cells.map((cv, i) => {
    const kids: N[] = [];
    // 沙/蛛网消融（juice·render-only·表现力要强·owner）：刚被挖到的格叠**双层**爆——纸屑碎块(沙块崩飞)+星光闪
    // ·满屏尘土感（程序化·美术就绪即换）。绝对定位不占流。
    const dissolve: N[] = s.dissolveCells?.includes(i)
      ? [
          { type: 'Particles', id: `t-live-${i}-dis`, props: { kind: 'confetti', count: 34, loop: false }, layout: { x: -12, y: -12, width: 170, height: 170, allowOverlap: true } } as N,
          { type: 'Particles', id: `t-live-${i}-dis2`, props: { kind: 'sparkle', count: 20, loop: false }, layout: { x: 0, y: 0, width: 150, height: 150, allowOverlap: true } } as N,
        ]
      : [];
    // 阻碍层覆盖格（挖掘解锁·分阶段）：沙下埋物·层数越低越接近挖开。特殊格显奖励气泡（⚡/💎/🎁·对齐原图）。
    // 阶段：埋沙(高层·只沙+锁数) → 蛛网 🕸️(低层·快挖开) → 露出(层归零=普通物)。
    if (cv?.cover != null) {
      const ck: N[] = [];
      // 埋物预览=半透明底图（owner：底下那个东西半透明画出来·隔沙朦胧）——放最下作背景层。
      if (cv.coverReward) {
        ck.push({ type: 'Label', id: `t-live-${i}-rw`, props: { text: cv.coverReward, size: 44 }, layout: { opacity: 0.4 } });
      } else if (cv.cover <= 1) {
        ck.push({ type: 'Label', id: `t-live-${i}-web`, props: { text: '🕸️', size: 44 }, layout: { opacity: 0.4 } });
      }
      // 「还要炸几次解锁」= 主视觉·金牌大号 💥N（尺寸收进格内·不溢出 grid 框·owner：数字要在方框里）。
      ck.push({
        type: 'Panel', id: `t-live-${i}-lk`, props: { bg: 'gold' },
        layout: { align: 'center', justify: 'center', padding: 5, radius: 14 },
        children: [{ type: 'Label', id: `t-live-${i}-lkn`, props: { text: `💥${cv.cover}`, size: 34, bold: true, color: 'ink' } }],
      });
      return {
        type: 'Panel', id: `t-live-${i}`, props: { bg: { custom: COVER_BG } },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 2, padding: 6, radius: 16, height: 128, allowOverlap: true },
        children: [...ck, ...dissolve],
      } as N;
    }
    // 泡泡锁格（G3·点破扣币出真物）：半透蓝泡里透出包裹的物 + 🪙价签。tap 发 pop_${id} 信号→craft-recipe 扣币→spawn。
    if (cv?.bubble) {
      return {
        type: 'Panel', id: `t-live-${i}`, props: { bg: { custom: '#bfe4ff' }, action: `pop_${cv.bubble.id}` },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 40, height: 128, opacity: 0.9, press3d: true, anim: 'float' },
        children: [
          { type: 'Label', id: `t-live-${i}-bi`, props: { text: cv.bubble.itemEmoji, size: 52 } },
          { type: 'Label', id: `t-live-${i}-bc`, props: { text: `🪙${cv.bubble.cost}`, size: 'sm', bold: true, color: 'ink' } },
          ...dissolve,
        ],
      } as N;
    }
    // 星锁区格（进度推进②）：紫金锁区显 ⭐N 解锁门槛（攒够星里程碑一次性开区）。区别沙下挖掘=靠交付攒星。
    if (cv?.starLock) {
      return {
        type: 'Panel', id: `t-live-${i}`, props: { bg: { custom: '#6a5acd' } },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 16, height: 128, opacity: 0.92 },
        children: [
          { type: 'Label', id: `t-live-${i}-sl`, props: { text: '🔒', size: 46 } },
          { type: 'Label', id: `t-live-${i}-sn`, props: { text: `⭐${cv.starLock.needStars}`, size: 'sm', bold: true, color: 'gold' } },
          ...dissolve,
        ],
      } as N;
    }
    if (cv) {
      // 皮肤槽就绪 → 渲美术图(Image·就绪即换装)；否则回退 Twemoji Label。被拿起格淡化缩小·冷却中淡化(让圆环醒目)。
      const cdDim = cv.cd != null;
      kids.push(cv.skin
        ? { type: 'Image', id: `t-live-${i}-l`, props: { src: cv.skin, fit: 'contain' }, layout: i === s.liftedCell ? { width: 108, height: 108, opacity: 0.28 } : cdDim ? { width: 126, height: 126, opacity: 0.4 } : { width: 126, height: 126 } }
        : { type: 'Label', id: `t-live-${i}-l`, props: { text: cv.emoji, size: i === s.liftedCell ? 52 : 66 }, layout: i === s.liftedCell ? { opacity: 0.28 } : cdDim ? { opacity: 0.4 } : {} });
      if (cv.deliverable) kids.push({ type: 'Badge', id: `t-live-${i}-b`, props: { text: '✓', tone: 'ok' } });
      if (cv.timer != null) kids.push({ type: 'Badge', id: `t-live-${i}-t`, props: { text: `⏱${cv.timer}`, tone: 'warn' } }); // 限时物倒计时
      // 生成器冷却（G4）：格内居中倒计时圆环（基座 ProgressBar shape:'ring'·conic 弧随剩余秒收缩·中心显剩余秒）。
      if (cv.cd != null) kids.push({
        type: 'Panel', id: `t-live-${i}-cdwrap`, props: { bg: 'transparent' },
        layout: { x: 0, y: 0, width: 116, height: 116, align: 'center', justify: 'center', allowOverlap: true },
        children: [{ type: 'ProgressBar', id: `t-live-${i}-cd`, props: { shape: 'ring', value: cv.cd, max: cv.cdMax ?? cv.cd, tone: 'warn', size: 92, label: `${cv.cd}` } }],
      } as N);
    }
    // 合成迸发（juice·render-only）：该格叠一次性星光爆（基座 Particles·非自造 CSS）。绝对定位不占流。
    if (i === s.burstCell) {
      kids.push({
        type: 'Particles', id: `t-live-${i}-burst`, props: { kind: 'stars', count: 14, loop: false },
        layout: { x: 0, y: 0, width: 120, height: 120, allowOverlap: true },
      } as N);
      // 合并成功气泡（owner：合成有个提示像气泡浮上去）：金色小胶囊「✨ 合成!」从格上方升冒淡出（anim:'floatUp'·基座件）。
      kids.push({
        type: 'Panel', id: `t-live-${i}-mf`, props: { bg: 'gold' },
        layout: { x: 4, y: -46, align: 'center', justify: 'center', padding: 8, radius: 16, allowOverlap: true, anim: 'floatUp' },
        children: [{ type: 'Label', id: `t-live-${i}-mft`, props: { text: '✨ 合成!', size: 'md', bold: true, color: 'ink' } }],
      } as N);
    }
    kids.push(...dissolve); // 消融尘土（覆盖格刚挖开变物品/空格也叠一把）
    const isItem = !!cv && !cv.gen; // 可拖物品格
    // 可交付物：绿框 + 循环发光脉冲 = 醒目「这个能交给顾客了」标识（区别普通物·基座 edge/anim·非自由 CSS）。
    const deliverable = isItem && cv?.deliverable;
    return {
      type: 'Panel', id: `t-live-${i}`,
      props: cv?.gen ? { bg: { custom: GEN_BG }, action: `tap_${cv.gen}` } : deliverable ? { bg: { custom: CELL_BG }, edge: 'ok' } : { bg: { custom: CELL_BG } },
      // 手感：物品格 tilt3d 悬停立体抬起；生成器格 press3d 按压下沉；可交付物 anim:'glow' 发光脉冲醒目。基座闭集。
      layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 1, radius: 16, height: 128, ...(deliverable ? { tilt3d: true, anim: 'glow' } : isItem ? { tilt3d: true } : cv?.gen ? { press3d: true } : {}) },
      children: kids,
    } as N;
  });
  return {
    type: 'Panel', id: 'board', props: { bg: { custom: FRAME } },
    layout: { direction: 'column', gap: 0, padding: 5, radius: 22, flex: 1 },
    children: [
      {
        type: 'Panel', id: 'board-well', props: { bg: { custom: WELL } },
        layout: { direction: 'grid', cols: GAME.board.cols, gap: 3, padding: 4, radius: 16, flex: 1 },
        children: cells,
      },
    ],
  };
}

// 拖拽跟手飞影（render-only·动效要充分）：绝对定位超大 emoji 跟指针，循环脉冲放大（anim:'pulse'）
// + 落影(fx:'holo' 彩光)——"拿在手上、活着"的空中态。size 大于格内(92)=明显举起来了。
function dragGhost(s: S1State): N[] {
  if (!s.dragGhost) return [];
  return [{
    type: 'Label', id: 'drag-ghost', props: { text: s.dragGhost.emoji, size: 120 },
    layout: { x: s.dragGhost.x - 60, y: s.dragGhost.y - 60, allowOverlap: true, anim: 'pulse' },
  } as N];
}

// 关卡完成横幅（进度推进②·达标 = 达成目标星·render-only 庆祝层·绝对定位盖全屏中央）。
function levelBanner(s: S1State): N[] {
  if (!s.levelComplete) return [];
  return [{
    type: 'Panel', id: 'lvl-done', props: { bg: 'gold', edge: 'ok' },
    layout: { x: 140, y: 760, width: 800, height: 400, direction: 'column', align: 'center', justify: 'center', gap: 20, padding: 40, radius: 40, allowOverlap: true, anim: 'pulse' },
    children: [
      { type: 'Label', id: 'lvl-done-t', props: { text: '🎉 关卡完成！', size: 'xxxl', bold: true, color: 'ink' } },
      { type: 'Label', id: 'lvl-done-s', props: { text: `⭐ ${s.progress?.goal ?? ''} 星达成 · 码头声名远扬`, size: 'lg', bold: true, color: 'ink' } },
      { type: 'Particles', id: 'lvl-done-fx', props: { kind: 'confetti', count: 60, loop: true }, layout: { x: 0, y: 0, width: 800, height: 400, allowOverlap: true } },
    ],
  } as N];
}

export function buildS1Live(s: S1State): LayoutNode {
  if (s.menuOpen) return menuScreen(s); // 菜单打开 → 整屏替换（正常流·稳）
  return {
    type: 'Screen', id: 's1', props: {},
    layout: { direction: 'column', gap: 8, padding: 12, width: 1080, height: 1920 },
    children: [hud(s), orders(s), board(s), ...dragGhost(s), ...levelBanner(s)],
  };
}
