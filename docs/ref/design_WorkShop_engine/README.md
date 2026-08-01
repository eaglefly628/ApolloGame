# Handoff: 爱萌互动 · ZeroCraft Engine 工作台 UI

## Overview
「爱萌互动 ZeroCraft Engine」是一台 AI Native 休闲游戏引擎的**桌面端工作台 UI**（横屏 PC，1280×800）。创作者在此管理在研游戏、通过 AI 或模板库新建游戏、管理素材、发布、设置。整套视觉是 **Supercell（欧美卡通 / 预渲染 3D / Pixar 质感）× Disney（魔法装饰层）** 混搭基调。

## About the Design Files
本包内的 HTML 文件（`平台工作台 UI.dc.html`）是**用 HTML 制作的设计参考稿** —— 展示预期外观与交互的原型，**不是可直接照搬的生产代码**。任务是把这些设计在目标工程里**用 TypeScript（推荐 React + TypeScript）复刻出来**，采用工程既有的组件与规范；若尚无环境，则选最合适的框架实现。

HTML 中使用了一个自研的轻量组件运行时（`.dc.html` / support.js），复刻时**无需**关心该运行时 —— 只需按本文档的 tokens、组件规格、屏幕布局重建即可。所有图形（货币、宝石、游戏封面缩略图、图标）都是**内联 SVG**，没有外部位图依赖。

## Fidelity
**High-fidelity（hifi）**：颜色、字体、间距、圆角、阴影、交互均为最终值，请按像素复刻。下方 Design Tokens 给出全部精确值。

## 图片格式 / 参考图
`参考图/` 内为 4 张 PNG 高清截图（每屏一张，2× 分辨率，约 1818×1616px，透明背景外的 UI 主体）：
- `01-我的游戏库.png` — 主页（在研项目库）
- `02-新建游戏.png` — 新建路径选择页
- `03-模板库.png` — 品类模板库
- `04-AI新建.png` — AI 描述生成页

复刻建议：所有装饰图形请用**内联 SVG**（矢量、可换色、无锯齿），不要切位图；仅角色/封面的最终成品美术会替换成预渲染 3D PNG（带透明通道，`@1x/@2x/@3x`）。

---

## Design Tokens

### 颜色（固定九色 + 混搭扩展色）
```ts
export const palette = {
  sky:      '#5cc0f2', // 主背景蓝
  grass:    '#7ecb45', // 自然 / 成功 / 行动
  gold:     '#ffd257', // 财富 / CTA
  wood:     '#c88a52', // 面板 / 侧栏木纹
  gem:      '#37b6ef', // 硬通货蓝
  chalice:  '#c14fe0', // 体力 / 能量紫
  danger:   '#ef5138', // 危险 / 警告红
  ink:      '#3a2312', // 统一描边（墨棕，非纯黑）
  cream:    '#fff5db', // 文字填充 / 浅底
} as const;

// Disney 混搭扩展色（仅用于魔法光效 / 星尘，不用于主底板）
export const magic = {
  rose:     '#f2789f',
  lavender: '#b47ce6',
  mint:     '#5fe0d0',
} as const;

// 常用衍生
export const shade = {
  goldEdge:  '#c98a1e', // 金色果冻按钮底沿
  grassEdge: '#4e8a24',
  gemEdge:   '#1f86bd',
  dangerEdge:'#b8341f',
  woodDark:  '#bd7f47',
  panelTop:  '#fffdf5',
  panelBot:  '#fff0cf',
};
```

### 字体
```
标题 / 中文装饰体： 'ZCOOL KuaiLe'（站酷快乐体，Google Fonts）
英文粗体 / 数字：   'Fredoka'（weights 400–700）
正文中文：          'Noto Sans SC'（weights 400/600/700/900）
备用正文：          'Baloo 2'
```
Google Fonts import:
`https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Baloo+2:wght@500;600;700;800&family=ZCOOL+KuaiLe&family=Noto+Sans+SC:wght@400;500;700;900&display=swap`

