// ═══════════════════════════════════════════════════════════════
//  Protocol Layer — 共享组件接口
// ═══════════════════════════════════════════════════════════════
//
//  这里集中声明跨 atom-skill 共享的 Component 接口（TypeScript 形状）。
//  每个原子 skill 拥有自己的组件定义，但需要被多个 skill 读写的组件
//  在此声明，作为它们之间的契约 (protocol)。
//
//  组件语义分类（defineCapability.provides.category 标注）：
//    Resource — 持久数值，{ current, min, max }
//    Event    — 一次性，被 consume 后消失
//    Intent   — 表达"想做某事"的请求
//    Effect   — 临时状态，有字段、有持续时间
//    Marker   — 无字段，存在即有意义
//    Config   — 持久配置
//    Render   — 每帧更新，驱动 UI/渲染层
//
//  约定：World 每个实体每种 type 只存一个组件 (Map<type, Component>)。
//  契约由 Lead 预先写入，Programmer 直接 import，不在此文件追加，避免合并冲突。
//  参见 wiki/atom-skill-periodic-table.md
// ═══════════════════════════════════════════════════════════════

import type { Component } from '../core/types.js';

// ── A1 transform ── 实体在世界的位置、朝向和大小
export interface Transform extends Component {
  readonly type: 'Transform';
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// ── F1 resource ── 某种有上下限的数值 (hp / mp / stamina ...)
export interface Resource extends Component {
  readonly type: 'Resource';
  id: string;
  current: number;
  min: number;
  max: number;
}

// ── F1 resource ── 修改某资源的事件 (read-then-consume)
export interface ResourceModify extends Component {
  readonly type: 'ResourceModify';
  resourceId: string;
  amount: number;
}

// ── F2 flag ── 某个条件开还是关
export interface Flag extends Component {
  readonly type: 'Flag';
  id: string;
  active: boolean;
}
