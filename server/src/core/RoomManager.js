const { v4: uuidv4 } = require('uuid');

const MAX_ROOMS = parseInt(process.env.MAX_ROOMS) || 1000;
const ROOM_TIMEOUT = parseInt(process.env.ROOM_TIMEOUT_MS) || 300000; // 5 min

const RoomState = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

/**
 * Manages game rooms. Each room holds up to 2 players.
 * Supports: create, join, quick-match, leave, state transitions.
 */
class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.cleanupTimer = setInterval(() => this.cleanupStaleRooms(), 60000);
  }

  createRoom(hostId) {
    if (this.rooms.size >= MAX_ROOMS) {
      return { error: 'Server is full, try again later' };
    }

    const roomId = this._generateRoomCode();
    const room = {
      id: roomId,
      host: hostId,
      players: [hostId],
      state: RoomState.WAITING,
      gameState: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return { room };
  }

  joinRoom(roomId, playerId, connectionManager) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.state !== RoomState.WAITING) return { error: 'Game already in progress' };
    if (room.players.length >= 2) return { error: 'Room is full' };
    if (room.players.includes(playerId)) return { error: 'Already in room' };

    room.players.push(playerId);
    room.updatedAt = Date.now();
    connectionManager.setRoom(playerId, roomId);

    // Notify host
    connectionManager.send(room.host, {
      type: 'player_joined',
      data: { playerId, roomId },
    });

    return { room };
  }

  quickMatch(playerId, connectionManager) {
    // Find a waiting room
    for (const [roomId, room] of this.rooms) {
      if (room.state === RoomState.WAITING && room.players.length === 1) {
        return this.joinRoom(roomId, playerId, connectionManager);
      }
    }
    // No available room, create one
    const result = this.createRoom(playerId);
    if (result.room) {
      connectionManager.setRoom(playerId, result.room.id);
    }
    return result;
  }

  leaveRoom(roomId, playerId, connectionManager) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((id) => id !== playerId);
    connectionManager.setRoom(playerId, null);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return;
    }

    // Notify remaining player
    room.updatedAt = Date.now();
    if (room.state === RoomState.PLAYING) {
      room.state = RoomState.FINISHED;
      connectionManager.broadcast(room.players, {
        type: 'opponent_left',
        data: { roomId },
      });
    } else {
      // Transfer host
      room.host = room.players[0];
      room.state = RoomState.WAITING;
      connectionManager.send(room.host, {
        type: 'opponent_left',
        data: { roomId },
      });
    }
  }

  startGame(roomId, playerId, connectionManager) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.host !== playerId) return { error: 'Only host can start' };
    if (room.players.length < 2) return { error: 'Need 2 players to start' };

    room.state = RoomState.PLAYING;
    room.gameState = this._initGameState(room);
    room.updatedAt = Date.now();

    connectionManager.broadcast(room.players, {
      type: 'game_start',
      data: {
        roomId,
        gameState: room.gameState,
        players: room.players,
      },
    });

    return { room };
  }

  handleGameAction(roomId, playerId, action, connectionManager) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.state !== RoomState.PLAYING) return { error: 'Game not in progress' };
    if (!room.players.includes(playerId)) return { error: 'Not in this room' };

    // Forward action to opponent (relay model for ultra-casual games)
    const opponent = room.players.find((id) => id !== playerId);
    if (opponent) {
      connectionManager.send(opponent, {
        type: 'game_action',
        data: { playerId, action },
      });
    }

    room.updatedAt = Date.now();
    return { ok: true };
  }

  endGame(roomId, result, connectionManager) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.state = RoomState.FINISHED;
    room.updatedAt = Date.now();

    connectionManager.broadcast(room.players, {
      type: 'game_end',
      data: { roomId, result },
    });
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  get roomCount() {
    return this.rooms.size;
  }

  cleanupStaleRooms() {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (now - room.updatedAt > ROOM_TIMEOUT) {
        console.log(`[Cleanup] Stale room: ${roomId}`);
        this.rooms.delete(roomId);
      }
    }
  }

  _generateRoomCode() {
    // 6-char alphanumeric room code, easier to share than UUID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  _initGameState(room) {
    // Override this in your game-specific subclass or plugin
    return {
      turn: room.players[0],
      round: 1,
      scores: Object.fromEntries(room.players.map((p) => [p, 0])),
      data: {},
    };
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = { RoomManager, RoomState };
