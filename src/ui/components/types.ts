// UI Component System — 引擎静态 UI 层
//
// 弱模型的工作：写 LayoutNode 树（纯数据）。
// 引擎的工作：renderNode() + mountUI() 解释这棵树。
// 红线：游戏层不得在此之外手写 HTML 模板或 DOM 操作。

export type ComponentType =
  | 'Panel' | 'Button' | 'Label' | 'Dropdown' | 'Badge' | 'Input' | 'Divider'
  | 'Checkbox' | 'Toggle' | 'RadioGroup' | 'Image' | 'Screen' | 'Slider'
  | 'Table' | 'Tabs' | 'ProgressBar' | 'Tag' | 'Modal' | 'Toast' | 'Tooltip'
  | 'Card' | 'PlayingCard' | 'Stepper' | 'Segmented' | 'Avatar' | 'Accordion'
  | 'Rating' | 'Combobox' | 'Drawer' | 'VirtualList' | 'ContextMenu'
  | 'CoinFlip' | 'Versus' | 'Video';

/** 布局约束：坐标/尺寸/弹性。x/y 触发绝对定位；flex 在父 Panel/Screen 内生效。 */
export interface LayoutConstraints {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** 最大宽度上限 px（响应式·区别于固定 width）+ 自动外边距块居中。整页 chrome「居中圆角框」用：
   *  填一个 maxWidth 数字即得「窄屏铺满、宽屏封顶居中」（无显式 width 时填满到上限再居中）。复用面：所有页面级 UI。 */
  maxWidth?: number;
  flex?: number;
  gap?: number;
  direction?: 'row' | 'column' | 'grid';
  /** 仅 direction:'grid' 生效：单元格最小列宽 px（auto-fill 自适应列数·缺省 96）。卡牌格/货架填这一个数即得自适应网格。 */
  minCol?: number;
  /** 仅 direction:'grid' 生效：**固定列数**（覆盖 auto-fill → repeat(N,1fr)）。要「严格 N 列·格子等分父宽」时用（配 PlayingCard.fluid 让卡填满格、消卡间空隙）。 */
  cols?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** 主轴分布（justify-content·与 align 交叉轴对偶）：内容沿主轴(row=横/column=竖)的排布。
   *  between=两端对齐均分间隔·around/evenly=环绕均分·center/start/end=居中/首/尾。
   *  用于「内容竖向铺满/居中、消除顶部堆叠 + 底部留白」（owner 2026-06-25）。grid 模式忽略。 */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  padding?: number;
  margin?: number;
  /** 旋转角度（度·CSS transform rotate）。扇形手牌/卡牌斜摆填这一个数即得。 */
  rotate?: number;
  /** 缩放倍率（CSS transform scale）。选中态放大、强调用。 */
  scale?: number;
  /** 入场/强调动画预设名（引擎内建关键帧·mountUI 注入）：fadeIn/slideUp/pop/shake/dealIn/flyIn。 */
  anim?: string;
  /** 动画时长 ms（缺省 360）。 */
  animMs?: number;
  /** 动画延迟 ms（错峰发牌/逐元素入场用·缺省 0）。 */
  animDelay?: number;
  /** 可拖拽：渲染加 draggable + data-drag(=节点 id 作载荷)；mountUI 收 dragstart。 */
  draggable?: boolean;
  /** 放置区：信号名·渲染加 data-drop；mountUI 在此 drop 时调 handlers[信号](被拖节点 id)。 */
  dropZone?: string;
  /** 新手引导锚点键：渲染加 data-anchor → OnboardingOverlay 按它 querySelector 定位 spotlight 高亮（配世界 Coachmark{anchor}）。数据 UI 也能被引导。 */
  anchor?: string;
  /** 倒角切角 px（CSS clip-path 八边形·art-deco/扑克牌桌美学）：如 13 = 左上/右下各切 13px。给面板/卡/CTA 切角。 */
  chamfer?: number;
  /** 流光 sheen（render-only·质感）：true=元素上叠一道斜向流光循环扫过（CSS 注入 ::after·apollo-sheen-sweep）。
   *  按钮/标题/卡片的"湿润反光"质感（原 hero 键内置的 sheen 通用化·REQ-UI-G流光底纹①）。 */
  sheen?: boolean;
}

