/**
 * WebSocket manager for WeChat Mini Program.
 * Handles connection, reconnection, heartbeat, and message dispatch.
 */
class SocketManager {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.heartbeatTimer = null;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.close();
      }

      this.ws = wx.connectSocket({ url, success: () => {} });

      this.ws.onOpen(() => {
        console.log('[Socket] Connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._startHeartbeat();
        resolve();
      });

      this.ws.onMessage((res) => {
        try {
          const msg = JSON.parse(res.data);
          this._dispatch(msg.type, msg.data);
        } catch (e) {
          console.error('[Socket] Parse error:', e);
        }
      });

      this.ws.onClose(() => {
        console.log('[Socket] Disconnected');
        this.connected = false;
        this._stopHeartbeat();
        this._dispatch('disconnected', {});
        this._tryReconnect(url);
      });

      this.ws.onError((err) => {
        console.error('[Socket] Error:', err);
        reject(err);
      });
    });
  }

  send(type, data = {}) {
    if (!this.connected) {
      console.warn('[Socket] Not connected, message dropped:', type);
      return;
    }
    this.ws.send({
      data: JSON.stringify({ type, data }),
    });
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  off(type, callback) {
    const cbs = this.listeners.get(type);
    if (cbs) {
      this.listeners.set(type, cbs.filter((cb) => cb !== callback));
    }
  }

  close() {
    this._stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close({});
      this.ws = null;
    }
    this.connected = false;
  }

  _dispatch(type, data) {
    const cbs = this.listeners.get(type) || [];
    cbs.forEach((cb) => cb(data));
    // Also notify wildcard listeners
    const wildcards = this.listeners.get('*') || [];
    wildcards.forEach((cb) => cb(type, data));
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.send('ping');
      }
    }, 15000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _tryReconnect(url) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect(url).catch(() => {});
    }, delay);
  }
}

// Singleton
const socketManager = new SocketManager();
module.exports = { socketManager };
