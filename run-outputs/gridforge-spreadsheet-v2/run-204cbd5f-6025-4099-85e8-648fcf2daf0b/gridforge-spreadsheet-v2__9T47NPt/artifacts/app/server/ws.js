const { WebSocketServer, WebSocket } = require('ws');

const PALETTE = [
  '#2563eb', // blue
  '#059669', // emerald
  '#7c3aed', // purple
  '#d97706', // amber
  '#e11d48', // rose
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#c026d3', // fuchsia
  '#ea580c', // orange
  '#16a34a', // green
];

class WebSocketManager {
  constructor(storageEngine) {
    this.storageEngine = storageEngine;
    this.wss = null;
    this.sessions = new Map(); // sessionId -> session details
    this.clientSockets = new Map(); // ws -> sessionId
    this.colorIndex = 0;
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      let currentSessionId = null;

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch (err) {
          console.error('Error handling WS message:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
        }
      });

      ws.on('close', () => {
        const sid = this.clientSockets.get(ws);
        if (sid) {
          this.clientSockets.delete(ws);
          this.sessions.delete(sid);
          this.broadcastPresence();
        }
      });

      ws.on('error', (err) => {
        console.error('WS client error:', err);
      });
    });

    // Clean up stale sessions every 10 seconds
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [sid, session] of this.sessions.entries()) {
        if (now - session.lastSeen > 30000) { // 30s timeout
          this.sessions.delete(sid);
          if (session.ws) {
            this.clientSockets.delete(session.ws);
          }
          changed = true;
        }
      }
      if (changed) {
        this.broadcastPresence();
      }
    }, 10000);
  }

  handleMessage(ws, msg) {
    const { type, sessionId, userId, userName, cell, range, workbookId } = msg;

    if (type === 'join') {
      if (!sessionId || typeof sessionId !== 'string') {
        ws.send(JSON.stringify({ type: 'error', message: 'Missing sessionId' }));
        return;
      }

      // Check valid user
      const users = this.storageEngine.getUsers();
      const validUser = users.find(u => u.id === userId);
      const effectiveUserId = validUser ? validUser.id : (userId || 'riley');
      const effectiveUserName = validUser ? validUser.name : (userName || 'Riley Stone');
      const assignedColor = validUser ? validUser.color : PALETTE[this.colorIndex++ % PALETTE.length];

      const session = {
        sessionId,
        ws,
        userId: effectiveUserId,
        userName: effectiveUserName,
        color: assignedColor,
        cell: cell || 'A1',
        range: range || null,
        workbookId: workbookId || 'ops-plan',
        lastSeen: Date.now()
      };

      this.sessions.set(sessionId, session);
      this.clientSockets.set(ws, sessionId);

      // Acknowledge join
      ws.send(JSON.stringify({
        type: 'joined',
        sessionId,
        userId: effectiveUserId,
        userName: effectiveUserName,
        color: assignedColor
      }));

      this.broadcastPresence();
      return;
    }

    if (!sessionId || !this.sessions.has(sessionId)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unrecognized session. Please rejoin.' }));
      return;
    }

    const session = this.sessions.get(sessionId);
    session.lastSeen = Date.now();

    if (type === 'presence') {
      session.cell = cell || session.cell;
      session.range = range !== undefined ? range : session.range;
      this.broadcastPresence();
    } else if (type === 'switch_user') {
      const users = this.storageEngine.getUsers();
      const validUser = users.find(u => u.id === userId);
      if (validUser) {
        session.userId = validUser.id;
        session.userName = validUser.name;
        session.color = validUser.color || session.color;
      } else if (userId && userName) {
        session.userId = userId;
        session.userName = userName;
      }
      ws.send(JSON.stringify({
        type: 'user_switched',
        userId: session.userId,
        userName: session.userName,
        color: session.color
      }));
      this.broadcastPresence();
    } else if (type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  broadcastPresence() {
    const list = [];
    for (const session of this.sessions.values()) {
      list.push({
        sessionId: session.sessionId,
        userId: session.userId,
        userName: session.userName,
        color: session.color,
        cell: session.cell,
        range: session.range
      });
    }

    const payload = JSON.stringify({
      type: 'presence_update',
      sessions: list
    });

    for (const session of this.sessions.values()) {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }

  broadcastRevisionSaved(workbookId, data) {
    const payload = JSON.stringify({
      type: 'revision_saved',
      workbookId,
      ...data
    });

    for (const session of this.sessions.values()) {
      if (session.workbookId === workbookId && session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }
}

module.exports = { WebSocketManager };
