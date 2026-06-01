import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface HealthModifyEvent extends Component {
  readonly type: 'HealthModifyEvent';
  readonly amount: number;
}

export interface KeyboardListener extends Component {
  readonly type: 'KeyboardListener';
}

// ── Keyboard state (module-level, shared across ticks) ──

const pressedKeys = new Set<string>();

function initKeyboardCapture() {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e) => pressedKeys.add(e.key));
  window.addEventListener('keyup', (e) => pressedKeys.delete(e.key));
}

let initialized = false;

// ── Capability Definition ──

export const keyInputCapability = defineCapability({
  id: 'key-input',
  version: '0.1.0',

  describe: {
    name: 'Key Input',
    summary: '监听键盘按键，产生 HealthModifyEvent。↑/W 治疗，↓/S 伤害。',
    semantic: ['input', 'keyboard', 'event-producer'],
    whenToUse: '需要键盘输入来修改实体数值时使用。',
    examples: ['键盘控制加减血', '按键触发数值变化'],
  },

  components: {
    provides: ['HealthModifyEvent', 'KeyboardListener'],
    reads: ['KeyboardListener'],
    writes: ['HealthModifyEvent'],
    consumes: [],
  },

  config: {
    healAmount: {
      type: 'number',
      default: 10,
      describe: '每次按键治疗的数值',
      question: '每次按上键回复多少生命值？',
      ui: { control: 'slider', min: 1, max: 100, step: 1 },
    },
    damageAmount: {
      type: 'number',
      default: 10,
      describe: '每次按键造成的伤害数值',
      question: '每次按下键扣除多少生命值？',
      ui: { control: 'slider', min: 1, max: 100, step: 1 },
    },
  },

  systems: [
    {
      id: 'key-input.capture',
      reads: ['KeyboardListener'],
      writes: ['HealthModifyEvent'],
      consumes: [],

      execute(world: IWorld): void {
        if (!initialized) {
          initKeyboardCapture();
          initialized = true;
        }

        const entities = world.queryEntities('KeyboardListener');

        for (const entityId of entities) {
          if (pressedKeys.has('ArrowUp') || pressedKeys.has('w') || pressedKeys.has('W')) {
            world.addComponent(entityId, {
              type: 'HealthModifyEvent',
              amount: 10,
            } as HealthModifyEvent);
          }

          if (pressedKeys.has('ArrowDown') || pressedKeys.has('s') || pressedKeys.has('S')) {
            world.addComponent(entityId, {
              type: 'HealthModifyEvent',
              amount: -10,
            } as HealthModifyEvent);
          }
        }

        pressedKeys.clear();
      },
    },
  ],
});
