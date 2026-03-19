const { BasePathogen } = require('./BasePathogen');

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
    this.mutationChance = 0.08; // 每日 8% 概率发生随机突变
  }

  specialTick(world) {
    const events = [];

    // 信息茧房效应：已感染海域感染速度额外 +20%
    // (通过直接影响 world tick 的 beta 实现)

    // 随机突变
    if (Math.random() < this.mutationChance) {
      const roll = Math.random();
      if (roll < 0.4) {
        // 有利突变：传染率微升
        this.modInfectivity += 0.01;
        events.push({
          type: 'mutation',
          subtype: 'beneficial',
          message: '算法推荐突变：传染率 +0.01',
        });
      } else if (roll < 0.7) {
        // 不利突变：异化度暴增，引发社会关注
        this.modSeverity += 0.03;
        events.push({
          type: 'mutation',
          subtype: 'harmful',
          message: '信息茧房破裂：异化度 +0.03，解药加速！',
        });
      } else {
        // 离职率突变
        this.modLethality += 0.005;
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
