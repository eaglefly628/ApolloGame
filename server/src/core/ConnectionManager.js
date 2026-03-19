const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/Logger');
const log = createLogger('ConnMgr');

/**
 * Manages WebSocket connections and player sessions.
 * Handles heartbeat detection for stale connections.
 */
class ConnectionManager {
  constructor(roomManager) {
    this.connections = new Map();
    this.roomManager = roomManager;
  }

  get count() {
    return this.connections.size;
  }

  addConnection(ws) {
    const playerId = uuidv4();
    this.connections.set(playerId, { ws, alive: true, roomId: null });
    log.info(`Connection added`, { playerId, online: this.count });
    return playerId;
  }

  removeConnection(playerId) {
    const conn = this.connections.get(playerId);
    if (!conn) return;

    if (conn.roomId) {
      this.roomManager.leaveRoom(conn.roomId, playerId, this);
    }

    this.connections.delete(playerId);
    log.info(`Connection removed`, { playerId, online: this.count });
  }

  getConnection(playerId) {
    return this.connections.get(playerId);
  }

  setRoom(playerId, roomId) {
    const conn = this.connections.get(playerId);
    if (conn) {
      conn.roomId = roomId;
      log.debug(`Player room set`, { playerId, roomId });
    }
  }

  // FIX: wrap ws.send in try-catch to prevent crashes on closed connections
  send(playerId, message) {
    const conn = this.connections.get(playerId);
    if (conn && conn.ws.readyState === 1) {
      try {
        conn.ws.send(JSON.stringify(message));
      } catch (e) {
        log.error(`Failed to send message`, { playerId, type: message.type, error: e.message });
      }
    }
  }

  broadcast(playerIds, message) {
    for (const id of playerIds) {
      this.send(id, message);
    }
  }

  markAlive(playerId) {
    const conn = this.connections.get(playerId);
    if (conn) conn.alive = true;
  }

  checkHeartbeats() {
    let deadCount = 0;
    for (const [playerId, conn] of this.connections) {
      if (!conn.alive) {
        deadCount++;
        log.info(`Heartbeat dead`, { playerId });
        conn.ws.terminate();
        this.removeConnection(playerId);
        continue;
      }
      conn.alive = false;
      if (conn.ws.readyState === 1) {
        conn.ws.ping();
      }
    }
    if (deadCount > 0) {
      log.info(`Heartbeat cleanup done`, { dead: deadCount, remaining: this.count });
    }
  }
}

module.exports = { ConnectionManager };
