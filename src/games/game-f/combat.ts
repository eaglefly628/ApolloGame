import type { PrefabTemplate } from '@engine/protocol/components.js';
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';
import { ZONE_FLAG } from '@skills/tier2/index.js';
import {
  TEAM_A, MOVE_PERIOD, ATK_CD, MANA_REGEN, FROZEN,
  PROTAG, LOOT, BAG, EQUIP, BENCH_OCC, MARKER_VIS, PROJ, RESULT,
  FONT_BODY, FONT_DISPLAY, FONT_NUM, xf, sprite, zlift,
} from './constants.js';
import { type HeroSpec, type Faction, rosterFor, finalHp, finalAtk, FX_BY_TYPE } from './heroes.js';
import { STAR_HP_MUL, STAR_DMG_MUL, STAR_GLYPH, STAR_SCALE } from './economy.js';
import { PVE_WAVES } from './stages.js';
import { F_HERO, F_FX_STRIKE, F_FX_BOLT, F_FX_FLAME, F_FX_DRAIN } from './assets.js';
import { offsetToAxial, project } from './hex.js';

// ── 普攻打击区：目标处小 sensor 伤害区，2 tick 自毁 + 表现两件（打击感批）。
const strike = (targetMask: number, amount: number, fxKey: string, scaleId = 'dmg_scale_b'): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 18, height: 18 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask, scaleByResource: scaleId },
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
      Sprite: sprite(fxKey, 6),
    },
    redflash: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 26, height: 26 },
      Color: { tint: 0xd65668, alpha: 0.7 },
      Tween: { target: 'Color.alpha', from: 0.7, to: 0, elapsed: 0, duration: 9, easing: 'easeOut', done: false },
      Timer: { id: 'life', elapsed: 0, duration: 10, loop: false },
      Sprite: zlift(9),
    },
    fx: {
      Transform: xf(0, 0),
      Color: { tint: 0xffffff, alpha: 0.9 },
      Tween: { target: 'Color.alpha', from: 0.9, to: 0, elapsed: 0, duration: 14, easing: 'easeOut', done: false },
      Timer: { id: 'life', elapsed: 0, duration: 15, loop: false },
      Sprite: sprite(fxKey, 8),
    },
  },
});

// DoT（灼烧/吸取）：命中后每 30 tick 掉血、持续 ~4s。
const DOT = { dotPerTick: 25, dotPeriod: 30, dotDuration: 240 };

// 远程/法术追踪弹道：全现有词汇拼装，aggro 锁敌 → Steering seek → consumeOnHit 两清。
const projectile = (targetMask: number, amount: number, fxKey: string, scaleId = 'dmg_scale_b'): PrefabTemplate => ({
  entities: {
    p: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 10, height: 10 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG | PROJ }, // PROJ：庆祝拍 destroy-tagged 清在飞弹
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Perception: { targetTag: targetMask, sightRadius: 0 },
      Steering: { mode: 'seek', speed: 3.2, stopRange: 0 },
      Hitbox: { resource: 'hp', amount, targetMask, scaleByResource: scaleId, consumeOnHit: true },
      Timer: { id: 'life', elapsed: 0, duration: 120, loop: false },
      Sprite: sprite(fxKey, 7),
    },
  },
});

