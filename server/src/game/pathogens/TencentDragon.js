const { BasePathogen } = require('./BasePathogen');
const { createLogger } = require('../../utils/Logger');
const log = createLogger('TencentDragon');

/**
 * 私域小绿龙 (腾讯系) - 真菌型
 * 特性：同海域传染极快，跨海域极难
 * 专属技能：孢子爆发 (群发砍一刀) - 无视距离随机感染远方海域
 */
class TencentDragon extends BasePathogen {
  constructor() {
    super('tencent', '私域小绿龙');
    this.baseInfectivity = 0.35;
    this.baseSeverity = 0.03;
    this.baseLethality = 0.008;

    this.sporeBurstCooldown = 0;
    this.sporeBurstMaxCooldown = 30;
    // FIX: 跨区惩罚系数存在 pathogen 上，不修改 connection 对象
    this.crossRegionPenalty = 0.4;
  }

  specialTick(world) {
    const events = [];
    // 基类处理雷总大招过期
    const baseEvents = super.specialTick(world);
    if (baseEvents) events.push(...baseEvents);

    if (this.sporeBurstCooldown > 0) {
      this.sporeBurstCooldown--;
    }

    // FIX: 用 baseWeight 重算，避免累积修改 connection.weight
    for (const [, region] of world.regions) {
      for (const conn of region.connections) {
        if (conn.baseWeight !== undefined) {
          conn.weight = conn.baseWeight * this.crossRegionPenalty;
        }
      }
    }

    return events.length > 0 ? events : null;
  }

  /** 孢子爆发：随机感染 1~3 个未感染海域 */
  sporeBurst(world) {
    if (this.sporeBurstCooldown > 0) {
      log.debug(`Spore burst on cooldown`, { remaining: this.sporeBurstCooldown });
      return { error: `冷却中，还需 ${this.sporeBurstCooldown} 天` };
    }

    const uninfected = [];
    for (const [id, region] of world.regions) {
      if (!region.isDiscovered && region.susceptible > 0) {
        uninfected.push(id);
      }
    }

    if (uninfected.length === 0) {
      return { error: '没有未感染的海域' };
    }

    const targets = [];
    const count = Math.min(uninfected.length, 1 + Math.floor(Math.random() * 3));
    const shuffled = uninfected.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const regionId = shuffled[i];
      const infected = world.seedRegion(regionId, 2);
      targets.push({ regionId, infected });
    }

    this.sporeBurstCooldown = this.sporeBurstMaxCooldown;
    log.info(`Spore burst activated`, { targets: targets.map((t) => t.regionId) });
    return { targets };
  }
}

module.exports = { TencentDragon };