### 招牌文字效果（signature text lockup）
所有标题都是「奶油描边字」：
```css
color: #fff5db;
-webkit-text-stroke: 8px #3a2312;   /* 厚度按字号缩放：大标题 8–9px，中 4–6px，小 2.5–3px */
paint-order: stroke fill;           /* 关键：先描边后填充，字才不会被吃掉 */
text-shadow: 0 5px 0 #c98a1e;       /* 金色下沿（硬投影，无模糊） */
```
Disney 混搭时再叠：`text-shadow: …, 0 0 18px rgba(255,220,130,.9)`（金色外发光）。
⚠️ 注意：**不要**用 `filter: drop-shadow()` 配 `paint-order` —— 会让厚描边盖住填充色。发光用 `text-shadow` 叠加。

### 间距 / 圆角 / 描边
```
描边宽度：      面板 4px，卡片 3–4px，按钮 3px，小徽章 2–2.5px，统一色 #3a2312
圆角：          大面板 22–28px，卡片 18–20px，按钮 12–16px，胶囊 999px，芯片 10–14px
卡片间距(gap)： 14–18px
内容内边距：    主区 24px 26px，面板 14–20px
```

### 阴影（体积感 = 硬投影 + 内高光 + 内底暗）
```css
/* 面板 */
box-shadow: 0 6px 0 rgba(58,35,18,.28), 0 12px 18px rgba(0,0,0,.16),
            inset 0 3px 0 rgba(255,255,255,.7);
/* 果冻按钮（top/bottom 为渐变两端，edge 为底沿硬投影色） */
box-shadow: 0 6px 0 <edge>, 0 10px 12px rgba(0,0,0,.26),
            inset 0 3px 0 rgba(255,255,255,.55), inset 0 -6px 0 rgba(0,0,0,.18);
```

---

## 组件规格（Components）

### JellyButton（果冻按钮）
- 竖排 flex 居中，`padding: 12px 26px`，圆角 16px，3px `#3a2312` 描边。
- 背景 `linear-gradient(180deg, <top>, <bottom>)`；四语义配色：
  - 绿=行动 `#8fe05a→#6cbf37` edge `#4e8a24`
  - 金=消费 `#ffdd6e→#f5b731` edge `#c98a1e`
  - 蓝=常规 `#5fcdf5→#37b6ef` edge `#1f86bd`
  - 红=危险 `#ff7a5f→#ef5138` edge `#b8341f`
- 文字：ZCOOL KuaiLe，`#fff5db`，`text-shadow: 0 2px 0 rgba(0,0,0,.28)`。
- **按下态**（`:active`）：`transform: translateY(4px)`，阴影从 `0 6px 0` 收到 `0 2px 0`（模拟真实下陷）。`transition: transform .06s, box-shadow .06s`。

### CurrencyChip（货币芯片）
- 深棕胶囊 `linear-gradient(180deg,#4a3320,#2e1d0e)`，圆角 999px，`0 4px 0 rgba(0,0,0,.35)`。
- 左侧圆形图标（金币=径向金渐变 + `$`；宝石=墨底 + 蓝多边形 SVG），右侧 Fredoka 粗体数字 `#fff5db`。

### GameCard（游戏卡 / 模板卡）
- 白底，4px `#3a2312` 描边，圆角 20px，面板阴影。
- 上部封面区 `height:118–128px`，品类专属渐变底 + 居中 SVG 缩略图（`drop-shadow(0 4px 0 rgba(58,35,18,.35))`）。
- 状态徽章（右上角胶囊）：开发中=金 `#ffd257`/墨字，已发布=绿 `#7ecb45`/奶油字，草稿=灰 `#c8c8c8`/墨字。
- 底部信息条：`linear-gradient(180deg,#fffdf5,#fff0cf)`，标题(ZCOOL) + meta(Fredoka) + 「编辑/选用」蓝/绿果冻小按钮 + 进度条。
- **hover**：`transform: translateY(-6px)`，`transition: transform .12s`。

### SidebarNav（左侧木纹导航）
- 宽 236px，`repeating-linear-gradient(180deg,#c88a52 0 11px,#bd7f47 11px 22px)`（木纹条），右边框 4px + `inset -6px 0 0 rgba(0,0,0,.18)`。
- 顶部 logo 金牌：见「品牌」。导航项：选中=金渐变胶囊 `0 4px 0 #c98a1e` + 墨字；未选=`rgba(58,35,18,.12)` 半透底 + 奶油字 + `text-shadow: 0 1px 0 rgba(0,0,0,.4)`。
- 底部账号卡。

