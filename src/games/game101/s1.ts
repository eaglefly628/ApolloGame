// game101 · S1 主界面 —— buildS1(): LayoutNode（静态·validate 测/audit 用）+ buildS1Live(state)：**活板**。
//
// UI 铁律：全 LayoutNode 闭集控件·纯数据·零手写 DOM。buildS1Live 对齐 benchmark 设计稿（MergeBeach）——
//   不是美术风格而是**核心 gameplay 可用性**：点击目标够大、顾客需求看得清、可交付/冷却反馈齐全。
//   结构：HUD（等级/体力+计时/金币/宝石/商店）+ 顾客订单卡（头像+盘子放需求物·大而清晰+金币奖励+可交付✓）
//   + 蓝色合并板井（7×9·物品小巧 size74≈占格50%·生成器格金色·可交付格标✓）。全由引擎世界态每帧投影。
import type { LayoutNode } from '@ui/components/types.js';
import s1Tree from './layout/s1.layout.json';
import { GAME, ENERGY } from './theme.js';

export function buildS1(): LayoutNode {
  return s1Tree as unknown as LayoutNode;
}

// ── 活板状态 ─────────────────────────────────────────────────────────────────
export interface CellView { emoji: string; gen?: string; deliverable?: boolean; timer?: number; cover?: number; coverReward?: string; bubble?: { itemEmoji: string; cost: number; id: string }; starLock?: { needStars: number } } // bubble=泡泡锁·starLock=星锁区（攒够星里程碑解锁）
export interface SlotView { itemEmoji: string; filled: boolean; want: boolean } // filled=已交付·want=板上有该物且此槽未满(可交付)
export interface OrderView { char: string; slots: SlotView[]; coins: number; stars: number; deliverable: boolean; mood: number; moodFace: string; timed?: boolean; timeLeft?: number; portrait?: string; fly?: { id: string; label: string }; celebrate?: boolean }
export interface S1State {
  energy: number; coins: number; gems: number; level: number;
  cells: (CellView | null)[]; orders: OrderView[];
  progress?: { stars: number; goal: number }; // 进度推进②：星→关卡目标进度条
  levelComplete?: boolean;                     // 达标 → 关卡完成横幅

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
  // pill 竖向撑满 HUD 带（align:stretch）·大字·圆润胶囊——正式美术资源就绪时同样有位置撑表现。
  const pill = (id: string, glyph: string, val: string, color: 'gold' | 'jade' | 'text'): N => ({
    type: 'Panel', id, props: { bg: 'panel' },
    layout: { direction: 'row', align: 'center', justify: 'center', gap: 8, padding: 16, radius: 26 },
    children: [
      { type: 'Label', id: `${id}-g`, props: { text: glyph, size: 'xxl' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, color, bold: true, size: 'xxl' } },
    ],
  });
  return {
    // HUD 状态栏=一条明显的高带（对齐原图比例·拉长）：所有件 align:'stretch' 等高撑满，读得清、留美术位。
    type: 'Panel', id: 'hud', props: { bare: true },
    layout: { direction: 'row', align: 'stretch', justify: 'between', gap: 10, padding: 12, height: 150 },
    children: [
      {
        // 关卡 + 星进度（进度推进②的 HUD 家）：Lv + ⭐进度条向本关目标·让「越玩越有奔头」看得见。
        type: 'Panel', id: 'hud-lvl', props: { bg: 'gold' },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 4, padding: 12, radius: 30 },
        children: [
          { type: 'Label', id: 'hud-lvl-l', props: { text: `Lv ${s.level}`, color: 'ink', bold: true, size: 'xxl' } },
          ...(s.progress ? [
            { type: 'ProgressBar', id: 'hud-lvl-bar', props: { value: Math.min(s.progress.stars, s.progress.goal), max: s.progress.goal, tone: 'ok' } } as N,
            { type: 'Label', id: 'hud-lvl-p', props: { text: `⭐${s.progress.stars}/${s.progress.goal}`, color: 'ink', bold: true, size: 'sm' } } as N,
          ] : []),
        ],
      },
      {
        type: 'Panel', id: 'hud-energy', props: { bg: 'panel' },
        layout: { direction: 'row', align: 'center', justify: 'center', gap: 10, padding: 16, radius: 26 },
        children: [
          { type: 'Label', id: 'hud-e-g', props: { text: '⚡', size: 'xxl' } },
          // 能量数值=大字（原 ProgressBar.showValue 太小·owner）：显著大值 + 细进度条只作填充观感。
          { type: 'Label', id: 'hud-e-v', props: { text: `${Math.round(s.energy)}`, color: 'gold', bold: true, size: 'xxxl' } },
          { type: 'ProgressBar', id: 'hud-e-bar', props: { value: Math.round(s.energy), max: ENERGY.cap, tone: 'warn' } },
        ],
      },
      pill('hud-coins', '🪙', `${Math.round(s.coins)}`, 'gold'),
      pill('hud-gems', '💎', `${s.gems}`, 'jade'),
      { type: 'Button', id: 'hud-cart', props: { label: '🛒', kind: 'primary', action: 'open_shop' } },
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
        // 顶：大人物立绘（asset-manager vendor 的 CC0 头像·src 就绪即真图·name 作缺省首字兜底）。撑满卡宽作主视觉。
        { type: 'Avatar', id: `ord-${i}-av`, props: { src: o.portrait, name: o.char, size: 190, shape: 'rounded' }, layout: { align: 'center' } },
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
      if (cv.coverReward) {
        // 沙下埋物**大图标直显**（owner：锁着也要跟挖开后一样大看得清·勾引玩家挖）——尺寸对齐普通物件(60)，
        // 微降透明度示意「隔着沙」，锁层数缩成右上小角标不再挡内容。
        ck.push({ type: 'Label', id: `t-live-${i}-rw`, props: { text: cv.coverReward, size: 60 }, layout: { opacity: 0.9 } });
      } else if (cv.cover <= 1) {
        ck.push({ type: 'Label', id: `t-live-${i}-web`, props: { text: '🕸️', size: 60 } }); // 快挖开=蛛网阶段（同样放大）
      }
      // 剩余层数=大图标下方小字（ink 深色·沙上可读·正常流不裁切·仍读得到「还挖几层」）。
      ck.push({ type: 'Label', id: `t-live-${i}-cl`, props: { text: `🔒${cv.cover}`, size: 'sm', bold: true, color: 'ink' } });
      return {
        type: 'Panel', id: `t-live-${i}`, props: { bg: { custom: COVER_BG } },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 0, padding: 4, radius: 16, height: 128, allowOverlap: true },
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
      kids.push({ type: 'Label', id: `t-live-${i}-l`, props: { text: cv.emoji, size: i === s.liftedCell ? 52 : 66 }, layout: i === s.liftedCell ? { opacity: 0.28 } : {} }); // 板等比缩小(对齐原图比例)·被拿起格淡化缩小
      if (cv.deliverable) kids.push({ type: 'Badge', id: `t-live-${i}-b`, props: { text: '✓', tone: 'ok' } });
      if (cv.timer != null) kids.push({ type: 'Badge', id: `t-live-${i}-t`, props: { text: `⏱${cv.timer}`, tone: 'warn' } }); // 限时物倒计时

    }
    // 合成迸发（juice·render-only）：该格叠一次性星光爆（基座 Particles·非自造 CSS）。绝对定位不占流。
    if (i === s.burstCell) kids.push({
      type: 'Particles', id: `t-live-${i}-burst`, props: { kind: 'stars', count: 14, loop: false },
      layout: { x: 0, y: 0, width: 120, height: 120, allowOverlap: true },
    } as N);
    kids.push(...dissolve); // 消融尘土（覆盖格刚挖开变物品/空格也叠一把）
    const isItem = !!cv && !cv.gen; // 可拖物品格
    // 可交付物：绿框 + 循环发光脉冲 = 醒目「这个能交给顾客了」标识（区别普通物·基座 edge/anim·非自由 CSS）。
    const deliverable = isItem && cv?.deliverable;
    return {
      type: 'Panel', id: `t-live-${i}`,
      props: cv?.gen ? { bg: { custom: GEN_BG }, action: `tap_${cv.gen}` } : deliverable ? { bg: { custom: CELL_BG }, edge: 'ok' } : { bg: { custom: CELL_BG } },
      // 手感：物品格 tilt3d 悬停立体抬起；生成器格 press3d 按压下沉；可交付物 anim:'glow' 发光脉冲醒目。基座闭集。
      layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 16, height: 128, ...(deliverable ? { tilt3d: true, anim: 'glow' } : isItem ? { tilt3d: true } : cv?.gen ? { press3d: true } : {}) },
      children: kids,
    } as N;
  });
  return {
    type: 'Panel', id: 'board', props: { bg: { custom: FRAME } },
    layout: { direction: 'column', gap: 0, padding: 10, radius: 22, flex: 1 },
    children: [
      {
        type: 'Panel', id: 'board-well', props: { bg: { custom: WELL } },
        layout: { direction: 'grid', cols: GAME.board.cols, gap: 6, padding: 8, radius: 16, flex: 1 },
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
  return {
    type: 'Screen', id: 's1', props: {},
    layout: { direction: 'column', gap: 8, padding: 12, width: 1080, height: 1920 },
    children: [hud(s), orders(s), board(s), ...dragGhost(s), ...levelBanner(s)],
  };
}
