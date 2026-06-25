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
  | 'CoinFlip' | 'Versus';

/** 布局约束：坐标/尺寸/弹性。x/y 触发绝对定位；flex 在父 Panel/Screen 内生效。 */
export interface LayoutConstraints {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  flex?: number;
  gap?: number;
  direction?: 'row' | 'column' | 'grid';
  /** 仅 direction:'grid' 生效：单元格最小列宽 px（auto-fill 自适应列数·缺省 96）。卡牌格/货架填这一个数即得自适应网格。 */
  minCol?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
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
}

export interface ButtonProps {
  label: string;
  kind?: 'primary' | 'ghost' | 'quiet';
  disabled?: boolean;
  action?: string;
  actionArg?: string;
}

export interface LabelProps {
  text: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger';
  bold?: boolean;
  mono?: boolean;
  /** 世界绑定(收编 GameShell stat)：resourceId·resolveBindings 时把 Resource.current 接到 text 后（text 作前缀/标签）。 */
  bind?: string;
  /** 打字机(收编 VN DialogBox 逐字显)：每字毫秒(>0 开)。mountUI 挂载时逐字揭示·teardown 清定时器。 */
  typewriter?: number;
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
  blur?: number;
  center?: boolean;
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
export interface TabsProps { tabs: { id: string; label: string }[]; active?: string; action?: string }

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
  content: string; placement?: 'top' | 'bottom' | 'left' | 'right';
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
  back?: string;                         // 牌背中央纹样字符（缺省 ♠ 暗纹）
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

export type ComponentProps =
  | ButtonProps | LabelProps | DropdownProps | BadgeProps | InputProps | PanelProps
  | CheckboxProps | ToggleProps | RadioGroupProps | ImageProps | ScreenProps | SliderProps
  | TableProps | TabsProps | ProgressBarProps | TagProps | ModalProps | ToastProps | TooltipProps
  | CardProps | PlayingCardProps | StepperProps | SegmentedProps | AvatarProps | AccordionProps
  | RatingProps | ComboboxProps | DrawerProps | VirtualListProps | ContextMenuProps
  | CoinFlipProps | VersusProps
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
}