### Panel / Popup（面板 / 弹窗 · 九宫格思路）
- 奶油渐变底 + 4–5px 描边 + 顶部金色缎带（ribbon，带两侧卷尾 SVG）+ 右上红叉圆钮。
- Disney 混搭：四角金藤 filigree SVG + `0 0 26px rgba(255,220,130,.5)` 柔光 + 内部飘浮星尘（twinkle 动画）。
- 生产实现按 **9-slice** 切图，四角固定、边缘单向拉伸、中心双向。

### 装饰层（Disney mashup）
- **星尘 Sparkle**：4 角星形 SVG（`M50,4 C54,40 60,46 96,50 …`）+ 中心白点，`@keyframes twinkle{0%,100%{transform:scale(.5);opacity:.3}50%{transform:scale(1);opacity:1}}`，随机位置/时长散布。
- **金藤 filigree**：卷草 SVG，双描边（外 9px 墨 + 内 5px 金），放弹窗/相框四角。
- **缎带卷尾 ribbonTail**：`#c98a1e` 填充卷曲 SVG，贴在金色缎带两端。
- **角色「有神」**：大眼（椭圆白 + 深瞳 + 高光点）+ 睫毛 + 腮红（`rgba(242,120,159,.7)`）+ 外发光。

---

## Screens / Views

### 1. 我的游戏库 My Games（主页，默认屏）
- **布局**：左侧栏 236px + 右主区（顶栏 + 内容滚动区）。内容为 3 列网格，`gap:18px`。
- **第一张卡**：虚线描边「＋新建游戏」幽灵卡（点击 → 新建路径选择页），绿色圆形 ＋ 图标。
- **其余卡**：在研项目 GameCard（糖果消消乐/王国塔防/泡泡传说/合成龙蛋/星际战机），带状态徽章 + 进度条 + 「编辑」钮。
- **顶栏**：页标题「我的游戏库 / MY GAMES · 在研项目」+ 搜索框（羊皮纸底）+ 金币/宝石货币芯片。

### 2. 新建游戏 New Game（路径选择）
- 顶部「← 返回游戏库」浅色返回钮。
- 居中标题「怎么开始你的新游戏？ / CHOOSE A STARTING POINT」。
- 两张大选择卡（760px 居中，2 列）：
  - **AI 新建**（紫渐变 `#c9b6f0→#9a7ce0`，闪星图标）→ 进入 AI 描述页
  - **从模板库选择**（绿渐变 `#bfe6a0→#7ecb45`，九宫格图标）→ 进入模板库
- hover 抬起 6px。

### 3. 模板库 Template Library
- 「← 返回选择」+ 蓝色说明条。
- 3 列模板卡网格，10 个品类 sample（三消/塔防/飞机大战/跑酷/合成/泡泡龙/2048/放置/打砖块/农场），每卡品类标签 + `sample` 徽章 + 「选用」绿钮（→ 带入 AI 描述页并 toast 提示）。

### 4. AI 新建 Create（描述生成）
- 「← 返回选择」+ 左右 2 栏（1.15 : 0.85）。
- 左：羊皮纸输入面板（预填创意文案）+「生成游戏」绿钮 → 触发进度条（旋转 spinner + 4 阶段文案「解析创意→生成美术资产→搭建关卡→打包预览」+ 百分比，每 110ms +4%）。
- 右：4 条「灵感示例」可点卡片，点击填入输入框。

### 5/6/7. 素材库 / 发布 / 设置
- **素材库**：分类 tab（全部/角色/场景/道具/特效）+ 6 列资产网格（宝石多边形缩略 + 命名 `td_enemy_goblin` 等）。
- **发布**：项目卡 + 4 平台多选（iOS/安卓/Web/小程序，选中描金边 + 绿勾）+ 三步状态灯（打包→审核→上架，每 800ms 进一步）+「一键发布」钮 + toast。
- **设置**：账号木纹卡 + API 密钥（复制钮）+ 3 个开关（音效/通知/自动保存）+ 画质分段控件（低/中/高）。

