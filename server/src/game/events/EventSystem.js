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
      // 异化度超过 0.15 时有概率触发
      const stats = world.pathogen ? world.pathogen.getStats() : { severity: 0 };
      return stats.severity > 0.15 && Math.random() < 0.06;
    },
    kpiPenalty: 15,
    requiredClicks: 5,
    timeLimit: 3000, // ms
  },
  {
    id: 'refund_riot',
    name: '仅退款暴乱',
    desc: '下沉海域龙虾集体暴动！需花费 KPI 进行"封号反击"镇压',
    type: 'interactive',
    triggerCondition: (world) => {
      // 低财富海域感染率 > 50% 时触发
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
    this.activeEvents = [];      // 当前活跃的限时事件
    this.activeBuffs = [];       // 当前活跃的持续效果
    this.eventHistory = [];
  }

  /** 每日检查触发事件 */
  checkEvents(world) {
    const triggered = [];

    // 清理过期 buff
    this.activeBuffs = this.activeBuffs.filter((buff) => {
      buff.remainingDays--;
      if (buff.remainingDays <= 0) {
        this._removeBuffEffect(buff, world);
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
        }
      }
    }

    return triggered;
  }

  _createEvent(template, world) {
    if (template.type === 'interactive') {
      // 交互事件：等待玩家响应
      const event = {
        id: `${template.id}_${world.day}`,
        templateId: template.id,
        name: template.name,
        desc: template.desc,
        type: 'interactive',
        kpiPenalty: template.kpiPenalty || 0,
        kpiCost: template.kpiCost || 0,
        requiredClicks: template.requiredClicks || 0,
        timeLimit: template.timeLimit || 5000,
        expiresAt: Date.now() + (template.timeLimit || 5000),
      };
      this.activeEvents.push(event);
      return event;
    }

    if (template.type === 'auto') {
      // 自动事件：立即生效
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

    if (event.templateId === 'labor_arbitration') {
      if (action === 'dismiss' && Date.now() <= event.expiresAt) {
        return { success: true, message: '仲裁已驳回！' };
      }
      world.kpiPoints = Math.max(0, world.kpiPoints - event.kpiPenalty);
      return { success: false, message: `仲裁成功！扣除 ${event.kpiPenalty} KPI` };
    }

    if (event.templateId === 'refund_riot') {
      if (action === 'suppress') {
        if (world.kpiPoints >= event.kpiCost) {
          world.kpiPoints -= event.kpiCost;
          return { success: true, message: `已花费 ${event.kpiCost} KPI 镇压暴乱` };
        }
        return { error: 'KPI 不足' };
      }
      // 忽略暴乱
      world.kpiPoints = Math.max(0, world.kpiPoints - (event.kpiPenaltyIfIgnored || 25));
      // 部分感染人口脱离控制
      for (const [, region] of world.regions) {
        if (region.wealthLevel < 0.6 && region.infected > 0) {
          const lost = Math.min(region.infected, event.affectedPop || 500);
          region.infected -= lost;
          region.susceptible += lost; // 回归健康
        }
      }
      return { success: false, message: '暴乱蔓延，部分打工虾脱离控制！' };
    }

    return { error: '未知事件类型' };
  }

  _applyAutoEffect(template, world) {
    const effect = template.effect || {};

    if (effect.infectivityMult && template.duration) {
      // 临时传染率加成
      if (world.pathogen) {
        const boost = (world.pathogen.baseInfectivity + world.pathogen.modInfectivity)
          * (effect.infectivityMult - 1);
        world.pathogen.modInfectivity += boost;
        this.activeBuffs.push({
          type: 'infectivity_boost',
          value: boost,
          remainingDays: template.duration,
        });
      }
    }

    if (effect.cureBoost) {
      world.cure.progress = Math.min(100, world.cure.progress + effect.cureBoost);
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
        // 封锁期间传染率归零
        const savedAwareness = region.awarenessLevel;
        region.awarenessLevel = 1.0;
        this.activeBuffs.push({
          type: 'lockdown',
          regionId: targetId,
          savedAwareness,
          remainingDays: template.duration || 10,
        });
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
