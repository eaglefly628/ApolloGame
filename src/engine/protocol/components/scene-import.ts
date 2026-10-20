import type { Component } from '../../core/types.js';

/** Load-time macro. Expanded before capability inference and before any world mutation. */
export interface SceneImport3D extends Component {
  readonly type: 'SceneImport3D';
  modelKey: string;
  rules: 'default';
  ground?: { source: 'navigation' | 'collision' };
}
