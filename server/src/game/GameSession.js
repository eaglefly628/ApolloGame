const { WorldSimulator } = require('../engine/WorldSimulator');
const { MutationTree } = require('./mutations/MutationTree');
const { EventSystem } = require('./events/EventSystem');
const { TencentDragon } = require('./pathogens/TencentDragon');
const { ByteDanceShaker } = require('./pathogens/ByteDanceShaker');
const { AliSlashDragon } = require('./pathogens/AliSlashDragon');
const { XiaomiSpeedDragon } = require('./pathogens/XiaomiSpeedDragon');

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
  }

  /** 选择病原体 */
  selectPathogen(type) {
    const PathogenClass = PATHOGEN_MAP[type];
    if (!PathogenClass) return { error: `未知病原体: ${type}` };

    this.pathogen = new PathogenClass();
    this.world.pathogen = this.pathogen;
    this.world.cure.resistance = this.pathogen.getStats().cureResistance;
    this.world.initDefaultWorld();
    this.state = 'seeding';

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

    return { regionId, infected: count };
  }

  /** 开始模拟 */
  startSimulation() {
    if (this.state !== 'seeding') return { error: '请先选择起始海域' };
    if (this.world.stats.totalInfected === 0) return { error: '请先种子感染一个海域' };

    this.state = 'running';

    // 挂载事件到 tick
    this.world.on('tick', (report) => this._onTick(report));
    this.world.on('gameOver', (result) => this._onGameOver(result));
    this.world.on('cureStarted', (data) => this._broadcast('cure_started', data));

    this.world.start();
    return { success: true, day: 0 };
  }

  /** 暂停/恢复 */
  togglePause() {
    if (this.world.state === 'running') {
      this.world.pause();
      return { paused: true };
    }
    if (this.world.state === 'paused') {
      this.world.resume();
      return { paused: false };
    }
    return { error: '游戏未在运行' };
  }

  /** 解锁科技树节点 */
  unlockMutation(mutationId) {
    if (this.state !== 'running') return { error: '游戏未在运行' };
    return this.mutationTree.unlock(mutationId, this.pathogen, this.world);
  }

  /** 使用病原体专属技能 */
  useSpecialAbility(abilityName, params = {}) {
    if (this.state !== 'running') return { error: '游戏未在运行' };
    if (!this.pathogen) return { error: '未选择病原体' };

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

  destroy() {
    this.world.stop();
    this.listeners = [];
  }

  // ─── Private ───

  _onTick(report) {
    // 检查事件
    const events = this.eventSystem.checkEvents(this.world);
    if (events.length > 0) {
      report.triggeredEvents = events;
    }

    // 解药抗性同步
    this.world.cure.resistance = this.pathogen.getStats().cureResistance;

    // Delta push to all listeners
    this._broadcast('tick', report);
  }

  _onGameOver(result) {
    this.state = 'ended';
    this._broadcast('game_over', result);
  }

  _broadcast(type, data) {
    for (const cb of this.listeners) {
      try {
        cb(type, data);
      } catch (e) {
        console.error('[GameSession] Listener error:', e);
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