// 大招打击区：大范围真伤，fxKey=主题特效，dot=是否附 DoT，freezeTicks>0=冰冻 N tick。
const ultTemplate = (targetMask: number, amount: number, size: number, fxKey: string, dot = false, freezeTicks = 0, scaleId = 'dmg_scale_b'): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: size, height: size },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask, scaleByResource: scaleId, ...(dot ? DOT : {}), ...(freezeTicks > 0 ? { setMask: FROZEN, statusDuration: freezeTicks } : {}) },
      Timer: { id: 'life', elapsed: 0, duration: 3, loop: false },
      Sprite: sprite(fxKey, 7),
    },
    redflash: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: Math.round(size * 0.7), height: Math.round(size * 0.7) },
      Color: { tint: 0xd65668, alpha: 0.5 },
      Tween: { target: 'Color.alpha', from: 0.5, to: 0, elapsed: 0, duration: 12, easing: 'easeOut', done: false },
      Timer: { id: 'life', elapsed: 0, duration: 13, loop: false },
      Sprite: zlift(9),
    },
    fx: {
      Transform: xf(0, 0),
      Color: { tint: 0xffffff, alpha: 0.95 },
      Tween: { target: 'Color.alpha', from: 0.95, to: 0, elapsed: 0, duration: 22, easing: 'easeOut', done: false },
      Timer: { id: 'life', elapsed: 0, duration: 23, loop: false },
      Sprite: sprite(fxKey, 8),
    },
  },
});

// ── 棋子复合模板（REQ-F-032/033）：单位+名牌+血蓝条×4+蓝 sidecar = 一个 PrefabTemplate 整体生灭 ──
// 全链已 per-instance（F-9 完结）：同模板任意多实例普攻、回蓝、放大招全不串台，零唯一 id。
const BAR_W = 28;
const trackColor = 0xd9c4b8; // 锦霞 --track
const HP_Y = -26, MP_Y = -20;
const sidecarLink = { parentId: '@local:main', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 };

function heroTemplate(h: HeroSpec): PrefabTemplate {
  const bar = (localY: number, height: number): Record<string, unknown> => ({
    Transform: xf(0, localY),
    Shape: { kind: 'box', width: BAR_W, height },
    Hierarchy: { ...sidecarLink, localY },
  });
  return {
    entities: {
      main: {
        Transform: xf(0, 0),
        Shape: { kind: 'box', width: 16, height: 16 },
        Tag: { flags: 0 }, // 占位 ← 槽位 overrides
        Resource: { id: 'hp', current: 1, min: 0, max: 1 }, // 占位 ← 槽位 overrides
        Perception: { targetTag: h.enemy, sightRadius: 0 },
        HexPos: { q: 0, r: 0 }, // 占位 ← 槽位 overrides
        // 射程驻足（REQ-F-060）：近战贴脸 1 / 法师 3 / 弓手 4。
        GridMover: { period: MOVE_PERIOD, elapsed: 0, haltStatusMask: FROZEN, glideSpeed: 0.8, range: h.atkType === 'melee' ? 1 : h.atkType === 'magic' ? 3 : 4 },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: `death_${h.id}` },
        // 普攻链（F-9 self 化）：自身 loop Timer 到点 ∧ 全局 in_combat → SelfRule spawn。
        Timer: { id: 'atk', elapsed: 0, duration: ATK_CD, loop: true },
        SelfRule: { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: ATK_CD - 1 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [h.atkType === 'melee' ? { kind: 'spawn', template: `strike_${h.id}`, at: 'target' } : { kind: 'spawn', template: `proj_${h.id}`, at: 'self' }], once: false, armed: false },
        Tween: { target: 'Transform.scaleY', from: 1, to: 1.05, elapsed: 0, duration: 26, easing: 'easeInOut', done: false, loop: 'pingpong' },
        Sprite: sprite(h.key, 4),
      },
      // 头顶名牌：队伍色（我方蜀=红 / 敌方魏=蓝）。
      name: {
        Transform: xf(0, -34),
        Text: { content: h.name, fontSize: 9, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
        Color: { tint: h.team === TEAM_A ? 0xd8504e : 0x3a86d4, alpha: 1 },
        Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
        Hierarchy: { ...sidecarLink, localY: -34 },
      },
      hpbg: { ...bar(HP_Y, 5), Color: { tint: trackColor, alpha: 0.85 } },
      hpbar: { ...bar(HP_Y, 5), Color: { tint: 0x54ad8e, alpha: 1 }, Gauge: { resourceId: 'hp', fromParent: true, width: BAR_W } },
      mpbg: { ...bar(MP_Y, 3), Color: { tint: trackColor, alpha: 0.85 } },
      mpbar: { ...bar(MP_Y, 3), Color: { tint: 0x8aa0e6, alpha: 1 }, Gauge: { resourceId: 'mp', fromParent: true, width: BAR_W }, Hierarchy: { ...sidecarLink, parentId: '@local:mana', localY: MP_Y } },
      // 大招接线（F-9 完结篇，全 per-instance 零唯一 id）：
      // · 回蓝 = over-time 永久 regen；· 蓝满→放→清 = sidecar SelfRule。
      mana: {
        Transform: xf(0, 0),
        Resource: { id: 'mp', current: 0, min: 0, max: 100 },
        OverTime: { effects: [{ id: 'mp_regen', resource: 'mp', amountPerTick: MANA_REGEN.amount, period: MANA_REGEN.period, duration: 0, elapsed: 0 }] },
        Perception: { targetTag: h.enemy, sightRadius: 0 },
        SelfRule: { when: { kind: 'resource', id: 'mp', cmp: 'gte', value: 100 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: `ult_${h.id}`, at: 'target' }, { kind: 'modify-resource', op: 'set', value: 0 }], once: false, armed: false },
        Hierarchy: { ...sidecarLink },
      },
    },
  } as unknown as PrefabTemplate;
}

