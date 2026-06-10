import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';
import type { SpawnRequest, PrefabLibrary, PrefabTemplate, SpawnOverrides } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  prefab —— 数据级预制模板展开（T4 授权层）。ARPG 评审里回驳了「YAML→Node 编译器」，
//  用户采纳反提案 B：宏 = 数据，引擎确定性展开，AI 产数据不产代码。
//
//  复用 spawn 原子的 SpawnRequest{templateId,x,y}（请求契约已有、展开系统此前为空，正是这块缺口）。
//  本能力读单例 PrefabLibrary（模板库数据）+ 消费 SpawnRequest：
//    查模板 → 为模板里每个 localId 建实体（id = `${templateId}#${seq}:${localId}`，确定性唯一）
//    → 深拷贝组件数据（实例隔离）→ Transform 偏移到 (x,y) → addComponent。
//  seq 进 PrefabLibrary（snapshot 可重放）；query/Object 顺序确定 → 单端录放一致。
//
//  这样「冰霜新星」= 一条 PrefabTemplate 数据 + 一个 SpawnRequest 数据；运行时释放技能 =
//  发 SpawnRequest，引擎展开出带 Hitbox/Shape/Tag/Timer 的伤害区，再走 trigger-zone→hitbox 结算。
//  从自然语言到可玩机制，全程数据，零游戏代码、零编译器。
// ═══════════════════════════════════════════════════════════════

function findLibrary(world: IWorld): PrefabLibrary | undefined {
  for (const [e] of world.query('PrefabLibrary')) return world.getComponent<PrefabLibrary>(e, 'PrefabLibrary');
  return undefined;
}

// 实例化一个模板到 (x,y)，返回新建实体 id 列表（便于测试/调试）。
// overrides（REQ-F-032）：localId→组件→字段补丁，深拷贝+Transform 偏移之后逐字段合并——
// 同一模板展开异构实例（各自 HexPos/Tag/数值）。补丁亦深拷贝（请求方数据与实例隔离）。
export function instantiate(world: IWorld, tmpl: PrefabTemplate, templateId: string, seq: number, x: number, y: number, overrides?: SpawnOverrides): string[] {
  const created: string[] = [];
  for (const [localId, comps] of Object.entries(tmpl.entities)) {
    const eid = `${templateId}#${seq}:${localId}`;
    world.createEntity(eid);
    const patches = overrides?.[localId];
    for (const [ctype, data] of Object.entries(comps)) {
      const copy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>; // 深拷贝隔离实例
      if (ctype === 'Transform') {
        copy.x = ((copy.x as number) ?? 0) + x;
        copy.y = ((copy.y as number) ?? 0) + y;
      }
      const patch = patches?.[ctype];
      if (patch) Object.assign(copy, JSON.parse(JSON.stringify(patch)) as Record<string, unknown>);
      world.addComponent(eid, { type: ctype, ...copy } as unknown as Component);
    }
    created.push(eid);
  }
  return created;
}

export const prefabCapability = defineCapability({
  id: 't3-prefab',
  version: '1.0.0',

  describe: {
    name: 'prefab',
    summary: '数据级预制模板展开：消费 SpawnRequest{templateId,x,y}，从 PrefabLibrary 查模板 → 确定性实例化为实体+组件（唯一 id、Transform 偏移、深拷贝）。',
    semantic: ['tier3', 'lifecycle', 'authoring', 'interpreter'],
    whenToUse:
      '运行时按数据生成多实体机制（技能/陷阱/刷怪/特效）。模板写进 PrefabLibrary（数据），释放即发 SpawnRequest（数据）。AI 产高层数据，引擎确定性展开，无 YAML 编译器、无游戏代码。',
    examples: [
      '冰霜新星：SpawnRequest{templateId:"frost_nova", x, y} → 展开伤害区（Shape+Sensor+Tag(ZONE)+Hitbox+Timer）',
      '刷怪：SpawnRequest{templateId:"slime", x, y} → 展开敌人（Transform+Shape+Tag(ENEMY)+Resource(hp)）',
      '组合机制：一个模板可含多实体（弹幕母体 + 多发子弹）',
    ],
  },

  components: {
    provides: {
      PrefabLibrary: {
        category: 'config',
        describe: '预制模板库（数据，单例）。templates: id→模板（实体/组件蓝图）。seq: 实例计数器（确定性唯一 id）。',
        fields: {
          templates: { type: 'string', describe: '模板库 Record<id, {entities:{localId:{Comp:data}}}>（复杂对象，按数据填）' },
          seq: { type: 'number', describe: '实例计数器（每次展开 +1，进 snapshot 可重放）' },
        },
      },
    },
    reads: ['SpawnRequest', 'PrefabLibrary'],
    writes: ['PrefabLibrary'],
    consumes: ['SpawnRequest'],
  },

  config: {},

  systems: [
    {
      id: 'prefab-spawn',
      reads: ['SpawnRequest', 'PrefabLibrary'],
      writes: ['PrefabLibrary'],
      consumes: ['SpawnRequest'],
      execute(world: IWorld) {
        const lib = findLibrary(world);
        if (!lib) return;
        for (const [rid, comps] of world.query('SpawnRequest')) {
          const req = world.getComponent<SpawnRequest>(rid, 'SpawnRequest');
          if (req) {
            const tmpl = lib.templates[req.templateId];
            if (tmpl) {
              instantiate(world, tmpl, req.templateId, lib.seq, req.x, req.y, req.overrides);
              lib.seq += 1;
            }
          }
          // BUG-004：专用请求载体（仅 SpawnRequest 一个组件，如 mortal 的 drop:<id>）展开后销毁回收，
          // 否则空实体永久残留（长局/刷怪无界增长，进 snapshot 拖慢，id 复用还会抛错）。
          // caster 等把 SpawnRequest 挂在持久实体上（组件数 >1）→ 不销毁，仅其 SpawnRequest 被 consume。
          if (comps.size === 1) world.destroyEntity(rid);
        }
      },
    },
  ],
});
