const { GameSession } = require('./GameSession');
const { createLogger } = require('../utils/Logger');
const log = createLogger('InvRouter');

/**
 * InvolutionRouter - 内卷公司游戏的消息路由
 */
class InvolutionRouter {
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
    this.sessions = new Map();
    this.playerSessions = new Map();

    this.handlers = {
      solo_start: this.handleSoloStart.bind(this),
      inv_select_pathogen: this.handleSelectPathogen.bind(this),
      inv_seed_region: this.handleSeedRegion.bind(this),
      inv_start_sim: this.handleStartSim.bind(this),
      inv_toggle_pause: this.handleTogglePause.bind(this),
      inv_unlock_mutation: this.handleUnlockMutation.bind(this),
      inv_special_ability: this.handleSpecialAbility.bind(this),
      inv_resolve_event: this.handleResolveEvent.bind(this),
      inv_get_snapshot: this.handleGetSnapshot.bind(this),
      inv_get_tree: this.handleGetTree.bind(this),
    };
  }

  route(playerId, msg) {
    const handler = this.handlers[msg.type];
    if (!handler) return false;
    log.debug(`Routing message`, { playerId, type: msg.type });
    handler(playerId, msg.data || {});
    return true;
  }

  handleSoloStart(playerId, data) {
    const sessionId = `solo_${playerId}`;

    // Clean up existing session
    if (this.sessions.has(sessionId)) {
      log.info(`Destroying previous session`, { sessionId });
      this.sessions.get(sessionId).destroy();
    }

    const session = new GameSession(sessionId, {
      tickRate: data.tickRate || 1000,
    });

    session.onUpdate((type, report) => {
      this.connectionManager.send(playerId, { type: `inv_${type}`, data: report });
    });

    this.sessions.set(sessionId, session);
    this.playerSessions.set(playerId, sessionId);

    log.info(`Solo session created`, { playerId, sessionId });
    this.connectionManager.send(playerId, {
      type: 'inv_session_created',
      data: { sessionId, mode: 'solo' },
    });
  }

  handleSelectPathogen(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    log.info(`Selecting pathogen`, { playerId, type: data.pathogenType });
    const result = session.selectPathogen(data.pathogenType);
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_pathogen_selected',
      data: result,
    });
  }

  handleSeedRegion(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    const result = session.seedInfection(data.regionId);
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_region_seeded',
      data: result,
    });
  }

  handleStartSim(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    log.info(`Starting simulation`, { playerId });
    const result = session.startSimulation();
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_sim_started',
      data: result,
    });
  }

  handleTogglePause(playerId) {
    const session = this._getSession(playerId);
    if (!session) return;

    const result = session.togglePause();
    this.connectionManager.send(playerId, {
      type: 'inv_pause_toggled',
      data: result,
    });
  }

  handleUnlockMutation(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    const result = session.unlockMutation(data.mutationId);
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_mutation_unlocked',
      data: result,
    });
  }

  handleSpecialAbility(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    const result = session.useSpecialAbility(data.ability, data.params || {});
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_ability_used',
      data: result,
    });
  }

  handleResolveEvent(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

    const result = session.resolveEvent(data.eventId, data.action);
    this.connectionManager.send(playerId, {
      type: result.error ? 'error' : 'inv_event_resolved',
      data: result,
    });
  }

  handleGetSnapshot(playerId) {
    const session = this._getSession(playerId);
    if (!session) return;

    this.connectionManager.send(playerId, {
      type: 'inv_snapshot',
      data: session.getSnapshot(),
    });
  }

  handleGetTree(playerId) {
    const session = this._getSession(playerId);
    if (!session) return;

    this.connectionManager.send(playerId, {
      type: 'inv_tree',
      data: session.mutationTree.toJSON(),
    });
  }

  _getSession(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    const session = sessionId ? this.sessions.get(sessionId) : null;
    if (!session) {
      log.warn(`No session found`, { playerId });
      this.connectionManager.send(playerId, {
        type: 'error',
        data: { message: '无游戏会话，请先创建游戏' },
      });
      return null;
    }
    return session;
  }

  cleanupPlayer(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    if (sessionId && sessionId.startsWith('solo_')) {
      const session = this.sessions.get(sessionId);
      if (session) session.destroy();
      this.sessions.delete(sessionId);
      log.info(`Player session cleaned up`, { playerId, sessionId });
    }
    this.playerSessions.delete(playerId);
  }

  /** Clean up all sessions (called on server shutdown) */
  destroyAll() {
    for (const [id, session] of this.sessions) {
      session.destroy();
    }
    this.sessions.clear();
    this.playerSessions.clear();
    log.info(`All sessions destroyed`);
  }
}

module.exports = { InvolutionRouter };
