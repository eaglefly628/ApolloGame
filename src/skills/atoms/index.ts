// ═══════════════════════════════════════════════════════════════
//  Atom Skills — 26 核心原子统一导出
//  参见 wiki/atom-skill-periodic-table.md
// ═══════════════════════════════════════════════════════════════
import type { CapabilityDefinition } from '@engine/core/define-capability.js';

import { transformCapability } from './transform/index.js';
import { hierarchyCapability } from './hierarchy/index.js';
import { velocityCapability } from './velocity/index.js';
import { accelerationCapability } from './acceleration/index.js';
import { massCapability } from './mass/index.js';
import { shapeCapability } from './shape/index.js';
import { overlapDetectCapability } from './overlap-detect/index.js';
import { timerCapability } from './timer/index.js';
import { resourceCapability } from './resource/index.js';
import { flagCapability } from './flag/index.js';
import { tagCapability } from './tag/index.js';
import { relationCapability } from './relation/index.js';
import { visibilityCapability } from './visibility/index.js';
import { inputCaptureCapability } from './input-capture/index.js';
import { actionMapCapability } from './action-map/index.js';
import { stateCapability } from './state/index.js';
import { spawnCapability } from './spawn/index.js';
import { destroyCapability } from './destroy/index.js';
import { spriteCapability } from './sprite/index.js';
import { colorCapability } from './color/index.js';
import { frameCapability } from './frame/index.js';
import { soundCapability } from './sound/index.js';
import { cameraCapability } from './camera/index.js';
import { textCapability } from './text/index.js';
import { randomCapability } from './random/index.js';
import { spatialQueryCapability } from './spatial-query/index.js';

// 扩展原子（周期表 Extension，非核心 26）
import { stringVariableCapability } from './string-variable/index.js';

export {
  transformCapability,
  hierarchyCapability,
  velocityCapability,
  accelerationCapability,
  massCapability,
  shapeCapability,
  overlapDetectCapability,
  timerCapability,
  resourceCapability,
  flagCapability,
  tagCapability,
  relationCapability,
  visibilityCapability,
  inputCaptureCapability,
  actionMapCapability,
  stateCapability,
  spawnCapability,
  destroyCapability,
  spriteCapability,
  colorCapability,
  frameCapability,
  soundCapability,
  cameraCapability,
  textCapability,
  randomCapability,
  spatialQueryCapability,
  stringVariableCapability,
};

// 世界级服务的纯函数助手
export { nextRandom, randomInt } from './random/index.js';
export { queryRange, queryNearest } from './spatial-query/index.js';

// 全部 26 个核心原子（用于注册到 World 或 assembly 蓝图）
export const allAtomCapabilities: CapabilityDefinition[] = [
  transformCapability,
  hierarchyCapability,
  velocityCapability,
  accelerationCapability,
  massCapability,
  shapeCapability,
  overlapDetectCapability,
  timerCapability,
  resourceCapability,
  flagCapability,
  tagCapability,
  relationCapability,
  visibilityCapability,
  inputCaptureCapability,
  actionMapCapability,
  stateCapability,
  spawnCapability,
  destroyCapability,
  spriteCapability,
  colorCapability,
  frameCapability,
  soundCapability,
  cameraCapability,
  textCapability,
  randomCapability,
  spatialQueryCapability,
];

// 扩展原子（按需引入，不计入核心 26）。
export const extensionAtomCapabilities: CapabilityDefinition[] = [stringVariableCapability];
