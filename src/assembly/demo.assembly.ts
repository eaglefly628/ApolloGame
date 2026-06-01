import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Component } from '@engine/core/types.js';
import { keyInputCapability } from '@atom-skills/key-input/index.js';
import { healthCapability } from '@atom-skills/health/index.js';
import { healthBarCapability } from '@atom-skills/health-bar/index.js';

export interface EntityBlueprint {
  [componentType: string]: Omit<Component, 'type'>;
}

export interface WorldBlueprint {
  capabilities: CapabilityDefinition[];
  entities: Record<string, EntityBlueprint>;
}

export const demoBlueprint: WorldBlueprint = {
  capabilities: [keyInputCapability, healthCapability, healthBarCapability],

  entities: {
    hero: {
      Health: { current: 100, max: 100 },
      KeyboardListener: {},
    },
  },
};