export interface ButtonProps {
  label: string;
  kind?: 'primary' | 'ghost' | 'quiet' | 'hero'; // hero=金色倒角 sheen 大 CTA（下沉自 game-g 出征键·owner 2026-06-25）
  disabled?: boolean;
  action?: string;
  actionArg?: string;
  sub?: string; // hero 键副标（小字第二行·如「挑战 曹操 · 难度 ★★」）
}

export interface LabelProps {
  text?: string; // 可选：spans / tween / bind 提供内容时可省（缺省空串）
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'; // xxl=28 xxxl=34（大标题·原版 felt 标题 34px·REQ-UI-Label大号字）
  color?: 'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger';
  bold?: boolean;
  mono?: boolean;
  /** 具名字体槽（复古/像素/磷光风换字体·下沉自 game-x 残响：VT323 时钟/Silkscreen 微标/DotGothic16 正文）。
   *  ui=主字体 / mono=等宽 / pixel=像素点阵(UITheme.fontPixel) / display=数码管展示字(UITheme.fontDisplay)。
   *  缺省按 mono 布尔回退（mono:true≈font:'mono'）。红线同 color：只收**枚举槽名**(最弱 LLM 能填)，绝不收自由 font-family 串。 */
  font?: 'ui' | 'mono' | 'pixel' | 'display';
  /** 磷光发光(text-shadow·琥珀时钟/霓虹标题)：true 时按当前 color 描一圈柔光。纯表现。 */
  glow?: boolean;
  /** 字距 px(letter-spacing·Silkscreen 全大写微标常用)。纯表现·只收数字(最弱 LLM 能填)。 */
  tracking?: number;
  /** 世界绑定(收编 GameShell stat)：resourceId·resolveBindings 时把 Resource.current 接到 text 后（text 作前缀/标签）。 */
  bind?: string;
  /** 打字机(收编 VN DialogBox 逐字显)：每字毫秒(>0 开)。mountUI 挂载时逐字揭示·teardown 清定时器。 */
  typewriter?: number;
  /** 数字滚动补间(render-only·掷骰滚到命点/筹码倍率分数跳动)：from→to 在 ms(缺省 600) 内由 mountUI 定时器动画到位；
   *  decimals=小数位(倍率用·缺省 0)。纯表现·不进 sim hash(同 typewriter)。弱模型只填 {from,to,ms} 数字。 */
  tween?: { from: number; to: number; ms?: number; decimals?: number };
  /** 富文本多段着色(render-only·词条高亮/分色说明)：替代单色 text，逐段自带 color(同 Label 令牌)/bold。
   *  纯数据(段数组)·最弱 LLM 能填；有 spans 时忽略 text。 */
  spans?: Array<{ text: string; color?: 'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger'; bold?: boolean }>;
}

export interface DropdownProps {
  options: Array<{ value: string; label: string }>;
  value?: string;
  placeholder?: string;
  action?: string;
}

export interface BadgeProps {
  text: string;
  tone?: 'ok' | 'warn' | 'dim';
}

export interface InputProps {
  placeholder?: string;
  value?: string;
  type?: 'text' | 'number';
  action?: string;
}

