/**
 * BasePathogen - 病原体基类
 * 所有大厂龙虾类型继承此类，覆写 specialTick 实现差异化机制
 */
class BasePathogen {
  constructor(type, name) {
    this.type = type;
    this.name = name;

    // 基础三维属性
    this.baseInfectivity = 0.2;   // β 传染率
    this.baseSeverity = 0.05;     // 异化度
    this.baseLethality = 0.01;    // γ 离职率

    // 来自科技树的加成
    this.modInfectivity = 0;
    this.modSeverity = 0;
    this.modLethality = 0;
    this.modCureResistance = 0;

    // 已解锁的科技节点 ID
    this.unlockedMutations = new Set();
  }

  getStats() {
    return {
      infectivity: Math.max(0, this.baseInfectivity + this.modInfectivity),
      severity: Math.max(0, this.baseSeverity + this.modSeverity),
      lethality: Math.max(0, this.baseLethality + this.modLethality),
      cureResistance: Math.min(0.9, Math.max(0, this.modCureResistance)),
    };
  }

  applyMutation(mutation) {
    if (this.unlockedMutations.has(mutation.id)) return false;
    this.unlockedMutations.add(mutation.id);
    this.modInfectivity += mutation.modBeta || 0;
    this.modSeverity += mutation.modSev || 0;
    this.modLethality += mutation.modGamma || 0;
    this.modCureResistance += mutation.modCureRes || 0;
    return true;
  }

  /** 每日特殊 tick，子类覆写 */
  specialTick(world) {
    return null;
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      stats: this.getStats(),
      unlockedMutations: [...this.unlockedMutations],
    };
  }
}

module.exports = { BasePathogen };
