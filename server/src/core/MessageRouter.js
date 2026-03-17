/**
 * Routes incoming WebSocket messages to the appropriate handler.
 * Protocol: { type: string, data: object }
 */
class MessageRouter {
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;

    this.handlers = {
      create_room: this.handleCreateRoom.bind(this),
      join_room: this.handleJoinRoom.bind(this),
      quick_match: this.handleQuickMatch.bind(this),
      leave_room: this.handleLeaveRoom.bind(this),
      start_game: this.handleStartGame.bind(this),
      game_action: this.handleGameAction.bind(this),
      game_end: this.handleGameEnd.bind(this),
    };
  }

  route(playerId, msg) {
    const handler = this.handlers[msg.type];
    if (!handler) {
      this.connectionManager.send(playerId, {
        type: 'error',
        data: { message: `Unknown message type: ${msg.type}` },
      });
      return;
    }
    handler(playerId, msg.data || {});
  }

  handleCreateRoom(playerId, data) {
    const result = this.roomManager.createRoom(playerId);
    if (result.error) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: result.error } });
      return;
    }
    this.connectionManager.setRoom(playerId, result.room.id);
    this.connectionManager.send(playerId, {
      type: 'room_created',
      data: { roomId: result.room.id },
    });
  }

  handleJoinRoom(playerId, data) {
    const { roomId } = data;
    if (!roomId) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: 'roomId required' } });
      return;
    }
    const result = this.roomManager.joinRoom(roomId, playerId, this.connectionManager);
    if (result.error) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: result.error } });
      return;
    }
    this.connectionManager.send(playerId, {
      type: 'room_joined',
      data: { roomId: result.room.id, players: result.room.players },
    });
  }

  handleQuickMatch(playerId, data) {
    const result = this.roomManager.quickMatch(playerId, this.connectionManager);
    if (result.error) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: result.error } });
      return;
    }
    const isNewRoom = result.room.players.length === 1;
    this.connectionManager.send(playerId, {
      type: isNewRoom ? 'room_created' : 'room_joined',
      data: { roomId: result.room.id, players: result.room.players },
    });
  }

  handleLeaveRoom(playerId, data) {
    const conn = this.connectionManager.getConnection(playerId);
    if (conn && conn.roomId) {
      this.roomManager.leaveRoom(conn.roomId, playerId, this.connectionManager);
    }
    this.connectionManager.send(playerId, { type: 'room_left', data: {} });
  }

  handleStartGame(playerId, data) {
    const conn = this.connectionManager.getConnection(playerId);
    if (!conn || !conn.roomId) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: 'Not in a room' } });
      return;
    }
    const result = this.roomManager.startGame(conn.roomId, playerId, this.connectionManager);
    if (result.error) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: result.error } });
    }
  }

  handleGameAction(playerId, data) {
    const conn = this.connectionManager.getConnection(playerId);
    if (!conn || !conn.roomId) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: 'Not in a room' } });
      return;
    }
    const result = this.roomManager.handleGameAction(
      conn.roomId,
      playerId,
      data.action,
      this.connectionManager
    );
    if (result.error) {
      this.connectionManager.send(playerId, { type: 'error', data: { message: result.error } });
    }
  }

  handleGameEnd(playerId, data) {
    const conn = this.connectionManager.getConnection(playerId);
    if (!conn || !conn.roomId) return;
    this.roomManager.endGame(conn.roomId, data.result, this.connectionManager);
  }
}

module.exports = { MessageRouter };
