const path = require('path');
const express = require('express');
const core = require('./src/core');
const storage = require('./src/storage');

const PORT = Number(process.env.PORT || 3000);
const APP_DIR = __dirname;
const DB_PATH = path.join(APP_DIR, 'gridforge.sqlite3');
const SEED_PATH = '/assets/workbook_seed.json';
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const CORE_PATH = path.join(APP_DIR, 'src', 'core.js');

const store = storage.openStore(DB_PATH, SEED_PATH);
const workbookId = storage.getWorkbookRow(store, 'ops-plan')?.id || 'ops-plan';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

const streamClients = new Map();

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function sendError(res, error) {
  const status = error.statusCode || 500;
  const payload = { error: error.message || 'Unexpected error' };
  if (error.details) payload.details = error.details;
  sendJson(res, status, payload);
}

function safeAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function parseWorkbookId(req) {
  return req.params.workbookId || req.params.id || 'ops-plan';
}

function normalizeSelectionPayload(selection, sheetId, workbookSnapshot) {
  if (!selection) return null;
  if (typeof selection !== 'object') {
    const error = new Error('Selection must be an object');
    error.statusCode = 400;
    throw error;
  }
  const activeSheet = workbookSnapshot.sheets[0];
  const requestedSheetId = selection.sheetId || sheetId || activeSheet.id;
  const sheet = workbookSnapshot.sheets.find((entry) => entry.id === requestedSheetId);
  if (!sheet) {
    const error = new Error('Unknown sheet in selection');
    error.statusCode = 400;
    throw error;
  }
  const start = selection.start || selection.anchor || selection.cell || null;
  const end = selection.end || selection.focus || selection.cell || start;
  if (start && !core.isValidAddress(start)) {
    const error = new Error(`Invalid selection start ${start}`);
    error.statusCode = 400;
    throw error;
  }
  if (end && !core.isValidAddress(end)) {
    const error = new Error(`Invalid selection end ${end}`);
    error.statusCode = 400;
    throw error;
  }
  return {
    sheetId: requestedSheetId,
    start: start ? String(start).toUpperCase() : null,
    end: end ? String(end).toUpperCase() : null,
    mode: selection.mode || (start && end && start !== end ? 'range' : 'cell'),
    current: selection.current ? String(selection.current).toUpperCase() : (end ? String(end).toUpperCase() : null),
  };
}

function serializeSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    workbookId: session.workbookId,
    userId: session.userId,
    userName: session.userName,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    closedAt: session.closedAt,
    selection: session.selection,
    sheetId: session.sheetId,
  };
}

function serializeRevisionSummary(revision, snapshot = null) {
  return {
    id: revision.id,
    workbookId: revision.workbookId,
    createdAt: revision.createdAt,
    kind: revision.kind,
    baseRevisionId: revision.baseRevisionId,
    authorSessionId: revision.authorSessionId,
    authorUserId: revision.authorUserId,
    authorName: revision.authorName,
    message: revision.message,
    snapshot,
  };
}

