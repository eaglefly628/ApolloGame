const { Region } = require('./Region');
const { EventEmitter } = require('events');

/**
 * WorldSimulator - 全局模拟引擎
 * 管理所有海域、执行每日 tick、计算解药进度、处理跨区传播
 */
class WorldSimulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.regions = new Map();
    this.day = 0;
    this.tickInterval = null;
    this.tickRate = config.tickRate || 1000; // ms per game-day
    this.state = 'idle'; // idle | running | paused | ended

    // 全局统计
    this.stats = {
      totalInfected: 0,
      totalRemoved: 0,
      totalPopulation: 0,
      regionsDiscovered: 0,
      totalRegions: 0,
    };

    // 解药系统
    this.cure = {
      progress: 0,       // 0~100
      baseRate: 0.15,     // k 常数
      isStarted: false,
      resistance: 0,      // 玩家能力提供的抗性 R_buff
      startThreshold: 0.05, // 全球感染率超过此值启动解药
    };

    // 病原体引用（由 GameSession 注入）
    this.pathogen = null;

    // KPI 点数
    this.kpiPoints = 0;
    this.kpiPerInfection = 1;
    this.kpiPerDay = 0;

    // 事件日志
    this.eventLog = [];
  }

  /** 初始化默认世界地图 */
  initDefaultWorld() {
    const regionData = [
      { id: 'cn_south', name: '南海域', totalPop: 50000, wealthLevel: 1.2, climate: 'tropical' },
      { id: 'cn_east', name: '东海域', totalPop: 80000, wealthLevel: 1.5, climate: 'temperate' },
      { id: 'cn_north', name: '北海域', totalPop: 60000, wealthLevel: 1.0, climate: 'cold' },
      { id: 'southeast_asia', name: '东南亚海域', totalPop: 40000, wealthLevel: 0.6, climate: 'tropical' },
      { id: 'japan_korea', name: '日韩海域', totalPop: 35000, wealthLevel: 1.8, climate: 'temperate' },
      { id: 'india', name: '印度洋', totalPop: 70000, wealthLevel: 0.5, climate: 'tropical' },
      { id: 'europe', name: '欧洲海域', totalPop: 45000, wealthLevel: 2.0, climate: 'cold' },
      { id: 'americas', name: '美洲海域', totalPop: 55000, wealthLevel: 2.2, climate: 'temperate' },
      { id: 'africa', name: '非洲海域', totalPop: 30000, wealthLevel: 0.3, climate: 'tropical' },
      { id: 'middle_east', name: '中东海域', totalPop: 25000, wealthLevel: 1.6, climate: 'arid' },
    ];

    // 航线/洋流连接 (双向)
    const connections = [
      ['cn_south', 'cn_east', 0.8],
      ['cn_south', 'southeast_asia', 0.6],
      ['cn_east', 'cn_north', 0.7],
      ['cn_east', 'japan_korea', 0.5],
      ['cn_south', 'india', 0.3],
      ['southeast_asia', 'india', 0.4],
      ['india', 'middle_east', 0.4],
      ['india', 'africa', 0.2],
      ['middle_east', 'europe', 0.5],
      ['europe', 'americas', 0.4],
      ['europe', 'africa', 0.3],
      ['japan_korea', 'americas', 0.2],
      ['cn_north', 'europe', 0.15],
      ['americas', 'africa', 0.15],
    ];

    for (const data of regionData) {
      this.regions.set(data.id, new Region(data));
    }

    for (const [a, b, weight] of connections) {
      const rA = this.regions.get(a);
      const rB = this.regions.get(b);
      if (rA && rB) {
        rA.connections.push({ regionId: b, weight });
        rB.connections.push({ regionId: a, weight });
      }
    }

    this._updateStats();
  }

  /** 在指定海域种子感染 */
  seedRegion(regionId, count = 5) {
    const region = this.regions.get(regionId);
    if (!region) return 0;
    const actual = region.seedInfection(count);
    this._updateStats();
    return actual;
  }

  /** 启动模拟循环 */
  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.tickInterval = setInterval(() => this._tick(), this.tickRate);
    this.emit('started', { day: this.day });
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    clearInterval(this.tickInterval);
    this.emit('paused', { day: this.day });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.tickInterval = setInterval(() => this._tick(), this.tickRate);
    this.emit('resumed', { day: this.day });
  }

  stop() {
    clearInterval(this.tickInterval);
    this.state = 'ended';
  }

  /** 核心 tick：每个游戏日执行一次 */
  _tick() {
    this.day++;
    const dayReport = { day: this.day, regions: {}, events: [] };

    // 1. 获取病原体当前属性
    const { infectivity, severity, lethality } = this.pathogen
      ? this.pathogen.getStats()
      : { infectivity: 0.3, severity: 0.1, lethality: 0.05 };

    // 2. 各海域独立 SIR 计算
    let dayNewInfected = 0;
    let dayNewRemoved = 0;

    for (const [id, region] of this.regions) {
      if (!region.isDiscovered) continue;
      const result = region.tick(infectivity, lethality);
      dayNewInfected += result.newInfected;
      dayNewRemoved += result.newRemoved;
      dayReport.regions[id] = {
        S: region.susceptible,
        I: region.infected,
        R: region.removed,
        newI: result.newInfected,
        newR: result.newRemoved,
      };
    }

    // 3. 跨海域传播 (洋流)
    const crossInfections = this._processCrossRegionSpread(infectivity);
    for (const ci of crossInfections) {
      dayReport.events.push({
        type: 'cross_infection',
        from: ci.from,
        to: ci.to,
        count: ci.count,
      });
    }

    // 4. 病原体特殊 tick
    if (this.pathogen && this.pathogen.specialTick) {
      const specialEvents = this.pathogen.specialTick(this);
      if (specialEvents) dayReport.events.push(...specialEvents);
    }

    // 5. KPI 收入
    const kpiEarned = Math.floor(dayNewInfected * this.kpiPerInfection) + this.kpiPerDay;
    this.kpiPoints += kpiEarned;
    dayReport.kpiEarned = kpiEarned;

    // 6. 解药进度
    this._updateStats();
    this._tickCure(severity);
    dayReport.cureProgress = Math.round(this.cure.progress * 100) / 100;

    // 7. 胜败判定
    if (this.cure.progress >= 100) {
      this.stop();
      dayReport.gameOver = { result: 'defeat', reason: '躺平思潮研发完成，龙虾全体觉醒！' };
      this.emit('gameOver', dayReport.gameOver);
    } else if (this.stats.totalInfected === 0 && this.day > 1) {
      // 所有感染者都离职了，没有健康宿主可传染
      if (this.stats.totalRemoved > 0) {
        this.stop();
        dayReport.gameOver = { result: 'defeat', reason: '所有打工虾已离职，大厂文化断裂！' };
        this.emit('gameOver', dayReport.gameOver);
      }
    } else if (this._isVictory()) {
      this.stop();
      dayReport.gameOver = { result: 'victory', reason: '全球龙虾已被完全同化为打工虾！' };
      this.emit('gameOver', dayReport.gameOver);
    }

    dayReport.stats = { ...this.stats };
    dayReport.kpiTotal = this.kpiPoints;

    this.emit('tick', dayReport);
    return dayReport;
  }

  /** 跨海域洋流传播 */
  _processCrossRegionSpread(beta) {
    const infections = [];
    for (const [id, region] of this.regions) {
      if (region.infected <= 0) continue;
      for (const conn of region.connections) {
        const target = this.regions.get(conn.regionId);
        if (!target || target.susceptible <= 0) continue;

        // 传播概率 = 连接权重 × 感染率 × β × 随机因子
        const spreadChance = conn.weight * region.infectionRate * beta * 0.1;
        if (Math.random() < spreadChance) {
          const count = Math.max(1, Math.floor(region.infected * 0.001 * conn.weight));
          const actual = target.seedInfection(count);
          if (actual > 0) {
            infections.push({ from: id, to: conn.regionId, count: actual });
          }
        }
      }
    }
    return infections;
  }

  /** 解药进度计算 */
  _tickCure(severity) {
    // 检查是否应该启动解药
    if (!this.cure.isStarted) {
      const globalInfRate = this.stats.totalPopulation > 0
        ? this.stats.totalInfected / this.stats.totalPopulation
        : 0;
      if (globalInfRate >= this.cure.startThreshold) {
        this.cure.isStarted = true;
        this.emit('cureStarted', { day: this.day, infectionRate: globalInfRate });
      }
    }

    if (!this.cure.isStarted) return;

    const Iglobal = this.stats.totalInfected;
    const Nglobal = this.stats.totalPopulation;
    if (Nglobal <= 0) return;

    // dC/dt = k * (Sev * I_global / N_global)^2 * (1 - R_buff)
    const ratio = (severity * Iglobal) / Nglobal;
    const dC = this.cure.baseRate * ratio * ratio * (1 - this.cure.resistance);
    this.cure.progress = Math.min(100, this.cure.progress + Math.max(0, dC));
  }

  /** 胜利判定：所有海域的健康龙虾为 0 */
  _isVictory() {
    for (const [, region] of this.regions) {
      if (region.susceptible > 0) return false;
    }
    return true;
  }

  /** 更新全局统计 */
  _updateStats() {
    let totalI = 0, totalR = 0, totalPop = 0, discovered = 0;
    for (const [, region] of this.regions) {
      totalI += region.infected;
      totalR += region.removed;
      totalPop += region.total;
      if (region.isDiscovered) discovered++;
    }
    this.stats = {
      totalInfected: totalI,
      totalRemoved: totalR,
      totalPopulation: totalPop,
      regionsDiscovered: discovered,
      totalRegions: this.regions.size,
    };
  }

  /** 获取完整世界快照 */
  getSnapshot() {
    const regions = {};
    for (const [id, region] of this.regions) {
      regions[id] = region.toJSON();
    }
    return {
      day: this.day,
      state: this.state,
      stats: { ...this.stats },
      cure: { ...this.cure },
      kpiPoints: this.kpiPoints,
      regions,
    };
  }
}

module.exports = { WorldSimulator };
