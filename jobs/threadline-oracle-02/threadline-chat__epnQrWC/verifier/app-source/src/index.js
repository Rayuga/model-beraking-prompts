import express from 'express';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { db, hashToken, insertAudit, passwordMatches } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const liveSessions = new Map();
const typing = new Map();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve('public')));

function nowIso() {
  return new Date().toISOString();
}

function userForRequest(req) {
  const authorization = String(req.get('Authorization') || '');
  const raw = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : (req.path === '/api/events' ? String(req.query.session || '') : '');
  if (!raw) return null;
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.color, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(raw), nowIso()) || null;
}

function requireAuth(req, res, next) {
  const user = userForRequest(req);
  if (!user) return res.status(401).json({ error: 'sign in required' });
  req.user = user;
  next();
}

function channelForUser(channelId, userId) {
  return db.prepare(`
    SELECT c.* FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    WHERE c.id = ? AND cm.user_id = ?
  `).get(channelId, userId);
}

function requireChannel(req, res, next) {
  const channel = channelForUser(req.params.id || req.params.channelId, req.user.id);
  if (!channel) return res.status(403).json({ error: 'channel access denied' });
  req.channel = channel;
  next();
}

function cleanContent(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim();
}

function validClientId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{8,120}$/.test(value);
}

function transaction(action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function messageRow(messageId) {
  return db.prepare(`
    SELECT m.*, u.name AS author_name, u.color AS author_color
    FROM messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.id = ?
  `).get(messageId);
}

function canSeeMessage(userId, messageId) {
  return db.prepare(`
    SELECT m.id FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id
    WHERE m.id = ? AND cm.user_id = ?
  `).get(messageId, userId);
}

function reactionGroups(messageId) {
  const rows = db.prepare(`
    SELECT r.emoji, r.user_id, u.name FROM reactions r
    JOIN users u ON u.id = r.user_id WHERE r.message_id = ? ORDER BY u.name
  `).all(messageId);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.emoji)) groups.set(row.emoji, { emoji: row.emoji, count: 0, users: [], userIds: [] });
    const group = groups.get(row.emoji);
    group.count += 1;
    group.users.push(row.name);
    group.userIds.push(row.user_id);
  }
  return [...groups.values()];
}

function serializeMessage(row) {
  if (!row) return null;
  const replies = row.parent_id == null ? db.prepare(`
    SELECT m.id, m.author_id, u.name AS author_name, m.created_at
    FROM messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.parent_id = ? AND m.deleted_at IS NULL ORDER BY m.id
  `).all(row.id) : [];
  const pin = db.prepare('SELECT pinned_by, created_at FROM pins WHERE message_id = ?').get(row.id);
  return {
    id: row.id,
    channelId: row.channel_id,
    parentId: row.parent_id,
    author: row.kind === 'integration'
      ? { id: null, name: row.integration_name, color: '#475569', integration: true }
      : { id: row.author_id, name: row.author_name, color: row.author_color, integration: false },
    content: row.deleted_at ? '' : row.content,
    kind: row.kind,
    version: row.version,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    reactions: row.deleted_at ? [] : reactionGroups(row.id),
    pinned: Boolean(pin),
    pinnedBy: pin?.pinned_by || null,
    replyCount: replies.length,
    replyParticipants: [...new Map(replies.map((reply) => [reply.author_id, { id: reply.author_id, name: reply.author_name }])).values()],
    latestReplyAt: replies.at(-1)?.created_at || null
  };
}

function mentionedUsers(content, channelId, actorId) {
  const members = db.prepare(`
    SELECT u.id, u.name FROM users u JOIN channel_members cm ON cm.user_id = u.id
    WHERE cm.channel_id = ?
  `).all(channelId);
  const lower = content.toLocaleLowerCase();
  return members.filter((user) => user.id !== actorId && lower.includes(`@${user.name.toLocaleLowerCase()}`));
}

