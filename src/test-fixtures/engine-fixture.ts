// 引擎侧最小夹具（REQ-RETRO 批①·2026-08-03）——不挂 games/** 下的一份自足测试蓝图 + 资产清单桩。
//
// 背景：bench/assembly/studio 等引擎侧工具历史上借用 game-f/game-e 的真实蓝图当"随手可得的真实数据"
// 测试夹具（decouple-check.mjs 的 SRC_GRANDFATHERED 祖父白名单 9 条），构成引擎→游戏目录的越界耦合
// （game-f/game-e 虽存活（game-f owner 2026-08-03 改判还原上架），但引擎侧工具借用具体游戏当夹具
// 本就是应消解的架构债——与该游戏是否存在无关，此耦合断开与否不应系于游戏生死）。
// 本文件是唯一替代：比 demo.assembly.ts 的两实体示例更完整——覆盖信号链(EventWhen→Effect)、
// 经济配方(CraftRecipe)、prefab 模板(PrefabLibrary+Caster)、逐实体死亡(Mortal)、流程机(GameFlow)，
// 让 validate-references 的"真实蓝图零误报"回归仍有意义（不退化成空跑）；且整份蓝图真跑得动 Engine
// （bench/preview 集成测试要求 load+tick 不崩·经实测校准：flow+dialogue 两个"图解释器"能力同蓝图共存
// 会在拓扑排序产生真实环，故未收 DialogueScript——链接器对 DialogueScript 的断链规则已有独立单测覆盖，
// 不靠这份"真实蓝图回归"兜底）。
import {
  transformCapability,
  velocityCapability,
  shapeCapability,
  spriteCapability,
  timerCapability,
  overlapDetectCapability,
  destroyCapability,
  resourceCapability,
  flagCapability,
  cameraCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability } from '@skills/tier1/index.js';
import {
  eventWhenCapability,
  effectApplyCapability,
  clickableCapability,
  craftRecipeCapability,
  mortalCapability,
  keybindCapability,
} from '@skills/tier2/index.js';
import { casterCapability, prefabCapability, flowCapability } from '@skills/tier3/index.js';
import type { WorldBlueprint, EntityBlueprint } from '../assembly/demo.assembly.js';
import type { AssetManifest } from '../assets/asset-types.js';

/** 夹具能力词汇表：涵盖信号/经济/prefab/死亡/流程五类逻辑，供需要"真实复杂蓝图"的回归测试消费。 */
export const FIXTURE_CAPABILITIES = [
  transformCapability,
  velocityCapability,
  shapeCapability,
  spriteCapability,
  timerCapability,
  overlapDetectCapability,
  destroyCapability,
  motionApplyCapability,
  lifetimeCapability,
  resourceCapability,
  flagCapability,
  cameraCapability,
  eventWhenCapability,
  effectApplyCapability,
  clickableCapability,
  craftRecipeCapability,
  mortalCapability,
  keybindCapability,
  casterCapability,
  prefabCapability,
  flowCapability,
];

/** 每次调用产一份新蓝图（确定性双跑要求独立实例，同 demoBlueprint 的用法约定）。 */
export function buildFixtureBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // ── 空间层：子弹撞墙自毁（同 demo.assembly，验证 motion/overlap/timer/destroy 协作） ──
    bullet: {
      Transform: { x: 0, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      Velocity: { vx: 8, vy: 0, angular: 0 },
      Shape: { kind: 'box', width: 8, height: 8 },
      Sprite: { textureKey: 'fixture_bullet', anchorX: 0.5, anchorY: 0.5, zOrder: 10 },
      Timer: { id: 'life', elapsed: 0, duration: 12, loop: false },
    },
    wall: {
      Transform: { x: 80, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: 16, height: 64 },
    },
    camera: {
      Camera: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 640, viewportH: 400 },
    },
    // ── 信号链：plate 条件成立 → 产 plate_on 信号 → door 收到置 Flag（EventWhen 生产者 + Effect 消费者）──
    door: {
      Effect: { onSignal: 'plate_on', kind: 'set-flag', targetId: 'opened', value: true },
      Flag: { id: 'opened', active: false },
    },
    plate: {
      EventWhen: { signal: 'plate_on', when: { kind: 'flag', id: 'opened' }, mode: 'edge', armed: false },
    },
    // ── 经济：CraftRecipe 收到 buy 信号且够 gold → 扣 gold 产 item + 置 shopFlag + 切 quest 状态 ──
    hero: {
      KeyBinding: { key: '1', signal: 'cast' },
      Clickable: { action: 'buy' },
      Resource: { id: 'gold', current: 10, min: 0, max: 99 },
    },
    shop: {
      CraftRecipe: {
        onSignal: 'buy',
        costs: [{ id: 'gold', amount: 3 }],
        gains: [{ id: 'item', amount: 1 }],
        grantsFlag: 'shopFlag',
        grantsState: { fsmId: 'quest', value: 'done' },
      },
    },
    inventory: { Resource: { id: 'item', current: 0, min: 0, max: 99 } },
    gate: { Flag: { id: 'shopFlag', active: false } },
    quest: { State: { fsmId: 'quest', current: 'start', previous: 'start' } },
    // ── prefab + caster：hero 按键 'cast' 释放，从 lib 的模板库生成 spark ──
    lib: {
      PrefabLibrary: { templates: { spark: { entities: { body: { Tag: { flags: 0 } } } } }, seq: 0 },
    },
    caster: {
      Caster: { onSignal: 'cast', template: 'spark', at: 'self' },
    },
    // ── 逐实体死亡：mob 自身资源见底即销毁自己 ──
    mob: {
      Resource: { id: 'mob_hp', current: 5, min: 0, max: 5 },
      Mortal: { resource: 'mob_hp', atOrBelow: 0 },
    },
    // ── 流程机：单状态 idle（合法闭环，零跳转） ──
    flowCtl: {
      GameFlow: { id: 'main', current: 'idle', states: [{ id: 'idle' }] },
    },
  };

  return { capabilities: FIXTURE_CAPABILITIES, entities };
}

/** 夹具资产清单桩：给 Studio 资产浏览器（AssetLibrary/StudioInspector）当"内置样例游戏"用，
 *  替换掉此前借用 game-f 的 GAME_F_ASSETS。内容纯占位（data: 内联 + FreeArtLib 引用两种），
 *  分别覆盖 manifestRecords 的 filled/placeholder/sheet 三条状态分支。 */
export const FIXTURE_ASSETS: AssetManifest = [
  { kind: 'texture', key: 'fixture.hero', src: 'assets/FreeArtLib/monster/death_knight.png', width: 32, height: 32 },
  { kind: 'texture', key: 'fixture.fx.spark', src: 'data:image/svg+xml,<svg/>', width: 24, height: 24 },
  { kind: 'sprite-sheet', key: 'fixture.hero.sheet', src: 'data:image/svg+xml,<svg/>', frameWidth: 24, frameHeight: 24, columns: 4, count: 8 },
];
