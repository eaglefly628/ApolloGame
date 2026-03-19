const { BasePathogen } = require('./BasePathogen');
const { createLogger } = require('../../utils/Logger');
const log = createLogger('ByteDanceShaker');

/**
 * 算法摇摆虾 (字节系) - 病毒型
 * 特性：高频随机突变，传染快但不可控
 * 专属 Debuff：突变可能引发社会关注，加速解药研发
 */
class ByteDanceShaker extends BasePathogen {
  constructor() {
    super('bytedance', '算法摇摆虾');
    this.baseInfectivity = 0.28;
    this.baseSeverity = 0.06;
    this.baseLethality = 0.012;
    this.mutationChance = 0.08;
    this.mutationCount = 0;
    // FIX: 突变上限，防止数值溢出
    this.maxMutations = 15;
  }

  specialTick(world) {
    const events = [];
    const baseEvents = super.specialTick(world);
    if (baseEvents) events.push(...baseEvents);

    // 随机突变 (有上限)
    if (this.mutationCount < this.maxMutations && Math.random() < this.mutationChance) {
      this.mutationCount++;
      const roll = Math.random();
      if (roll < 0.4) {
        this.modInfectivity += 0.01;
        log.info(`Beneficial mutation #${this.mutationCount}: infectivity +0.01`);
        events.push({
          type: 'mutation',
          subtype: 'beneficial',
          message: '算法推荐突变：传染率 +0.01',
        });
      } else if (roll < 0.7) {
        this.modSeverity += 0.03;
        log.info(`Harmful mutation #${this.mutationCount}: severity +0.03`);
        events.push({
          type: 'mutation',
          subtype: 'harmful',
          message: '信息茧房破裂：异化度 +0.03，解药加速！',
        });
      } else {
        this.modLethality += 0.005;
        log.info(`Neutral mutation #${this.mutationCount}: lethality +0.005`);
        events.push({
          type: 'mutation',
          subtype: 'neutral',
          message: '996 突变：离职率 +0.005',
        });
      }
    }

    return events.length > 0 ? events : null;
  }
}

module.exports = { ByteDanceShaker };