function syncMentionNotifications(messageId) {
  const message = messageRow(messageId);
  db.prepare(`DELETE FROM notifications WHERE message_id = ? AND kind = 'mention'`).run(messageId);
  if (!message || message.deleted_at) return;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notifications (user_id, message_id, channel_id, kind, created_at)
    VALUES (?, ?, ?, 'mention', ?)
  `);
  for (const user of mentionedUsers(message.content, message.channel_id, message.author_id)) {
    insert.run(user.id, message.id, message.channel_id, message.created_at);
  }
}

function channelPayload(channel, userId) {
  const lastRead = db.prepare(`
    SELECT COALESCE(last_read_message_id, 0) AS id FROM read_positions WHERE user_id = ? AND channel_id = ?
  `).get(userId, channel.id)?.id || 0;
  const unread = db.prepare(`
    SELECT COUNT(*) AS count FROM messages
    WHERE channel_id = ? AND parent_id IS NULL AND deleted_at IS NULL AND id > ? AND COALESCE(author_id, '') <> ?
  `).get(channel.id, lastRead, userId).count;
  const mentions = db.prepare(`
    SELECT COUNT(*) AS count FROM notifications
    WHERE user_id = ? AND channel_id = ? AND kind = 'mention' AND read_at IS NULL
  `).get(userId, channel.id).count;
  const members = db.prepare(`
    SELECT u.id, u.name, u.role, u.color FROM users u
    JOIN channel_members cm ON cm.user_id = u.id WHERE cm.channel_id = ? ORDER BY u.name
  `).all(channel.id);
  const directUser = channel.kind === 'direct' ? members.find((member) => member.id !== userId) || null : null;
  return {
    id: channel.id,
    name: channel.name,
    displayName: directUser?.name || channel.name,
    description: channel.description,
    kind: channel.kind,
    isDirect: channel.kind === 'direct',
    directUser,
    isPrivate: Boolean(channel.is_private),
    unread,
    mentions,
    members
  };
}

function accessibleChannels(userId) {
  return db.prepare(`
    SELECT c.* FROM channels c JOIN channel_members cm ON cm.channel_id = c.id
    WHERE cm.user_id = ? ORDER BY CASE c.kind WHEN 'public' THEN 0 WHEN 'private' THEN 1 ELSE 2 END, c.name
  `).all(userId).map((channel) => channelPayload(channel, userId));
}

function notificationsFor(userId) {
  return db.prepare(`
    SELECT n.id, n.message_id, n.channel_id, n.kind, n.created_at, n.read_at,
           c.name AS channel_name, m.content, m.parent_id, u.name AS author_name
    FROM notifications n JOIN channels c ON c.id = n.channel_id
    JOIN messages m ON m.id = n.message_id LEFT JOIN users u ON u.id = m.author_id
    WHERE n.user_id = ? AND m.deleted_at IS NULL ORDER BY n.id DESC LIMIT 50
  `).all(userId).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    kind: row.kind,
    content: row.content,
    authorName: row.author_name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    readAt: row.read_at
  }));
}

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function userCanAccessChannel(userId, channelId) {
  return Boolean(channelForUser(channelId, userId));
}

function broadcastChannel(channelId, event, payload) {
  for (const session of liveSessions.values()) {
    if (userCanAccessChannel(session.user.id, channelId)) sendEvent(session.res, event, payload);
  }
}

function broadcastUser(userId, event, payload) {
  for (const session of liveSessions.values()) {
    if (session.user.id === userId) sendEvent(session.res, event, payload);
  }
}

function presencePayload(channelId) {
  return [...liveSessions.entries()]
    .filter(([, session]) => session.channelId === channelId)
    .map(([viewId, session]) => ({
      viewId,
      user: { id: session.user.id, name: session.user.name, color: session.user.color },
      connectedAt: session.connectedAt
    }))
    .sort((a, b) => a.connectedAt.localeCompare(b.connectedAt));
}

function broadcastPresence(channelId) {
  if (!channelId) return;
  broadcastChannel(channelId, 'presence', { channelId, views: presencePayload(channelId) });
}

function broadcastWorkspaceChange(channelId, type, messageId, extra = {}) {
  const message = messageId ? serializeMessage(messageRow(messageId)) : null;
  broadcastChannel(channelId, 'change', { type, channelId, message, ...extra });
}

function createMessage({ channelId, parentId = null, authorId = null, integrationName = null, content, kind = 'user', clientId = null, createdAt = nowIso() }) {
  const result = db.prepare(`
    INSERT INTO messages (channel_id, parent_id, author_id, integration_name, content, kind, client_id, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(channelId, parentId, authorId, integrationName, content, kind, clientId, createdAt);
  const id = Number(result.lastInsertRowid);
  insertAudit('message', id, 'created', authorId, null, createdAt);
  syncMentionNotifications(id);
  return id;
}

app.get('/health', (_req, res) => res.json({ ok: true, app: 'threadline-chat' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.get('/api/auth/users', (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role, color FROM users ORDER BY name').all();
  res.json({ users });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !passwordMatches(password, user.password_hash)) {
    return res.status(401).json({ error: 'email or password is incorrect' });
  }
  const token = randomBytes(32).toString('base64url');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_AGE_MS).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), user.id, createdAt, expiresAt);
  res.json({
    sessionToken: token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, color: user.color }
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.user.token_hash);
  res.json({ ok: true });
});

