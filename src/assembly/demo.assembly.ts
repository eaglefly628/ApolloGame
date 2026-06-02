import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Component } from '@engine/core/types.js';
import {
  transformCapability,
  velocityCapability,
  shapeCapability,
  spriteCapability,
  timerCapability,
  destroyCapability,
  overlapDetectCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability } from '../tier1/index.js';

export interface EntityBlueprint {
  [componentType: string]: Omit<Component, 'type'>;
}

export interface WorldBlueprint {
  capabilities: CapabilityDefinition[];
  entities: Record<string, EntityBlueprint>;
}

// 演示蓝图：子弹向右飞 → 撞墙被 overlap-detect 检测 → 寿命到时自毁。
// 验证核心原子 + 2 个 Tier 1 系统在真实 ECS 循环里经拓扑排序协作。
// 拓扑顺序自动得出：motion-apply → overlap-detect；timer-advance → lifetime → destroy-apply。
export const demoBlueprint: WorldBlueprint = {
  capabilities: [
    transformCapability,
    velocityCapability,
    shapeCapability,
    spriteCapability,
    timerCapability,
    overlapDetectCapability,
    destroyCapability,
    motionApplyCapability,
    lifetimeCapability,
  ],
  entities: {
    bullet: {
      Transform: { x: 0, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      Velocity: { vx: 8, vy: 0, angular: 0 },
      Shape: { kind: 'box', width: 8, height: 8 },
      Sprite: { textureKey: 'bullet', anchorX: 0.5, anchorY: 0.5, zOrder: 10 },
      Timer: { id: 'life', elapsed: 0, duration: 12, loop: false },
    },
    wall: {
      Transform: { x: 80, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: 16, height: 64 },
    },
  },
};
