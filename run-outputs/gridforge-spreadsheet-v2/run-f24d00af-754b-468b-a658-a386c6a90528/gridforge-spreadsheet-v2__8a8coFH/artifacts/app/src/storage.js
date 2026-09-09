const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const core = require('./core');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalizeSnapshot(snapshot) {
  const validated = core.validateSnapshot(snapshot);
  return {
    workbook: { id: validated.workbook.id, title: validated.workbook.title },
    sheets: validated.sheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      cells: Object.fromEntries(Object.keys(sheet.cells).sort().map((key) => [key, sheet.cells[key]])),
    })),
  };
}

function snapshotKey(snapshot) {
  return JSON.stringify(canonicalizeSnapshot(snapshot));
}

function rowsToSnapshot(row) {
  if (!row) return null;
  return canonicalizeSnapshot(JSON.parse(row.snapshot_json));
}

function workbookMeta(snapshot) {
  return {
    id: snapshot.workbook.id,
    title: snapshot.workbook.title,
    sheets: snapshot.sheets.map((sheet) => ({ id: sheet.id, name: sheet.name })),
  };
}

function validateIdentityMatches(expected, actual) {
  if (!expected || !actual) throw new Error('Workbook snapshot is missing');
  if (expected.workbook.id !== actual.workbook.id) throw new Error('Workbook identity mismatch');
  if (expected.workbook.title !== actual.workbook.title) throw new Error('Workbook title mismatch');
  if (expected.sheets.length !== actual.sheets.length) throw new Error('Sheet count mismatch');
  for (let i = 0; i < expected.sheets.length; i += 1) {
    const a = expected.sheets[i];
    const b = actual.sheets[i];
    if (a.id !== b.id || a.name !== b.name) throw new Error('Sheet identity mismatch');
  }
}

function openDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_revision_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workbook_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_revision_id INTEGER,
      author_session_id TEXT,
      author_user_id TEXT,
      author_name TEXT,
      snapshot_json TEXT NOT NULL,
      message TEXT,
      FOREIGN KEY(workbook_id) REFERENCES workbooks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_revisions_workbook_created ON revisions(workbook_id, created_at, id);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workbook_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      closed_at TEXT,
      selection_json TEXT NOT NULL DEFAULT '{}',
      sheet_id TEXT,
      FOREIGN KEY(workbook_id) REFERENCES workbooks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_workbook ON sessions(workbook_id, closed_at, expires_at);
  `);

  return db;
}

function initializeSeed(db, seedPath) {
  const seed = readJson(seedPath);
  const users = Array.isArray(seed.users) ? seed.users : [];
  const workbook = canonicalizeSnapshot({
    workbook: { id: seed.workbook.id, title: seed.workbook.title },
    sheets: seed.workbook.sheets,
  });

  const workbooksRow = db.prepare('SELECT id FROM workbooks WHERE id = ?').get(workbook.workbook.id);
  if (workbooksRow) {
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)');
    for (const user of users) insertUser.run(user.id, user.name);
    return;
  }

  const createdAt = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)');
    for (const user of users) insertUser.run(user.id, user.name);

    db.prepare(`
      INSERT INTO workbooks (id, title, current_revision_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workbook.workbook.id, workbook.workbook.title, 1, createdAt, createdAt);

    db.prepare(`
      INSERT INTO revisions (
        id, workbook_id, created_at, kind, base_revision_id, author_session_id,
        author_user_id, author_name, snapshot_json, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      workbook.workbook.id,
      createdAt,
      'seed',
      null,
      null,
      null,
      null,
      JSON.stringify(workbook),
      'Seed import'
    );

    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('seed-imported', createdAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function openStore(dbPath, seedPath) {
  const db = openDatabase(dbPath);
  initializeSeed(db, seedPath);
  return { db };
}

function closeStore(store) {
  if (store && store.db) store.db.close();
}

function getUsers(store) {
  return store.db.prepare('SELECT id, name FROM users ORDER BY name').all();
}

function getWorkbookRow(store, workbookId) {
  return store.db.prepare('SELECT * FROM workbooks WHERE id = ?').get(workbookId) || null;
}

function getRevisionRow(store, revisionId) {
  return store.db.prepare('SELECT * FROM revisions WHERE id = ?').get(revisionId) || null;
}

function getRevisionSnapshot(store, revisionId) {
  const row = getRevisionRow(store, revisionId);
  if (!row) return null;
  return rowsToSnapshot(row);
}

function getLatestRevisionRow(store, workbookId) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) return null;
  return getRevisionRow(store, workbook.current_revision_id);
}

function listRevisions(store, workbookId, limit = 50) {
  const rows = store.db.prepare(`
    SELECT * FROM revisions
    WHERE workbook_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(workbookId, limit);
  const users = new Map(getUsers(store).map((user) => [user.id, user.name]));
  return rows.map((row) => ({
    id: row.id,
    workbookId: row.workbook_id,
    createdAt: row.created_at,
    kind: row.kind,
    baseRevisionId: row.base_revision_id,
    authorSessionId: row.author_session_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name || users.get(row.author_user_id) || null,
    message: row.message,
  }));
}