export interface PanelProps {
  title?: string;
  scroll?: boolean;
  /** 自定义底（令牌串·如 'var(--felt)'）：表达绿呢牌桌等特殊表面（下沉自 game-g·owner 2026-06-25）。缺省=主题 bg1。 */
  bg?: string;
  /** 暗角叠加（felt 牌桌四周渐暗 vignette）：true 时叠一层径向暗角·纯表现。 */
  vignette?: boolean;
  /** 高亮框（强调态/活动视口）：true 时用 jade 描边 + 柔光投影，替代默认细线边·纯表现。 */
  accent?: boolean;
  /** 无框纯布局容器（owner 2026-06-25「别千层框」）：true=不画边框/底/圆角、padding 缺省 0——只做 row/column/grid 分组。
   *  边框只留给「真该成一个框的东西」（外框/牌桌/侧栏/卡片）；行列分组一律 bare，避免嵌套出层层框。 */
  bare?: boolean;
  /** 图片贴图层（平铺·同 Screen.bgTexture）：贴图 URL → repeat 平铺叠在面板底上、可被 bgScroll 滚动。 */
  bgTexture?: string;
  /** 贴图平铺单元尺寸 px（配 bgTexture·缺省=图原始尺寸）。 */
  bgTextureSize?: number;
  /** UV 背景滚动（同 Screen.bgScroll·面板底纹滚动特效·render-only）。 */
  bgScroll?: { x?: number; y?: number; ms?: number };
  /** 程序化纹理叠层（render-only·质感）：stripe=45°斜条纹 / checker=棋盘格。叠在面板内容下（如原版 felt 牌桌斜纹·REQ-UI-G流光底纹③）。 */
  pattern?: 'stripe' | 'checker';
}

/** 单个开/关复选框。handler 收到 'true' | 'false'。 */
export interface CheckboxProps {
  label: string;
  checked?: boolean;
  action?: string;
}

/** 药丸形开关（Toggle Switch）。handler 收到 'true' | 'false'。 */
export interface ToggleProps {
  label: string;
  checked?: boolean;
  action?: string;
}

/** 互斥单选组。name 用于分组；handler 收到所选 value。 */
export interface RadioGroupProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  action?: string;
}

/** 图片/图标。fit 控制 object-fit；radius 为圆角 px。 */
export interface ImageProps {
  src: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'fill';
  radius?: number;
  /** 世界绑定(收编 GameShell image bind)：StringVar id·resolveBindings 时 src 取自其 value。 */
  bind?: string;
}

/**
 * 全屏根容器——页面背景层。
 * bg：CSS 颜色或渐变；image：背景图 URL；center：垂直水平居中子项。
 */
export interface ScreenProps {
  bg?: string;
  image?: string;
  /** 图片贴图层（平铺·区别于 image 的 cover 整图 & 主题 texture 的程序化纹理）：贴图 URL → 渲成 repeat 平铺、叠在底色上、可被 bgScroll 滚动。游戏填**已解析 URL**（资产 key 自行经 resolveAsset 解析·sim 持 key 保纯）。三路并存：程序化(主题 texture) / cover 整图(image) / 平铺图片(bgTexture)。 */
  bgTexture?: string;
  /** 贴图平铺单元尺寸 px（配 bgTexture·缺省=图原始尺寸）。 */
  bgTextureSize?: number;
  blur?: number;
  center?: boolean;
  /** UV 背景滚动（render-only·滚动 UI 特效）：背景每 ms(缺省 6000) 平移 (x,y) px 循环。配 texture/平铺底纹·mountUI 注入滚动动画。纯数字（弱模型能填）。 */
  bgScroll?: { x?: number; y?: number; ms?: number };
}

/** 数值滑块。handler 收到数值字符串（Number(arg) 转回）。 */
export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  label?: string;
  action?: string;
}

// ── Table（数据表 / 榜单 / 数值表）：列定义 + 行数据。游戏只填 columns + rows（最弱 LLM 能填）。 ──
// 列：key 取行 cells[key]；align 对齐；width 固定列宽 px（缺省弹性均分）。
export interface TableColumn { key: string; label: string; align?: 'left' | 'center' | 'right'; width?: number }
// 行：id 唯一；cells = 列 key → 文本；action 可选（整行可点·arg=行 id）；tone 着色（普通/强调/淡）。
export interface TableRow { id: string; cells: Record<string, string>; action?: string; tone?: 'normal' | 'accent' | 'dim' }
export interface TableProps { columns: TableColumn[]; rows: TableRow[]; title?: string; empty?: string }