app.get('/api/bootstrap', requireAuth, (req, res) => {
  const workspace = db.prepare('SELECT id, name FROM workspaces LIMIT 1').get();
  const channels = accessibleChannels(req.user.id);
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, color: req.user.color },
    workspace,
    channels,
    notifications: notificationsFor(req.user.id)
  });
});

app.post('/api/direct-messages', requireAuth, (req, res) => {
  const targetUserId = String(req.body?.userId || '').trim();
  if (!targetUserId || targetUserId === req.user.id) return res.status(400).json({ error: 'choose another workspace member' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
  if (!target) return res.status(400).json({ error: 'unknown workspace member' });
  const [userLow, userHigh] = [req.user.id, targetUserId].sort();
  let direct = db.prepare(`
    SELECT c.* FROM direct_conversations d JOIN channels c ON c.id = d.channel_id
    WHERE d.user_low = ? AND d.user_high = ?
  `).get(userLow, userHigh);
  let created = false;
  if (!direct) {
    const channelId = `dm-${userLow}-${userHigh}`;
    const at = nowIso();
    try {
      transaction(() => {
        db.prepare(`
          INSERT INTO channels (id, workspace_id, name, description, kind, is_private, created_at)
          SELECT ?, id, ?, 'Private conversation', 'direct', 1, ? FROM workspaces LIMIT 1
        `).run(channelId, `${userLow}-${userHigh}`, at);
        const addMember = db.prepare('INSERT INTO channel_members (channel_id, user_id, added_at) VALUES (?, ?, ?)');
        addMember.run(channelId, userLow, at);
        addMember.run(channelId, userHigh, at);
        db.prepare('INSERT INTO direct_conversations (channel_id, user_low, user_high) VALUES (?, ?, ?)')
          .run(channelId, userLow, userHigh);
        insertAudit('direct-conversation', channelId, 'created', req.user.id, null, at);
      });
      created = true;
    } catch (error) {
      direct = db.prepare(`
        SELECT c.* FROM direct_conversations d JOIN channels c ON c.id = d.channel_id
        WHERE d.user_low = ? AND d.user_high = ?
      `).get(userLow, userHigh);
      if (!direct) throw error;
    }
    direct ||= db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
  }
  const payload = channelPayload(direct, req.user.id);
  broadcastUser(targetUserId, 'membership', { channelId: direct.id, action: 'direct-message-created' });
  res.status(created ? 201 : 200).json({ channel: payload, created });
});

app.get('/api/channels/:id/messages', requireAuth, requireChannel, (req, res) => {
  const before = Number(req.query.before || Number.MAX_SAFE_INTEGER);
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
  const rows = db.prepare(`
    SELECT m.*, u.name AS author_name, u.color AS author_color
    FROM messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.channel_id = ? AND m.parent_id IS NULL AND m.id < ?
    ORDER BY m.id DESC LIMIT ?
  `).all(req.channel.id, Number.isSafeInteger(before) ? before : Number.MAX_SAFE_INTEGER, limit).reverse();
  const oldest = rows[0]?.id || null;
  const hasMore = oldest ? Boolean(db.prepare(`
    SELECT 1 FROM messages WHERE channel_id = ? AND parent_id IS NULL AND id < ? LIMIT 1
  `).get(req.channel.id, oldest)) : false;
  res.json({ messages: rows.map(serializeMessage), hasMore });
});

app.post('/api/channels/:id/messages', requireAuth, requireChannel, (req, res) => {
  const content = cleanContent(req.body?.content);
  const clientId = req.body?.clientId;
  if (!content || content.length > 8000) return res.status(400).json({ error: 'message content required' });
  if (!validClientId(clientId)) return res.status(400).json({ error: 'valid clientId required' });
  const existing = db.prepare('SELECT id, channel_id, parent_id FROM messages WHERE author_id = ? AND client_id = ?').get(req.user.id, clientId);
  if (existing) {
    if (existing.channel_id !== req.channel.id || existing.parent_id != null) {
      return res.status(409).json({ error: 'clientId belongs to a different message target' });
    }
    return res.json({ message: serializeMessage(messageRow(existing.id)), duplicate: true });
  }
  let id;
  try {
    id = transaction(() => createMessage({ channelId: req.channel.id, authorId: req.user.id, content, clientId }));
  } catch (error) {
    const duplicate = db.prepare('SELECT id, channel_id, parent_id FROM messages WHERE author_id = ? AND client_id = ?').get(req.user.id, clientId);
    if (duplicate && duplicate.channel_id === req.channel.id && duplicate.parent_id == null) {
      return res.json({ message: serializeMessage(messageRow(duplicate.id)), duplicate: true });
    }
    if (duplicate) return res.status(409).json({ error: 'clientId belongs to a different message target' });
    throw error;
  }
  broadcastWorkspaceChange(req.channel.id, 'message-created', id);
  for (const user of mentionedUsers(content, req.channel.id, req.user.id)) {
    broadcastUser(user.id, 'notifications', { notifications: notificationsFor(user.id) });
  }
  res.status(201).json({ message: serializeMessage(messageRow(id)) });
});

app.get('/api/messages/:id/replies', requireAuth, (req, res) => {
  const parent = messageRow(Number(req.params.id));
  if (!parent || parent.parent_id != null || !canSeeMessage(req.user.id, parent.id)) return res.status(404).json({ error: 'thread not found' });
  const rows = db.prepare(`
    SELECT m.*, u.name AS author_name, u.color AS author_color
    FROM messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.parent_id = ? ORDER BY m.id
  `).all(parent.id);
  res.json({ parent: serializeMessage(parent), replies: rows.map(serializeMessage) });
});

app.post('/api/messages/:id/replies', requireAuth, (req, res) => {
  const parent = messageRow(Number(req.params.id));
  if (!parent || parent.parent_id != null || parent.deleted_at || !channelForUser(parent.channel_id, req.user.id)) {
    return res.status(404).json({ error: 'thread not found' });
  }
  const content = cleanContent(req.body?.content);
  const clientId = req.body?.clientId;
  if (!content || content.length > 8000) return res.status(400).json({ error: 'reply content required' });
  if (!validClientId(clientId)) return res.status(400).json({ error: 'valid clientId required' });
  const existing = db.prepare('SELECT id, channel_id, parent_id FROM messages WHERE author_id = ? AND client_id = ?').get(req.user.id, clientId);
  if (existing) {
    if (existing.channel_id !== parent.channel_id || existing.parent_id !== parent.id) {
      return res.status(409).json({ error: 'clientId belongs to a different thread' });
    }
    return res.json({
      message: serializeMessage(messageRow(existing.id)),
      parent: serializeMessage(messageRow(parent.id)),
      duplicate: true
    });
  }
  let id;
  try {
    id = transaction(() => createMessage({ channelId: parent.channel_id, parentId: parent.id, authorId: req.user.id, content, clientId }));
  } catch (error) {
    const duplicate = db.prepare('SELECT id, channel_id, parent_id FROM messages WHERE author_id = ? AND client_id = ?').get(req.user.id, clientId);
    if (duplicate && duplicate.channel_id === parent.channel_id && duplicate.parent_id === parent.id) {
      return res.json({ message: serializeMessage(messageRow(duplicate.id)), parent: serializeMessage(messageRow(parent.id)), duplicate: true });
    }
    if (duplicate) return res.status(409).json({ error: 'clientId belongs to a different thread' });
    throw error;
  }
  broadcastWorkspaceChange(parent.channel_id, 'reply-created', id, { parent: serializeMessage(messageRow(parent.id)) });
  for (const user of mentionedUsers(content, parent.channel_id, req.user.id)) {
    broadcastUser(user.id, 'notifications', { notifications: notificationsFor(user.id) });
  }
  res.status(201).json({ message: serializeMessage(messageRow(id)), parent: serializeMessage(messageRow(parent.id)) });
});

app.patch('/api/messages/:id', requireAuth, (req, res) => {
  const row = messageRow(Number(req.params.id));
  if (!row || !canSeeMessage(req.user.id, row.id)) return res.status(404).json({ error: 'message not found' });
  if (row.deleted_at) return res.status(409).json({ error: 'message is deleted' });
  if (row.kind !== 'user' || row.author_id !== req.user.id) return res.status(403).json({ error: 'only the author can edit this message' });
  if (!Number.isInteger(req.body?.version)) return res.status(400).json({ error: 'version required' });
  if (req.body.version !== row.version) return res.status(409).json({ error: 'message changed', currentVersion: row.version });
  const content = cleanContent(req.body?.content);
  if (!content || content.length > 8000) return res.status(400).json({ error: 'message content required' });
  if (content === row.content) return res.json({ message: serializeMessage(row), unchanged: true });
  const editedAt = nowIso();
  transaction(() => {
    const changed = db.prepare(`
      UPDATE messages SET content = ?, version = version + 1, edited_at = ? WHERE id = ? AND version = ?
    `).run(content, editedAt, row.id, row.version);
    if (changed.changes !== 1) throw Object.assign(new Error('stale message'), { status: 409 });
    insertAudit('message', row.id, 'edited', req.user.id, { content: row.content, version: row.version }, editedAt);
    syncMentionNotifications(row.id);
  });
  broadcastWorkspaceChange(row.channel_id, 'message-edited', row.id, row.parent_id ? { parent: serializeMessage(messageRow(row.parent_id)) } : {});
  for (const user of db.prepare('SELECT id FROM users').all()) broadcastUser(user.id, 'notifications', { notifications: notificationsFor(user.id) });
  res.json({ message: serializeMessage(messageRow(row.id)) });
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
  const row = messageRow(Number(req.params.id));
  if (!row || !canSeeMessage(req.user.id, row.id)) return res.status(404).json({ error: 'message not found' });
  if (row.deleted_at) return res.json({ message: serializeMessage(row), unchanged: true });
  const allowed = row.author_id === req.user.id || ['moderator', 'admin'].includes(req.user.role);
  if (!allowed) return res.status(403).json({ error: 'not allowed to delete this message' });
  if (!Number.isInteger(req.body?.version)) return res.status(400).json({ error: 'version required' });
  if (req.body.version !== row.version) return res.status(409).json({ error: 'message changed', currentVersion: row.version });
  const deletedAt = nowIso();
  transaction(() => {
    const changed = db.prepare(`
      UPDATE messages SET content = '', version = version + 1, deleted_at = ? WHERE id = ? AND version = ?
    `).run(deletedAt, row.id, row.version);
    if (changed.changes !== 1) throw Object.assign(new Error('stale message'), { status: 409 });
    db.prepare('DELETE FROM pins WHERE message_id = ?').run(row.id);
    db.prepare('DELETE FROM reactions WHERE message_id = ?').run(row.id);
    db.prepare('DELETE FROM notifications WHERE message_id = ?').run(row.id);
    insertAudit('message', row.id, 'deleted', req.user.id, { content: row.content, version: row.version }, deletedAt);
  });
  broadcastWorkspaceChange(row.channel_id, 'message-deleted', row.id, row.parent_id ? { parent: serializeMessage(messageRow(row.parent_id)) } : {});
  res.json({ message: serializeMessage(messageRow(row.id)) });
});

app.post('/api/messages/:id/reactions', requireAuth, (req, res) => {
  const row = messageRow(Number(req.params.id));
  if (!row || row.deleted_at || !canSeeMessage(req.user.id, row.id)) return res.status(404).json({ error: 'message not found' });
  const emoji = String(req.body?.emoji || '').trim();
  if (!/^[a-z0-9-]{2,32}$/.test(emoji)) return res.status(400).json({ error: 'invalid emoji' });
  const existing = db.prepare('SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(row.id, req.user.id, emoji);
  const desired = typeof req.body?.active === 'boolean' ? req.body.active : !existing;
  const at = nowIso();
  transaction(() => {
    if (existing && !desired) {
      db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(row.id, req.user.id, emoji);
      insertAudit('reaction', `${row.id}:${req.user.id}:${emoji}`, 'removed', req.user.id, null, at);
    } else if (!existing && desired) {
      db.prepare('INSERT OR IGNORE INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)').run(row.id, req.user.id, emoji, at);
      insertAudit('reaction', `${row.id}:${req.user.id}:${emoji}`, 'added', req.user.id, null, at);
    }
  });
  if (Boolean(existing) !== desired) broadcastWorkspaceChange(row.channel_id, 'reaction-changed', row.id);
  res.json({ message: serializeMessage(messageRow(row.id)), active: desired, unchanged: Boolean(existing) === desired });
});

app.post('/api/messages/:id/pin', requireAuth, (req, res) => {
  const row = messageRow(Number(req.params.id));
  if (!row || row.deleted_at || !canSeeMessage(req.user.id, row.id)) return res.status(404).json({ error: 'message not found' });
  if (!['moderator', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'moderator permission required' });
  const existing = db.prepare('SELECT 1 FROM pins WHERE message_id = ?').get(row.id);
  const desired = typeof req.body?.pinned === 'boolean' ? req.body.pinned : !existing;
  const at = nowIso();
  transaction(() => {
    if (existing && !desired) {
      db.prepare('DELETE FROM pins WHERE message_id = ?').run(row.id);
      insertAudit('pin', row.id, 'removed', req.user.id, null, at);
    } else if (!existing && desired) {
      db.prepare('INSERT INTO pins (channel_id, message_id, pinned_by, created_at) VALUES (?, ?, ?, ?)').run(row.channel_id, row.id, req.user.id, at);
      insertAudit('pin', row.id, 'added', req.user.id, null, at);
    }
  });
  if (Boolean(existing) !== desired) broadcastWorkspaceChange(row.channel_id, 'pin-changed', row.id);
  res.json({ message: serializeMessage(messageRow(row.id)), pinned: desired, unchanged: Boolean(existing) === desired });
});

app.get('/api/channels/:id/pins', requireAuth, requireChannel, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name AS author_name, u.color AS author_color
    FROM pins p JOIN messages m ON m.id = p.message_id LEFT JOIN users u ON u.id = m.author_id
    WHERE p.channel_id = ? AND m.deleted_at IS NULL ORDER BY p.created_at DESC
  `).all(req.channel.id);
  res.json({ messages: rows.map(serializeMessage) });
});

app.post('/api/channels/:id/read', requireAuth, requireChannel, (req, res) => {
  const messageId = Number(req.body?.messageId || 0);
  const message = messageId ? db.prepare('SELECT id FROM messages WHERE id = ? AND channel_id = ?').get(messageId, req.channel.id) : null;
  if (messageId && !message) return res.status(400).json({ error: 'message does not belong to channel' });
  const existing = db.prepare('SELECT last_read_message_id FROM read_positions WHERE user_id = ? AND channel_id = ?').get(req.user.id, req.channel.id);
  const nextId = Math.max(Number(existing?.last_read_message_id || 0), messageId);
  const at = nowIso();
  db.prepare(`
    INSERT INTO read_positions (user_id, channel_id, last_read_message_id, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, channel_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at
  `).run(req.user.id, req.channel.id, nextId || null, at);
  db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND channel_id = ? AND message_id <= ?`)
    .run(at, req.user.id, req.channel.id, nextId);
  const channels = accessibleChannels(req.user.id);
  const notifications = notificationsFor(req.user.id);
  broadcastUser(req.user.id, 'read-state', { channels, notifications });
  res.json({ channels, notifications });
});

app.get('/api/search', requireAuth, (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ results: [] });
  const channelId = String(req.query.channelId || '').trim();
  if (channelId && !channelForUser(channelId, req.user.id)) return res.status(403).json({ error: 'channel access denied' });
  const rows = db.prepare(`
    SELECT m.*, u.name AS author_name, u.color AS author_color, c.name AS channel_name
    FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id
    JOIN channels c ON c.id = m.channel_id LEFT JOIN users u ON u.id = m.author_id
    WHERE cm.user_id = ? AND m.deleted_at IS NULL AND m.content LIKE ?
      AND (? = '' OR m.channel_id = ?)
    ORDER BY m.id DESC LIMIT 50
  `).all(req.user.id, `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`, channelId, channelId);
  res.json({ results: rows.map((row) => ({ ...serializeMessage(row), channelName: row.channel_name })) });
});

