const { createLogger } = require('../../utils/Logger');
const log = createLogger('EventSystem');

/**
 * 动态事件系统
 * 每日 tick 检查并触发随机事件，玩家需在限时内响应
 */

const EVENT_TEMPLATES = [
  {
    id: 'labor_arbitration',
    name: '劳动仲裁',
    desc: '龙虾提起劳动仲裁！3秒内连续点击5次"驳回"，否则扣除大量 KPI',
    type: 'interactive',
    triggerCondition: (world) => {
      const stats = world.pathogen ? world.pathogen.getStats() : { severity: 0 };
      return stats.severity > 0.15 && Math.random() < 0.06;
    },
    kpiPenalty: 15,
    requiredClicks: 5,
    timeLimit: 3000,
  },
  {
    id: 'refund_riot',
    name: '仅退款暴乱',
    desc: '下沉海域龙虾集体暴动！需花费 KPI 进行"封号反击"镇压',
    type: 'interactive',
    triggerCondition: (world) => {
      for (const [, region] of world.regions) {
        if (region.wealthLevel < 0.6 && region.infectionRate > 0.5 && Math.random() < 0.04) {
          return true;
        }
      }
      return false;
    },
    kpiCost: 10,
    kpiPenaltyIfIgnored: 25,
    affectedPop: 500,
  },
  {
    id: '996_blessing',
    name: '996 福报',
    desc: '全体打工虾进入狂热状态！传染率临时 ×1.5，持续 3 天',
    type: 'auto',
    triggerCondition: (world) => {
      return world.day % 30 === 0 && world.stats.totalInfected > 1000;
    },
    duration: 3,
    effect: { infectivityMult: 1.5 },
  },
  {
    id: 'whistleblower',
    name: '内部举报人',
    desc: '一名龙虾向媒体爆料！解药进度 +3%，但异化度降低',
    type: 'auto',
    triggerCondition: (world) => {
      const stats = world.pathogen ? world.pathogen.getStats() : { severity: 0 };
      return stats.severity > 0.2 && Math.random() < 0.03;
    },
    effect: { cureBoost: 3, severityReduce: 0.02 },
  },
  {
    id: 'government_inspection',
    name: '政府调查组',
    desc: '监管部门介入！随机一个海域进入"封锁"状态 10 天',
    type: 'auto',
    triggerCondition: (world) => {
      return world.stats.regionsDiscovered >= 5 && Math.random() < 0.02;
    },
    duration: 10,
    effect: { lockdownRandomRegion: true },
  },
];

class EventSystem {
  constructor() {
    this.activeEvents = [];
    this.activeBuffs = [];
    this.eventHistory = [];
  }

  /** 每日检查触发事件 */
  checkEvents(world) {
    const triggered = [];

    // FIX: 自动过期未响应的交互事件
    const now = Date.now();
    const expired = [];
    this.activeEvents = this.activeEvents.filter((evt) => {
      if (evt.expiresAt && now > evt.expiresAt) {
        expired.push(evt);
        return false;
      }
      return true;
    });
    for (const evt of expired) {
      // 过期事件自动执行惩罚
      if (evt.templateId === 'labor_arbitration') {
        world.kpiPoints = Math.max(0, world.kpiPoints - evt.kpiPenalty);
        log.warn(`Event expired with penalty`, { eventId: evt.id, penalty: evt.kpiPenalty });
      }
    }

    // 清理过期 buff
    this.activeBuffs = this.activeBuffs.filter((buff) => {
      buff.remainingDays--;
      if (buff.remainingDays <= 0) {
        try {
          this._removeBuffEffect(buff, world);
        } catch (e) {
          log.error(`Failed to remove buff effect`, { buffType: buff.type, error: e.message });
        }
        log.info(`Buff expired`, { type: buff.type, regionId: buff.regionId });
        return false;
      }
      return true;
    });

    // 检查新事件
    for (const template of EVENT_TEMPLATES) {
      if (template.triggerCondition(world)) {
        const event = this._createEvent(template, world);
        if (event) {
          triggered.push(event);
          this.eventHistory.push({ ...event, day: world.day });
          log.info(`Event triggered`, { eventId: event.id, name: event.name, type: event.type });
        }
      }
    }

    return triggered;
  }

  _createEvent(template, world) {
    if (template.type === 'interactive') {
      const event = {
        id: `${template.id}_${world.day}`,
        templateId: template.id,
        name: template.name,
        desc: template.desc,
        type: 'interactive',
        kpiPenalty: template.kpiPenalty || 0,
        kpiCost: template.kpiCost || 0,
        kpiPenaltyIfIgnored: template.kpiPenaltyIfIgnored || 0,
        affectedPop: template.affectedPop || 0,
        requiredClicks: template.requiredClicks || 0,
        timeLimit: template.timeLimit || 5000,
        expiresAt: Date.now() + (template.timeLimit || 5000),
      };
      this.activeEvents.push(event);
      return event;
    }

    if (template.type === 'auto') {
      const event = {
        id: `${template.id}_${world.day}`,
        templateId: template.id,
        name: template.name,
        desc: template.desc,
        type: 'auto',
      };
      this._applyAutoEffect(template, world);
      return event;
    }

    return null;
  }