// ── Tabs（= Table Pages）：带标签的多页。引擎管切换——点 label 切页、**不重建页内容**
//    （抗闪屏内建·下沉自 game-g 大厅 setTab 定点刷新；解决"切页重建 52 网格/跳滚动"一类 bug 一次）。 ──
// LayoutNode.children = 各页内容（顺序对齐 tabs：tabs[i] ↔ children[i]）。
// active = 当前页 id（缺省第一页）；action = 切页额外回调（可选·core 切换由引擎做、无需游戏处理）。
export interface TabsProps { tabs: { id: string; label: string; anchor?: string }[]; active?: string; action?: string } // tab.anchor=该页签 nav 按钮的新手引导锚点(→ data-anchor·spotlight 到具体页签·REQ-UI-Tabs每页签锚点)

// ── ProgressBar（纯展示比例条·血/蓝/经验/进度）：区别于可拖的 Slider。value/max → 填充宽度；tone 取主题令牌。──
// max 缺省 1（value 当 0..1 比例）；showValue=true 右上显示 百分比(max=1) 或 value/max。纯展示·无事件。
export interface ProgressBarProps {
  value: number; max?: number;
  tone?: 'accent' | 'gold' | 'ok' | 'warn' | 'danger';
  label?: string; showValue?: boolean;
  /** 世界绑定(收编 GameShell bar)：resourceId·resolveBindings 时 value/max 取自 Resource.current/max。 */
  bind?: string;
}

// ── Tag（可点过滤标签/词条·筛选条大量用）：active 高亮；可点(action·arg=actionArg)；可删(removable 显 ×)。──
export interface TagProps {
  label: string; active?: boolean; tone?: 'normal' | 'accent' | 'dim';
  action?: string; actionArg?: string; removable?: boolean;
  /** 尺寸档（缺省 md=原默认·向后兼容）：sm 紧凑筛选条 / md 默认 / lg「大气药丸」(货币计数 💎/💰、稀有度等需醒目的 pill·≈2x)。
   *  Tag 无 children 逃生、Label 无药丸 chrome——pill 缩放只能靠这一档（同 Modal/PlayingCard.size 体系）。 */
  size?: 'sm' | 'md' | 'lg';
}

// ── Modal（居中模态浮层 + 遮罩 + 关闭语义）：children = 弹窗体。──
// closable 显示右上 ×（缺省 true）；closeAction = 点 × / 点遮罩本身 时触发的信号（遮罩关闭由 mountUI 内建）。
export interface ModalProps {
  title?: string; size?: 'sm' | 'md' | 'lg'; closable?: boolean; closeAction?: string;
}

// ── Toast（飘字提示·非模态）：tone 着色的小药丸。──
// 既可作静态节点(渲染提示药丸)，也由挂载器 API showToast() 触发「定时自消」的浮层（duration ms·缺省 2600）。
export interface ToastProps {
  text: string; tone?: 'ok' | 'warn' | 'danger' | 'accent' | 'dim'; duration?: number;
}

// ── Tooltip（悬浮提示/词条浮窗）：包裹 children 作触发元素；hover/focus 显示 content 气泡。──
// 内联样式表达不了 :hover → 显隐由 mountUI 内建（mouseover/focusin 显、移出隐）。placement 定气泡方位。
export interface TooltipProps {
  content?: string; placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 富气泡根（通常一个 Panel(column)·内含 标题/效果/数值行 Label+spans）：有它则气泡渲这棵 LayoutNode、忽略 content，气泡变宽可换行。地煞/天罡/装备等词条详情用。 */
  bubble?: LayoutNode;
  /** 块级触发元素（缺省 inline-flex）：true→触发元素 display:block + width:100%，能作 grid/flex item 随轨道(1fr)拉伸、
   *  不塌陷。用于「给 grid 卡墙里的整张牌/格子包 hover 浮窗」——内联 span 作 grid item 不拉伸会撑塌（PG 回执 2026-06-27）。 */
  block?: boolean;
}

// ── Card（网格卡单元·配 Panel grid 用）：媒体字形 + 标题 + 副标 + 角标 + tone/锁态 + 可点。──
// children 可放自定义体（覆盖默认 title/sub 排版）。Card + Panel(grid) = 卡牌格/货架标准组合。
export interface CardProps {
  title?: string; sub?: string; media?: string; corner?: string;
  tone?: 'normal' | 'accent' | 'dim' | 'locked'; action?: string; actionArg?: string;
}

