/** Preview host budget controller. Thresholds are targets, not measured costs. */
export class CapeBudgetPolicy {
  constructor({ normalBudgetMs = 0.75, lowBudgetMs = 0.75, hardBudgetMs = 8, consecutiveSamples = 8 } = {}) {
    this.thresholds = {normal:normalBudgetMs, low:lowBudgetMs};
    this.hardBudgetMs = hardBudgetMs;
    this.consecutiveSamples = consecutiveSamples;
    this.tier = 'normal';
    this.overBudgetSamples = 0;
    this.reason = 'requested';
  }

  request(tier) {
    if (!['normal','low','off'].includes(tier)) throw new Error('Invalid cape tier');
    this.tier = tier;
    this.overBudgetSamples = 0;
    this.reason = 'requested';
  }

  sample(cpuMs) {
    if (this.tier === 'off') return {tier:this.tier,changed:false,reason:this.reason};
    const before = this.tier;
    if (!Number.isFinite(cpuMs) || cpuMs < 0) {
      this.tier = 'off'; this.reason = 'invalid-cpu-sample';
    } else if (cpuMs > this.hardBudgetMs) {
      this.tier = 'off'; this.reason = 'hard-cpu-budget';
    } else {
      this.overBudgetSamples = cpuMs > this.thresholds[this.tier] ? this.overBudgetSamples + 1 : 0;
      if (this.overBudgetSamples >= this.consecutiveSamples) {
        this.tier = this.tier === 'normal' ? 'low' : 'off';
        this.reason = 'sustained-cpu-budget';
        this.overBudgetSamples = 0;
      }
    }
    return {tier:this.tier,changed:this.tier !== before,reason:this.reason};
  }
}
