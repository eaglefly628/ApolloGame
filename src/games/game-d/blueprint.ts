import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { PrefabTemplate } from '@engine/protocol/components.js';
import { ZONE_FLAG } from '@skills/tier2/index.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { destroyCapability } from '@skills/atoms/destroy/index.js';
import { timerCapability } from '@skills/atoms/timer/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import {
  triggerZoneCapability,
  hitboxCapability,
  overTimeCapability,
  mortalCapability,
  steeringCapability,
  collisionResolveCapability,
  cameraFollowCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability } from '@skills/tier3/index.js';
import { motionApplyCapability, lifetimeCapability } from '@skills/tier1/index.js';

// ═══════════════════════════════════════════════════════════════
//  Game D —— 暗黑类 ARPG 垂直切片（PoC）。**纯数据装配**，零游戏专属代码。
//  整套战斗循环由通用能力涌现，AI 行为按周期表「用 Macro 组装」＝数据组合（aggro+steering+state），非代码：
//
//    · 怪追你   = aggro(感知→Relation target) + steering(追逐) + motion-apply        —— ai-chase（数据）
//    · 放技能   = Signal → caster(at:pointer/target) → SpawnRequest → prefab 展开伤害区 —— D-002
//    · 命中结算 = overlap-detect → trigger-zone → hitbox(阵营/状态门 + 伤害 + 挂 OverTime)
//    · 冰冻/灼烧= hitbox.statusDuration / dot* → over-time（定时解冻 / 周期真伤）              —— D-003
//    · 冻=定身  = steering.haltStatusMask（被冻结则停）                                  —— CC
//    · 死亡掉落 = resource-apply → mortal(hp≤0 销毁自己 + dropTemplate 掉落) → destroy        —— D-001 配套
//    · 技能自毁 = Timer{id:'life'} → lifetime → destroy（瞬时 burst）
//
//  技能/掉落 = PrefabTemplate（数据）；释放 = Signal/输入（数据）；敌人 = 组件装配（数据）。零 ARPG 专属代码。
// ═══════════════════════════════════════════════════════════════

// 阵营（Tag.flags）/ 状态（Status.flags）位语义 —— 数据约定。
export const TEAM_PLAYER = 1 << 1;
export const TEAM_ENEMY = 1 << 2;
export const LOOT_FLAG = 1 << 3;
export const STATUS_FROZEN = 1 << 0;

const xf = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });

// 冰霜新星：范围冰冻 CC（statusDuration → over-time 90 tick 后自动解冻，免手动清场）。Timer 'life' 瞬时自毁。
const FROST_NOVA: PrefabTemplate = {
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 60, height: 60 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', targetMask: TEAM_ENEMY, setMask: STATUS_FROZEN, statusDuration: 90 },
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
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
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
    },
  },
};

// 烈焰：小直伤 + 灼烧 DoT（dot* → over-time 每 20 tick 掉 5 血，持续 120 tick）。
const FLAME: PrefabTemplate = {
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 80, height: 80 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount: 3, targetMask: TEAM_ENEMY, dotPerTick: 5, dotPeriod: 20, dotDuration: 120 },
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
    },
  },
};

// 掉落物：金色小方块（占位；真资产走资产流程 R9）。怪死时由 mortal.dropTemplate 在原地展开。
const LOOT: PrefabTemplate = {
  entities: {
    item: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 8, height: 8 },
      Color: { tint: 0xffcc00, alpha: 1 },
      Tag: { flags: LOOT_FLAG },
    },
  },
};

export const GAME_D_TEMPLATES: Record<string, PrefabTemplate> = {
  frost_nova: FROST_NOVA,
  shatter_smash: SHATTER_SMASH,
  flame: FLAME,
  loot: LOOT,
};

// 一个敌人（纯数据）：ai-chase = Perception(感知玩家) + Steering(追逐,冻则停) + 实体战斗组件 + 死亡掉落。
function enemy(x: number, y: number): EntityBlueprint {
  return {
    Transform: xf(x, y),
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Shape: { kind: 'box', width: 16, height: 16 },
    Mass: { value: 1 },
    Tag: { flags: TEAM_ENEMY },
    Resource: { id: 'hp', current: 100, min: 0, max: 100 },
    Perception: { targetTag: TEAM_PLAYER, sightRadius: 0 }, // 无限视野（演示用）
    Steering: { mode: 'seek', speed: 1, stopRange: 18, haltStatusMask: STATUS_FROZEN },
    Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: 'loot' },
  } as unknown as EntityBlueprint;
}

export function buildGameDBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 技能库（数据，单例）。
    library: { PrefabLibrary: { templates: GAME_D_TEMPLATES, seq: 0 } } as unknown as EntityBlueprint,

    // 英雄：实心可动 + 相机目标 + 手柄操控 + 会死。Perception(锁敌) 让主动技能 caster(at:'target') 复用 Relation 自动索敌。
    hero: {
      Transform: xf(0, 0),
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Shape: { kind: 'box', width: 16, height: 16 },
      Mass: { value: 1 },
      Tag: { flags: TEAM_PLAYER },
      Resource: { id: 'hp', current: 100, min: 0, max: 100 },
      CameraTarget: {},
      Controllable: { playerId: 'p1', speed: 2 },
      Mortal: { resource: 'hp', atOrBelow: 0 },
      Perception: { targetTag: TEAM_ENEMY, sightRadius: 0 },
      Caster: { onSignal: 'cast_flame', template: 'flame', at: 'target', targetTag: TEAM_ENEMY },
    } as unknown as EntityBlueprint,

    // 技能栏：点地 AoE（point-and-click，暗黑式）。释放 = 输入层发对应 Signal（数据）。
    bind_nova: { Caster: { onSignal: 'cast_nova', template: 'frost_nova', at: 'pointer' } } as unknown as EntityBlueprint,
    bind_smash: { Caster: { onSignal: 'cast_smash', template: 'shatter_smash', at: 'pointer' } } as unknown as EntityBlueprint,

    // 一小波敌人。
    enemy_a: enemy(120, 0),
    enemy_b: enemy(140, 30),
    enemy_c: enemy(-130, 20),

    // 跟随相机（纯表现，排除出 hash）。
    camera: { Transform: xf(0, 0), Camera: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 800, viewportH: 600 } } as unknown as EntityBlueprint,
  };

  return {
    capabilities: [
      // 释放 / 展开
      prefabCapability,
      casterCapability,
      // AI（数据组合 ai-chase）
      aggroCapability,
      steeringCapability,
      motionApplyCapability,
      collisionResolveCapability,
      // 战斗结算
      overlapDetectCapability,
      triggerZoneCapability,
      hitboxCapability,
      resourceCapability,
      overTimeCapability,
      // 生命周期
      mortalCapability,
      destroyCapability,
      timerCapability,
      lifetimeCapability,
      // 表现
      cameraFollowCapability,
    ],
    entities,
  };
}
