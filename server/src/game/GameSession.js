const { WorldSimulator } = require('../engine/WorldSimulator');
const { MutationTree } = require('./mutations/MutationTree');
const { EventSystem } = require('./events/EventSystem');
const { TencentDragon } = require('./pathogens/TencentDragon');
const { ByteDanceShaker } = require('./pathogens/ByteDanceShaker');
const { AliSlashDragon } = require('./pathogens/AliSlashDragon');
const { XiaomiSpeedDragon } = require('./pathogens/XiaomiSpeedDragon');
const { createLogger } = require('../utils/Logger');
const log = createLogger('GameSession');

const PATHOGEN_MAP = {
  tencent: TencentDragon,
  bytedance: ByteDanceShaker,
  ali: AliSlashDragon,
  xiaomi: XiaomiSpeedDragon,
};

/**
 * GameSession - 单局游戏会话
 * 将 WorldSimulator + Pathogen + MutationTree + EventSystem 组合为完整游戏
 */
class GameSession {
  constructor(sessionId, config = {}) {
    this.sessionId = sessionId;
    this.world = new WorldSimulator({ tickRate: config.tickRate || 1000 });
    this.mutationTree = new MutationTree();
    this.eventSystem = new EventSystem();
    this.pathogen = null;
    this.listeners = [];      // callback list for delta push
    this.state = 'selecting'; // selecting | seeding | running | ended
    this.config = config;
    log.info(`Session created`, { sessionId });
  }

  /** 选择病原体 */
  selectPathogen(type) {
    const PathogenClass = PATHOGEN_MAP[type];
    if (!PathogenClass) {
      log.warn(`Unknown pathogen type`, { sessionId: this.sessionId, type });
      return { error: `未知病原体: ${type}` };
    }

    this.pathogen = new PathogenClass();
    this.world.pathogen = this.pathogen;
    this.world.cure.resistance = this.pathogen.getStats().cureResistance;
    this.world.initDefaultWorld();
    this.state = 'seeding';

    log.info(`Pathogen selected`, { sessionId: this.sessionId, type, name: this.pathogen.name });
    return {
      pathogen: this.pathogen.toJSON(),
      regions: this._getRegionList(),
    };
  }

  /** 选择起始感染海域 */
  seedInfection(regionId) {
    if (this.state !== 'seeding') return { error: '当前不在选择阶段' };

    const count = this.world.seedRegion(regionId, 5);
    if (count === 0) return { error: '无法感染该海域' };

    log.info(`Infection seeded`, { sessionId: this.sessionId, regionId, count });
    return { regionId, infected: count };
  }

  /** 开始模拟 */
  startSimulation() {
    if (this.state !== 'seeding') return { error: '请先选择起始海域' };
    // FIX: 校验 pathogen 已选
    if (!this.pathogen) return { error: '请先选择病原体' };
    if (this.world.stats.totalInfected === 0) return { error: '请先种子感染一个海域' };

    this.state = 'running';

    // FIX: 保存 bound handlers 以便 destroy 时移除
    this._onTickHandler = (report) => this._onTick(report);
    this._onGameOverHandler = (result) => this._onGameOver(result);
    this._onCureStartedHandler = (data) => this._broadcast('cure_started', data);

    this.world.on('tick', this._onTickHandler);
    this.world.on('gameOver', this._onGameOverHandler);
    this.world.on('cureStarted', this._onCureStartedHandler);

    this.world.start();
    log.info(`Simulation started`, { sessionId: this.sessionId, pathogen: this.pathogen.type });
    return { success: true, day: 0 };
  }

  /** 暂停/恢复 */
  togglePause() {
    if (this.world.state === 'running') {
      this.world.pause();
      log.info(`Game paused`, { sessionId: this.sessionId, day: this.world.day });
      return { paused: true };
    }
    if (this.world.state === 'paused') {
      this.world.resume();
      log.info(`Game resumed`, { sessionId: this.sessionId, day: this.world.day });
      return { paused: false };
    }
    return { error: '游戏未在运行' };
  }

  /** 解锁科技树节点 */
  unlockMutation(mutationId) {
    if (this.state !== 'running') return { error: '游戏未在运行' };
    const result = this.mutationTree.unlock(mutationId, this.pathogen, this.world);
    if (result.success) {
      log.info(`Mutation unlocked`, { sessionId: this.sessionId, mutationId, kpiRemaining: this.world.kpiPoints });
    } else {
      log.debug(`Mutation unlock failed`, { sessionId: this.sessionId, mutationId, error: result.error });
    }
    return result;
  }

  /** 使用病原体专属技能 */
  useSpecialAbility(abilityName, params = {}) {
    if (this.state !== 'running') return { error: '游戏未在运行' };
    if (!this.pathogen) return { error: '未选择病原体' };

    log.info(`Special ability used`, { sessionId: this.sessionId, ability: abilityName, pathogen: this.pathogen.type });

    switch (abilityName) {
      case 'spore_burst':
        if (this.pathogen.type !== 'tencent') return { error: '仅腾讯系可用' };
        return this.pathogen.sporeBurst(this.world);

      case 'eco_lock':
        if (this.pathogen.type !== 'xiaomi') return { error: '仅小米系可用' };
        return this.pathogen.activateEcoLock(this.world);

      case 'claim_subsidy':
        if (this.pathogen.type !== 'ali') return { error: '仅阿里系可用' };
        return this.pathogen.claimSubsidy(params.subsidyId, this.world);

      default:
        return { error: `未知技能: ${abilityName}` };
    }
  }

  /** 响应动态事件 */
  resolveEvent(eventId, action) {
    log.info(`Event resolved`, { sessionId: this.sessionId, eventId, action });
    return this.eventSystem.resolveEvent(eventId, action, this.world);
  }

  /** 获取完整游戏快照 */
  getSnapshot() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      world: this.world.getSnapshot(),
      pathogen: this.pathogen ? this.pathogen.toJSON() : null,
      mutationTree: this.mutationTree.toJSON(),
      events: this.eventSystem.toJSON(),
    };
  }

  /** 注册 delta 推送回调 */
  onUpdate(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  /** FIX: Proper cleanup - remove world EventEmitter listeners + stop intervals */
  destroy() {
    log.info(`Session destroyed`, { sessionId: this.sessionId, day: this.world.day, state: this.state });
    this.world.destroy(); // stops interval + removes all EventEmitter listeners
    this.listeners = [];
  }

  // ─── Private ───

  _onTick(report) {
    // 检查事件
    const events = this.eventSystem.checkEvents(this.world);
    if (events.length > 0) {
      report.triggeredEvents = events;
      log.info(`Events triggered`, { sessionId: this.sessionId, day: report.day, events: events.map((e) => e.name || e.templateId) });
    }

    // 解药抗性同步
    this.world.cure.resistance = this.pathogen.getStats().cureResistance;

    // Delta push to all listeners
    this._broadcast('tick', report);
  }

  _onGameOver(result) {
    this.state = 'ended';
    log.info(`Game over`, { sessionId: this.sessionId, result: result.result, reason: result.reason });
    this._broadcast('game_over', result);
  }

  _broadcast(type, data) {
    for (const cb of this.listeners) {
      try {
        cb(type, data);
      } catch (e) {
        log.error(`Listener callback error`, { sessionId: this.sessionId, type, error: e.message });
      }
    }
  }

  _getRegionList() {
    const list = [];
    for (const [id, region] of this.world.regions) {
      list.push({ id, name: region.name, totalPop: region.totalPop, wealthLevel: region.wealthLevel });
    }
    return list;
  }
}

module.exports = { GameSession };
