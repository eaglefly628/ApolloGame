import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { PrefabTemplate } from '@engine/protocol/components.js';
import { ZONE_FLAG } from '@skills/tier2/index.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import { triggerZoneCapability, hitboxCapability } from '@skills/tier2/index.js';
import { prefabCapability } from '@skills/tier3/index.js';

// ═══════════════════════════════════════════════════════════════
//  Game D —— 暗黑类 ARPG 垂直切片（PoC）。**纯数据装配**，零游戏专属代码。
//  技能 = PrefabTemplate（数据）；释放 = SpawnRequest（数据）；命中结算 = hitbox 能力。
//  证蓝图 §3「涌现式系统叠加」：冰霜新星冻住敌人 → 碎冰重锤只对冰冻目标结算 20% maxHP 真伤并解冻。
//
//  整条战斗链全由已下沉的通用能力涌现，无一行 ARPG 专属代码：
//    prefab（展开技能）→ overlap-detect（接触）→ trigger-zone（进区）→ hitbox（阵营/状态过滤+伤害）
//    → resource（结算）。AI 只需产 PrefabTemplate + SpawnRequest 这两种数据。
// ═══════════════════════════════════════════════════════════════

// 阵营（Tag.flags）/ 状态（Status.flags）位语义 —— 数据约定。
export const TEAM_PLAYER = 1 << 1;
export const TEAM_ENEMY = 1 << 2;
export const STATUS_FROZEN = 1 << 0;

const xf = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });

// 冰霜新星：范围冰冻（CC，蓝图「触发冰冻、移速归零」）。伤害区 = Sensor + Tag(ZONE_FLAG)
// + Hitbox{ 给范围内敌人置 FROZEN }。纯 CC（不直接扣血），手感与碎冰的真伤分工清晰。
const FROST_NOVA: PrefabTemplate = {
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 60, height: 60 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', targetMask: TEAM_ENEMY, setMask: STATUS_FROZEN },
    },
  },
};

// 碎冰重锤：只对 FROZEN 目标结算 20% maxHP 真伤并解冻（requireMask + clearMask）。
const SHATTER_SMASH: PrefabTemplate = {
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 120, height: 120 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', fracOfMax: 0.2, targetMask: TEAM_ENEMY, requireMask: STATUS_FROZEN, clearMask: STATUS_FROZEN },
    },
  },
};

// 注：技能区自毁（'life' Timer + lifetime + destroy 三能力 → 一次性 burst）是表现/手感 polish，
// 列为 follow-up；本切片聚焦证明「冰冻→碎冰」的涌现式系统叠加（蓝图 §3），技能 burst 由释放节奏控制。

export const GAME_D_TEMPLATES: Record<string, PrefabTemplate> = {
  frost_nova: FROST_NOVA,
  shatter_smash: SHATTER_SMASH,
};

// 一个敌人实体（数据）：阵营 ENEMY + hp + 占位形状。
function enemy(x: number, y: number): EntityBlueprint {
  return {
    Transform: xf(x, y),
    Shape: { kind: 'box', width: 16, height: 16 },
    Tag: { flags: TEAM_ENEMY },
    Resource: { id: 'hp', current: 100, min: 0, max: 100 },
  } as unknown as EntityBlueprint;
}

export function buildGameDBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 技能库（数据，单例）。释放技能 = 发 SpawnRequest{templateId,x,y}（输入层/AI 产）。
    library: { PrefabLibrary: { templates: GAME_D_TEMPLATES, seq: 0 } } as unknown as EntityBlueprint,
    enemy_a: enemy(0, 0),
    enemy_b: enemy(40, 0),
    enemy_c: enemy(-40, 0),
  };
  return {
    capabilities: [prefabCapability, overlapDetectCapability, triggerZoneCapability, hitboxCapability, resourceCapability],
    entities,
  };
}
