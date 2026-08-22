import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'threadline.db');
const SEED_PATH = process.env.SEED_PATH || '/assets/threadline_seed.json';

fs.mkdirSync(DATA_DIR, { recursive: true });
if (process.env.RESET_SEED === '1') {
  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('member', 'moderator', 'admin')),
    color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    is_private INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id TEXT NOT NULL REFERENCES channels(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    added_at TEXT NOT NULL,
    PRIMARY KEY (channel_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    parent_id INTEGER REFERENCES messages(id),
    author_id TEXT REFERENCES users(id),
    integration_name TEXT,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'integration')),
    client_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    edited_at TEXT,
    deleted_at TEXT,
    UNIQUE(author_id, client_id)
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, parent_id, id);
  CREATE TABLE IF NOT EXISTS reactions (
    message_id INTEGER NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
  );
  CREATE TABLE IF NOT EXISTS pins (
    channel_id TEXT NOT NULL REFERENCES channels(id),
    message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id),
    pinned_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (channel_id, message_id)
  );
  CREATE TABLE IF NOT EXISTS read_positions (
    user_id TEXT NOT NULL REFERENCES users(id),
    channel_id TEXT NOT NULL REFERENCES channels(id),
    last_read_message_id INTEGER,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    message_id INTEGER NOT NULL REFERENCES messages(id),
    channel_id TEXT NOT NULL REFERENCES channels(id),
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    UNIQUE(user_id, message_id, kind)
  );
  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    webhook_id TEXT NOT NULL REFERENCES webhooks(id),
    event_id TEXT NOT NULL,
    message_id INTEGER NOT NULL REFERENCES messages(id),
    received_at TEXT NOT NULL,
    PRIMARY KEY (webhook_id, event_id)
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    previous_json TEXT,
    created_at TEXT NOT NULL
  );
`);

export function hashToken(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const digest = scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${digest}`;
}

export function passwordMatches(password, encoded) {
  const [salt, expectedHex] = String(encoded).split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(String(password), salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readSeed() {
  const candidates = [SEED_PATH, path.resolve('../../environment/assets/threadline_seed.json')];
  for (const candidate of candidates) {
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      // Try the next development or container path.
    }
  }
  throw new Error(`Unable to read Threadline seed from ${candidates.join(' or ')}`);
}

function insertAudit(entityType, entityId, action, actorId, previous, createdAt) {
  db.prepare(`
    INSERT INTO audit_log (entity_type, entity_id, action, actor_id, previous_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, String(entityId), action, actorId || null, previous == null ? null : JSON.stringify(previous), createdAt);
}

function seedIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count;
  if (count > 0) return;
  const seed = readSeed();
  const now = '2026-08-20T08:00:00.000Z';
  const messageIds = new Map();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO workspaces (id, name) VALUES (?, ?)').run(seed.workspace.id, seed.workspace.name);
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, color) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const user of seed.users) {
      insertUser.run(user.id, user.name, user.email.toLowerCase(), passwordHash(user.password), user.role, user.color);
    }

    const insertChannel = db.prepare(`
      INSERT INTO channels (id, workspace_id, name, description, is_private, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMember = db.prepare(`
      INSERT INTO channel_members (channel_id, user_id, added_at) VALUES (?, ?, ?)
    `);
    for (const channel of seed.channels) {
      insertChannel.run(channel.id, seed.workspace.id, channel.name, channel.description, channel.isPrivate ? 1 : 0, now);
      for (const userId of channel.members) insertMember.run(channel.id, userId, now);
    }

    const insertMessage = db.prepare(`
      INSERT INTO messages (channel_id, parent_id, author_id, content, kind, client_id, version, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, ?)
    `);
    for (const message of seed.messages.filter((item) => !item.parentSeedId)) {
      const result = insertMessage.run(message.channelId, null, message.authorId, message.content, `seed-${message.seedId}`, message.createdAt);
      messageIds.set(message.seedId, Number(result.lastInsertRowid));
    }
    for (const message of seed.messages.filter((item) => item.parentSeedId)) {
      const result = insertMessage.run(message.channelId, messageIds.get(message.parentSeedId), message.authorId, message.content, `seed-${message.seedId}`, message.createdAt);
      messageIds.set(message.seedId, Number(result.lastInsertRowid));
    }

    for (const message of seed.messages) {
      insertAudit('message', messageIds.get(message.seedId), 'created', message.authorId, null, message.createdAt);
    }
    for (const message of seed.messages.filter((item) => item.pinnedBy)) {
      db.prepare('INSERT INTO pins (channel_id, message_id, pinned_by, created_at) VALUES (?, ?, ?, ?)')
        .run(message.channelId, messageIds.get(message.seedId), message.pinnedBy, message.createdAt);
    }
    for (const reaction of seed.reactions || []) {
      db.prepare('INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)')
        .run(messageIds.get(reaction.messageSeedId), reaction.userId, reaction.emoji, now);
    }
    const insertNotification = db.prepare(`
      INSERT OR IGNORE INTO notifications (user_id, message_id, channel_id, kind, created_at)
      VALUES (?, ?, ?, 'mention', ?)
    `);
    for (const message of seed.messages) {
      const lower = message.content.toLocaleLowerCase();
      const channel = seed.channels.find((item) => item.id === message.channelId);
      for (const user of seed.users) {
        if (user.id !== message.authorId && channel?.members.includes(user.id) && lower.includes(`@${user.name.toLocaleLowerCase()}`)) {
          insertNotification.run(user.id, messageIds.get(message.seedId), message.channelId, message.createdAt);
        }
      }
    }
    for (const position of seed.readPositions || []) {
      db.prepare(`
        INSERT INTO read_positions (user_id, channel_id, last_read_message_id, updated_at) VALUES (?, ?, ?, ?)
      `).run(position.userId, position.channelId, messageIds.get(position.messageSeedId), now);
    }
    for (const hook of seed.webhooks || []) {
      db.prepare('INSERT INTO webhooks (id, name, token_hash, channel_id, enabled) VALUES (?, ?, ?, ?, ?)')
        .run(hook.id, hook.name, hashToken(hook.token), hook.channelId, hook.enabled ? 1 : 0);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

seedIfNeeded();

export { insertAudit };
