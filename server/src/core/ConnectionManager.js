const { v4: uuidv4 } = require('uuid');

/**
 * Manages WebSocket connections and player sessions.
 * Handles heartbeat detection for stale connections.
 */
class ConnectionManager {
  constructor(roomManager) {
    this.connections = new Map(); // playerId -> { ws, alive, roomId }
    this.roomManager = roomManager;
  }

  get count() {
    return this.connections.size;
  }

  addConnection(ws) {
    const playerId = uuidv4();
    this.connections.set(playerId, { ws, alive: true, roomId: null });
    return playerId;
  }

  removeConnection(playerId) {
    const conn = this.connections.get(playerId);
    if (!conn) return;

    // Clean up room membership
    if (conn.roomId) {
      this.roomManager.leaveRoom(conn.roomId, playerId, this);
    }

    this.connections.delete(playerId);
  }

  getConnection(playerId) {
    return this.connections.get(playerId);
  }

  setRoom(playerId, roomId) {
    const conn = this.connections.get(playerId);
    if (conn) conn.roomId = roomId;
  }

  send(playerId, message) {
    const conn = this.connections.get(playerId);
    if (conn && conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify(message));
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
    for (const [playerId, conn] of this.connections) {
      if (!conn.alive) {
        console.log(`[Heartbeat] Dead connection: ${playerId}`);
        conn.ws.terminate();
        this.removeConnection(playerId);
        continue;
      }
      conn.alive = false;
      if (conn.ws.readyState === 1) {
        conn.ws.ping();
      }
    }
  }
}

module.exports = { ConnectionManager };
