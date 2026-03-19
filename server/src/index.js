require('dotenv').config();
const { WebSocketServer } = require('ws');
const { ConnectionManager } = require('./core/ConnectionManager');
const { RoomManager } = require('./core/RoomManager');
const { MessageRouter } = require('./core/MessageRouter');
const { InvolutionRouter } = require('./game/InvolutionRouter');

const PORT = process.env.PORT || 3000;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 10000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();
const connectionManager = new ConnectionManager(roomManager);
const messageRouter = new MessageRouter(roomManager, connectionManager);
const involutionRouter = new InvolutionRouter(roomManager, connectionManager);

// Heartbeat: detect and clean dead connections
const heartbeatTimer = setInterval(() => {
  connectionManager.checkHeartbeats();
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws, req) => {
  const playerId = connectionManager.addConnection(ws);
  console.log(`[Connect] player=${playerId}, online=${connectionManager.count}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      // Try involution game router first, fallback to generic router
      if (!involutionRouter.route(playerId, msg)) {
        messageRouter.route(playerId, msg);
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }));
    }
  });

  ws.on('close', () => {
    console.log(`[Disconnect] player=${playerId}`);
    involutionRouter.cleanupPlayer(playerId);
    connectionManager.removeConnection(playerId);
  });

  ws.on('pong', () => {
    connectionManager.markAlive(playerId);
  });

  // Send player their ID
  ws.send(JSON.stringify({ type: 'connected', data: { playerId } }));
});

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

console.log(`[ApolloGame] Server running on ws://localhost:${PORT}`);

module.exports = { wss, roomManager, connectionManager };