app.get('/api/messages/:id/history', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!canSeeMessage(req.user.id, id)) return res.status(404).json({ error: 'message not found' });
  const rows = db.prepare(`
    SELECT a.id, a.action, a.actor_id, u.name AS actor_name, a.previous_json, a.created_at
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.entity_type = 'message' AND a.entity_id = ? ORDER BY a.id DESC
  `).all(String(id));
  res.json({ history: rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_name,
    previous: row.previous_json ? JSON.parse(row.previous_json) : null,
    createdAt: row.created_at
  })) });
});

app.post('/api/channels/:id/members', requireAuth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'channel not found' });
  if (channel.kind === 'direct') return res.status(400).json({ error: 'direct-message participants cannot be changed' });
  if (req.user.role !== 'admin' || !channelForUser(channel.id, req.user.id)) return res.status(403).json({ error: 'admin permission required' });
  const userId = String(req.body?.userId || '');
  const action = String(req.body?.action || '');
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return res.status(400).json({ error: 'unknown user' });
  if (!['add', 'remove'].includes(action)) return res.status(400).json({ error: 'action must be add or remove' });
  if (action === 'remove' && userId === req.user.id) return res.status(400).json({ error: 'cannot remove your active admin session' });
  const at = nowIso();
  transaction(() => {
    if (action === 'add') db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id, added_at) VALUES (?, ?, ?)').run(channel.id, userId, at);
    else db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(channel.id, userId);
    insertAudit('membership', `${channel.id}:${userId}`, action === 'add' ? 'added' : 'removed', req.user.id, null, at);
  });
  if (action === 'remove') {
    for (const [viewId, session] of liveSessions) {
      if (session.user.id !== userId || session.channelId !== channel.id) continue;
      session.channelId = null;
      const typingState = typing.get(`${viewId}:${channel.id}`);
      if (typingState?.timer) clearTimeout(typingState.timer);
      typing.delete(`${viewId}:${channel.id}`);
    }
  }
  broadcastUser(userId, 'membership', { channelId: channel.id, action });
  broadcastPresence(channel.id);
  res.json({ channel: channelPayload(channel, req.user.id) });
});

