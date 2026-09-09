/**
 * GridForge Real-time Collaboration Client
 * Manages WebSocket session, presence broadcasting, remote cursors, and live updates.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CollaborationClient = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class CollaborationClient {
    constructor(options = {}) {
      this.workbookId = options.workbookId || 'ops-plan';
      this.userId = options.userId || 'riley';
      this.userName = options.userName || 'Riley Stone';
      this.sessionId = this._generateSessionId();
      this.userColor = '#2563eb';
      this.socket = null;
      this.connected = false;
      this.sessions = [];
      this.onPresenceUpdate = options.onPresenceUpdate || (() => {});
      this.onRevisionSaved = options.onRevisionSaved || (() => {});
      this.onError = options.onError || (() => {});
      this.reconnectTimer = null;
      this.pingTimer = null;
    }

    _generateSessionId() {
      return 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    }

    connect() {
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.connected = true;
          this._sendJoin();
          this._startHeartbeat();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._handleMessage(data);
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        this.socket.onclose = () => {
          this.connected = false;
          this._stopHeartbeat();
          this._scheduleReconnect();
        };

        this.socket.onerror = (err) => {
          console.warn('WS error:', err);
        };
      } catch (err) {
        console.error('Error connecting to WS:', err);
        this._scheduleReconnect();
      }
    }

    _scheduleReconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 2000);
    }

    _startHeartbeat() {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.connected && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping', sessionId: this.sessionId }));
        }
      }, 15000);
    }

    _stopHeartbeat() {
      if (this.pingTimer) clearInterval(this.pingTimer);
    }

    _sendJoin() {
      if (!this.connected || this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({
        type: 'join',
        sessionId: this.sessionId,
        userId: this.userId,
        userName: this.userName,
        workbookId: this.workbookId
      }));
    }

    switchUser(userId, userName) {
      this.userId = userId;
      this.userName = userName;
      if (this.connected && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'switch_user',
          sessionId: this.sessionId,
          userId,
          userName
        }));
      }
    }

    sendPresence(activeCell, selectionRange) {
      if (!this.connected || this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({
        type: 'presence',
        sessionId: this.sessionId,
        cell: activeCell,
        range: selectionRange
      }));
    }

    _handleMessage(msg) {
      switch (msg.type) {
        case 'joined':
          this.userColor = msg.color;
          break;
        case 'user_switched':
          this.userColor = msg.color;
          break;
        case 'presence_update':
          this.sessions = msg.sessions || [];
          this.onPresenceUpdate(this.sessions);
          break;
        case 'revision_saved':
          this.onRevisionSaved(msg);
          break;
        case 'error':
          this.onError(msg.message);
          break;
      }
    }
  }

  return { CollaborationClient };
});
