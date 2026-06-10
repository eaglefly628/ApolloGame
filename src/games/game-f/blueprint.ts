import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { PrefabTemplate } from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { destroyCapability } from '@skills/atoms/destroy/index.js';
import { timerCapability } from '@skills/atoms/timer/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability, hierarchyResolveCapability } from '@skills/tier1/index.js';
import {
  triggerZoneCapability,
  hitboxCapability,
  mortalCapability,
  steeringCapability,
  facingCapability,
  collisionResolveCapability,
  eventWhenCapability,
  zoneOccupancyCapability,
  cameraFollowCapability,
  ZONE_FLAG,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability } from '@skills/tier3/index.js';
import { GAME_F_ASSETS, F_HERO, F_FX_STRIKE } from './assets.js';

// ═══════════════════════════════════════════════════════════════
//  Game F —— 《像素三分天下》自走棋 MVP-0 骨架。**纯数据装配**，零自走棋专属代码。
//  整套战斗循环由通用能力涌现（= Game D 暗黑切片的数据，减去玩家操控、加一支镜像敌队）：
//
//    · 索敌走位 = aggro(Perception→Relation target) + steering(seek) + motion-apply   —— ai-chase（数据）
//    · 普攻     = 本地 loop Timer → 自身唯一 EventWhen(timer 叶子,edge) 产唯一信号
//                 → 自身 Caster(at:'target') → prefab 在目标处展开瞬时打击区              —— 自动普攻（数据）
//    · 结算     = overlap-detect → trigger-zone → hitbox(阵营 targetMask 过滤 + 伤害)
//    · 打击自毁 = Timer{id:'life'} → lifetime → destroy（瞬时 burst，无孤儿）
//    · 死亡     = resource-apply → mortal(hp≤0 销毁自己) → destroy
//    · 判胜负   = Zone{requiredTag:TEAM, count:1} 数某队存活 → 写 present Flag（存活=0 → flag false）
//    · 头顶名字 = Text + 势力色 Color + Hierarchy 跟随单位（三国感靠命名+分色，见 art-data.md）
//
//  MVP-0 用一组**互不相同**的英雄、每英雄**唯一** timer/signal id，规避「逻辑链按全局 id 寻址」串台
//  （重复棋子/三星合体 待引擎 REQ-021 self 作用域，主程已落地，下一阶段接）。零自走棋 system。
//  简化（已知，后续）：① 普攻无距离门（condition 无距离叶子）→ 打击在目标处展开，移动仅表现；
//  ② 蓝条/大招/经济/商店/flow 阶段机 = 下一轮（本骨架先把"两队自动互砍到团灭"跑通）。
// ═══════════════════════════════════════════════════════════════

// 阵营（Tag.flags）。蜀=TEAM_A，魏=TEAM_B。ZONE_FLAG(=1<<0) 由 trigger-zone 约定，留给打击区。
export const TEAM_A = 1 << 1; // 蜀
export const TEAM_B = 1 << 2; // 魏
// 势力色（Color.tint；drawImage 不吃 tint，由头顶名字 Text 承担分色，见 art-data.md §二）。
export const SHU_RED = 0xb02a28;
export const WEI_BLUE = 0x2962c8;

// 战斗数值（数据，可调）。
const HP = 90;
const ATK_DMG = 11;
const ATK_CD = 24; // 普攻间隔(tick)

const xf = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const sprite = (textureKey: string, zOrder: number): Record<string, unknown> => ({ textureKey, anchorX: 0.5, anchorY: 0.5, zOrder });

// 瞬时打击区模板：在目标处生成一个小 sensor 伤害区，2 tick 自毁（lifetime）。targetMask 决定打哪队。
const strike = (targetMask: number): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 22, height: 22 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount: ATK_DMG, targetMask },
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
      Sprite: sprite(F_FX_STRIKE, 6),
    },
  },
});

export const GAME_F_TEMPLATES: Record<string, PrefabTemplate> = {
  strike_vs_a: strike(TEAM_A), // 魏 打 蜀
  strike_vs_b: strike(TEAM_B), // 蜀 打 魏
};

interface HeroSpec {
  id: string;
  name: string;
  key: string;
  team: number;
  enemy: number;
  strike: string;
  tint: number;
  x: number;
  y: number;
}

const ROSTER: HeroSpec[] = [
  // 蜀（TEAM_A，左列，红）
  { id: 'a_guanyu', name: '关羽', key: F_HERO.guan_yu, team: TEAM_A, enemy: TEAM_B, strike: 'strike_vs_b', tint: SHU_RED, x: -160, y: -45 },
  { id: 'a_zhaoyun', name: '赵云', key: F_HERO.zhao_yun, team: TEAM_A, enemy: TEAM_B, strike: 'strike_vs_b', tint: SHU_RED, x: -165, y: 0 },
  { id: 'a_zhuge', name: '诸葛亮', key: F_HERO.zhuge_liang, team: TEAM_A, enemy: TEAM_B, strike: 'strike_vs_b', tint: SHU_RED, x: -195, y: 45 },
  // 魏（TEAM_B，右列，蓝）
  { id: 'b_zhangliao', name: '张辽', key: F_HERO.zhang_liao, team: TEAM_B, enemy: TEAM_A, strike: 'strike_vs_a', tint: WEI_BLUE, x: 160, y: -45 },
  { id: 'b_xuchu', name: '许褚', key: F_HERO.xu_chu, team: TEAM_B, enemy: TEAM_A, strike: 'strike_vs_a', tint: WEI_BLUE, x: 165, y: 0 },
  { id: 'b_simayi', name: '司马懿', key: F_HERO.sima_yi, team: TEAM_B, enemy: TEAM_A, strike: 'strike_vs_a', tint: WEI_BLUE, x: 195, y: 45 },
];

