// Game I 展示台 · 页 · 3D 按钮布局
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { sectionTitle, divider } from './shared.js';
// ── 页 9 · 3D 按钮布局（owner 2026-09 点名）───────────────────────────────────
// 定位：既有「🧊 3D UI」页是**逐字段隔离演示**（一段演一个 rotateY/z/press3d）；本页是**布局样板**——
//   「一组按钮到底怎么摆成菜单」。六种排布，全是现成闭集字段的组合（零新控件·零自由 CSS）：
//   layout.rotate/rotateX/rotateY/z/scale/tilt3d/press3d + Button.kind/shape/sub/icon + Panel.shadow/edge/bg。
// 照抄法：复制那一段的 children 数组，只改 label/action 与那两三个数字。
export function buildPage3dButtons(): LayoutNode {
  // 一颗菜单钮的统一底座：kind 定皮、宽度统一（竖排菜单不随字长变宽·手册「统一等宽」律）。
  const btn = (id: string, label: string, kind: 'hero' | 'primary' | 'ghost' | 'quiet', extra: Record<string, unknown> = {}, lay: Record<string, unknown> = {}): LayoutNode =>
    ({ type: 'Button', id, props: { label, kind, action: 'click', actionArg: id, ...extra }, layout: { width: 150, height: 48, ...lay } });
  const note = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, color: 'sub', size: 'sm' }, layout: { flex: 1 } });

  return {
    type: 'Panel', id: 'page-3dbtn', props: { scroll: true },
    layout: { direction: 'column', gap: 18, padding: 20 },
    children: [
      { type: 'Label', id: '3dbtn-intro', props: {
        text: '3D 按钮「布局」样板——不是再演一遍 rotateY 是什么，而是「一组按钮怎么摆」。六种排布各配适用场景；全部只用现成字段组合（rotate/rotateX/rotateY/z/scale/press3d + Button.kind/shape/sub + Panel.shadow），零新控件、零自由 CSS。照抄=复制 children 数组、改 label/action 与那两三个数字。',
        color: 'text', size: 'sm' } },

      // ① 弧形扇出 —— 绕屏幕 Z 轴转（rotate），不是 3D，但最像「手柄/技能扇」。
      divider('d-3b1'),
      sectionTitle('t-3dbtn-arc', '① 弧形扇出菜单（LAYOUT.rotate + y 偏移 → 拇指弧·技能扇）'),
      // ⚠ 弧必须走**绝对定位**：x/y 同时给。只给 y 不给 x → 元素仍是 absolute 但 left 未定，
      //   五颗会叠在同一处（ui-audit 当场报 10 处重叠——本段初版真踩过）。这条是本页最值钱的一课。
      { type: 'Panel', id: '3db-arc', props: { bare: true }, layout: { width: 664, height: 148, padding: 4 },
        children: ([['攻击', -14, 12, 62], ['技能', -7, 144, 26], ['必杀', 0, 276, 8], ['道具', 7, 408, 26], ['撤退', 14, 540, 62]] as const)
          .map(([label, rot, x, y], i): LayoutNode =>
            btn(`ab-${i}`, label, i === 2 ? 'hero' : 'primary', { shape: 'pill' }, { width: 104, height: 44, rotate: rot, x, y })),
      },
      { type: 'Panel', id: '3db-arc-n', props: { bare: true }, layout: { direction: 'row', padding: 4 },
        children: [note('3db-arc-l', '拇指可达的弧：中间 rotate:0 最高，两翼逐级 ±7/±14° 并沿 y 下沉。⚠ 关键：弧要 x/y **成对**给（只给 y 会让五颗叠成一摞——layout.y 是绝对定位不是相对偏移）。旋转会撑大包围盒，x 间距留足（这里 132 > 旋转后的 111）。移动端「技能扇/表情轮」标配。')] },

      // ② 景深主菜单 —— z 让主 CTA 真的「凸出来」。
      divider('d-3b2'),
      sectionTitle('t-3dbtn-depth', '② 景深主菜单（LAYOUT.z + scale → 主 CTA 凸出·次级后退）'),
      { type: 'Panel', id: '3db-depth', props: { bare: true }, layout: { direction: 'column', gap: 12, padding: 26, align: 'center', perspective: 900 },
        children: [
          btn('db-start', '开始游戏', 'hero', { sub: '继续第 12 关' }, { width: 190, height: 58, z: 60, scale: 1.06 }),
          btn('db-shop', '商店', 'primary', {}, { width: 165, z: 10 }),
          btn('db-set', '设置', 'ghost', {}, { width: 150, z: -30, scale: 0.96 }),
          btn('db-quit', '退出', 'quiet', {}, { width: 140, z: -60, scale: 0.92 }),
        ] },
      { type: 'Panel', id: '3db-depth-n', props: { bare: true }, layout: { direction: 'row', padding: 4 },
        children: [note('3db-depth-l', '层级=z（+60 凸出 → −60 后退）配 scale 微调。主 CTA 用 kind:"hero" + sub 把关键信息写进键面（别塞到键外当说明）。这是主菜单的默认摆法。')] },

      // ③ 透视斜置控制台 —— 父面板 rotateX，按钮作为子层随面倾斜（sci-fi HUD）。
      divider('d-3b3'),
      sectionTitle('t-3dbtn-console', '③ 透视斜置控制台（父 PANEL.rotateX → 整面倾斜·按钮随面躺下）'),
      { type: 'Panel', id: '3db-con-wrap', props: { bare: true }, layout: { direction: 'row', gap: 20, padding: 30, align: 'center', justify: 'center' },
        children: [
          {
            type: 'Panel', id: '3db-console', props: { bg: 'ink-deep', edge: 'jade' },
            layout: { direction: 'grid', cols: 3, gap: 10, padding: 16, width: 330, radius: 12, rotateX: 34, z: -20 },
            children: (['雷达', '护盾', '引擎', '武器', '通讯', '自毁'] as const).map((l, i): LayoutNode =>
              btn(`cn-${i}`, l, i === 5 ? 'quiet' : 'ghost', { shape: 'cut' }, { width: 92, height: 40 })),
          },
          note('3db-con-l', '按钮不各自转——转的是**承载它们的面板**（rotateX:34），子层随面躺下、自动共面。sci-fi 控制台/驾驶舱面板就是这一招；改一个数就改倾角。'),
        ] },

      // ④ 旋转木马选择器 —— rotateY + z 摆成一圈，中间那颗是当前选中。
      divider('d-3b4'),
      sectionTitle('t-3dbtn-carousel', '④ 旋转木马选择器（LAYOUT.rotateY + z → 角色/模式左右翻选）'),
      { type: 'Panel', id: '3db-caro', props: { bare: true }, layout: { direction: 'row', gap: 6, padding: 30, align: 'center', justify: 'center', perspective: 760 },
        children: ([['难度·易', 50, -80], ['难度·中', 28, -34], ['难度·难', 0, 50], ['噩梦', -28, -34], ['地狱', -50, -80]] as const)
          .map(([label, ry, z], i): LayoutNode =>
            btn(`cr-${i}`, label, i === 2 ? 'hero' : 'ghost', { shape: 'pill' }, { width: 120, height: 50, rotateY: ry, z })),
      },
      { type: 'Panel', id: '3db-caro-n', props: { bare: true }, layout: { direction: 'row', padding: 4 },
        children: [note('3db-caro-l', '同 cover-flow 的排法搬到按钮上：只有 rotateY 与 z 两个数不同（中间 0/+50 朝前、两翼 ±28/±50 后旋退后）。换选中项=换这组数，结构一字不改。')] },

      // ⑤ 糖果厚钮网格 —— press3d + Panel.shadow，手机上最实用的一档。
      divider('d-3b5'),
      sectionTitle('t-3dbtn-candy', '⑤ 糖果厚钮网格（LAYOUT.press3d + PANEL.shadow → 按得下去的实体感·触屏首选）'),
      { type: 'Panel', id: '3db-candy-wrap', props: { bare: true }, layout: { direction: 'row', gap: 20, padding: 26, align: 'center' },
        children: [
          {
            type: 'Panel', id: '3db-candy', props: { bg: 'raised', shadow: { y: 6 } },
            layout: { direction: 'grid', cols: 3, gap: 12, padding: 16, width: 384, radius: 14 },
            // ⚠ hero 皮自带 30px 横向内边距——宽度给不够会**折行**（初版 92px 把「抽卡」折成两行）。
            //   网格里混 hero 时按最宽的那颗定列宽，别让 kind 决定的内边距把字挤掉。
            children: (['金币', '钻石', '体力', '抽卡', '邮件', '好友'] as const).map((l, i): LayoutNode =>
              btn(`cd-${i}`, l, i === 3 ? 'hero' : 'primary', { shape: 'pill' }, { width: 108, height: 46, press3d: true })),
          },
          note('3db-candy-l', 'press3d 走 :active——**触屏也触发**（tilt3d 只吃 :hover，手机上等于没有）。承载面加 Panel.shadow 硬边投影＝整块浮起来。休闲/手游主界面按钮墙用这一档。'),
        ] },

      // ⑥ 悬停抬起侧栏 —— tilt3d（桌面），配 rotateY 侧翼。
      divider('d-3b6'),
      sectionTitle('t-3dbtn-side', '⑥ 侧翼立体栏（LAYOUT.rotateY 侧转 + tilt3d 悬停抬起·桌面端）'),
      { type: 'Panel', id: '3db-side-wrap', props: { bare: true }, layout: { direction: 'row', gap: 24, padding: 26, align: 'center', perspective: 1000 },
        children: [
          {
            type: 'Panel', id: '3db-side', props: { bare: true },
            layout: { direction: 'column', gap: 10, rotateY: 22 },
            children: (['角色', '背包', '任务', '公会'] as const).map((l, i): LayoutNode =>
              btn(`sd-${i}`, l, 'ghost', { shape: 'tag' }, { width: 132, height: 42, tilt3d: true })),
          },
          note('3db-side-l', '整栏 rotateY:22 侧转成「翻开的书页」，每颗钮 tilt3d 悬停抬起。**仅桌面**——tilt3d 走 :hover，触屏无效，移动端改用 ⑤ 的 press3d。'),
        ] },

      divider('d-3b7'),
      { type: 'Label', id: '3dbtn-foot', props: {
        text: '选型速查：主菜单→② 景深 ｜ 技能/表情轮→① 弧形 ｜ 模式/角色选择→④ 木马 ｜ 手游按钮墙→⑤ 糖果厚钮（触屏）｜ 驾驶舱/仪表→③ 斜置面板 ｜ 桌面侧栏→⑥ 侧翼。移动端一律避开 tilt3d（只吃 hover），用 press3d。',
        color: 'gold', size: 'sm', bold: true } },
    ],
  };
}