  /** 玩家响应交互事件 */
  resolveEvent(eventId, action, world) {
    const idx = this.activeEvents.findIndex((e) => e.id === eventId);
    if (idx === -1) return { error: '事件已过期' };

    const event = this.activeEvents.splice(idx, 1)[0];

    // FIX: 检查是否过期
    if (event.expiresAt && Date.now() > event.expiresAt) {
      log.warn(`Player tried to resolve expired event`, { eventId });
      if (event.kpiPenalty) {
        world.kpiPoints = Math.max(0, world.kpiPoints - event.kpiPenalty);
      }
      return { success: false, message: '响应超时！' };
    }

    if (event.templateId === 'labor_arbitration') {
      if (action === 'dismiss') {
        log.info(`Labor arbitration dismissed successfully`, { eventId });
        return { success: true, message: '仲裁已驳回！' };
      }
      world.kpiPoints = Math.max(0, world.kpiPoints - event.kpiPenalty);
      log.info(`Labor arbitration penalty applied`, { eventId, penalty: event.kpiPenalty });
      return { success: false, message: `仲裁成功！扣除 ${event.kpiPenalty} KPI` };
    }

    if (event.templateId === 'refund_riot') {
      if (action === 'suppress') {
        if (world.kpiPoints >= event.kpiCost) {
          world.kpiPoints -= event.kpiCost;
          log.info(`Refund riot suppressed`, { eventId, cost: event.kpiCost });
          return { success: true, message: `已花费 ${event.kpiCost} KPI 镇压暴乱` };
        }
        return { error: 'KPI 不足' };
      }
      // 忽略暴乱
      world.kpiPoints = Math.max(0, world.kpiPoints - (event.kpiPenaltyIfIgnored || 25));
      // FIX: 感染者 → removed (逃离)，不是回归健康
      for (const [, region] of world.regions) {
        if (region.wealthLevel < 0.6 && region.infected > 0) {
          const lost = Math.min(region.infected, event.affectedPop || 500);
          region.infected -= lost;
          region.removed += lost;
        }
      }
      log.warn(`Refund riot ignored, infected escaped`, { eventId });
      return { success: false, message: '暴乱蔓延，部分打工虾逃离了！' };
    }

    return { error: '未知事件类型' };
  }

  _applyAutoEffect(template, world) {
    const effect = template.effect || {};

    if (effect.infectivityMult && template.duration) {
      if (world.pathogen) {
        const boost = (world.pathogen.baseInfectivity + world.pathogen.modInfectivity)
          * (effect.infectivityMult - 1);
        world.pathogen.modInfectivity += boost;
        this.activeBuffs.push({
          type: 'infectivity_boost',
          value: boost,
          remainingDays: template.duration,
        });
        log.info(`Infectivity buff applied`, { boost: Math.round(boost * 1000) / 1000, duration: template.duration });
      }
    }

    if (effect.cureBoost) {
      world.cure.progress = Math.min(100, world.cure.progress + effect.cureBoost);
      log.info(`Cure boosted`, { boost: effect.cureBoost, progress: world.cure.progress });
    }

    if (effect.severityReduce && world.pathogen) {
      world.pathogen.modSeverity = Math.max(0, world.pathogen.modSeverity - effect.severityReduce);
    }

    if (effect.lockdownRandomRegion) {
      const infected = [];
      for (const [id, region] of world.regions) {
        if (region.infected > 0 && region.localStatus === 'normal') {
          infected.push(id);
        }
      }
      if (infected.length > 0) {
        const targetId = infected[Math.floor(Math.random() * infected.length)];
        const region = world.regions.get(targetId);
        region.localStatus = 'lockdown';
        const savedAwareness = region.awarenessLevel;
        region.awarenessLevel = 1.0;
        this.activeBuffs.push({
          type: 'lockdown',
          regionId: targetId,
          savedAwareness,
          remainingDays: template.duration || 10,
        });
        log.info(`Lockdown applied`, { regionId: targetId, duration: template.duration || 10 });
      }
    }
  }

  _removeBuffEffect(buff, world) {
    if (buff.type === 'infectivity_boost' && world.pathogen) {
      world.pathogen.modInfectivity -= buff.value;
    }
    if (buff.type === 'lockdown') {
      const region = world.regions.get(buff.regionId);
      if (region) {
        region.localStatus = 'normal';
        region.awarenessLevel = buff.savedAwareness;
      }
    }
  }

  toJSON() {
    return {
      activeEvents: this.activeEvents,
      activeBuffs: this.activeBuffs.map((b) => ({
        type: b.type,
        remainingDays: b.remainingDays,
        regionId: b.regionId,
      })),
    };
  }
}

module.exports = { EventSystem, EVENT_TEMPLATES };
