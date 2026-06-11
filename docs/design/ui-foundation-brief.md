# Apollo UI 基础库 · 设计简报（给 Claude designer）

> 2026-06-10 · 委托方:Apollo 引擎团队 · 性质:**设计简报(brief)**,不是实现。
> 目标:产出一套**高级、统一、带完整交互态**的 UI 基础库设计——引擎壳层与游戏内 DOM HUD 共用。
> 红线:**不改任何游戏/引擎逻辑**。UI 是纯表现层(不进确定性模拟,不碰 world/hash)。

---

## 0. 一句话需求

把当前"每个界面各自手写内联样式、按钮没有悬浮/点击反馈、动效散落"的现状,**收敛成一套高级感的、可复用的交互组件库**——视觉沿用并精炼现有「青瓷 × 墨蓝 × 淡金」基调,重点补齐**悬浮(hover)/按压(press)/聚焦(focus)/禁用/加载/选中**这套交互语言。

## 1. 现状盘点(诚实,带硬数据)

**已有的好底子(保留并精炼,别推翻):**
- `src/ui/shell-theme.ts` 已定义不错的设计 token:四级墨蓝底(`bg0~bg3`)、发丝线(hairline)分隔、主色**青瓷** `#9cd2c5`、辅色**黛紫** `#a79ddb`、点睛**淡金** `#d4bd8a`、降饱和语义色、阔字距小标签、衬线 display 字体。气质定位写得很清楚:"清幽·高雅·高级·秩序——一台安静运转的 AI 引擎"。
- launcher 主页(卡带轮播 + 渐变标题 + 发丝线)已经体现了这套基调。

**真正的问题(要解决的):**
| 症状 | 实测 |
|---|---|
| 设计系统没被采用 | shell-theme 在 launcher 引用 15 次,但 **7 个游戏壳(game-a~f)全 0 次**——各自发明 UI |
| 硬编码色泛滥 | game-e 内联 **103** 处 hex、launcher **65** 处、game-c **10** 处 |
| **交互态缺失(核心)** | launcher 按钮 **0** hover/press,studio ~0,game-e 仅 5 处(注入 class 临时拼) |
| 动效散落 | game-e 有 **9** 个内联 `<style>` keyframe 块,各写各的(wiggle/sheen/coin/shopIn…) |
| 技术根因 | shell-theme 是**静态样式函数**(返回内联 CSSProperties)→ 写不出 `:hover/:active/:focus` 伪类 → "高级交互"无处安放 |

## 2. 两个层次(别混淆)

设计这套库时务必区分两层,它们**不是一回事**:
- **A. 引擎壳层 UI(本简报主体)**:launcher 主页、数据透视器(StudioInspector)、资源库(AssetLibrary)、资产导入向导、各游戏的 HUD 外框/返回钮/工具条。这是**引擎自己的脸**,要统一、高级、克制。
- **B. 游戏内 DOM HUD**:game-e(小丑牌:手牌/小丑排/商店/计分读出)、game-c 这类用 React-DOM 浮层做的游戏界面。**复用同一套基础库**,但允许换肤(每个游戏一套 token 皮肤)。
- **C.(不在范围内)** `src/ui/themes/` 里的 8 套游戏主题(cyberpunk/sakura-otome/pixel-retro…)是**面向玩家的、游戏世界内的 UI 皮肤**,与本库正交,别动。

> Canvas 约束:游戏画面是 canvas 渲染的,DOM UI **浮在 canvas 之上**——组件要处理好 z 层、`pointer-events`、半透明背板 + 毛玻璃(backdrop-filter)与画面的关系。

## 3. 要你(designer)产出什么

### 3.1 精炼后的视觉语言(在 shell-theme 基础上)
- 确认/微调色板(青瓷主、黛紫辅、淡金点睛、四级墨蓝底、发丝线);给出**完整的色彩用法规范**(背板/边/字/态各用哪级)。
- 排版梯级(display 衬线用在哪、UI sans 用在哪、mono 用在哪;字号/字重/字距阶梯)。
- 圆角、间距(spacing scale)、阴影、发丝线、毛玻璃的统一取值。
- 高级感来源:**克制 + 层次 + 微动效**,而不是堆装饰。少即是多。

### 3.2 组件清单(给出每个组件的视觉 + 全部状态)
基础:**Button**(primary/ghost/quiet/danger + size sm/md)、**IconButton**、**BackPill**、**Chip/Tag**(可选中)、**Badge**(ok/warn/dim)、**Panel/Card**、**Toolbar/SegmentedControl**、**Input/Textarea/Select**、**Slider**、**Tabs**、**Tooltip**、**Modal/Sheet/Drawer**、**Toast/通知**、**ProgressBar / Gauge(条)**、**Stat 读出**(标签+数值,带数字跳动)、**ListRow**、**EmptyState**、**Skeleton/Loading**、**Banner(阶段/胜负横幅)**、**Carousel 卡带**(launcher 已有,纳入规范)。