// ── PlayingCard（扑克牌原语·下沉自各卡牌游戏的 bespoke 牌面 · owner 2026-06-25）─────────────
// 一张真正的扑克牌：花色角标(双角镜像) + 中央大花色 + 正/背面 + 选中/暗态 + 可点 + 牌下标签。
// 旋转/缩放/发牌动画走 layout(rotate/scale/anim:dealIn|flyIn|pop)——不在本控件内重造。
// 数据接口（最弱 LLM 也能填）：{ rank:'A', suit:'♠', faceUp:true }。花色色自动判红/黑（♥♦红·♠♣黑）。
// 复用面：扑克/接龙/TCG/Balatro 类一大片；game-g 主页对决卡、牌库 52 牌、收藏牌谱共用。
export interface PlayingCardProps {
  rank: string;                          // 'A' 'K' 'Q' 'J' '10'..'2'（或自定义点数文本）
  suit: string;                          // '♠'|'♥'|'♦'|'♣'（红黑自动判；其它符号按黑处理）
  faceUp?: boolean;                      // 缺省 true；false=展示牌背
  label?: string;                        // 牌下小标签（如名将名）
  value?: string;                        // 牌右下小数值（如 favor）
  selected?: boolean;                    // 选中高亮（入选出战组 → 金边发光）
  dimmed?: boolean;                      // 弱牌/未拥有 → 半透明
  size?: 'sm' | 'md' | 'lg';             // 牌面尺寸（缺省 md）
  face?: 'dark' | 'light';               // 牌面底：dark=暗主题卡(缺省) / light=经典白扑克牌（红黑对比·对决卡用）
  back?: string;                         // 牌背中央纹样字符（缺省 ♠ 暗纹）
  art?: string;                          // 立绘槽（已解析 URL/SVG）：正面时居中显名将立绘剪影、替代中央大花色（角标点数花色仍在）。游戏经 resolveAsset 把资产 key 解析后填（sim 持 key 保纯）。复用面：所有卡牌游戏。
  fluid?: boolean;                       // 流式卡：width:100% 充满父格 + 维持 5:7 aspect-ratio（替代固定 sm/md/lg 档）。配 Panel grid cols:N → 严格 N 列、卡填满、零卡间空隙（REQ-UI-G收藏卡②）。
  flipOnHover?: boolean;                 // 悬停翻面：配 backFace·鼠标悬停时 front→back scaleX 翻转，露出背面信息子树（CSS 注入·REQ-UI-G收藏卡①）。
  backFace?: LayoutNode;                 // 背面内容子树（通常 Panel(column) 装 名/朝代/简介，同 Tooltip.bubble 思路）。仅 flipOnHover 时渲。
  backPattern?: 'checker' | 'stripe';    // 牌背程序化纹理（faceUp:false 时叠·原版红牌背棋盘格条纹·REQ-UI-G流光底纹②）。
  action?: string; actionArg?: string;   // 可点 → handlers[action](actionArg)
}

// ── Stepper（数量 ± 加减）：value 当前值；±按钮 data-arg=钳位后的新值；到界禁用。handler 收到新值字符串。 ──
export interface StepperProps {
  value: number; min?: number; max?: number; step?: number; action?: string;
}

// ── Segmented（紧凑分段选择·比 RadioGroup 省地方）：options + value(选中)；handler 收到所选 value。 ──
export interface SegmentedProps {
  options: { value: string; label: string }[]; value?: string; action?: string;
}

// ── Avatar（头像/立绘位）：src 有则图、无则取 name 首字；size 尺寸 px；shape 圆/圆角/方。 ──
export interface AvatarProps {
  src?: string; name?: string; size?: number; shape?: 'circle' | 'rounded' | 'square';
}

// ── Accordion（折叠面板）：title 行点击切开合（mountUI 内建）；open 初始展开；children = 折叠体。action 可选通知信号。 ──
export interface AccordionProps {
  title: string; open?: boolean; action?: string;
}

// ── Rating（星级评分）：value 已亮颗数；max 总颗（缺省 5）；有 action 则可点设值(arg=点中颗数)，无则只读展示。 ──
export interface RatingProps {
  value: number; max?: number; action?: string;
}

