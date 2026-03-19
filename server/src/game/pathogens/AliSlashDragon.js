const { BasePathogen } = require('./BasePathogen');

/**
 * 屠龙大刀虾 (阿里/闲鱼系) - 寄生虫型
 * 特性：极低异化度，初期不被察觉
 * 专属玩法：KPI 吸血 - 地图掉落"百亿补贴"，需手动点击获取 KPI
 */
class AliSlashDragon extends BasePathogen {
  constructor() {
    super('ali', '屠龙大刀虾');
    this.baseInfectivity = 0.22;
    this.baseSeverity = 0.01;     // 极低异化度
    this.baseLethality = 0.015;

    // 百亿补贴掉落系统
    this.subsidyDropChance = 0.15; // 每日 15% 在随机海域掉落
    this.pendingSubsidies = [];     // 待领取的补贴
    this.subsidyExpireDays = 5;
  }

  specialTick(world) {
    const events = [];

    // 隐蔽特性：解药启动阈值提高（更难被发现）
    world.cure.startThreshold = Math.max(world.cure.startThreshold, 0.1);

    // 清理过期补贴
    this.pendingSubsidies = this.pendingSubsidies.filter(
      (s) => world.day - s.day < this.subsidyExpireDays
    );

    // 掉落百亿补贴
    if (Math.random() < this.subsidyDropChance) {
      const infectedRegions = [];
      for (const [id, region] of world.regions) {
        if (region.infected > 0) infectedRegions.push(id);
      }

      if (infectedRegions.length > 0) {
        const regionId = infectedRegions[Math.floor(Math.random() * infectedRegions.length)];
        const kpiValue = 5 + Math.floor(Math.random() * 15);
        const subsidy = {
          id: `subsidy_${world.day}_${Math.random().toString(36).slice(2, 6)}`,
          regionId,
          kpiValue,
          day: world.day,
        };
        this.pendingSubsidies.push(subsidy);
        events.push({
          type: 'subsidy_drop',
          data: subsidy,
          message: `百亿补贴出现在 ${world.regions.get(regionId).name}！(${kpiValue} KPI)`,
        });
      }
    }

    return events.length > 0 ? events : null;
  }

  /** 玩家点击领取百亿补贴 */
  claimSubsidy(subsidyId, world) {
    const idx = this.pendingSubsidies.findIndex((s) => s.id === subsidyId);
    if (idx === -1) return { error: '补贴已过期或不存在' };

    const subsidy = this.pendingSubsidies.splice(idx, 1)[0];
    world.kpiPoints += subsidy.kpiValue;
    return { kpiValue: subsidy.kpiValue, totalKpi: world.kpiPoints };
  }
}

module.exports = { AliSlashDragon };