## Interactions & Behavior
- **导航**：侧栏 4 项（我的游戏库高亮覆盖 games/newgame/templates/create 全流程）+ 素材库/发布/设置。新建流程带面包屑返回，逐级后退。
- **按钮按下**：所有果冻钮 `translateY` + 收阴影，`transition .06s`。
- **卡片 hover**：`translateY(-6px/-8px)`。
- **AI 生成 / 发布**：定时器驱动的进度动画（见上）。
- **toast**：底部居中弹出，`@keyframes toastin`（上移淡入），2.2s 后消失。
- **开关**：track 变色 + knob 左右滑（`transition .15s`）。

## State Management
```ts
type Screen = 'games' | 'newgame' | 'templates' | 'create' | 'assets' | 'publish' | 'settings';
interface State {
  screen: Screen;
  coins: number; gems: number;
  prompt: string;
  generating: boolean; genPct: number; done: boolean;
  activeCat: '全部' | '角色' | '场景' | '道具' | '特效';
  platforms: { iOS: boolean; Android: boolean; Web: boolean; MP: boolean };
  publishing: boolean; publishStep: number;
  sound: boolean; notif: boolean; autosave: boolean;
  quality: '低' | '中' | '高';
  toast: string | null;
}
```
- `generate()`：setInterval 110ms，genPct +4，到 100 停并 done=true。
- `startPublish()`：setInterval 800ms，publishStep 0→3，到 3 toast「发布成功」。
- 卸载时 `clearInterval` 所有计时器。

## 品牌 Branding
- **logo 金牌**：金渐变胶囊 `linear-gradient(180deg,#ffe08a,#f5b731)`，3px 描边，`0 5px 0 #c98a1e`。
  - 主名「爱萌互动」ZCOOL KuaiLe 24px 奶油描边字。
  - 副名「ZEROCRAFT ENGINE」Fredoka 700 9px，`letter-spacing:.14em`，色 `#8a5a1c`。
- 账号名：豆包工作室（示例，可替换）。

## Assets
全部为**内联 SVG**（货币图标、宝石、游戏品类缩略图、导航图标、装饰星尘/金藤/缎带）。无外部位图。字体走 Google Fonts。最终上线时角色/封面成品美术替换为预渲染 3D 透明 PNG（`@1x/@2x/@3x`）。

## Files（本包已包含全部设计文件 + 美术）

### 设计参考稿（HTML 原型）
- `平台工作台 UI.dc.html` — **主交付**：完整工作台 UI（含全部 7 屏与交互逻辑）。
- `Supercell 美术系统 · 基调规范.dc.html` — **基调规范**：九色板、招牌奶油描边字、果冻按钮、面板/阴影体积感、装饰层的定义总表。复刻时的「设计源头」，tokens 与组件规格均以此为准。
- `模板 · 三消 Match-3.dc.html` — 三消品类游戏模板参考稿。
- `模板 · 塔防 Tower Defense.dc.html` — 塔防品类游戏模板参考稿。
- `风格探索 · Supercell × Disney 混搭.dc.html` — 混搭基调的风格探索稿（星尘 / 金藤 / 缎带 / 魔法光效的来源）。
- `support.js` — `.dc.html` 组件运行时。**复刻时无需关心**，仅供本地打开 HTML 预览用。

### 美术 / 图片
- `参考图/*.png` — 4 屏工作台高清截图（我的游戏库 / 新建游戏 / 模板库 / AI 新建）。
- `美术渲染图/*.png` — 全部设计稿的成品渲染截图（基调规范、模板、混搭探索、工作台各屏及弹窗态），供直接比对最终视觉。

### 本地预览
任意 `.dc.html` 与同目录 `support.js` 一起用浏览器打开即可查看交互原型。所有图形均为内联 SVG，无外部位图依赖。

## 复刻建议（TypeScript / React）
1. 建 `tokens.ts`（上方 palette/magic/shade）+ 一个 `<JellyButton variant>`、`<CurrencyChip>`、`<GameCard>`、`<SidebarNav>`、`<Panel>` 组件库。
2. 招牌字做成 `<StrokeText>` 组件封装 `-webkit-text-stroke + paint-order`。
3. 装饰 SVG（星尘/金藤/缎带/宝石/缩略图）抽成独立 SVG 组件，props 控制颜色。
4. 屏幕用一个 `screen` 状态机切换；计时动画用 `useEffect + setInterval`，卸载清理。
5. hover/active 用 CSS（`:hover`/`:active`）而非 JS，保证 60fps。