// ── Combobox（带搜索的下拉）：输入框过滤选项、点选回填。──
// 过滤/开合/点选由 mountUI 内建（focus 开、input 过滤、点项选+合、点外合）；选中 → action(arg=value)。
export interface ComboboxProps {
  options: { value: string; label: string }[]; value?: string; placeholder?: string; action?: string;
}

// ── Drawer（侧滑/底部抽屉）：children = 抽屉体。──
// 机制同 Modal（遮罩 + 关闭复用 mountUI 遮罩关闭）；side 定贴边方位。closeAction = 点 × / 点遮罩信号。
export interface DrawerProps {
  side?: 'left' | 'right' | 'bottom'; title?: string; closeAction?: string;
}

// ── VirtualList（长列表虚拟滚动）：只渲可视窗口的行（不一次性渲全部·解决千行级卡顿）。──
// 列定义同 Table；rowHeight 固定行高；height 视口高(缺省 320)；action 行可点(arg=row.id)。
// 滚动重渲窗口由 mountUI 内建（持 root 数据·按 scrollTop 算窗口）。
export interface VirtualListProps {
  rows: { id: string; cells: Record<string, string> }[];
  columns?: TableColumn[]; rowHeight: number; height?: number; action?: string;
}

// ── ContextMenu（右键/长按菜单）：包裹 children 作触发元素；右键(contextmenu)在光标处弹菜单。──
// 弹出/定位/点项/点外合由 mountUI 内建；点项 → 该项 action(arg=item.id)。
export interface ContextMenuProps {
  items: { id: string; label: string; action: string }[];
}

// ── CoinFlip（掷币·下沉自 game-g 掷命对决 3D 硬币 · owner 2026-06-25）─────────────────
// 确定性掷币：结果由游戏算好(outcome)传入·控件只演出。spinning=true 播 3D 翻转落定到 outcome；false=静态显示。
// 数据接口：{ outcome:'heads' }。复用面：掷命/猜硬币/随机二选一演出（多游戏通用）。
export interface CoinFlipProps {
  outcome: 'heads' | 'tails';            // 结果（确定性·游戏侧算好）
  headsLabel?: string; tailsLabel?: string; // 两面文字（缺省 正/反）
  spinning?: boolean;                    // true=播翻转动画落定；false=静态显示结果
  size?: number;                         // 直径 px（缺省 92）
  durationMs?: number;                   // 翻转时长（缺省 1100）
  action?: string;                       // 可选点击信号
}

// ── Versus（对决特写·下沉自 game-g 对决火花 · owner 2026-06-25）─────────────────────
// 两张牌正面对决 + 中央胜率/火花 + 胜方高亮。复用面：卡牌对战/PVP 结算特写。
// 数据接口：{ left:{rank,suit}, right:{rank,suit}, label:'76 : 24', winner:'left' }。
export interface VersusProps {
  left: PlayingCardProps; right: PlayingCardProps; // 左右两张牌
  label?: string;                        // 中央文字（如胜率 '76 : 24'）
  winner?: 'left' | 'right' | 'none';    // 胜方高亮（败方暗）
  spark?: boolean;                       // 中央火花闪（缺省 true）
}

// ── Video（视频嵌入·爱诗 AIGP 生成的开场/转场短视频等）：原生 <video>·数据驱动播放。
// src/poster 为 URL（爱诗句柄 url / 海报）；controls 缺省开；autoplay 自动补 muted（浏览器策略）。纯表现。
export interface VideoProps {
  src?: string; poster?: string;
  controls?: boolean; loop?: boolean; autoplay?: boolean; muted?: boolean;
}

export type ComponentProps =
  | ButtonProps | LabelProps | DropdownProps | BadgeProps | InputProps | PanelProps
  | CheckboxProps | ToggleProps | RadioGroupProps | ImageProps | ScreenProps | SliderProps
  | TableProps | TabsProps | ProgressBarProps | TagProps | ModalProps | ToastProps | TooltipProps
  | CardProps | PlayingCardProps | StepperProps | SegmentedProps | AvatarProps | AccordionProps
  | RatingProps | ComboboxProps | DrawerProps | VirtualListProps | ContextMenuProps
  | CoinFlipProps | VersusProps | VideoProps
  | Record<string, never>;

