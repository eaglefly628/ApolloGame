// UI Component System — 引擎静态 UI 层
//
// 弱模型的工作：写 LayoutNode 树（纯数据）。
// 引擎的工作：renderNode() + mountUI() 解释这棵树。
// 红线：游戏层不得在此之外手写 HTML 模板或 DOM 操作。

export type ComponentType = 'Panel' | 'Button' | 'Label' | 'Dropdown' | 'Badge' | 'Input' | 'Divider';

/** 布局约束：坐标/尺寸/弹性。x/y 触发绝对定位；flex 在父 Panel 内生效。 */
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

export type ComponentProps =
  | ButtonProps
  | LabelProps
  | DropdownProps
  | BadgeProps
  | InputProps
  | PanelProps
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
