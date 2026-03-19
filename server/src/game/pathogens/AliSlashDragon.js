const { BasePathogen } = require('./BasePathogen');
const { createLogger } = require('../../utils/Logger');
const log = createLogger('AliSlashDragon');

/**
 * 屠龙大刀虾 (阿里/闲鱼系) - 寄生虫型
 * 特性：极低异化度，初期不被察觉
 * 专属玩法：KPI 吸血 - 地图掉落"百亿补贴"，需手动点击获取 KPI
 */
class AliSlashDragon extends BasePathogen {
  constructor() {
    super('ali', '屠龙大刀虾');
    this.baseInfectivity = 0.22;
    this.baseSeverity = 0.01;
    this.baseLethality = 0.015;

    this.subsidyDropChance = 0.15;
    this.pendingSubsidies = [];
    this.subsidyExpireDays = 5;
  }

  specialTick(world) {
    const events = [];
    const baseEvents = super.specialTick(world);
    if (baseEvents) events.push(...baseEvents);

    // 隐蔽特性：解药启动阈值提高
    world.cure.startThreshold = Math.max(world.cure.startThreshold, 0.1);

    // FIX: 过期补贴清理，用 <= 修正 off-by-one
    this.pendingSubsidies = this.pendingSubsidies.filter(
      (s) => world.day - s.day <= this.subsidyExpireDays
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
        log.info(`Subsidy dropped`, { regionId, kpiValue, subsidyId: subsidy.id });
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
    log.info(`Subsidy claimed`, { subsidyId, kpiValue: subsidy.kpiValue, totalKpi: world.kpiPoints });
    return { kpiValue: subsidy.kpiValue, totalKpi: world.kpiPoints };
  }
}

module.exports = { AliSlashDragon };
