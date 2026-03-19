const { BasePathogen } = require('./BasePathogen');

/**
 * 苏七速跑龙 (小米 SU7) - 纳米病毒型
 * 特性：开局解药即启动研发，但传播速度极快
 * 专属技能：生态互联 - 消耗大量 KPI 冻结解药进度 15 天
 */
class XiaomiSpeedDragon extends BasePathogen {
  constructor() {
    super('xiaomi', '苏七速跑龙');
    this.baseInfectivity = 0.32;
    this.baseSeverity = 0.08;
    this.baseLethality = 0.01;

    // 生态互联
    this.ecoLockActive = false;
    this.ecoLockRemainingDays = 0;
    this.ecoLockCost = 50;
    this.ecoLockDuration = 15;
    this.ecoLockUsed = false; // 全局仅一次
  }

  specialTick(world) {
    const events = [];

    // 纳米病毒特性：解药从第 1 天就开始
    if (world.day === 1) {
      world.cure.isStarted = true;
      world.cure.startThreshold = 0;
      events.push({
        type: 'nano_alert',
        message: '⚠️ 纳米病毒特性：躺平思潮从第 1 天起开始研发！',
      });
    }

    // 生态互联效果
    if (this.ecoLockActive) {
      this.ecoLockRemainingDays--;
      world.cure.progress = Math.max(0, world.cure.progress - 0.01); // 微量回退
      if (this.ecoLockRemainingDays <= 0) {
        this.ecoLockActive = false;
        events.push({
          type: 'eco_lock_end',
          message: '生态互联效果结束，解药恢复研发',
        });
      }
    }

    return events.length > 0 ? events : null;
  }

  /** 生态互联：冻结解药进度 */
  activateEcoLock(world) {
    if (this.ecoLockUsed) return { error: '生态互联只能使用一次' };
    if (world.kpiPoints < this.ecoLockCost) {
      return { error: `KPI 不足，需要 ${this.ecoLockCost}` };
    }

    world.kpiPoints -= this.ecoLockCost;
    this.ecoLockActive = true;
    this.ecoLockRemainingDays = this.ecoLockDuration;
    this.ecoLockUsed = true;

    // 保存原始解药速率并冻结
    this._savedCureRate = world.cure.baseRate;
    world.cure.baseRate = 0;

    return { success: true, duration: this.ecoLockDuration };
  }
}

module.exports = { XiaomiSpeedDragon };