// 一个棋子（纯数据）：ai-chase + 自动普攻 + 会死。
function unitEntity(h: HeroSpec): EntityBlueprint {
  const atk = `atk_${h.id}`; // 每英雄唯一 → 不与他人串台（MVP-0 唯一 id 策略）
  return {
    Transform: xf(h.x, h.y),
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Shape: { kind: 'box', width: 16, height: 16 },
    Mass: { value: 1 },
    Tag: { flags: h.team },
    Resource: { id: 'hp', current: HP, min: 0, max: HP },
    Perception: { targetTag: h.enemy, sightRadius: 0 }, // 无限视野 → 锁最近敌人写 Relation(target)
    Steering: { mode: 'seek', speed: 0.8, stopRange: 26 },
    Mortal: { resource: 'hp', atOrBelow: 0 },
    // 普攻链（自身闭环）：loop Timer 周期到点 → EventWhen(读自身唯一 timer,edge) 发唯一信号 → Caster 在目标处展开打击区。
    Timer: { id: atk, elapsed: 0, duration: ATK_CD, loop: true },
    EventWhen: { signal: atk, when: { kind: 'timer', id: atk, cmp: 'gte', value: ATK_CD - 1 }, mode: 'edge', armed: false },
    Caster: { onSignal: atk, template: h.strike, at: 'target', targetTag: h.enemy },
    Sprite: sprite(h.key, 4),
    Facing: { mode: 'target' }, // 面朝目标
  } as unknown as EntityBlueprint;
}

// 头顶名字（表现，三国感）：Text + 势力色 Color + Hierarchy 跟随单位本体。
function labelEntity(h: HeroSpec): EntityBlueprint {
  return {
    Transform: xf(h.x, h.y - 16),
    Text: { content: h.name, fontSize: 9, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
    Color: { tint: h.tint, alpha: 1 },
    Hierarchy: { parentId: h.id, localX: 0, localY: -16, localRotation: 0, localScaleX: 1, localScaleY: 1 },
  } as unknown as EntityBlueprint;
}

const ARENA = { minX: -300, minY: -160, maxX: 300, maxY: 160 };

export function buildGameFBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 技能/打击库（数据，单例）。
    library: { PrefabLibrary: { templates: GAME_F_TEMPLATES, seq: 0 } } as unknown as EntityBlueprint,
    // 胜负旗标 + 竞技场存活计数 Zone（存活=0 → present flag 落 false；下游接 flow 阶段机，后续）。
    team_a_flag: { Flag: { id: 'team_a_present', active: true } } as unknown as EntityBlueprint,
    team_b_flag: { Flag: { id: 'team_b_present', active: true } } as unknown as EntityBlueprint,
    zone_a: { Zone: { outFlag: 'team_a_present', ...ARENA, requiredTag: TEAM_A, count: 1 } } as unknown as EntityBlueprint,
    zone_b: { Zone: { outFlag: 'team_b_present', ...ARENA, requiredTag: TEAM_B, count: 1 } } as unknown as EntityBlueprint,
    // 静态相机（表现，排除出 hash）。
    camera: { Transform: xf(0, 0), Camera: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 800, viewportH: 600 } } as unknown as EntityBlueprint,
  };
  for (const h of ROSTER) {
    entities[h.id] = unitEntity(h);
    entities[`${h.id}_name`] = labelEntity(h);
  }

  return {
    capabilities: [
      // AI：索敌 + 走位（ai-chase = aggro + steering + motion）
      aggroCapability,
      steeringCapability,
      motionApplyCapability,
      collisionResolveCapability,
      // 自动普攻：timer → event-when → caster → prefab 展开打击区
      timerCapability,
      eventWhenCapability,
      casterCapability,
      prefabCapability,
      // 结算：overlap → trigger-zone → hitbox → resource
      overlapDetectCapability,
      triggerZoneCapability,
      hitboxCapability,
      resourceCapability,
      // 生命周期：打击区自毁 + 单位死亡
      lifetimeCapability,
      destroyCapability,
      mortalCapability,
      // 胜负 + 表现
      zoneOccupancyCapability,
      facingCapability,
      hierarchyResolveCapability,
      cameraFollowCapability,
    ],
    entities,
  };
}

export const GAME_F_HERO_IDS = ROSTER.map((h) => h.id);
