const { GameSession } = require('./GameSession');

/**
 * InvolutionRouter - 内卷公司游戏的消息路由
 * 扩展现有 MessageRouter，处理游戏专属消息
 *
 * 支持单人模式和双人模式：
 * - 单人：玩家独立创建 GameSession，对抗 AI 解药
 * - 双人：两名玩家在同一个房间各选病原体，同图竞争感染
 */
class InvolutionRouter {
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
    this.sessions = new Map(); // sessionId -> GameSession
    this.playerSessions = new Map(); // playerId -> sessionId

    this.handlers = {
      // 单人模式
      solo_start: this.handleSoloStart.bind(this),

      // 通用游戏操作
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
    if (!handler) return false; // Not our message, let other router handle
    handler(playerId, msg.data || {});
    return true;
  }

  // ─── Solo Mode ───

  handleSoloStart(playerId, data) {
    const sessionId = `solo_${playerId}`;

    // Clean up existing session
    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId).destroy();
    }

    const session = new GameSession(sessionId, {
      tickRate: data.tickRate || 1000,
    });

    // Wire up delta push to player
    session.onUpdate((type, report) => {
      this.connectionManager.send(playerId, { type: `inv_${type}`, data: report });
    });

    this.sessions.set(sessionId, session);
    this.playerSessions.set(playerId, sessionId);

    this.connectionManager.send(playerId, {
      type: 'inv_session_created',
      data: { sessionId, mode: 'solo' },
    });
  }

  // ─── Game Operations ───

  handleSelectPathogen(playerId, data) {
    const session = this._getSession(playerId);
    if (!session) return;

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

  // ─── Helpers ───

  _getSession(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    const session = sessionId ? this.sessions.get(sessionId) : null;
    if (!session) {
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
    }
    this.playerSessions.delete(playerId);
  }
}

module.exports = { InvolutionRouter };