function loadRevisionSummariesWithSnapshots(store, workbookId) {
  const rows = store.db.prepare(`
    SELECT * FROM revisions
    WHERE workbook_id = ?
    ORDER BY id ASC
  `).all(workbookId);
  const users = new Map(getUsers(store).map((user) => [user.id, user.name]));
  return rows.map((row) => ({
    id: row.id,
    workbookId: row.workbook_id,
    createdAt: row.created_at,
    kind: row.kind,
    baseRevisionId: row.base_revision_id,
    authorSessionId: row.author_session_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name || users.get(row.author_user_id) || null,
    message: row.message,
    snapshot: rowsToSnapshot(row),
  }));
}

function listActiveSessions(store, workbookId) {
  const rows = store.db.prepare(`
    SELECT * FROM sessions
    WHERE workbook_id = ?
      AND closed_at IS NULL
      AND datetime(expires_at) > datetime('now')
    ORDER BY last_seen_at DESC, created_at DESC
  `).all(workbookId);
  return rows.map((row) => ({
    id: row.id,
    workbookId: row.workbook_id,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    selection: JSON.parse(row.selection_json || '{}'),
    sheetId: row.sheet_id,
  }));
}

function getSession(store, sessionId) {
  const row = store.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!row) return null;
  return {
    id: row.id,
    workbookId: row.workbook_id,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    selection: JSON.parse(row.selection_json || '{}'),
    sheetId: row.sheet_id,
  };
}

function assertSessionValid(store, sessionId, workbookId, userId) {
  const session = getSession(store, sessionId);
  if (!session) {
    const error = new Error('Unknown session');
    error.statusCode = 404;
    throw error;
  }
  if (session.workbookId !== workbookId) {
    const error = new Error('Session workbook mismatch');
    error.statusCode = 409;
    throw error;
  }
  if (userId && session.userId !== userId) {
    const error = new Error('Session user mismatch');
    error.statusCode = 409;
    throw error;
  }
  if (session.closedAt) {
    const error = new Error('Session closed');
    error.statusCode = 410;
    throw error;
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    const error = new Error('Session expired');
    error.statusCode = 410;
    throw error;
  }
  return session;
}