/** LayoutNode = 弱模型填写的 UI 数据单元。type + id + props 必填；layout/children 按需。 */
export interface LayoutNode {
  type: ComponentType;
  id: string;
  props: ComponentProps;
  layout?: LayoutConstraints;
  children?: LayoutNode[];
  /**
   * 条件显隐（数据·替代"游戏用代码重建 UI 树"这种代码回潮）：一个 **flag id**，可选 `!` 前缀取反。
   * 在 resolveBindings 求值（经 UIDataSource.flag 读布尔）：为真 → 该节点连同子树留在树里；
   * 为假 → 从父节点 children 里移除（不进渲染·不留 DOM，区别于 display:none）。
   * 锁牌 / 选中态 / 买不起（先由 sim 算成 Flag）/ 阶段限定按钮等，靠它声明，不必让游戏 if/else 重建树。
   * 红线同 bind：只收 **flag id 字符串**（最弱 LLM 能填），绝不收自由布尔表达式。
   * 注：**树根**的 visibleWhen 不被求值（根恒渲染）——把条件内容放进某个子节点；若确需按根判可见用 isVisible()。
   */
  visibleWhen?: string;
}

export type Handler = (arg?: string) => void;
export type HandlerMap = Record<string, Handler>;

/**
 * UI 写世界接缝（铁律：写路径收紧成信号）——把 action 信号名 + 可选 arg **enqueue 进 sim 输入队列**，
 * 而不是在 UI 回调里写自由逻辑。传给 mountUI 后，**无本地 handler** 的 data-action 即走：
 *   enqueueAction(action,{arg}) → InputQueue{key:action,phase:'action',arg} → keybind 产 Signal{name,arg} → sim 能力按名消费。
 * 这条就是「UI 只发信号、具体逻辑在 sim 能力层处理」的**人/AI 共用动作总线**：AI 玩家=另一个推同样具名动作的 InputSource。
 * 形状与 net 的 QueuedInputSource.enqueueAction 同构，但此处不 import net（保 ui/components 解耦）。
 */
export interface ActionSink {
  enqueueAction(name: string, value?: { arg?: string }): void;
}

/**
 * UI 主题令牌（renderNode/mountUI 取色取字的唯一来源）。
 * 游戏可传自己的一份 → 同一份 LayoutNode 数据换皮（数据驱动·零改解释器）。缺省 = 引擎 SHELL 脸。
 * 红线不变：游戏只填**令牌值**（颜色/字体字符串，最弱 LLM 能填），不写 CSS/DOM。
 */
export interface UITheme {
  bg0: string; bg1: string; bg2: string; bg3: string; pageBg: string;
  line: string;
  text: string; sub: string; dim: string;
  jade: string; jadeWash: string; jadeLine: string;
  gold: string;
  ok: string; okWash: string; warn: string; warnWash: string; danger: string;
  fontUi: string; fontMono: string;
  /** 像素点阵字体槽（Label font:'pixel'·如 Silkscreen/DotGothic16）。缺省回退 fontUi。 */
  fontPixel?: string;
  /** 数码管展示字体槽（Label font:'display'·如 VT323 七段琥珀时钟）。缺省回退 fontMono。 */
  fontDisplay?: string;
  /** 输入框底色（缺省深色半透 rgba(0,0,0,0.35)·适配暗皮）。亮皮须填浅色，否则深底深字看不清。 */
  inputBg?: string;
  /** 背景贴图层（procedural CSS 图案 / 贴图 url·叠在 pageBg 上·renderScreen 合成）。主题作者填（可含 CSS），区别于游戏 LayoutNode 数据。缺省无 = 纯 pageBg（老主题零变化）。 */
  texture?: string;
  /** 背景晕染叠层（vignette/wash·盖在 texture 之上的柔光/暗角）。同 texture：主题作者填。 */
  wash?: string;
}
