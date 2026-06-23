// UI Component System — 引擎静态 UI 层
//
// 弱模型的工作：写 LayoutNode 树（纯数据）。
// 引擎的工作：renderNode() + mountUI() 解释这棵树。
// 红线：游戏层不得在此之外手写 HTML 模板或 DOM 操作。

export type ComponentType =
  | 'Panel' | 'Button' | 'Label' | 'Dropdown' | 'Badge' | 'Input' | 'Divider'
  | 'Checkbox' | 'Toggle' | 'RadioGroup' | 'Image' | 'Screen' | 'Slider'
  | 'Table' | 'Tabs' | 'ProgressBar' | 'Tag' | 'Modal' | 'Toast';

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

export type ComponentProps =
  | ButtonProps | LabelProps | DropdownProps | BadgeProps | InputProps | PanelProps
  | CheckboxProps | ToggleProps | RadioGroupProps | ImageProps | ScreenProps | SliderProps
  | TableProps | TabsProps | ProgressBarProps | TagProps | ModalProps | ToastProps
  | Record<string, never>;

/** LayoutNode = 弱模型填写的 UI 数据单元。type + id + props 必填；layout/children 按需。 */
export interface LayoutNode {
  type: ComponentType;
  id: string;
  props: ComponentProps;
  layout?: LayoutConstraints;
  children?: LayoutNode[];
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