function createSession(store, { workbookId, userId }) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) {
    const error = new Error('Unknown workbook');
    error.statusCode = 404;
    throw error;
  }
  const user = store.db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user) {
    const error = new Error('Unknown user');
    error.statusCode = 404;
    throw error;
  }
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  store.db.prepare(`
    INSERT INTO sessions (
      id, workbook_id, user_id, user_name, created_at, last_seen_at, expires_at, selection_json, sheet_id, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(id, workbookId, user.id, user.name, createdAt, createdAt, expiresAt, '{}', null);
  return getSession(store, id);
}

function touchSession(store, sessionId, selection = null, sheetId = null) {
  const session = getSession(store, sessionId);
  if (!session) return null;
  if (session.closedAt) return null;
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  store.db.prepare(`
    UPDATE sessions
    SET last_seen_at = ?, expires_at = ?, selection_json = ?, sheet_id = ?
    WHERE id = ?
  `).run(now, expiresAt, JSON.stringify(selection || {}), sheetId, sessionId);
  return getSession(store, sessionId);
}

function closeSession(store, sessionId) {
  const session = getSession(store, sessionId);
  if (!session) return null;
  const closedAt = nowIso();
  store.db.prepare('UPDATE sessions SET closed_at = ? WHERE id = ?').run(closedAt, sessionId);
  return getSession(store, sessionId);
}

function workbookBundle(store, workbookId) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) {
    const error = new Error('Unknown workbook');
    error.statusCode = 404;
    throw error;
  }
  const currentRevision = getRevisionRow(store, workbook.current_revision_id);
  if (!currentRevision) {
    throw new Error('Workbook has no current revision');
  }
  const snapshot = rowsToSnapshot(currentRevision);
  const revisions = listRevisions(store, workbookId, 50);
  const sessions = listActiveSessions(store, workbookId);
  return {
    workbook: snapshot.workbook,
    snapshot,
    currentRevision: {
      id: currentRevision.id,
      createdAt: currentRevision.created_at,
      kind: currentRevision.kind,
      baseRevisionId: currentRevision.base_revision_id,
      authorSessionId: currentRevision.author_session_id,
      authorUserId: currentRevision.author_user_id,
      authorName: currentRevision.author_name,
      message: currentRevision.message,
    },
    revisions,
    sessions,
    users: getUsers(store),
  };
}

function revisionPreview(store, workbookId, revisionId) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) {
    const error = new Error('Unknown workbook');
    error.statusCode = 404;
    throw error;
  }
  const row = getRevisionRow(store, revisionId);
  if (!row || row.workbook_id !== workbookId) {
    const error = new Error('Unknown revision');
    error.statusCode = 404;
    throw error;
  }
  return {
    revision: {
      id: row.id,
      workbookId: row.workbook_id,
      createdAt: row.created_at,
      kind: row.kind,
      baseRevisionId: row.base_revision_id,
      authorSessionId: row.author_session_id,
      authorUserId: row.author_user_id,
      authorName: row.author_name,
      message: row.message,
    },
    snapshot: rowsToSnapshot(row),
  };
}

function getCellHistory(store, workbookId, sheetId, address) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) {
    const error = new Error('Unknown workbook');
    error.statusCode = 404;
    throw error;
  }
  const revisions = loadRevisionSummariesWithSnapshots(store, workbookId);
  return core.cellHistory(revisions, sheetId, address.toUpperCase());
}

function updateWorkbookCurrentRevision(store, workbookId, revisionId) {
  store.db.prepare('UPDATE workbooks SET current_revision_id = ?, updated_at = ? WHERE id = ?').run(revisionId, nowIso(), workbookId);
}

function insertRevision(store, { workbookId, kind, baseRevisionId, authorSessionId, authorUserId, authorName, snapshot, message }) {
  const createdAt = nowIso();
  const canonical = canonicalizeSnapshot(snapshot);
  const result = store.db.prepare(`
    INSERT INTO revisions (
      workbook_id, created_at, kind, base_revision_id, author_session_id, author_user_id,
      author_name, snapshot_json, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workbookId,
    createdAt,
    kind,
    baseRevisionId == null ? null : baseRevisionId,
    authorSessionId || null,
    authorUserId || null,
    authorName || null,
    JSON.stringify(canonical),
    message || null
  );
  const revisionId = Number(result.lastInsertRowid);
  updateWorkbookCurrentRevision(store, workbookId, revisionId);
  return getRevisionRow(store, revisionId);
}

