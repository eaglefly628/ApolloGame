// Game I 展示台 · 页 · 3D UI
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { sectionTitle, divider, CARD_JOKER_URL } from './shared.js';
import type { ControlsState } from './shared.js';
// ── 页 · 3D UI 表达（CSS-3D 通用化·把 rotateX/Y/z/perspective/翻面 组合成一组 3D 数据控件）─────────
// 全是既有 LayoutConstraints（rotateX/rotateY/z/perspective/tilt3d）+ PlayingCard.flipOnHover 的**重组**，
// 无新引擎能力（showcase 职责=把底座能力排成活样例）。控件仍是纯数据·经真 UI 库渲染·UI 铁律。
export function buildPage3dUi(controls: ControlsState): LayoutNode {
  // 旋转木马一张卡：绕 Y 轴按位次倾 + 朝外/朝内推（z），共享父 perspective → 卡组呈 3D 扇形。
  const coverCard = (id: string, rank: string, suit: string, name: string, rotY: number, z: number, sel = false): LayoutNode =>
    ({ type: 'PlayingCard', id, props: { rank, suit, label: name, size: 'md', selected: sel }, layout: { rotateY: rotY, z } });
  // 名将背面信息子树（翻面卡共用）。
  const heroBack = (bid: string, name: string, era: string, tag: string): LayoutNode =>
    ({ type: 'Panel', id: bid, props: { bare: true }, layout: { direction: 'column', gap: 6, padding: 10, align: 'center', justify: 'center' },
      children: [
        { type: 'Label', id: `${bid}-n`, props: { text: name, size: 'md', bold: true, color: 'gold' } },
        { type: 'Label', id: `${bid}-e`, props: { text: era, size: 'xs', color: 'jade' } },
        { type: 'Label', id: `${bid}-t`, props: { text: tag, size: 'xs', color: 'sub' } },
      ] });
  return {
    type: 'Panel', id: 'page-3dui', props: { scroll: true },
    layout: { direction: 'column', gap: 18, padding: 20 },
    children: [
      { type: 'Label', id: '3dui-intro', props: {
        text: '3D UI = 2D LayoutNode 挂 CSS-3D 变换（透视/景深/翻面/自旋/按压）+ 休闲 juice（庆祝粒子/退场/环形进度/全息箔/描边字）——全是数据字段，弱 LLM 只填数不写 CSS。真 3D 合成（preserve-3d）·非贴图假 3D。往下滚看 🎉 Juice 段。',
        color: 'sub', size: 'sm' } },

      divider('d-3du1'),
      sectionTitle('t-3dui-carousel', '★ 3D 卡牌旋转木马 / cover-flow（LAYOUT.rotateY + z·共享父 perspective → 卡组扇形铺开·中间凸出·两翼后旋）'),
      { type: 'Panel', id: '3dui-carousel', props: { bare: true }, layout: { direction: 'row', gap: 0, padding: 48, align: 'center', justify: 'center', perspective: 720 },
        children: [
          coverCard('cf-1', 'J', '♣', '张辽', 55, -90),
          coverCard('cf-2', 'Q', '♦', '马超', 32, -40),
          coverCard('cf-3', 'A', '♠', '赵子龙', 0, 60, true),
          coverCard('cf-4', 'K', '♥', '关云长', -32, -40),
          coverCard('cf-5', '10', '♣', '黄忠', -55, -90),
        ] },
      { type: 'Label', id: '3dui-carousel-l', props: { text: '五张同结构卡·只有 rotateY/z 两个数不同 → 摆成 cover-flow。换牌组=换数据，结构一字不改。', color: 'dim', size: 'xs' } },

      divider('d-3du2'),
      sectionTitle('t-3dui-flip', '★ 真 3D 翻面卡（PLAYINGCARD.flipOnHover + backFace·rotateY 180°+backface-hidden·悬停翻到背面信息）'),
      { type: 'Panel', id: '3dui-flip-row', props: { bare: true }, layout: { direction: 'row', gap: 28, padding: 24, align: 'center' },
        children: [
          { type: 'PlayingCard', id: 'flip-1', props: {
            rank: 'A', suit: '♠', label: '赵子龙', size: 'lg', flipOnHover: true,
            backFace: { type: 'Panel', id: 'flip-1-back', props: { bare: true }, layout: { direction: 'column', gap: 6, padding: 10, align: 'center', justify: 'center' },
              children: [
                { type: 'Label', id: 'flip-1-b-n', props: { text: '常山赵子龙', size: 'md', bold: true, color: 'gold' } },
                { type: 'Label', id: 'flip-1-b-d', props: { text: '蜀 · 五虎上将', size: 'xs', color: 'jade' } },
                { type: 'Label', id: 'flip-1-b-t', props: { text: '一身是胆·长坂坡七进七出', size: 'xs', color: 'sub' } },
              ] } } },
          { type: 'PlayingCard', id: 'flip-2', props: {
            rank: 'K', suit: '♥', label: '关云长', size: 'lg', flipOnHover: true,
            backFace: { type: 'Panel', id: 'flip-2-back', props: { bare: true }, layout: { direction: 'column', gap: 6, padding: 10, align: 'center', justify: 'center' },
              children: [
                { type: 'Label', id: 'flip-2-b-n', props: { text: '美髯公 关羽', size: 'md', bold: true, color: 'gold' } },
                { type: 'Label', id: 'flip-2-b-d', props: { text: '蜀 · 五虎之首', size: 'xs', color: 'jade' } },
                { type: 'Label', id: 'flip-2-b-t', props: { text: '过五关斩六将·水淹七军', size: 'xs', color: 'sub' } },
              ] } } },
          { type: 'Label', id: '3dui-flip-l', props: { text: '← 悬停卡牌：前后两面绕 Y 轴真翻转（backface-hidden 藏反面）。背面挂任意 LayoutNode 信息子树。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du3'),
      sectionTitle('t-3dui-tilt', 'LAYOUT.rotateX/Y · 透视倾斜面板（静态摆进 3D 空间·像 sci-fi 斜置 HUD）'),
      { type: 'Panel', id: '3dui-tilt-row', props: { bare: true }, layout: { direction: 'row', gap: 48, padding: 24, align: 'center', perspective: 1000 },
        children: [
          { type: 'Panel', id: '3dui-tilt-a', props: { bg: 'jade-sheen', title: '左倾 HUD' }, layout: { width: 170, height: 116, padding: 14, rotateX: 12, rotateY: 26 },
            children: [{ type: 'Label', id: '3dui-tilt-a-l', props: { text: 'rotateX:12\nrotateY:26', size: 'sm', color: 'text' } }] },
          { type: 'Panel', id: '3dui-tilt-b', props: { bg: 'gold-sheen', title: '右倾 HUD' }, layout: { width: 170, height: 116, padding: 14, rotateX: 12, rotateY: -26 },
            children: [{ type: 'Label', id: '3dui-tilt-b-l', props: { text: 'rotateX:12\nrotateY:-26', size: 'sm', color: 'ink' } }] },
        ] },

      divider('d-3du4'),
      sectionTitle('t-3dui-depth', 'LAYOUT.z · 景深叠层（子面板各挂不同 z·真 translateZ 分层·朝屏幕凸出）'),
      { type: 'Panel', id: '3dui-depth', props: { bare: true }, layout: { width: 220, height: 180, padding: 20, rotateY: 20, perspective: 900 },
        children: [
          // 景深叠层=设计意图叠放 → allowOverlap 标意图（REQ-UIFX 修好空审计后 overlap 检查首次真跑到本 tab·A-007 语义）。
          { type: 'Panel', id: '3dui-d1', props: { bg: 'steel' }, layout: { x: 0, y: 0, width: 104, height: 144, radius: 10, z: 0, allowOverlap: true }, children: [] },
          { type: 'Panel', id: '3dui-d2', props: { bg: 'ink-deep' }, layout: { x: 18, y: 12, width: 104, height: 144, radius: 10, z: 34, allowOverlap: true }, children: [] },
          { type: 'Panel', id: '3dui-d3', props: { bg: 'gold-sheen' }, layout: { x: 36, y: 24, width: 104, height: 144, radius: 10, z: 68, align: 'center', justify: 'center', padding: 0, allowOverlap: true },
            children: [{ type: 'Label', id: '3dui-d3-l', props: { text: 'z:68\n最前', size: 'sm', bold: true, color: 'ink' } }] },
        ] },

      divider('d-3du5'),
      sectionTitle('t-3dui-hover', 'LAYOUT.tilt3d · 悬停立体抬起（交互 3D·鼠标悬停时面板/卡牌抬离屏幕·CSS 注入 :hover 变换）'),
      { type: 'Panel', id: '3dui-hover-row', props: { bare: true }, layout: { direction: 'row', gap: 40, padding: 24, align: 'center' },
        children: [
          { type: 'Button', id: '3dui-tilt-card', props: { label: '', skin: CARD_JOKER_URL, action: 'click', actionArg: 'tilt-card' }, layout: { width: 120, height: 168, tilt3d: true } },
          { type: 'Panel', id: '3dui-tilt-panel', props: { bg: 'void', title: 'tilt3d' }, layout: { width: 150, height: 116, padding: 14, tilt3d: true, align: 'center', justify: 'center' },
            children: [{ type: 'Label', id: '3dui-tilt-panel-l', props: { text: '悬停我\n→ 立体抬起', size: 'sm', color: 'text' } }] },
          { type: 'Label', id: '3dui-hover-l', props: { text: '一个 tilt3d:true 字段 = 悬停时透视抬起 + 柔影（仅桌面 hover）。触屏点按反馈见下方 press3d。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du6'),
      sectionTitle('t-3dui-wheel', '★ 幸运转盘 / spinner 加载 / 旋转勋章（LAYOUT.rotate 既有 Z 轴 + anim:"spin" 新循环预设·休闲刚需·非新增轴）'),
      { type: 'Panel', id: '3dui-wheel-row', props: { bare: true }, layout: { direction: 'row', gap: 56, padding: 24, align: 'center' },
        children: [
          // 幸运转盘：conic-gradient 分段圆盘 + 连续自旋 + 顶部指针。
          { type: 'Panel', id: 'wheel-col', props: { bare: true }, layout: { direction: 'column', gap: 2, align: 'center' },
            children: [
              { type: 'Label', id: 'wheel-ptr', props: { text: '▼', size: 'lg', color: 'gold' } },
              { type: 'Panel', id: 'wheel-disc', props: { bg: { custom: 'conic-gradient(#e94f5a 0deg 45deg,#f5a623 45deg 90deg,#7ed957 90deg 135deg,#4a90d9 135deg 180deg,#9b59b6 180deg 225deg,#f5a623 225deg 270deg,#7ed957 270deg 315deg,#4a90d9 315deg 360deg)' } },
                layout: { width: 168, height: 168, radius: 84, anim: 'spin', animMs: 6000, align: 'center', justify: 'center', padding: 0 },
                children: [{ type: 'Panel', id: 'wheel-hub', props: { bg: 'raised' }, layout: { width: 40, height: 40, radius: 20 }, children: [] }] },
              { type: 'Label', id: 'wheel-lbl', props: { text: '每日转盘（rotate + spin）', size: 'xs', color: 'dim' } },
            ] },
          // spinner 加载环：conic 弧 + 快速自旋。
          { type: 'Panel', id: 'spin-col', props: { bare: true }, layout: { direction: 'column', gap: 8, align: 'center' },
            children: [
              { type: 'Panel', id: 'spin-ring', props: { bg: { custom: 'conic-gradient(#6cc6a0 0deg,rgba(108,198,160,0) 300deg 360deg)' } },
                layout: { width: 60, height: 60, radius: 30, anim: 'spin', animMs: 900, align: 'center', justify: 'center', padding: 0 },
                children: [{ type: 'Panel', id: 'spin-hole', props: { bg: 'sunken' }, layout: { width: 38, height: 38, radius: 19 }, children: [] }] },
              { type: 'Label', id: 'spin-lbl', props: { text: '加载中…', size: 'xs', color: 'dim' } },
            ] },
          // 旋转勋章：金圆 + ★（自旋让对称件也读得出转动）。
          { type: 'Panel', id: 'medal-col', props: { bare: true }, layout: { direction: 'column', gap: 8, align: 'center' },
            children: [
              { type: 'Panel', id: 'medal', props: { bg: 'gold-sheen' }, layout: { width: 74, height: 74, radius: 37, anim: 'spin', animMs: 3200, align: 'center', justify: 'center', padding: 0 },
                children: [{ type: 'Label', id: 'medal-star', props: { text: '★', size: 'xl', bold: true, color: 'ink' } }] },
              { type: 'Label', id: 'medal-lbl', props: { text: '旋转勋章', size: 'xs', color: 'dim' } },
            ] },
          { type: 'Label', id: '3dui-wheel-l', props: { text: 'Z 轴自旋既有（LAYOUT.rotate）；缺的是连续循环预设——补 anim:"spin"（linear·匀速）即解锁转盘/加载环/自旋徽章一大类休闲件。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du7'),
      sectionTitle('t-3dui-tapflip', '★ 状态驱动翻面 PLAYINGCARD.flipped（点按/state 翻·非 hover·触屏可用——记忆翻牌/卡牌对战/刮刮乐）'),
      { type: 'Panel', id: '3dui-tapflip-row', props: { bare: true }, layout: { direction: 'row', gap: 30, padding: 24, align: 'center' },
        children: [
          // 交互：flipped 绑 controls.flag，点下方 Toggle 实时翻（state 驱动·非 hover）。
          { type: 'Panel', id: 'tapflip-live', props: { bare: true }, layout: { direction: 'column', gap: 10, align: 'center' },
            children: [
              { type: 'PlayingCard', id: 'tapflip-card', props: {
                rank: 'A', suit: '♠', label: '赵子龙', size: 'lg', flipped: controls.flag,
                backFace: heroBack('tapflip-back', '常山赵子龙', '蜀 · 五虎上将', '一身是胆 · 长坂坡') } },
              { type: 'Toggle', id: 'tapflip-tg', props: { label: '点我翻牌（flipped=state）', checked: controls.flag, action: 'setFlag' } },
            ] },
          // 静态两态对照（同字段不同值）。
          { type: 'PlayingCard', id: 'tapflip-a', props: {
            rank: 'K', suit: '♥', label: '关云长', size: 'lg', flipped: false,
            backFace: heroBack('tapflip-a-back', '美髯公 关羽', '蜀', '过五关斩六将') } },
          { type: 'PlayingCard', id: 'tapflip-b', props: {
            rank: 'K', suit: '♥', label: '关云长', size: 'lg', flipped: true,
            backFace: heroBack('tapflip-b-back', '美髯公 关羽', '蜀', '过五关斩六将') } },
          { type: 'Label', id: '3dui-tapflip-l', props: { text: 'flipped:false=正面 / true=背面 → 由数据决定翻到哪面（左侧绑 state·点 Toggle 实时翻）。对比 flipOnHover：这个触屏点按就能翻。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du8'),
      sectionTitle('t-3dui-press', '★ 按压 3D 反馈 LAYOUT.press3d（按下沉 Z + 底唇收缩·:active 触屏可用·糖果厚按钮——tilt3d 的移动端补位）'),
      { type: 'Panel', id: '3dui-press-row', props: { bare: true }, layout: { direction: 'row', gap: 28, padding: 24, align: 'center' },
        children: [
          { type: 'Button', id: 'press-a', props: { label: '开始游戏', kind: 'primary', action: 'click', actionArg: 'press-a' }, layout: { press3d: true } },
          { type: 'Button', id: 'press-b', props: { label: '领取奖励', kind: 'hero', action: 'click', actionArg: 'press-b' }, layout: { press3d: true } },
          { type: 'Panel', id: 'press-tile', props: { bg: 'jade-sheen', action: 'click', actionArg: 'press-tile' }, layout: { width: 120, height: 72, padding: 12, press3d: true, align: 'center', justify: 'center' },
            children: [{ type: 'Label', id: 'press-tile-l', props: { text: '可按面板', size: 'sm', color: 'text' } }] },
          { type: 'Label', id: '3dui-press-l', props: { text: '一个 press3d:true 字段 = 常驻底唇（厚度）+ 按下沉 Z、底唇收缩。走 :active → 触屏点按也触发（对照 tilt3d 只 hover）。按钮/面板/卡牌通用。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      // ══════ 🎉 Juice / 反馈五补（休闲刚需·render-only·纯数据）══════
      divider('d-3du9'),
      { type: 'Label', id: 'juice-hdr', props: { text: '🎉 Juice / 反馈（庆祝粒子 · 退场动画 · 环形进度 · 全息箔 · 描边字——休闲游戏的"爽感"层）', size: 'md', bold: true, color: 'gold' } },

      sectionTitle('t-3dui-particles', '★ UI 庆祝粒子 PARTICLES（通关撒纸屑 / 领奖金币雨 / 星光爆 / 环境微光·fx 无法喷 N 粒子·UI 层发射器）'),
      { type: 'Panel', id: '3dui-particles-row', props: { bare: true }, layout: { direction: 'row', gap: 18, padding: 20, align: 'center' },
        children: ([
          ['confetti', '纸屑雨 confetti', 'sunken'], ['coins', '金币雨 coins', 'ink'],
          ['stars', '星光爆 stars', 'sunken'], ['sparkle', '环境微光 sparkle', 'ink'],
        ] as const).map(([kind, cap, bg]): LayoutNode => ({
          type: 'Panel', id: `pt-col-${kind}`, props: { bare: true }, layout: { direction: 'column', gap: 6, align: 'center' },
          children: [
            { type: 'Panel', id: `pt-stage-${kind}`, props: { bg }, layout: { width: 150, height: 116, padding: 0, align: 'center', justify: 'center' },
              children: [{ type: 'Particles', id: `pt-${kind}`, props: { kind }, layout: { width: 150, height: 116 } }] },
            { type: 'Label', id: `pt-cap-${kind}`, props: { text: cap, size: 'xs', color: 'dim' } },
          ],
        })).concat([
          { type: 'Label', id: '3dui-particles-l', props: { text: '一个 Particles{kind} = 一台 UI 层发射器（世界层对等件=Vfx3D）。粒子位置确定式派生·无裸 Math.random·可回归。loop:false=庆祝播一次。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ]) },

      // follow:'cursor'——收成小簇跟随光标（桌面微尘·下沉自 game-b「GameD 粒子追随」owner 2026-07-22）。
      { type: 'Panel', id: '3dui-particles-follow-row', props: { bare: true }, layout: { direction: 'row', gap: 18, padding: 20, align: 'center' },
        children: [
          { type: 'Panel', id: 'pt-follow-stage', props: { bg: 'sunken' }, layout: { width: 320, height: 120, padding: 0, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'pt-follow-hint', props: { text: '↖ 在此框内移动鼠标 · 微尘跟随光标', size: 'sm', color: 'dim' } },
              { type: 'Particles', id: 'pt-follow', props: { kind: 'sparkle', count: 9, follow: 'cursor' } },
            ] },
          { type: 'Label', id: '3dui-particles-follow-l', props: { text: 'Particles{follow:"cursor"} = 粒子收成小簇跟随光标（软遮罩 + screen 混色不挡字·JS 缓动逼近·离场淡出）。渲染器侧跟随循环(server rAF)驱动·游戏侧纯数据一行；render-only 不进 sim。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      // 物理弹道粒子（REQ-UIFX·对位 Vfx3D：cone 初速+重力+阻尼+弹簧引向目标锚·拖尾对位 Trail3D·server rAF 胶水）。
      sectionTitle('t-3dui-pfly', '★ 物理弹道粒子 PARTICLES 对位 Vfx3D（shape:cone+gravity 先窜后落 · flyTo=AnchorRef 飞向节点 · trail 拖尾 · 色/径分档）'),
      { type: 'Panel', id: '3dui-pfly-row', props: { bare: true }, layout: { direction: 'row', gap: 28, padding: 22, align: 'center', justify: 'between' },
        children: [
          { type: 'Panel', id: 'pfly-stage', props: { bg: 'sunken' }, layout: { width: 210, height: 140, padding: 0, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'pfly-hint', props: { text: '发射台', size: 'xs', color: 'text' } }, // dim 在 daylight sunken 上 2.42 硬失败（审计实测）→ text
              { type: 'Particles', id: 'pfly-burst', props: {
                kind: 'coins', count: 14, shape: 'cone', coneAngle: 0.5, speed: 560, gravity: 1050, drag: 0.6,
                lifetime: 2.2, stagger: 36, size: [12, 16, 20, 22, 26, 30],
                colorGradient: [{ t: 0, color: '#ffffff' }, { t: 0.45, color: '#ff5d7d' }, { t: 1, color: '#ff5d7d', alpha: 0.75 }],
                flyTo: { kind: 'node', id: 'pfly-wallet' },
                trail: { segments: 6, fade: 0, blend: 'add' },
              }, layout: { width: 210, height: 140 } },
            ] },
          { type: 'Label', id: '3dui-pfly-l', props: { text: '定稿写法照搬：14 颗 · 六档 12–30 · 芯白→牌色→牌色75% 径向渐变 · 每颗错开 36ms · cone 初速向上窜再被 gravity 俯冲、弹簧引向右侧钱包（flyTo=AnchorRef{kind:node,id}·同 Float/flyTo 一套寻址）· 拖尾对位 Trail3D(segments/width/fade/blend)。全静态数据·动画归渲染器 rAF——禁「每帧换新贴图」那条路。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
          { type: 'Badge', id: 'pfly-wallet', props: { text: '👛 钱包', tone: 'gold' } },
        ] },

      divider('d-3du10'),
      sectionTitle('t-3dui-exit', '★ 退场 / 飘字动画 anim（fadeOut·popOut 一次性退场 + floatUp 循环升冒·+N 收益飘字）'),
      { type: 'Panel', id: '3dui-exit-row', props: { bare: true }, layout: { direction: 'row', gap: 40, padding: 24, align: 'center' },
        children: [
          // floatUp 循环（可见）：一叠 +N 收益数字持续升起淡出。
          { type: 'Panel', id: 'floatup-stage', props: { bg: 'sunken' }, layout: { width: 160, height: 120, padding: 0, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'fu-1', props: { text: '+50', size: 'lg', bold: true, color: 'gold', glow: true }, layout: { anim: 'floatUp', animMs: 1800 } },
              { type: 'Label', id: 'fu-2', props: { text: '+120', size: 'md', bold: true, color: 'ok' }, layout: { x: 90, y: 40, anim: 'floatUp', animMs: 2100, animDelay: 600 } },
              { type: 'Label', id: 'fu-3', props: { text: '+8', size: 'md', bold: true, color: 'jade' }, layout: { x: 30, y: 60, anim: 'floatUp', animMs: 1600, animDelay: 300 } },
            ] },
          { type: 'Label', id: 'exit-fu-l', props: { text: 'floatUp（循环）= +N 收益飘字升起淡出（挂 animDelay 错峰成一串·idle/消除游戏刚需）。', color: 'sub', size: 'sm' }, layout: { width: 200 } },
          // 一次性退场（进本页播一次·both 停末态）。
          { type: 'Panel', id: 'exit-once', props: { bare: true }, layout: { direction: 'column', gap: 10, align: 'center' },
            children: [
              { type: 'Badge', id: 'exit-fade', props: { text: 'fadeOut', tone: 'warn' }, layout: { anim: 'fadeOut', animMs: 1400 } },
              { type: 'Badge', id: 'exit-pop', props: { text: 'popOut', tone: 'danger' }, layout: { anim: 'popOut', animMs: 1400 } },
            ] },
          { type: 'Label', id: 'exit-once-l', props: { text: '← fadeOut / popOut（一次性退场·both 停末态）：toast 消失、弹窗关闭、三消物消除。补齐入场(fadeIn/pop)的退场对称位。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du11'),
      sectionTitle('t-3dui-ring', '★ 环形 / 径向进度 PROGRESSBAR.shape:"ring"（体力环 / 每日目标 / 冷却环·休闲常见·补线性条之外）'),
      { type: 'Panel', id: '3dui-ring-row', props: { bare: true }, layout: { direction: 'row', gap: 32, padding: 24, align: 'center' },
        children: [
          { type: 'ProgressBar', id: 'ring-sta', props: { value: 0.72, shape: 'ring', size: 88, tone: 'ok', showValue: true, label: '体力' } },
          { type: 'ProgressBar', id: 'ring-goal', props: { value: 0.45, shape: 'ring', size: 88, tone: 'gold', showValue: true, label: '日目标' } },
          { type: 'ProgressBar', id: 'ring-cd', props: { value: 0.9, shape: 'ring', size: 88, tone: 'accent', showValue: true, label: '冷却' } },
          { type: 'ProgressBar', id: 'ring-hp', props: { value: 0.3, shape: 'ring', size: 72, tone: 'danger', showValue: true } },
          { type: 'Label', id: '3dui-ring-l', props: { text: 'shape:"ring" = conic 弧 + 中心镂空显值。同 value/max/tone 语义，换个 shape 就从线性条变径向环。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      // 液面杯（REQ-UIFX·ProgressBar 同族第三档）：游戏只给标量 value·晃动/气泡全由渲染器 CSS 承担。
      sectionTitle('t-3dui-liquid', '★ 液面杯 PROGRESSBAR.shape:"liquid"（注水/蓄力·双错频波脊 + 整杯 slosh + 气泡·游戏只给标量 value）'),
      { type: 'Panel', id: '3dui-liquid-row', props: { bare: true }, layout: { direction: 'row', gap: 30, padding: 24, align: 'center' },
        children: [
          { type: 'ProgressBar', id: 'liq-cup', props: { value: 0.68, shape: 'liquid', radius: 18, fillColor: '#31b7f2', bubbles: 3, showValue: true }, layout: { width: 92, height: 140 } },
          { type: 'ProgressBar', id: 'liq-gold', props: { value: 0.45, shape: 'liquid', tone: 'gold', radius: 26, bubbles: 2, label: '蓄力' }, layout: { width: 78, height: 118 } },
          { type: 'ProgressBar', id: 'liq-still', props: { value: 0.55, shape: 'liquid', fillColor: '#7ed957', wave: false, radius: 12, label: '静水' }, layout: { width: 70, height: 104 } },
          { type: 'Label', id: '3dui-liquid-l', props: { text: 'shape:"liquid" = 液面杯：水面是两条错频椭圆脊（主脊 900ms scaleY1↔.5 荡±3% + 副脊白55% 1250ms 反向——两条不同步才有晃动感）+ 整杯以杯底为轴 ±1.6° slosh + 气泡按档上窜（16/11/20px·1.5/1.8/2.1s 错开发）。radius 按盒圆角裁 · fillColor 液色 · wave:false=静水。游戏只给 value（注水曲线在游戏侧算好逐帧喂）——禁每帧烤水面进贴图。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du12'),
      sectionTitle('t-3dui-holo', '★ 全息箔 fx:"holo"（彩虹光随角度流动·收集 / gacha 稀有卡演出·比 sheen 白斜扫更炫）'),
      { type: 'Panel', id: '3dui-holo-row', props: { bare: true }, layout: { direction: 'row', gap: 24, padding: 24, align: 'center' },
        children: [
          { type: 'PlayingCard', id: 'holo-card', props: { rank: 'A', suit: '♠', label: '★ 传说 赵子龙', size: 'lg' }, layout: { fx: [{ kind: 'holo' }] } },
          { type: 'Panel', id: 'holo-panel', props: { bg: 'gold-sheen', title: 'SSR' }, layout: { width: 150, height: 120, padding: 14, fx: [{ kind: 'holo' }], align: 'center', justify: 'center' },
            children: [{ type: 'Label', id: 'holo-p-l', props: { text: '稀有度箔光', size: 'sm', color: 'ink', bold: true } }] },
          { type: 'Label', id: '3dui-holo-l', props: { text: '新增 fx kind（闭集扩展=替代"开关爆炸"的正道）。holo 与 sheen/glow 可叠加。挂任意卡/面板/按钮。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du13'),
      sectionTitle('t-3dui-stroke', '★ 描边字 LABEL.stroke（comic 深色粗轮廓·卡通 / 休闲标题·paint-order 保填色可读）'),
      { type: 'Panel', id: '3dui-stroke-row', props: { bare: true }, layout: { direction: 'row', gap: 26, padding: 24, align: 'center' },
        children: [
          { type: 'Label', id: 'stroke-1', props: { text: 'LEVEL UP!', size: 'xxl', bold: true, color: 'gold', stroke: true, font: 'comic' } },
          { type: 'Label', id: 'stroke-2', props: { text: '大 吉', size: 'xxl', bold: true, color: 'danger', stroke: true, font: 'bubbly' } },
          { type: 'Label', id: 'stroke-3', props: { text: 'COMBO ×8', size: 'xl', bold: true, color: 'ok', stroke: true, glow: true } },
          { type: 'Label', id: '3dui-stroke-l', props: { text: 'stroke:true = 深色粗描边（paint-order:stroke fill 保填色不被盖）。可与 glow / 艺术字 font 叠——卡通爆字标配。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      // ══════ 🎁 休闲缺口补全批（数字格式化 / 飞向奖励 / 关卡地图 / 跑马灯 / 涟漪）══════
      divider('d-3du14'),
      { type: 'Label', id: 'gap-hdr', props: { text: '🎁 休闲缺口补全（数字格式化 · 飞向奖励 · 关卡地图 · 跑马灯 · 点按涟漪）', size: 'md', bold: true, color: 'gold' } },

      sectionTitle('t-3dui-format', '★ 数字格式化 LABEL.format（idle 大数 compact / 计时 time / 百分比 percent·配 tween 滚动同格式化）'),
      { type: 'Panel', id: '3dui-format-row', props: { bare: true }, layout: { direction: 'row', gap: 30, padding: 22, align: 'center' },
        children: [
          { type: 'Label', id: 'fmt-1', props: { text: '1500000', format: 'compact', size: 'xxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 'fmt-2', props: { text: '3661', format: 'time', size: 'xxl', bold: true, color: 'jade', mono: true } },
          { type: 'Label', id: 'fmt-3', props: { text: '0.75', format: 'percent', size: 'xxl', bold: true, color: 'ok' } },
          { type: 'Label', id: 'fmt-tw', props: { format: 'compact', tween: { from: 0, to: 9820000, ms: 1600 }, size: 'xxl', bold: true, color: 'warn' } },
          { type: 'Label', id: '3dui-format-l', props: { text: '1500000→1.5M · 3661秒→1:01:01 · 0.75→75% · tween 滚动到 9.8M（滚的过程也走缩写）。idle/休闲大数与计时刚需。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du15'),
      sectionTitle('t-3dui-fly', '★ 飞向奖励 layout.flyTo（元素沿弧线飞到目标锚·金币飞进钱包·进本页触发一次）'),
      { type: 'Panel', id: '3dui-fly-row', props: { bare: true }, layout: { direction: 'row', gap: 40, padding: 22, align: 'center', justify: 'between' },
        children: [
          { type: 'Panel', id: 'fly-src', props: { bare: true }, layout: { direction: 'row', gap: 10 },
            children: [
              { type: 'Badge', id: 'fly-c1', props: { text: '💰+50', tone: 'gold' }, layout: { flyTo: { to: 'fly-wallet', ms: 900, arc: 80, delay: 0 } } },
              { type: 'Badge', id: 'fly-c2', props: { text: '💰+50', tone: 'gold' }, layout: { flyTo: { to: 'fly-wallet', ms: 900, arc: 80, delay: 180 } } },
              { type: 'Badge', id: 'fly-c3', props: { text: '💎+5', tone: 'accent' }, layout: { flyTo: { to: 'fly-wallet', ms: 900, arc: 110, delay: 360 } } },
            ] },
          { type: 'Label', id: '3dui-fly-l', props: { text: '三枚金币/宝石从左侧沿弧线飞进右侧钱包（不同 delay=拖尾成串）。mountUI 量两者屏幕 rect 算位移·CSS 弧线飞。刷新本页重播。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
          { type: 'Badge', id: 'fly-wallet', props: { text: '👛 钱包', tone: 'ok' } },
        ] },

      divider('d-3du16'),
      sectionTitle('t-3dui-tick', 'anim:"marquee" 跑马灯（滚动公告）+ fx:"ripple" 点按涟漪（material 触感）'),
      { type: 'Panel', id: '3dui-tick-row', props: { bare: true }, layout: { direction: 'row', gap: 24, padding: 20, align: 'center' },
        children: [
          { type: 'Panel', id: 'marquee-box', props: { bg: 'sunken' }, layout: { width: 300, height: 40, padding: 0, align: 'center' },
            children: [{ type: 'Label', id: 'marquee-txt', props: { text: '📢 限时活动：登录送 888 钻 · 新赛季开启 · 通关冲榜赢皮肤 · ', size: 'sm', color: 'gold' }, layout: { anim: 'marquee' } }] },
          { type: 'Button', id: 'ripple-btn', props: { label: '点我涟漪', kind: 'primary', action: 'click', actionArg: 'ripple' }, layout: { fx: [{ kind: 'ripple' }] } },
          { type: 'Label', id: '3dui-tick-l', props: { text: 'marquee=横向匀速滚动公告条；ripple=:active 从中心扩散一圈波（触屏点按反馈）。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-3du17'),
      sectionTitle('t-3dui-levelmap', '★ 关卡地图 LEVELPATH（蛇形蜿蜒路径 + 连接线 + 星 + done/current/locked 状态·选关屏）'),
      { type: 'Panel', id: '3dui-levelmap-row', props: { bare: true }, layout: { direction: 'row', gap: 24, padding: 20, align: 'center' },
        children: [
          { type: 'LevelPath', id: 'demo-levelmap', props: { cols: 4, tone: 'gold', nodes: [
            { label: '1', state: 'done', stars: 3, action: 'pickLevel', actionArg: '1' },
            { label: '2', state: 'done', stars: 2, action: 'pickLevel', actionArg: '2' },
            { label: '3', state: 'done', stars: 3, action: 'pickLevel', actionArg: '3' },
            { label: '4', state: 'done', stars: 1, action: 'pickLevel', actionArg: '4' },
            { label: '5', state: 'current', action: 'pickLevel', actionArg: '5' },
            { label: '6', state: 'locked' }, { label: '7', state: 'locked' }, { label: '8', state: 'locked' },
          ] } },
          { type: 'Label', id: '3dui-levelmap-l', props: { text: '只给节点列表 + 状态，引擎自动排蛇形、画连线（通关段亮/未解锁段暗虚线）、渲节点（done 实心+星 / current 脉冲高亮 / locked 灰锁）。点节点发 pickLevel 信号选关。', color: 'sub', size: 'sm' }, layout: { flex: 1, maxWidth: 320 } },
        ] },
    ],
  };
}