function listStreamClients(workbookId) {
  if (!streamClients.has(workbookId)) streamClients.set(workbookId, new Set());
  return streamClients.get(workbookId);
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(workbookId, event, data) {
  for (const client of listStreamClients(workbookId)) {
    try {
      writeSse(client.res, event, data);
    } catch (error) {
      client.dead = true;
    }
  }
  const alive = new Set([...listStreamClients(workbookId)].filter((client) => !client.dead));
  streamClients.set(workbookId, alive);
}

function broadcastPresence(workbookId) {
  broadcast(workbookId, 'presence', {
    sessions: storage.listActiveSessions(store, workbookId),
    currentRevision: storage.getLatestRevisionRow(store, workbookId)?.id || null,
  });
}

function broadcastRevision(workbookId, revisionRow, snapshot) {
  broadcast(workbookId, 'revision', {
    revision: serializeRevisionSummary({
      id: revisionRow.id,
      workbookId: revisionRow.workbook_id,
      createdAt: revisionRow.created_at,
      kind: revisionRow.kind,
      baseRevisionId: revisionRow.base_revision_id,
      authorSessionId: revisionRow.author_session_id,
      authorUserId: revisionRow.author_user_id,
      authorName: revisionRow.author_name,
      message: revisionRow.message,
    }, snapshot),
    snapshot,
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/core.js', (req, res) => {
  res.type('application/javascript').sendFile(CORE_PATH);
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('/api/bootstrap', (req, res) => {
  const workbook = storage.workbookBundle(store, workbookId);
  sendJson(res, 200, {
    workbook: workbook.workbook,
    users: workbook.users,
    routes: {
      state: `/api/workbooks/${workbookId}/state`,
      revisions: `/api/workbooks/${workbookId}/revisions`,
      revisionPreview: `/api/workbooks/${workbookId}/revisions/:revisionId`,
      cellHistory: `/api/workbooks/${workbookId}/cells/:address/history`,
      sessions: '/api/sessions',
      stream: '/api/stream',
    },
  });
});

app.post('/api/sessions', safeAsync((req, res) => {
  const { workbookId: requestedWorkbookId, userId } = req.body || {};
  if (!requestedWorkbookId || !userId) {
    const error = new Error('workbookId and userId are required');
    error.statusCode = 400;
    throw error;
  }
  if (requestedWorkbookId !== workbookId) {
    const error = new Error('Workbook mismatch');
    error.statusCode = 409;
    throw error;
  }
  const session = storage.createSession(store, { workbookId: requestedWorkbookId, userId });
  const bundle = storage.workbookBundle(store, requestedWorkbookId);
  broadcastPresence(requestedWorkbookId);
  sendJson(res, 201, {
    session: serializeSession(session),
    bundle,
  });
}));

app.get('/api/workbooks/:workbookId/state', safeAsync((req, res) => {
  const id = parseWorkbookId(req);
  const sessionId = req.query.sessionId;
  if (sessionId) storage.assertSessionValid(store, sessionId, id);
  const bundle = storage.workbookBundle(store, id);
  if (sessionId) {
    const session = storage.getSession(store, sessionId);
    if (session) storage.touchSession(store, sessionId, session.selection, session.sheetId);
  }
  sendJson(res, 200, bundle);
}));

app.get('/api/workbooks/:workbookId/revisions', safeAsync((req, res) => {
  const id = parseWorkbookId(req);
  sendJson(res, 200, { revisions: storage.listRevisions(store, id, 200) });
}));

app.get('/api/workbooks/:workbookId/revisions/:revisionId', safeAsync((req, res) => {
  const id = parseWorkbookId(req);
  const revisionId = Number(req.params.revisionId);
  if (!Number.isInteger(revisionId)) {
    const error = new Error('Revision id must be an integer');
    error.statusCode = 400;
    throw error;
  }
  sendJson(res, 200, storage.revisionPreview(store, id, revisionId));
}));

app.get('/api/workbooks/:workbookId/cells/:address/history', safeAsync((req, res) => {
  const id = parseWorkbookId(req);
  const address = String(req.params.address || '').toUpperCase();
  if (!core.isValidAddress(address)) {
    const error = new Error('Invalid cell address');
    error.statusCode = 400;
    throw error;
  }
  const workbook = storage.workbookBundle(store, id);
  const chosenSheetId = String(req.query.sheetId || workbook.snapshot.sheets[0].id);
  sendJson(res, 200, { address, sheetId: chosenSheetId, history: storage.getCellHistory(store, id, chosenSheetId, address) });
}));

app.post('/api/sessions/:sessionId/presence', safeAsync((req, res) => {
  const sessionId = req.params.sessionId;
  const { workbookId: requestedWorkbookId, selection, sheetId } = req.body || {};
  if (!requestedWorkbookId) {
    const error = new Error('workbookId is required');
    error.statusCode = 400;
    throw error;
  }
  const workbook = storage.workbookBundle(store, requestedWorkbookId);
  const normalizedSelection = normalizeSelectionPayload(selection, sheetId, workbook.snapshot);
  const session = storage.setSessionSelection(store, sessionId, requestedWorkbookId, normalizedSelection, normalizedSelection?.sheetId || workbook.snapshot.sheets[0].id);
  if (!session) {
    const error = new Error('Session is not active');
    error.statusCode = 410;
    throw error;
  }
  broadcastPresence(requestedWorkbookId);
  sendJson(res, 200, { session: serializeSession(session) });
}));

app.post('/api/sessions/:sessionId/heartbeat', safeAsync((req, res) => {
  const sessionId = req.params.sessionId;
  const { workbookId: requestedWorkbookId } = req.body || {};
  if (!requestedWorkbookId) {
    const error = new Error('workbookId is required');
    error.statusCode = 400;
    throw error;
  }
  const session = storage.assertSessionValid(store, sessionId, requestedWorkbookId);
  const refreshed = storage.touchSession(store, sessionId, session.selection, session.sheetId);
  if (!refreshed) {
    const error = new Error('Session is not active');
    error.statusCode = 410;
    throw error;
  }
  broadcastPresence(requestedWorkbookId);
  sendJson(res, 200, { session: serializeSession(refreshed) });
}));

app.post('/api/sessions/:sessionId/close', safeAsync((req, res) => {
  const sessionId = req.params.sessionId;
  const closed = storage.closeSession(store, sessionId);
  if (closed) broadcastPresence(closed.workbookId);
  sendJson(res, 200, { closed: Boolean(closed) });
}));

app.delete('/api/sessions/:sessionId', safeAsync((req, res) => {
  const sessionId = req.params.sessionId;
  const closed = storage.closeSession(store, sessionId);
  if (closed) broadcastPresence(closed.workbookId);
  sendJson(res, 200, { closed: Boolean(closed) });
}));

app.post('/api/workbooks/:workbookId/save', safeAsync((req, res) => {
  const id = parseWorkbookId(req);
  const { sessionId, baseRevisionId, snapshot, kind, message } = req.body || {};
  if (!sessionId || !snapshot) {
    const error = new Error('sessionId and snapshot are required');
    error.statusCode = 400;
    throw error;
  }
  const result = storage.saveWorkbook(store, {
    workbookId: id,
    sessionId,
    baseRevisionId: Number(baseRevisionId),
    snapshot,
    kind: kind || 'autosave',
    message: message || null,
  });
  const current = storage.getLatestRevisionRow(store, id);
  const preview = storage.revisionPreview(store, id, current.id);
  broadcastRevision(id, current, preview.snapshot);
  broadcastPresence(id);
  sendJson(res, 200, {
    status: result.status,
    revision: serializeRevisionSummary(result.revision, preview.snapshot),
    snapshot: preview.snapshot,
    conflicts: result.conflicts,
  });
}));

app.get('/api/stream', safeAsync((req, res) => {
  const sessionId = String(req.query.sessionId || '');
  if (!sessionId) {
    const error = new Error('sessionId is required');
    error.statusCode = 400;
    throw error;
  }
  const session = storage.getSession(store, sessionId);
  if (!session || session.closedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
    const error = new Error('Session is not active');
    error.statusCode = 410;
    throw error;
  }
  const bundle = storage.workbookBundle(store, session.workbookId);
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const client = { res, sessionId, workbookId: session.workbookId, dead: false };
  listStreamClients(session.workbookId).add(client);
  writeSse(res, 'state', bundle);
  writeSse(res, 'presence', {
    sessions: storage.listActiveSessions(store, session.workbookId),
    currentRevision: bundle.currentRevision.id,
  });
  const keepAlive = setInterval(() => {
    if (!client.dead) res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    client.dead = true;
    const set = listStreamClients(session.workbookId);
    set.delete(client);
  });
}));

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  sendError(res, err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GridForge listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGINT', () => {
  try {
    storage.closeStore(store);
  } finally {
    process.exit(0);
  }
});