// 棋子 overrides 包（统一管道）：星级数值 + 阵营 Tag + HexPos。
// hpMul=§4.5 敌阵强度；'@origin-hex' 哨兵=席位 marker 跟手（REQ-F-049）。
export function heroOverrides(h: HeroSpec, star: number, hexPos: Record<string, unknown> | string, hpMul = 1): Record<string, unknown> {
  const hp = Math.round(finalHp(h) * hpMul * STAR_HP_MUL[star]);
  return {
    main: {
      HexPos: hexPos,
      Tag: { flags: h.team | h.cls | h.faction },
      Resource: { current: hp, max: hp },
      ...(star >= 2 ? { SelfRule: { do: [h.atkType === 'melee' ? { kind: 'spawn', template: `strike_${h.id}_s${star}`, at: 'target' } : { kind: 'spawn', template: `proj_${h.id}_s${star}`, at: 'self' }] } } : {}),
    },
    ...(star >= 2 ? { mana: { SelfRule: { do: [{ kind: 'spawn', template: `ult_${h.id}_s${star}`, at: 'target' }, { kind: 'modify-resource', op: 'set', value: 0 }] } } } : {}),
  };
}

// 敌方阵容槽位（持久数据，REQ-F-032）：无 TEAM 位 → wipe 清场不波及；跨回合常驻。
export function slotEntity(h: HeroSpec, onSignal: string, col: number, row: number, hpMul = 1): EntityBlueprint {
  const a = offsetToAxial(col, row);
  const p = project(a.q, a.r);
  return {
    Transform: xf(p.x, p.y),
    Caster: { onSignal, template: `hero_${h.id}`, at: 'self', overrides: heroOverrides(h, 1, { q: a.q, r: a.r }, hpMul) },
  } as unknown as EntityBlueprint;
}

