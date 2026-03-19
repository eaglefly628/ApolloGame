const { createLogger } = require('../utils/Logger');
const log = createLogger('Region');

/**
 * Region - 海域节点
 * 每个海域维护独立的 SIR 人口模型
 */
class Region {
  constructor({ id, name, totalPop, wealthLevel = 1.0, climate = 'temperate' }) {
    this.id = id;
    this.name = name;
    this.totalPop = totalPop;
    this.susceptible = totalPop; // S: 健康龙虾
    this.infected = 0;           // I: 感染龙虾 (打工虾)
    this.removed = 0;            // R: 离职/猝死
    this.wealthLevel = wealthLevel; // 影响传播系数
    this.climate = climate;
    this.connections = [];       // { regionId, weight } 洋流航线
    this.localStatus = 'normal'; // normal | rioting | lockdown
    this.awarenessLevel = 0;     // 0~1, 影响本地抗性
    this.isDiscovered = false;   // 病原体是否已到达此海域
  }

  get healthy() { return this.susceptible; }
  get total() { return this.susceptible + this.infected + this.removed; }
  get infectionRate() { return this.total > 0 ? this.infected / this.total : 0; }
  get isFullyInfected() { return this.susceptible === 0; }
  get isExtinct() { return this.infected === 0 && this.susceptible === 0; }

  /** 种子感染：初始感染少量龙虾 */
  seedInfection(count = 1) {
    const actual = Math.min(count, this.susceptible);
    this.susceptible -= actual;
    this.infected += actual;
    this.isDiscovered = true;
    log.info(`Seed infection: region=${this.id}, count=${actual}, I=${this.infected}`, { regionId: this.id, actual });
    return actual;
  }

  /** 单次 SIR tick 计算 */
  tick(beta, gamma, dt = 1) {
    if (this.infected <= 0 || this.total <= 0) return { newInfected: 0, newRemoved: 0 };

    const N = this.total;
    const S = this.susceptible;
    const I = this.infected;

    // 本地抗性降低有效传染率
    const effectiveBeta = beta * (1 - this.awarenessLevel * 0.5) * this.wealthLevel;

    // SIR 差分方程
    let newInfected = Math.floor(effectiveBeta * S * I / N * dt);
    let newRemoved = Math.floor(gamma * I * dt);

    // 边界保护
    newInfected = Math.min(newInfected, this.susceptible);
    newRemoved = Math.min(newRemoved, this.infected);

    // FIX: 微量扩散概率封顶 clamp 到 [0, 1]
    if (newInfected === 0 && this.susceptible > 0 && this.infected > 0) {
      const microChance = Math.min(1, effectiveBeta * 0.1);
      if (Math.random() < microChance) {
        newInfected = 1;
      }
    }

    this.susceptible -= newInfected;
    this.infected += newInfected - newRemoved;
    this.removed += newRemoved;

    // 感染率过高时提升本地意识
    if (this.infectionRate > 0.3) {
      this.awarenessLevel = Math.min(1, this.awarenessLevel + 0.002);
    }

    return { newInfected, newRemoved };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      susceptible: this.susceptible,
      infected: this.infected,
      removed: this.removed,
      totalPop: this.totalPop,
      wealthLevel: this.wealthLevel,
      localStatus: this.localStatus,
      awarenessLevel: Math.round(this.awarenessLevel * 100) / 100,
      isDiscovered: this.isDiscovered,
      connections: this.connections,
    };
  }
}

module.exports = { Region };
