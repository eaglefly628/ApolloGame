import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import type { DeliverDrop, Order, PrefabOrigin, DestroyRequest, Resource } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  order-fulfill —— 玩家**拖成品去交付订单**的位置感知交付裁决（REQ-101-07·顾客点单/收集任务/合成台通用）。
//
//  区别 craft-recipe（只吞/产资源计数·不吞棋盘实体实例）：本件消耗的是**具体的成品实例**（带 PrefabOrigin）。
//  宿主层把「拖成品 item 落到顾客卡 order」合成一条 DeliverDrop{item,order}（host 解析被拖实例 + 落点订单实体）：
//    ① item 模板命中 order 某个**未满 slot** 的 needItem → 销毁 item + 该 slot 置满；
//    ② 全部 slot 集齐 → 一次性发 reward（资源增量·钳进各资源 min/max）+（resetOnComplete!==false）清空 filled 重新接单；
//    ③ 不命中（模板不在需求 / 对应 slot 已满）→ 什么都不做（宿主可回弹 item）。
//  订单态 Order{needItems,filled,reward} 是纯数据（顺序即 slot 序）；发奖表数据化，游戏层零交付逻辑。
//  确定性：只读/写确定状态、按落放意图逐条结算（host 合成序确定）；销毁汇入 destroy-apply、发奖写 Resource（钳限）。
// ═══════════════════════════════════════════════════════════════

export const orderFulfillCapability = defineCapability({
  id: 't2-order-fulfill',
  version: '1.0.0',

  describe: {
    name: 'order-fulfill',
    summary: '拖成品交付订单：item 模板命中订单某未满 slot→销毁该实例+置满该 slot；全 slot 集齐→发奖(资源增量·钳限)+可重置。消耗棋盘实体实例的多槽交付（区别 craft-recipe 只吞资源计数）。',
    semantic: ['tier2', 'order', 'deliver', 'interpreter'],
    whenToUse:
      '合并/收集游戏的订单交付（Gossip Harbor 顾客点单/收集任务/合成台：拖成品给顾客→消耗该成品实例+集齐发奖）。宿主拖拽手势合成 DeliverDrop{item,order}；Order{needItems,filled,reward} 提供订单态数据（本件读写之）。',
    examples: [
      '交付命中：DeliverDrop{ item:"dish_7", order:"ord_zhou" }（dish_7 模板==needItems 某未满 slot）→ 销毁 dish_7 + 该 slot 置满',
      '集齐发奖：最后一 slot 满 → reward 逐条 modify Resource（+金币/星星）+ 清空 filled 重新接单',
      '不命中：item 模板不在 needItems / 对应 slot 已满 → 无改动（宿主回弹）',
    ],
  },

  components: {
    provides: {
      Order: {
        category: 'config',
        describe: '多槽交付订单：needItems 各 slot 要的模板 id、filled 各 slot 已交付否（等长）、reward 集齐发的资源增量表。',
        fields: {
          orderId: { type: 'string', describe: '订单标识（宿主投影/发信号用）' },
          needItems: { type: 'string', describe: '各 slot 需要的模板 id 数组（顺序即 slot 序·最多 N）' },
          filled: { type: 'string', describe: '各 slot 是否已交付的布尔数组（与 needItems 等长·初始全 false）' },
          reward: { type: 'string', describe: '全 slot 集齐后发的 {resourceId,amount}[]（钳进各资源 min/max）' },
          resetOnComplete: { type: 'boolean', describe: '集齐发奖后是否清空 filled 重新接单（缺省 true）' },
        },
      },
      DeliverDrop: {
        category: 'intent',
        describe: '交付意图（宿主合成·消费即清）。item=被拖成品实例(带 PrefabOrigin)·order=目标订单实体。',
        fields: {
          item: { type: 'EntityId', describe: '被拖去交付的成品实例' },
          order: { type: 'EntityId', describe: '目标订单实体（带 Order）' },
        },
      },
    },
    reads: ['DeliverDrop', 'Order', 'PrefabOrigin'],
    writes: ['DestroyRequest', 'Order', 'Resource'],
    consumes: ['DeliverDrop'],
  },

  config: {},

  systems: [
    {
      id: 'order-fulfill',
      phase: SystemPhase.Update,
      reads: ['DeliverDrop', 'Order', 'PrefabOrigin'],
      writes: ['DestroyRequest', 'Order', 'Resource'],
      consumes: ['DeliverDrop'],
      execute(world: IWorld) {
        const drops = world.query('DeliverDrop').map(([id, comps]) => ({ id, size: comps.size }));
        for (const { id: did, size } of drops) {
          const d = world.getComponent<DeliverDrop>(did, 'DeliverDrop');
          if (d) {
            const itemPO = world.getComponent<PrefabOrigin>(d.item, 'PrefabOrigin');
            const order = world.getComponent<Order>(d.order, 'Order');
            if (itemPO && order && Array.isArray(order.needItems) && Array.isArray(order.filled)) {
              // 找第一个「未满 && 需要该模板」的 slot。
              let slot = -1;
              for (let j = 0; j < order.needItems.length; j++) {
                if (!order.filled[j] && order.needItems[j] === itemPO.templateId) { slot = j; break; }
              }
              if (slot >= 0) {
                // ① 命中：销毁该成品实例 + 置满该 slot。
                if (!world.hasComponent(d.item, 'DestroyRequest')) world.addComponent(d.item, { type: 'DestroyRequest', entityId: d.item } as DestroyRequest);
                order.filled[slot] = true;
                // ② 全满 → 发奖（钳限）+（缺省）重置接单。
                if (order.filled.every((f) => f)) {
                  for (const rw of order.reward ?? []) {
                    const r = world.getComponent<Resource>(rw.resourceId, 'Resource');
                    if (r) r.current = Math.max(r.min, Math.min(r.max, r.current + rw.amount));
                  }
                  if (order.resetOnComplete !== false) order.filled = order.needItems.map(() => false);
                }
              }
            }
          }
          // 消费：专用载体（仅 DeliverDrop）回收；挂在持久实体上则仅去组件。
          if (size === 1) world.destroyEntity(did);
          else world.removeComponent(did, 'DeliverDrop');
        }
      },
    },
  ],
});
