import type { SystemDeclaration, ComponentType } from './types.js';

export type ComponentCategory = 'resource' | 'event' | 'intent' | 'marker' | 'config' | 'render' | 'effect';
export type FieldType = 'number' | 'string' | 'boolean' | 'EntityId' | 'string[]' | 'number[]';

export interface ComponentSchema {
  category: ComponentCategory;
  describe: string;
  fields: Record<string, {
    type: FieldType;
    describe: string;
  }>;
}

export interface CapabilityConfig {
  type: 'number' | 'string' | 'boolean' | 'select';
  default: unknown;
  describe: string;
  question: string;
  ui: {
    control: 'slider' | 'toggle' | 'chips' | 'input';
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}

export interface CapabilityDefinition {
  id: string;
  version: string;

  describe: {
    name: string;
    summary: string;
    semantic: string[];
    whenToUse: string;
    examples: string[];
  };

  components: {
    provides: Record<ComponentType, ComponentSchema>;
    reads: ComponentType[];
    writes: ComponentType[];
    consumes: ComponentType[];
  };

  config: Record<string, CapabilityConfig>;

  systems: SystemDeclaration[];
}

export function defineCapability(def: CapabilityDefinition): CapabilityDefinition {
  return Object.freeze(def);
}