// 野怪模板：简化棋子（无大招/蓝条；带血条+名牌；死亡掉法球）。Tag/血量由槽位 overrides 写。
function mobTemplate(atk: number): PrefabTemplate {
  return {
    entities: {
      main: {
        Transform: xf(0, 0),
        Shape: { kind: 'box', width: 16, height: 16 },
        Tag: { flags: 0 },
        Resource: { id: 'hp', current: 1, min: 0, max: 1 },
        Perception: { targetTag: TEAM_A, sightRadius: 0 },
        HexPos: { q: 0, r: 0 },
        GridMover: { period: MOVE_PERIOD, elapsed: 0, haltStatusMask: FROZEN, glideSpeed: 0.8 },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: 'mob_death' },
        Timer: { id: 'atk', elapsed: 0, duration: ATK_CD, loop: true },
        SelfRule: { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: ATK_CD - 1 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: `strike_mob_${atk}`, at: 'target' }], once: false, armed: false },
        Tween: { target: 'Transform.scaleY', from: 1, to: 1.05, elapsed: 0, duration: 26, easing: 'easeInOut', done: false, loop: 'pingpong' },
        Sprite: sprite(F_HERO.gan_ning, 4),
      },
      name: {
        Transform: xf(0, -34),
        Text: { content: '黄巾賊', fontSize: 9, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
        Color: { tint: 0xa98b8f, alpha: 1 },
        Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
        Hierarchy: { ...sidecarLink, localY: -34 },
      },
      hpbg: { Transform: xf(0, HP_Y), Shape: { kind: 'box', width: BAR_W, height: 5 }, Hierarchy: { ...sidecarLink, localY: HP_Y }, Color: { tint: trackColor, alpha: 0.85 } },
      hpbar: { Transform: xf(0, HP_Y), Shape: { kind: 'box', width: BAR_W, height: 5 }, Hierarchy: { ...sidecarLink, localY: HP_Y }, Color: { tint: 0x54ad8e, alpha: 1 }, Gauge: { resourceId: 'hp', fromParent: true, width: BAR_W } },
    },
  } as unknown as PrefabTemplate;
}