app.get('/api/events', requireAuth, (req, res) => {
  const viewId = String(req.query.viewId || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(viewId)) return res.status(400).json({ error: 'valid viewId required' });
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('retry: 1000\n\n');
  const old = liveSessions.get(viewId);
  if (old) old.res.end();
  liveSessions.set(viewId, { res, user: req.user, channelId: null, connectedAt: nowIso() });
  sendEvent(res, 'ready', { viewId });
  req.on('close', () => {
    const current = liveSessions.get(viewId);
    if (current?.res !== res) return;
    const channelId = current.channelId;
    liveSessions.delete(viewId);
    broadcastPresence(channelId);
  });
});

app.post('/api/presence', requireAuth, (req, res) => {
  const viewId = String(req.body?.viewId || '');
  const channelId = req.body?.channelId == null ? null : String(req.body.channelId);
  const session = liveSessions.get(viewId);
  if (!session || session.user.id !== req.user.id) return res.status(404).json({ error: 'active view not found' });
  if (channelId && !channelForUser(channelId, req.user.id)) return res.status(403).json({ error: 'channel access denied' });
  const previous = session.channelId;
  session.channelId = channelId;
  broadcastPresence(previous);
  broadcastPresence(channelId);
  res.json({ views: channelId ? presencePayload(channelId) : [] });
});

