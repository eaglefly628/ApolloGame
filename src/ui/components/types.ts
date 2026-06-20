// UI Component System — 引擎静态 UI 层
//
// 弱模型的工作：写 LayoutNode 树（纯数据）。
// 引擎的工作：renderNode() + mountUI() 解释这棵树。
// 红线：游戏层不得在此之外手写 HTML 模板或 DOM 操作。

export type ComponentType =
  | 'Panel' | 'Button' | 'Label' | 'Dropdown' | 'Badge' | 'Input' | 'Divider'
  | 'Checkbox' | 'Toggle' | 'RadioGroup' | 'Image' | 'Screen' | 'Slider';

/** 布局约束：坐标/尺寸/弹性。x/y 触发绝对定位；flex 在父 Panel/Screen 内生效。 */
export interface LayoutConstraints {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  flex?: number;
  gap?: number;
  direction?: 'row' | 'column';
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

export type ComponentProps =
  | ButtonProps | LabelProps | DropdownProps | BadgeProps | InputProps | PanelProps
  | CheckboxProps | ToggleProps | RadioGroupProps | ImageProps | ScreenProps | SliderProps
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
