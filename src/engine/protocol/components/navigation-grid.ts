import type { Component, EntityId } from '../../core/types.js';

/** Shared ground X/Z map. origin is the minimum cell CORNER; y maps to scene Z. */
export interface NavigationGrid extends Component {
  readonly type: 'NavigationGrid';
  originX: number;
  originY: number;
  cellSize: number;
  cols: number;
  rows: number;
  blocked?: readonly number[];
  cost?: readonly number[];
}

/** Output entity id selects both NavAgent.graphId and FlowAgent.fieldId. */
export interface NavigationProfile extends Component {
  readonly type: 'NavigationProfile';
  gridId: EntityId;
  radius: number;
  goals?: ReadonlyArray<{ x: number; y: number }>;
}

/** Serialized derived geometry used for strict point lookup and directed terrain costs. */
export interface NavigationGraphGrid {
  bakeKey?: string; // Serialized exact source geometry identity (derived outputs owned by navigation-grid).
  originX: number;
  originY: number;
  cellSize: number;
  cols: number;
  rows: number;
  blocked: number[];
  cost: number[];
}
