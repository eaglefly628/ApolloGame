import type { Component, EntityId } from '../core/types.js';

// ═══════════════════════════════════════════
//  Resource — 持久数值, { current, max }
// ═══════════════════════════════════════════

export interface Health extends Component {
  readonly type: 'Health';
  current: number;
  max: number;
}

export interface Shield extends Component {
  readonly type: 'Shield';
  current: number;
  max: number;
}

// ═══════════════════════════════════════════
//  Event — 一次性, 被 consume 后消失
// ═══════════════════════════════════════════

export interface HealthModifyEvent extends Component {
  readonly type: 'HealthModifyEvent';
  readonly amount: number;
}

// ═══════════════════════════════════════════
//  Effect — 临时状态, 有字段, 有持续时间
// ═══════════════════════════════════════════

export interface Poisoned extends Component {
  readonly type: 'Poisoned';
  damagePerTick: number;
  remainingTicks: number;
}

// ═══════════════════════════════════════════
//  Marker — 无字段, 存在即有意义
// ═══════════════════════════════════════════

export interface Dead extends Component {
  readonly type: 'Dead';
}

export interface KeyboardListener extends Component {
  readonly type: 'KeyboardListener';
}

// ═══════════════════════════════════════════
//  Config — 持久配置
// ═══════════════════════════════════════════

export interface StatusBarSource extends Component {
  readonly type: 'StatusBarSource';
  readonly sourceComponent: string;
  readonly label: string;
  readonly highColor: string;
  readonly midColor: string;
  readonly lowColor: string;
  readonly lowThreshold: number;
  readonly midThreshold: number;
}

// ═══════════════════════════════════════════
//  Render — 每帧更新, 驱动 UI/渲染层
// ═══════════════════════════════════════════

export interface BarDisplay extends Component {
  readonly type: 'BarDisplay';
  percentage: number;
  color: string;
  label: string;
  current: number;
  max: number;
}
