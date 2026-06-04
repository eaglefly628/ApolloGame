import { defineCapability } from '@engine/core/define-capability.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Transform, Flag } from '@engine/protocol/components.js';
import type { Box } from './level.js';

// 协作通关状态：挂 Flag 的实体 id 与旗标名。
export const COOP_ENTITY = 'coop';
export const COOP_CLEAR_FLAG = 'coop-clear';

function inside(t: Transform, g: Box): boolean {
  return Math.abs(t.x - g.x) <= g.width / 2 && Math.abs(t.y - g.y) <= g.height / 2;
}

// 游戏层规则（非引擎）：所有玩家都进入目标区 → 置 coop-clear 旗标。缺一不可 = 协作。
// 纯读玩家 Transform + 写自家 Flag —— 这是「游戏逻辑读世界状态判定胜负」，
// 不是引擎 sensor。门控式触发（踩开关→开门）需要的 sensor 仍缺（见 requests REQ-002），雏形未做、未 hack。
export function makeCoopGoalCapability(goal: Box, playerEntityIds: readonly string[]): CapabilityDefinition {
  return defineCapability({
    id: 'game-a-coop-goal',
    version: '1.0.0',
    describe: {
      name: 'coop-goal',
      summary: '所有玩家同时进入目标区时置 coop-clear 旗标（双人协作通关条件，缺一不可）。',
      semantic: ['game-a', 'objective'],
      whenToUse: 'Game A 通关判定：两名玩家都到达目标区。',
      examples: ['两人同抵右侧目标 → 过关'],
    },
    components: { provides: {}, reads: ['Transform', 'Flag'], writes: ['Flag'], consumes: [] },
    config: {},
    systems: [
      {
        id: 'coop-goal',
        reads: ['Transform', 'Flag'],
        writes: ['Flag'],
        consumes: [],
        execute(world) {
          const flag = world.getComponent<Flag>(COOP_ENTITY, 'Flag');
          if (!flag || flag.id !== COOP_CLEAR_FLAG) return;
          let allIn = playerEntityIds.length > 0;
          for (const pid of playerEntityIds) {
            const t = world.getComponent<Transform>(pid, 'Transform');
            if (!t || !inside(t, goal)) {
              allIn = false;
              break;
            }
          }
          flag.active = allIn;
        },
      },
    ],
  });
}
