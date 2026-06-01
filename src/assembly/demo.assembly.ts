import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Component } from '@engine/core/types.js';
import { keyInputCapability } from '@atom-skills/key-input/index.js';
import { healthCapability } from '@atom-skills/health/index.js';
import { statusBarCapability } from '@atom-skills/status-bar/index.js';
import { poisonCapability } from '@atom-skills/poison/index.js';
import { shieldCapability } from '@atom-skills/shield/index.js';

export interface EntityBlueprint {
  [componentType: string]: Omit<Component, 'type'>;
}

export interface WorldBlueprint {
  capabilities: CapabilityDefinition[];
  entities: Record<string, EntityBlueprint>;
}

export const demoBlueprint: WorldBlueprint = {
  capabilities: [
    keyInputCapability,
    poisonCapability,
    shieldCapability,
    healthCapability,
    statusBarCapability,
  ],

  entities: {
    hero: {
      Health: { current: 100, max: 100 },
      Shield: { current: 30, max: 30 },
      Poisoned: { damagePerTick: 2, remainingTicks: 999 },
      KeyboardListener: {},
      StatusBarSource: {
        sourceComponent: 'Health',
        label: 'HP',
        highColor: '#22c55e',
        midColor: '#eab308',
        lowColor: '#ef4444',
        lowThreshold: 0.3,
        midThreshold: 0.6,
      },
    },
  },
};