// 每英雄三张模板：普攻打击区 + 大招打击区 + 棋子复合体（REQ-F-032 回合重展开用）。
// 参数名 ROSTER 遮蔽外层，使函数为纯函数（不闭包任何外部状态）。
export function templatesFor(ROSTER: HeroSpec[]): Record<string, PrefabTemplate> {
  return Object.fromEntries(
  ROSTER.flatMap((h): [string, PrefabTemplate][] => [
    h.atkType === 'melee'
      ? [`strike_${h.id}`, strike(h.enemy, finalAtk(h), FX_BY_TYPE[h.atkType], h.team === TEAM_A ? 'dmg_scale_a' : 'dmg_scale_b')] as [string, PrefabTemplate]
      : [`proj_${h.id}`, projectile(h.enemy, finalAtk(h), FX_BY_TYPE[h.atkType], h.team === TEAM_A ? 'dmg_scale_a' : 'dmg_scale_b')] as [string, PrefabTemplate],
    [`ult_${h.id}`, ultTemplate(h.enemy, h.ultDmg, h.ultSize, h.ultFx, h.ultDot, h.ultFreeze, h.team === TEAM_A ? 'dmg_scale_a' : 'dmg_scale_b')],
    [`hero_${h.id}`, heroTemplate(h)],
    // 死亡碎裂：4 个 0.55 倍迷你分身向四角飞散+渐隐。
    [`death_${h.id}`, {
      entities: Object.assign(
        Object.fromEntries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => [`q${i}`, {
          Transform: { x: dx * 5, y: dy * 5, rotation: 0, scaleX: 0.55, scaleY: 0.55 },
          Velocity: { vx: dx * 2.0, vy: dy * 1.6 - 0.6, angular: 0 },
          Color: { tint: 0xffffff, alpha: 0.95 },
          Tween: { target: 'Color.alpha', from: 0.95, to: 0, elapsed: 0, duration: 26, easing: 'easeOut', done: false },
          Timer: { id: 'life', elapsed: 0, duration: 30, loop: false },
          Sprite: sprite(h.key, 6),
        }])),
        h.team === TEAM_A ? {} : { eorb: { Transform: xf(0, 0), Shape: { kind: 'box', width: 13, height: 13 }, Sensor: {}, Text: { content: '📦', fontSize: 15, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Sprite: sprite(F_FX_STRIKE, 6), Color: { tint: 0xcf9a3f, alpha: 1 }, Tag: { flags: EQUIP | ZONE_FLAG }, Hitbox: { resource: 'items', amount: -1, targetMask: BAG, consumeOnHit: true } } },
      ),
    } as unknown as PrefabTemplate],
  ]).concat(
    // 备战席位模板（v2 §4.6 + F-17 升星家族）：席位 marker 即上场槽（REQ-F-049 统一架构）。
    ROSTER.filter((x) => x.team === TEAM_A).flatMap((h): [string, PrefabTemplate][] =>
      [1, 2, 3].map((s): [string, PrefabTemplate] => [
        s === 1 ? `bench_${h.id}` : `bench${s}_${h.id}`,
        {
          entities: {
            seat: {
              Transform: { x: 0, y: 0, rotation: 0, scaleX: STAR_SCALE[s], scaleY: STAR_SCALE[s] },
              Sprite: sprite(h.key, 2),
              Shape: { kind: 'box', width: 30, height: 30 },
              Clickable: { action: s === 1 ? `sell_${h.id}` : `sell${s}_${h.id}`, phase: 'up', onlyFlag: 'click_sell_off' },
              Tag: { flags: BENCH_OCC | MARKER_VIS },
              Visibility: { visible: true, active: true },
              Draggable: { snap: 'hex', onlyFlag: 'in_prep', capTagMask: BENCH_OCC, capResource: 'level' },
              // 落子弹跳（REQ-F-057）：压扁回弹 keep Tween。
              Tween: { target: 'Transform.scaleY', from: STAR_SCALE[s] * 1.35, to: STAR_SCALE[s], elapsed: 0, duration: 12, easing: 'easeOut', done: false, keep: true },
              Caster: { onSignal: 'deploy', template: `hero_${h.id}`, at: 'self', requireHexPos: true, overrides: heroOverrides(h, s, '@origin-hex') },
            },
            ...(s >= 2
              ? {
                  // 合成闪光（用户「合在一起要有效果」）：仅 2/3 星模板自带。
                  flash: {
                    Transform: { x: 0, y: 0, rotation: 0, scaleX: 2.4, scaleY: 2.4 },
                    Color: { tint: 0xcf9a3f, alpha: 0.95 },
                    Tween: { target: 'Color.alpha', from: 0.95, to: 0, elapsed: 0, duration: 22, easing: 'easeOut', done: false },
                    Timer: { id: 'life', elapsed: 0, duration: 24, loop: false },
                    Sprite: sprite(F_FX_FLAME, 32),
                  },
                  // ★ 角标：2 星银 / 3 星金。
                  star: {
                    Transform: xf(0, -26),
                    Text: { content: STAR_GLYPH[s], fontSize: s === 3 ? 16 : 14, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
                    Color: { tint: s === 3 ? 0xcf9a3f : 0x8aa0e6, alpha: 1 },
                    Tag: { flags: MARKER_VIS },
                    Visibility: { visible: true, active: true },
                    Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
                    Hierarchy: { parentId: '@local:seat', localX: 0, localY: -26, localRotation: 0, localScaleX: 1, localScaleY: 1 },
                  },
                }
              : {}),
          },
        } as unknown as PrefabTemplate,
      ]),
    ),
    // 升星武器模板（F-17）：二/三星普攻与大招（×1.5/×2.25），槽位 overrides 换弹。
    ROSTER.filter((x) => x.team === TEAM_A).flatMap((h): [string, PrefabTemplate][] =>
      [2, 3].flatMap((s): [string, PrefabTemplate][] => [
        h.atkType === 'melee'
          ? [`strike_${h.id}_s${s}`, strike(h.enemy, Math.round(finalAtk(h) * STAR_DMG_MUL[s]), FX_BY_TYPE[h.atkType], 'dmg_scale_a')] as [string, PrefabTemplate]
          : [`proj_${h.id}_s${s}`, projectile(h.enemy, Math.round(finalAtk(h) * STAR_DMG_MUL[s]), FX_BY_TYPE[h.atkType], 'dmg_scale_a')] as [string, PrefabTemplate],
        [`ult_${h.id}_s${s}`, ultTemplate(h.enemy, Math.round(h.ultDmg * STAR_DMG_MUL[s]), h.ultSize, h.ultFx, h.ultDot, h.ultFreeze, 'dmg_scale_a')],
      ]),
    ),
    // 野怪（批B）：每档攻一张 strike + 一张 mob 模板。
    PVE_WAVES.map((w): [string, PrefabTemplate] => [`strike_mob_${w.atk}`, strike(TEAM_A, w.atk, F_FX_BOLT)]),
    PVE_WAVES.map((w): [string, PrefabTemplate] => [`mob_s${w.stage}`, mobTemplate(w.atk)]),
    [[
      'loot_orb',
      { entities: { orb: { Transform: xf(0, 0), Shape: { kind: 'box', width: 10, height: 10 }, Sensor: {}, Sprite: sprite(F_FX_DRAIN, 5), Color: { tint: 0xd8607b, alpha: 1 }, Tag: { flags: LOOT | ZONE_FLAG }, Hitbox: { resource: 'loot', amount: -5, targetMask: PROTAG, consumeOnHit: true } } } } as unknown as PrefabTemplate,
    ]] as [string, PrefabTemplate][],
    // 野怪死亡复合（掉法球 + 四分碎裂）。
    [[
      'mob_death',
      { entities: Object.assign(
        { orb: { Transform: xf(0, 0), Shape: { kind: 'box', width: 10, height: 10 }, Sensor: {}, Sprite: sprite(F_FX_DRAIN, 5), Color: { tint: 0xd8607b, alpha: 1 }, Tag: { flags: LOOT | ZONE_FLAG }, Hitbox: { resource: 'loot', amount: -5, targetMask: PROTAG, consumeOnHit: true } },
          eorb: { Transform: xf(14, 0), Shape: { kind: 'box', width: 13, height: 13 }, Sensor: {}, Text: { content: '📦', fontSize: 15, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Sprite: sprite(F_FX_STRIKE, 6), Color: { tint: 0xcf9a3f, alpha: 1 }, Tag: { flags: EQUIP | ZONE_FLAG }, Hitbox: { resource: 'items', amount: -1, targetMask: BAG, consumeOnHit: true } } },
        Object.fromEntries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => [`q${i}`, {
          Transform: { x: dx * 5, y: dy * 5, rotation: 0, scaleX: 0.5, scaleY: 0.5 },
          Velocity: { vx: dx * 2.0, vy: dy * 1.6 - 0.6, angular: 0 },
          Color: { tint: 0xffffff, alpha: 0.9 },
          Tween: { target: 'Color.alpha', from: 0.9, to: 0, elapsed: 0, duration: 24, easing: 'easeOut', done: false },
          Timer: { id: 'life', elapsed: 0, duration: 28, loop: false },
          Sprite: sprite(F_HERO.gan_ning, 6),
        }])),
      ) } as unknown as PrefabTemplate,
    ]] as [string, PrefabTemplate][],
    // 胜利彩点（庆祝相位喷洒）。
    [[
      'win_burst',
      { entities: Object.fromEntries([[-1.8, -1.2], [-0.6, -2.0], [0.6, -2.0], [1.8, -1.2]].map(([vx, vy], i) => [`c${i}`, {
        Transform: { x: (i - 1.5) * 8, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Shape: { kind: 'circle', radius: 4 },
        Velocity: { vx, vy, angular: 0 },
        Color: { tint: i % 2 === 0 ? 0xcf9a3f : 0xe887a0, alpha: 0.95 },
        Tween: { target: 'Color.alpha', from: 0.95, to: 0, elapsed: 0, duration: 38, easing: 'easeOut', done: false },
        Timer: { id: 'life', elapsed: 0, duration: 42, loop: false },
        Sprite: zlift(33),
      }])) } as unknown as PrefabTemplate,
    ]] as [string, PrefabTemplate][],
    // 战果面板（动态结算过程）：逐行错速淡入，数字 TextBinding 实时跳。
    [[
      'result_win',
      { entities: {
        head:    { Transform: xf(0,  0), Text: { content: '— 战 果 —',    fontSize: 14, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration:  8, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        verdict: { Transform: xf(0, 20), Text: { content: '🏆 本回合胜利', fontSize: 15, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 16, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        gline:   { Transform: xf(0, 40), Text: { content: '金币 0',        fontSize: 12, fontFamily: FONT_NUM,     anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'gold',       prefix: '金币 ' }, Color: { tint: 0xcf9a3f, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 26, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        sline:   { Transform: xf(0, 58), Text: { content: '',              fontSize: 12, fontFamily: FONT_BODY,    anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'win_streak', prefix: '连胜 ' }, Color: { tint: 0x8aa0e6, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 36, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        hline:   { Transform: xf(0, 76), Text: { content: '血量 100',      fontSize: 12, fontFamily: FONT_NUM,     anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'player_hp',  prefix: '血量 ' }, Color: { tint: 0xd65668, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 46, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
      } } as unknown as PrefabTemplate,
    ]] as [string, PrefabTemplate][],
    [[
      'result_lose',
      { entities: {
        head:    { Transform: xf(0,  0), Text: { content: '— 战 果 —',    fontSize: 14, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration:  8, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        verdict: { Transform: xf(0, 20), Text: { content: '💔 本回合战败', fontSize: 15, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xd65668, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 16, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        gline:   { Transform: xf(0, 40), Text: { content: '金币 0',        fontSize: 12, fontFamily: FONT_NUM,     anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'gold',        prefix: '金币 ' }, Color: { tint: 0xcf9a3f, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 26, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        sline:   { Transform: xf(0, 58), Text: { content: '',              fontSize: 12, fontFamily: FONT_BODY,    anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'lose_streak', prefix: '连败 ' }, Color: { tint: 0x8aa0e6, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 36, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
        hline:   { Transform: xf(0, 76), Text: { content: '血量 100',      fontSize: 12, fontFamily: FONT_NUM,     anchor: 'center', lineSpacing: 0 }, TextBinding: { resourceId: 'player_hp',   prefix: '血量 ' }, Color: { tint: 0xd65668, alpha: 0 }, Tween: { target: 'Color.alpha', from: 0, to: 1, elapsed: 0, duration: 46, easing: 'easeOut', done: false }, Tag: { flags: RESULT }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 34 } },
      } } as unknown as PrefabTemplate,
    ]] as [string, PrefabTemplate][],
    // 商店大卡（F-14 重排）：在售英雄的可点大卡面（60×68）+ 名字签 + 价签。
    ROSTER.filter((x) => x.team === TEAM_A).map((h): [string, PrefabTemplate] => [
      `shopcard_${h.id}`,
      { entities: {
        card:      { Transform: xf(0,   0), Shape: { kind: 'box', width: 58, height: 68 }, Sprite: sprite(h.key, 28), Color: { tint: 0xcf9a3f, alpha: 1 }, Clickable: { action: 'ph' }, Tag: { flags: 0 } },
        cardname:  { Transform: xf(0, -26), Text: { content: h.name, fontSize: 9,  fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0x5a3f44, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 29 }, Hierarchy: { parentId: '@local:card', localX: 0, localY: -26, localRotation: 0, localScaleX: 1, localScaleY: 1 } },
        cardprice: { Transform: xf(0,  28), Text: { content: '💰3',   fontSize: 11, fontFamily: FONT_NUM,  anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 29 }, Hierarchy: { parentId: '@local:card', localX: 0, localY:  28, localRotation: 0, localScaleX: 1, localScaleY: 1 } },
      } } as unknown as PrefabTemplate,
    ]),
  ),
  );
}

// 模块级默认（玩家=蜀），供 index.ts 导出/外部消费；build 内按所选阵营重新生成并 shadow。
export const GAME_F_TEMPLATES = templatesFor(rosterFor('shu'));
