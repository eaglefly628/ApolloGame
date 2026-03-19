require('dotenv').config();
const { WebSocketServer } = require('ws');
const { ConnectionManager } = require('./core/ConnectionManager');
const { RoomManager } = require('./core/RoomManager');
const { MessageRouter } = require('./core/MessageRouter');
const { InvolutionRouter } = require('./game/InvolutionRouter');
const { createLogger } = require('./utils/Logger');
const log = createLogger('Server');

const PORT = process.env.PORT || 3000;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 10000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();
const connectionManager = new ConnectionManager(roomManager);
const messageRouter = new MessageRouter(roomManager, connectionManager);
const involutionRouter = new InvolutionRouter(roomManager, connectionManager);

// Heartbeat
const heartbeatTimer = setInterval(() => {
  connectionManager.checkHeartbeats();
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws, req) => {
  const playerId = connectionManager.addConnection(ws);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (!involutionRouter.route(playerId, msg)) {
        messageRouter.route(playerId, msg);
      }
    } catch (e) {
      log.error(`Message parse error`, { playerId, error: e.message });
      try {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }));
      } catch (_) {
        // connection already closed
      }
    }
  });

  ws.on('close', () => {
    log.info(`Player disconnected`, { playerId });
    involutionRouter.cleanupPlayer(playerId);
    connectionManager.removeConnection(playerId);
  });

  ws.on('error', (err) => {
    log.error(`WebSocket error`, { playerId, error: err.message });
  });

  ws.on('pong', () => {
    connectionManager.markAlive(playerId);
  });

  // FIX: wrap initial send in try-catch
  try {
    ws.send(JSON.stringify({ type: 'connected', data: { playerId } }));
  } catch (e) {
    log.error(`Failed to send welcome`, { playerId, error: e.message });
  }
});

// Graceful shutdown
function shutdown() {
  log.info('Server shutting down...');
  clearInterval(heartbeatTimer);
  involutionRouter.destroyAll();
  roomManager.destroy();
  wss.close(() => {
    log.info('Server stopped');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

log.info(`Server running on ws://localhost:${PORT}`, { port: PORT, heartbeat: HEARTBEAT_INTERVAL });

module.exports = { wss, roomManager, connectionManager };
