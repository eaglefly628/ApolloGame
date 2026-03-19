const { createLogger } = require('../../utils/Logger');
const log = createLogger('MutationTree');

/**
 * OKR 科技树 - 升级面板
 * 三大分支：传播途径 (transmission)、异化症状 (symptom)、特殊能力 (ability)
 */

const MUTATIONS = [
  // ═══════════ 传播途径 (Transmission) ═══════════
  {
    id: 'referral_1', name: '内推机制 Lv.1',
    desc: '熟人网络：同海域传染率 +0.03',
    type: 'transmission', cost: 3, requires: [],
    modBeta: 0.03, modSev: 0, modGamma: 0, modCureRes: 0,
  },
  {
    id: 'referral_2', name: '内推机制 Lv.2',
    desc: 'HR 内推奖金加码：同海域传染率 +0.05',
    type: 'transmission', cost: 6, requires: ['referral_1'],
    modBeta: 0.05, modSev: 0, modGamma: 0, modCureRes: 0,
  },
  {
    id: 'referral_3', name: '内推机制 Lv.3',
    desc: '全员猎头化：同海域传染率 +0.08',
    type: 'transmission', cost: 12, requires: ['referral_2'],
    modBeta: 0.08, modSev: 0, modGamma: 0, modCureRes: 0,
  },
  {
    id: 'stock_option', name: '期权大饼画法',
    desc: '解锁跨海域洋流传播加速：跨区传染权重 +50%',
    type: 'transmission', cost: 8, requires: ['referral_1'],
    modBeta: 0.02, modSev: 0.01, modGamma: 0, modCureRes: 0,
    special: 'boost_cross_region',
  },
  {
    id: 'sink_market', name: '下沉市场裂变',
    desc: '低财富海域传染性暴增（传播阻力降低）',
    type: 'transmission', cost: 10, requires: ['referral_2'],
    modBeta: 0.04, modSev: 0, modGamma: 0, modCureRes: 0,
    special: 'sink_market_boost',
  },

  // ═══════════ 异化症状 (Symptoms) ═══════════
  {
    id: 'clock_anxiety', name: '打卡焦虑症',
    desc: '传染率微升 +0.02，异化度 +0.03',
    type: 'symptom', cost: 4, requires: [],
    modBeta: 0.02, modSev: 0.03, modGamma: 0, modCureRes: 0,
  },
  {
    id: 'meeting_hell', name: '无限会议综合征',
    desc: '异化度 +0.05，KPI 每日额外产出 +2',
    type: 'symptom', cost: 6, requires: ['clock_anxiety'],
    modBeta: 0, modSev: 0.05, modGamma: 0, modCureRes: 0,
    special: 'kpi_per_day_2',
  },
  {
    id: 'wolf_pua', name: '狼性 PUA 服从',
    desc: '异化度暴增 +0.12，KPI 产出翻倍，但解药加速 20%',
    type: 'symptom', cost: 15, requires: ['meeting_hell'],
    modBeta: 0.01, modSev: 0.12, modGamma: 0.005, modCureRes: -0.05,
    special: 'kpi_multiplier',
  },
  {
    id: 'organ_failure', name: '器官衰竭（猝死优化）',
    desc: '离职率暴增 +0.08。终极收割',
    type: 'symptom', cost: 25, requires: ['wolf_pua'],
    modBeta: 0, modSev: 0.15, modGamma: 0.08, modCureRes: 0,
  },
  {
    id: 'pdd_syndrome', name: '仅退款依赖症',
    desc: '传染率 +0.03，异化度 +0.04，有概率触发暴乱事件',
    type: 'symptom', cost: 8, requires: ['clock_anxiety'],
    modBeta: 0.03, modSev: 0.04, modGamma: 0.01, modCureRes: 0,
    special: 'refund_riot_chance',
  },

  // ═══════════ 特殊能力 (Abilities) ═══════════
  {
    id: 'non_compete', name: '竞业协议',
    desc: '离职率降低 0.02，锁住劳动力',
    type: 'ability', cost: 5, requires: [],
    modBeta: 0, modSev: 0, modGamma: -0.02, modCureRes: 0,
  },
  {
    id: 'legal_warning', name: '法务警告函',
    desc: '解药进度强行回退 5%',
    type: 'ability', cost: 12, requires: ['non_compete'],
    modBeta: 0, modSev: 0, modGamma: 0, modCureRes: 0,
    special: 'cure_rollback_5',
  },
  {
    id: 'team_building', name: '团建洗脑',
    desc: '降低所有海域意识水平 30%',
    type: 'ability', cost: 8, requires: [],
    modBeta: 0, modSev: 0, modGamma: 0, modCureRes: 0.05,
    special: 'reduce_awareness',
  },
  {
    id: 'data_fortress', name: '数据城堡',
    desc: '解药抗性 +0.1',
    type: 'ability', cost: 15, requires: ['team_building'],
    modBeta: 0, modSev: 0, modGamma: 0, modCureRes: 0.1,
  },
  {
    id: 'lei_jun_live', name: '雷总直播带货',
    desc: '全图传染率瞬间爆发 ×3（持续 5 天），但解药永久提速',
    type: 'ability', cost: 30, requires: ['data_fortress', 'wolf_pua'],
    modBeta: 0, modSev: 0.05, modGamma: 0, modCureRes: -0.1,
    special: 'lei_jun_ultimate',
  },
];