### 3.3 ⭐ 交互系统(本次重点,要最详尽)
为**每个可交互组件**定义完整状态机 + 精确动效规格:
- **状态**:default / **hover** / **press(active)** / **focus-visible** / **disabled** / **loading** / **selected/active**。
- **悬浮(hover)**:给出精确处方——抬升(translateY)、缩放(scale)、亮度(brightness)、阴影增强、边/洗色变化、发光(glow)幅度;时长 + 缓动(如 140ms `ease-out`)。
- **按压(press)**:点击瞬间的反馈——下沉/缩小(scale .97)、阴影收缩、可选涟漪(ripple)或高光闪;松开回弹曲线。**这是"点了有反应"的关键,当前完全缺失**。
- **聚焦(focus-visible)**:键盘可达的聚焦环(青瓷描边 + 柔光),鼠标点击不触发、键盘 Tab 才触发。
- **禁用/加载**:降透明 + 去交互 + (加载)内联 spinner;按钮加载时锁宽防跳动。
- **选中态**:卡带/chip/tab 选中的高亮规格(淡金或青瓷,克制)。

### 3.4 动效语言(统一,收编散落的 keyframe)
- 时长档(如 fast 120 / base 180 / slow 280ms)、缓动档(standard / decelerate / spring)。
- 进场/退场(淡入+轻位移)、列表交错(stagger,收编 game-e 的 shopIn)、数值跳动(计分/金币)、强调脉冲(收编 wiggle/sheen/coin)。
- **`prefers-reduced-motion` 降级**(无障碍必做)。

### 3.5 反馈与状态
加载 spinner、成功/失败 toast、乐观反馈、空状态、错误态的统一表达。

### 3.6 可达性
聚焦环、对比度(暗底上的低饱和色要够清晰)、键盘可操作、**点击热区 ≥ 视觉尺寸**(尤其 IconButton/chip)。

## 4. 技术取向(供你设计时心里有数,不必出代码)
- 实现层会把库做成**真正的 React 组件**(内部用状态或单张注入样式表管理 `:hover/:active/:focus-visible` + keyframes),取代现在"静态内联样式函数"——因为内联样式表达不了伪类。设计稿请按"组件有完整状态"来给,而非单一静态外观。
- 主题化走 **CSS 变量 / token**,一套组件多套皮肤(壳层皮肤 + 各游戏皮肤)。
- 纯 React、无额外 UI 框架依赖优先(当前项目是裸 React + 内联样式);若建议引入轻量方案请说明取舍。
- 组件必须能**浮在 canvas 上**正常工作(背板/毛玻璃/z 层/pointer-events)。

## 5. 交付物(希望你回什么)
1. **视觉规范**:精炼后的 token(色/排版/间距/圆角/阴影/动效档)。
2. **组件状态矩阵**:每个组件 × 每个状态的视觉(default/hover/press/focus/disabled/loading/selected),含精确动效处方(位移/缩放/亮度/阴影/时长/缓动)。
3. **动效规格**:时长/缓动档 + 进出场/交错/脉冲/数值跳动 + reduced-motion 降级。
4. **参考画面 mock**:至少 ① launcher 主页 ② 一个工具界面(透视器或资源库)③ 一个游戏内 HUD(game-e 商店/手牌)——展示组件组合后的高级观感。
5. 落地建议:如何用这套库替换 shell-theme 的静态函数 + 让 7 个游戏壳接入(迁移路径)。

## 6. 明确不做
- 不改游戏/引擎**逻辑**、不碰确定性模拟、不动 canvas 内的游戏美术。
- 不动 `src/ui/themes/`(面向玩家的游戏世界皮肤,另一层)。
- 不要为炫技堆装饰——气质是"清幽·高级·克制",微交互见功力,不是满屏特效。

## 7. 风格锚点(给你定调)
Linear / Vercel / Arc 那种**暗色、克制、发丝线、微妙悬浮与按压反馈**的高级工具感;加一点东方"青瓷+水墨留白"的清幽。**目标:让人一打开就觉得"这是一台精密、安静、高级的引擎",每次点击/悬浮都有恰到好处的微反馈。**

---

> 附:现状代码参考——`src/ui/shell-theme.ts`(现有 token,精炼起点)、`src/launcher.tsx`(主页,采用最好的一例)、`src/game-e.tsx`(最复杂的游戏内 UI,也是最该被库收编的一例)。