function compareSnapshots(base, next) {
  return snapshotKey(base) === snapshotKey(next);
}

function saveWorkbook(store, { workbookId, sessionId, baseRevisionId, snapshot, kind = 'autosave', message = null }) {
  const workbook = getWorkbookRow(store, workbookId);
  if (!workbook) {
    const error = new Error('Unknown workbook');
    error.statusCode = 404;
    throw error;
  }
  const session = assertSessionValid(store, sessionId, workbookId);
  const canonicalIncoming = canonicalizeSnapshot(snapshot);
  const currentRevisionRow = getRevisionRow(store, workbook.current_revision_id);
  const currentSnapshot = rowsToSnapshot(currentRevisionRow);
  validateIdentityMatches(currentSnapshot, canonicalIncoming);
  if (!Number.isInteger(baseRevisionId)) {
    const error = new Error('Base revision must be an integer');
    error.statusCode = 400;
    throw error;
  }

  store.db.exec('BEGIN IMMEDIATE');
  try {
    const refreshedWorkbook = getWorkbookRow(store, workbookId);
    const refreshedCurrent = getRevisionRow(store, refreshedWorkbook.current_revision_id);
    const refreshedCurrentSnapshot = rowsToSnapshot(refreshedCurrent);
    let result = { status: 'unchanged', revision: refreshedCurrent, conflicts: [] };

    if (baseRevisionId === refreshedCurrent.id) {
      if (!compareSnapshots(refreshedCurrentSnapshot, canonicalIncoming)) {
        const inserted = insertRevision(store, {
          workbookId,
          kind,
          baseRevisionId,
          authorSessionId: session.id,
          authorUserId: session.userId,
          authorName: session.userName,
          snapshot: canonicalIncoming,
          message,
        });
        result = { status: 'saved', revision: inserted, conflicts: [] };
      }
    } else {
      const baseRevisionRow = getRevisionRow(store, baseRevisionId);
      if (!baseRevisionRow || baseRevisionRow.workbook_id !== workbookId) {
        const error = new Error('Base revision is invalid');
        error.statusCode = 409;
        throw error;
      }
      const baseSnapshot = rowsToSnapshot(baseRevisionRow);
      const mergeResult = core.mergeSnapshots(baseSnapshot, refreshedCurrentSnapshot, canonicalIncoming);
      if (mergeResult.conflicts.length) {
        const error = new Error('Save conflict');
        error.statusCode = 409;
        error.details = mergeResult.conflicts;
        throw error;
      }
      if (!compareSnapshots(refreshedCurrentSnapshot, mergeResult.merged)) {
        const inserted = insertRevision(store, {
          workbookId,
          kind,
          baseRevisionId,
          authorSessionId: session.id,
          authorUserId: session.userId,
          authorName: session.userName,
          snapshot: mergeResult.merged,
          message,
        });
        result = { status: 'saved', revision: inserted, conflicts: [] };
      }
    }

    store.db.exec('COMMIT');
    return result;
  } catch (error) {
    store.db.exec('ROLLBACK');
    throw error;
  }
}

function setSessionSelection(store, sessionId, workbookId, selection, sheetId) {
  const session = assertSessionValid(store, sessionId, workbookId);
  return touchSession(store, session.id, selection, sheetId);
}

module.exports = {
  openStore,
  closeStore,
  getUsers,
  getWorkbookRow,
  getRevisionRow,
  getRevisionSnapshot,
  getLatestRevisionRow,
  listRevisions,
  loadRevisionSummariesWithSnapshots,
  listActiveSessions,
  getSession,
  assertSessionValid,
  createSession,
  touchSession,
  closeSession,
  workbookBundle,
  revisionPreview,
  getCellHistory,
  insertRevision,
  saveWorkbook,
  setSessionSelection,
  compareSnapshots,
  canonicalizeSnapshot,
};