class MutationTree {
  constructor() {
    this.nodes = new Map();
    for (const m of MUTATIONS) {
      this.nodes.set(m.id, { ...m, isUnlocked: false });
    }
  }

  getAll() {
    return [...this.nodes.values()];
  }

  getByType(type) {
    return this.getAll().filter((n) => n.type === type);
  }

  canUnlock(id, unlockedSet) {
    const node = this.nodes.get(id);
    if (!node || node.isUnlocked) return false;
    return node.requires.every((reqId) => unlockedSet.has(reqId));
  }

  unlock(id, pathogen, world) {
    const node = this.nodes.get(id);
    if (!node) return { error: '科技节点不存在' };
    if (node.isUnlocked) return { error: '已解锁' };
    if (!this.canUnlock(id, pathogen.unlockedMutations)) {
      return { error: '前置科技未解锁' };
    }
    if (world.kpiPoints < node.cost) {
      return { error: `KPI 不足，需要 ${node.cost}，当前 ${world.kpiPoints}` };
    }

    world.kpiPoints -= node.cost;
    node.isUnlocked = true;
    pathogen.applyMutation(node);
    this._applySpecial(node, pathogen, world);

    log.info(`Mutation unlocked: ${node.name}`, { id, cost: node.cost, type: node.type, special: node.special || 'none' });
    return { success: true, node: node };
  }

  _applySpecial(node, pathogen, world) {
    switch (node.special) {
      case 'boost_cross_region':
        for (const [, region] of world.regions) {
          for (const conn of region.connections) {
            const base = conn.baseWeight || conn.weight;
            conn.weight = Math.min(1, base * 1.5);
            conn.baseWeight = base;
          }
        }
        log.info('Cross-region weights boosted ×1.5');
        break;

      case 'sink_market_boost':
        // FIX: 降低低财富海域的意识水平（让传播更容易），而不是改变 wealthLevel
        for (const [, region] of world.regions) {
          if (region.wealthLevel < 0.8) {
            region.awarenessLevel = Math.max(0, region.awarenessLevel - 0.3);
          }
        }
        log.info('Sink market boost: low-wealth region awareness reduced');
        break;

      case 'kpi_per_day_2':
        world.kpiPerDay += 2;
        log.info('KPI per day +2', { newTotal: world.kpiPerDay });
        break;

      case 'kpi_multiplier':
        world.kpiPerInfection *= 2;
        log.info('KPI per infection doubled', { newMultiplier: world.kpiPerInfection });
        break;

      case 'cure_rollback_5':
        world.cure.progress = Math.max(0, world.cure.progress - 5);
        log.info('Cure rolled back 5%', { newProgress: world.cure.progress });
        break;

      case 'reduce_awareness':
        for (const [, region] of world.regions) {
          region.awarenessLevel *= 0.7;
        }
        log.info('All region awareness reduced by 30%');
        break;

      case 'lei_jun_ultimate':
        // FIX: 实际实现雷总大招 - 传染率 ×3 持续 5 天
        if (pathogen) {
          const currentBeta = pathogen.baseInfectivity + pathogen.modInfectivity;
          const boost = currentBeta * 2; // ×3 总计 = 基础 + 2倍boost
          pathogen.modInfectivity += boost;
          // 设置 5 天后回退的定时器（通过 world tick 计数）
          pathogen._leiJunBoost = boost;
          pathogen._leiJunExpireDay = world.day + 5;
          log.info(`LEI JUN ULTIMATE activated: infectivity ×3 for 5 days`, { boost, expireDay: world.day + 5 });
        }
        break;

      default:
        break;
    }
  }

  toJSON() {
    return this.getAll().map((n) => ({
      id: n.id,
      name: n.name,
      desc: n.desc,
      type: n.type,
      cost: n.cost,
      requires: n.requires,
      isUnlocked: n.isUnlocked,
    }));
  }
}

module.exports = { MutationTree, MUTATIONS };