app.post('/api/typing', requireAuth, (req, res) => {
  const channelId = String(req.body?.channelId || '');
  const viewId = String(req.body?.viewId || '');
  const active = Boolean(req.body?.active);
  const session = liveSessions.get(viewId);
  if (!session || session.user.id !== req.user.id || session.channelId !== channelId || !channelForUser(channelId, req.user.id)) {
    return res.status(403).json({ error: 'active channel view required' });
  }
  const key = `${viewId}:${channelId}`;
  const existing = typing.get(key);
  if (existing?.timer) clearTimeout(existing.timer);
  if (!active) {
    typing.delete(key);
  } else {
    const timer = setTimeout(() => {
      typing.delete(key);
      broadcastChannel(channelId, 'typing', { channelId, users: currentTyping(channelId) });
    }, 3500);
    timer.unref();
    typing.set(key, { viewId, channelId, user: req.user, timer });
  }
  const users = currentTyping(channelId);
  broadcastChannel(channelId, 'typing', { channelId, users });
  res.json({ users });
});

function currentTyping(channelId) {
  return [...new Map([...typing.values()].filter((item) => item.channelId === channelId).map((item) => [item.user.id, {
    id: item.user.id,
    name: item.user.name,
    color: item.user.color
  }])).values()];
}

app.post('/api/hooks/:token', (req, res) => {
  const hook = db.prepare(`SELECT * FROM webhooks WHERE token_hash = ?`).get(hashToken(req.params.token));
  if (!hook || !hook.enabled) return res.status(404).json({ error: 'webhook not found' });
  const eventId = String(req.get('Idempotency-Key') || req.body?.eventId || '').trim();
  const content = cleanContent(req.body?.text);
  if (!validClientId(eventId)) return res.status(400).json({ error: 'valid event id required' });
  if (!content || content.length > 8000) return res.status(400).json({ error: 'message text required' });
  if (req.body?.channelId && req.body.channelId !== hook.channel_id) return res.status(403).json({ error: 'webhook channel mismatch' });
  const previous = db.prepare('SELECT message_id FROM webhook_deliveries WHERE webhook_id = ? AND event_id = ?').get(hook.id, eventId);
  if (previous) return res.json({ message: serializeMessage(messageRow(previous.message_id)), duplicate: true });
  let id;
  try {
    id = transaction(() => {
      const messageId = createMessage({ channelId: hook.channel_id, integrationName: hook.name, content, kind: 'integration', clientId: null });
      db.prepare('INSERT INTO webhook_deliveries (webhook_id, event_id, message_id, received_at) VALUES (?, ?, ?, ?)')
        .run(hook.id, eventId, messageId, nowIso());
      return messageId;
    });
  } catch (error) {
    const duplicate = db.prepare('SELECT message_id FROM webhook_deliveries WHERE webhook_id = ? AND event_id = ?').get(hook.id, eventId);
    if (duplicate) return res.json({ message: serializeMessage(messageRow(duplicate.message_id)), duplicate: true });
    throw error;
  }
  broadcastWorkspaceChange(hook.channel_id, 'message-created', id);
  res.status(201).json({ message: serializeMessage(messageRow(id)) });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'internal server error' });
});

app.listen(PORT, HOST, () => console.log(`Threadline listening on http://${HOST}:${PORT}`));

setInterval(() => {
  for (const session of liveSessions.values()) session.res.write(': heartbeat\n\n');
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}, 20000).unref();
